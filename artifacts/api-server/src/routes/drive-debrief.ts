import { Router, type IRouter } from "express";
import {
  CreateDriveDebriefBody,
  CreateDriveDebriefResponse,
} from "@workspace/api-zod";
import { createRequestLimiter } from "../lib/request-windows";

type DebriefInput = ReturnType<typeof CreateDriveDebriefBody.parse>;

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

const router: IRouter = Router();
const REQUEST_WINDOW_MS = 60_000;
const REQUEST_LIMIT = 10;

const topLevelKeys = new Set([
  "jurisdiction",
  "contentPackVersion",
  "durationMinutes",
  "distanceMiles",
  "night",
  "skills",
  "events",
  "weakTopics",
]);
const eventKeys = new Set(["kind", "title", "detail"]);
const topicKeys = new Set(["topic", "mastery"]);

function hasOnlyKeys(value: unknown, allowed: Set<string>): boolean {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key)),
  );
}

export function containsOnlyDebriefFields(value: unknown): boolean {
  if (!hasOnlyKeys(value, topLevelKeys)) return false;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.events) || !input.events.every((event) => hasOnlyKeys(event, eventKeys))) return false;
  if (!Array.isArray(input.weakTopics) || !input.weakTopics.every((topic) => hasOnlyKeys(topic, topicKeys))) return false;
  return true;
}

const requestLimiter = createRequestLimiter(REQUEST_LIMIT, REQUEST_WINDOW_MS);

export function allowDebriefRequest(clientId: string, now = Date.now()): boolean {
  return requestLimiter.allow(clientId, now);
}

export function buildDebriefPrompt(input: DebriefInput): string {
  return JSON.stringify({
    jurisdiction: input.jurisdiction,
    contentPackVersion: input.contentPackVersion,
    drive: {
      durationMinutes: input.durationMinutes,
      distanceMiles: input.distanceMiles,
      night: input.night,
      skills: input.skills,
    },
    observedCoachEvents: input.events,
    weakKnowledgeTopics: input.weakTopics,
  });
}

function jurisdictionLabel(jurisdiction: DebriefInput["jurisdiction"]): string {
  return {
    "US-CA": "California (US-CA)",
    "US-TX": "Texas (US-TX)",
    "US-FL": "Florida (US-FL)",
    "US-NY": "New York (US-NY)",
    "US-OH": "Ohio (US-OH)",
    "US-IL": "Illinois (US-IL)",
  }[jurisdiction];
}
export const approvedPackVersions: Record<string, string> = { "US-CA": "us-ca-2026.09.1", "US-TX": "us-tx-2026.09.1", "US-FL": "us-fl-2026.09.2", "US-NY": "us-ny-2026.09.1", "US-OH": "us-oh-2026.09.1", "US-IL": "us-il-2026.09.1" };

async function requestDebrief(input: DebriefInput) {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Managed AI integration is not configured");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      max_completion_tokens: 900,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coastwise_drive_debrief",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["headline", "win", "improvement", "nextStep", "parentPrompt"],
            properties: {
              headline: { type: "string", maxLength: 120 },
              win: { type: "string", maxLength: 500 },
              improvement: { type: "string", maxLength: 500 },
              nextStep: { type: "string", maxLength: 500 },
              parentPrompt: { type: "string", maxLength: 300 },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: [
            `You are Coastwise, a calm teen driving practice coach for ${jurisdictionLabel(input.jurisdiction)}.`,
            "Create a concise post-drive debrief for a teen and supervising adult.",
            "Use only the supplied summary. Never claim to have watched video, observed road conditions, verified safe driving, or diagnosed a driver.",
            "Coach events are prompts the app delivered, not proof the driver made a mistake.",
            "Be specific but cautious. Praise participation or preparation when evidence is limited.",
            "Recommend exactly one low-pressure improvement and one supervised next step.",
            "Do not give legal conclusions, emergency advice, scores, grades, or guarantees.",
            "Do not mention AI, the prompt, GPS coordinates, video, or private data.",
            "The parentPrompt must be one open-ended question a supervising adult can ask while parked after the drive.",
          ].join(" "),
        },
        { role: "user", content: buildDebriefPrompt(input) },
      ],
    }),
  });

  const payload = await response.json() as OpenAIChatResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `AI service returned ${response.status}`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI service returned an empty debrief");
  return CreateDriveDebriefResponse.parse(JSON.parse(content));
}

router.post("/ai/drive-debrief", async (req, res): Promise<void> => {
  const clientId = req.ip || req.socket.remoteAddress || "unknown";
  if (!allowDebriefRequest(clientId)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many debrief requests. Wait a minute and try again." });
    return;
  }
  if (!containsOnlyDebriefFields(req.body)) {
    res.status(400).json({ error: "Only a drive summary can be used for an AI debrief." });
    return;
  }
  const parsed = CreateDriveDebriefBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The drive summary is incomplete or invalid." });
    return;
  }
  if (approvedPackVersions[parsed.data.jurisdiction] !== parsed.data.contentPackVersion) {
    res.status(400).json({ error: "That jurisdiction is not an approved current coaching pack." }); return;
  }
  try {
    res.json(await requestDebrief(parsed.data));
  } catch (error) {
    req.log.error({ error }, "AI drive debrief failed");
    res.status(502).json({ error: "Your drive is saved, but the AI debrief is unavailable right now." });
  }
});

export default router;