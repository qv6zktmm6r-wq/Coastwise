import { Router, type IRouter } from "express";
import {
  CreateNextDrivePlanBody,
  CreateNextDrivePlanResponse,
} from "@workspace/api-zod";

type PlanInput = ReturnType<typeof CreateNextDrivePlanBody.parse>;
type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

const router: IRouter = Router();
const requestWindows = new Map<string, { startedAt: number; count: number }>();
const REQUEST_WINDOW_MS = 60_000;
const REQUEST_LIMIT = 10;
const SAFETY_GUIDANCE = "Practice only with an attentive, qualified supervising adult. Review the plan while parked, choose conditions that match the driver’s current ability, and stop or simplify the drive whenever conditions feel unsafe.";
const topLevelKeys = new Set(["jurisdiction", "contentPackVersion", "weakTopics", "unfinishedMissions", "recentDrives"]);
const topicKeys = new Set(["topic", "mastery"]);
const missionKeys = new Set(["title", "category", "minutes"]);
const driveKeys = new Set(["durationMinutes", "night", "skills", "debriefImprovement", "debriefNextStep"]);

function hasOnlyKeys(value: unknown, allowed: Set<string>): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key)));
}

export function containsOnlyNextDrivePlanFields(value: unknown): boolean {
  if (!hasOnlyKeys(value, topLevelKeys)) return false;
  const input = value as Record<string, unknown>;
  return Array.isArray(input.weakTopics)
    && input.weakTopics.every((item) => hasOnlyKeys(item, topicKeys))
    && Array.isArray(input.unfinishedMissions)
    && input.unfinishedMissions.every((item) => hasOnlyKeys(item, missionKeys))
    && Array.isArray(input.recentDrives)
    && input.recentDrives.every((item) => hasOnlyKeys(item, driveKeys));
}

export function allowNextDrivePlanRequest(clientId: string, now = Date.now()): boolean {
  const current = requestWindows.get(clientId);
  if (!current || now - current.startedAt >= REQUEST_WINDOW_MS) {
    requestWindows.set(clientId, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= REQUEST_LIMIT;
}

export function buildNextDrivePlanPrompt(input: PlanInput): string {
  return JSON.stringify({
    jurisdiction: input.jurisdiction,
    contentPackVersion: input.contentPackVersion,
    weakKnowledgeTopics: input.weakTopics,
    unfinishedPracticeMissions: input.unfinishedMissions,
    recentDriveSummaries: input.recentDrives,
  });
}

function jurisdictionLabel(jurisdiction: PlanInput["jurisdiction"]): string {
  return {
    "US-CA": "California (US-CA)",
    "US-TX": "Texas (US-TX)",
    "US-FL": "Florida (US-FL)",
    "US-NY": "New York (US-NY)",
    "US-OH": "Ohio (US-OH)",
    "US-IL": "Illinois (US-IL)",
  }[jurisdiction];
}
const approvedPackVersions: Record<string, string> = { "US-CA": "us-ca-2026.09.1", "US-TX": "us-tx-2026.09.1", "US-FL": "us-fl-2026.09.1" };

async function requestNextDrivePlan(input: PlanInput) {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Managed AI integration is not configured");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      max_completion_tokens: 900,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coastwise_next_drive_plan",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["skillFocus", "durationMinutes", "parentPrompt"],
            properties: {
              skillFocus: { type: "string", maxLength: 160 },
              durationMinutes: { type: "integer", minimum: 10, maximum: 60 },
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
            "Create one short, age-appropriate supervised practice plan using only the supplied progress summaries.",
            "Choose exactly one skill focus and a realistic duration between 10 and 60 minutes.",
            "The parent prompt must be one calm sentence the adult can say before starting or while safely parked.",
            "Do not claim to know the teen, observe driving, verify safety, diagnose ability, or give legal conclusions.",
            "Do not mention AI, private data, routes, coordinates, video, identity, notes, answers, or scores.",
          ].join(" "),
        },
        { role: "user", content: buildNextDrivePlanPrompt(input) },
      ],
    }),
  });
  const payload = await response.json() as OpenAIChatResponse;
  if (!response.ok) throw new Error(payload.error?.message ?? `AI service returned ${response.status}`);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI service returned an empty plan");
  return CreateNextDrivePlanResponse.parse({
    ...JSON.parse(content),
    safetyGuidance: SAFETY_GUIDANCE,
    createdAt: new Date().toISOString(),
  });
}

router.post("/ai/next-drive-plan", async (req, res): Promise<void> => {
  const clientId = req.ip || req.socket.remoteAddress || "unknown";
  if (!allowNextDrivePlanRequest(clientId)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many plan requests. Wait a minute and try again." });
    return;
  }
  if (!containsOnlyNextDrivePlanFields(req.body)) {
    res.status(400).json({ error: "Only bounded progress summaries can be used for a next-drive plan." });
    return;
  }
  const parsed = CreateNextDrivePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The progress summary is incomplete or invalid." });
    return;
  }
  if (approvedPackVersions[parsed.data.jurisdiction] !== parsed.data.contentPackVersion) {
    res.status(400).json({ error: "That jurisdiction is not an approved current coaching pack." }); return;
  }
  try {
    res.json(await requestNextDrivePlan(parsed.data));
  } catch (error) {
    req.log.error({ error }, "AI next-drive plan failed");
    res.status(502).json({ error: "Your saved plan is still available, but a new plan cannot be generated right now." });
  }
});

export default router;