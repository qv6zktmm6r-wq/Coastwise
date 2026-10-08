import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreatePracticeRouteBody,
  CreatePracticeRouteResponse,
} from "@workspace/api-zod";
import { createRequestLimiter } from "../lib/request-windows";

type OsrmStep = {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: Array<[number, number]> };
  legs: Array<{ steps: OsrmStep[] }>;
};

type OsrmResponse = {
  code: string;
  routes?: OsrmRoute[];
  message?: string;
};

const router: IRouter = Router();
const ROUTE_REQUEST_WINDOW_MS = 60_000;
const ROUTE_REQUEST_LIMIT = 20;

const requestLimiter = createRequestLimiter(ROUTE_REQUEST_LIMIT, ROUTE_REQUEST_WINDOW_MS);

export function allowRouteRequest(clientId: string, now = Date.now()): boolean {
  return requestLimiter.allow(clientId, now);
}

function describeStep(step: OsrmStep): string {
  const road = step.name ? ` onto ${step.name}` : "";
  const modifier = step.maneuver.modifier?.replaceAll("_", " ");
  if (step.maneuver.type === "depart") return `Begin driving${road}.`;
  if (step.maneuver.type === "arrive") return "You have returned to the starting area.";
  if (step.maneuver.type === "roundabout") return `Enter the roundabout${road}.`;
  if (step.maneuver.type === "merge") return `Merge ${modifier ?? ""}${road}.`.replace(/\s+/g, " ");
  if (step.maneuver.type === "fork") return `Keep ${modifier ?? "ahead"}${road}.`;
  if (modifier) return `${modifier[0].toUpperCase()}${modifier.slice(1)}${road}.`;
  return `Continue${road}.`;
}

async function requestRoute(points: Array<[number, number]>): Promise<OsrmRoute> {
  const coordinates = points.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&continue_straight=false`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Coastwise-Driver-Coach/1.0" },
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`OSRM returned ${response.status}`);
      const transient = response.status === 408 || response.status === 429 || response.status >= 500;
      if (transient && attempt === 0) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      throw error;
    }
    let payload: OsrmResponse;
    try {
      payload = await response.json() as OsrmResponse;
    } catch {
      throw new Error("Route service returned an invalid response");
    }
    const route = payload.routes?.[0];
    if (payload.code !== "Ok" || !route) throw new Error(payload.message ?? "No route returned");
    return route;
  }
  throw lastError instanceof Error ? lastError : new Error("Route service unavailable");
}

router.post("/practice-routes", async (req, res): Promise<void> => {
  const clientId = req.ip || req.socket.remoteAddress || "unknown";
  if (!allowRouteRequest(clientId)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many route requests. Wait a minute and try again." });
    return;
  }
  const parsed = CreatePracticeRouteBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.issues }, "Invalid practice route request");
    res.status(400).json({ error: "Choose a valid location, duration, difficulty, and at least one skill." });
    return;
  }

  const { latitude, longitude, durationMinutes, difficulty, skills } = parsed.data;
  const radiusKm = Math.max(0.9, durationMinutes * 0.047);
  const latOffset = radiusKm / 111;
  const lonOffset = radiusKm / (111 * Math.max(0.25, Math.cos(latitude * Math.PI / 180)));

  try {
    const start: [number, number] = [longitude, latitude];
    const wantsManeuvers = skills.includes("turns") || skills.includes("intersections");
    const wantsFlow = skills.includes("lane-changes") || skills.includes("speed-control");
    const complexity = difficulty === "beginner" ? 0 : difficulty === "intermediate" ? 1 : 2;
    const flowPoints: Array<[number, number]> = [
      [longitude + lonOffset * 1.15, latitude + latOffset * 0.05],
      [longitude - lonOffset * 0.95, latitude + latOffset * 0.55],
    ];
    const maneuverPoints: Array<[number, number]> = [
      [longitude + lonOffset * 0.7, latitude + latOffset * 0.15],
      [longitude + lonOffset * 0.15, latitude + latOffset * 0.85],
      [longitude - lonOffset * 0.75, latitude + latOffset * 0.45],
      [longitude - lonOffset * 0.25, latitude - latOffset * 0.25],
      [longitude + lonOffset * 0.45, latitude + latOffset * 0.55],
    ];
    const points: Array<[number, number]> = [start];
    if (wantsFlow) points.push(...flowPoints);
    if (wantsManeuvers || !wantsFlow) points.push(...maneuverPoints.slice(0, 3 + complexity));
    if (skills.includes("parking")) {
      const parkingScale = difficulty === "beginner" ? 0.12 : 0.18;
      points.push(
        [longitude + lonOffset * parkingScale, latitude + latOffset * parkingScale],
        [longitude - lonOffset * parkingScale, latitude + latOffset * parkingScale],
      );
    }
    points.push(start);
    let route = await requestRoute(points);
    const targetSeconds = durationMinutes * 60;
    let calibratedPoints = points;
    for (let attempt = 0; attempt < 2 && Math.abs(route.duration - targetSeconds) / targetSeconds > 0.2; attempt += 1) {
      const scale = Math.min(1.8, Math.max(0.65, targetSeconds / Math.max(1, route.duration)));
      calibratedPoints = calibratedPoints.map(([lon, lat], index) => index === 0 || index === calibratedPoints.length - 1
        ? start
        : [longitude + (lon - longitude) * scale, latitude + (lat - latitude) * scale] as [number, number]);
      route = await requestRoute(calibratedPoints);
    }

    const allLegSteps = route.legs.flatMap((leg, legIndex) => leg.steps
      .filter((step, stepIndex) => !(legIndex > 0 && stepIndex === 0 && step.maneuver.type === "depart"))
      .filter((step) => !(legIndex < route.legs.length - 1 && step.maneuver.type === "arrive"))
      .map((step) => ({ step, legIndex })));
    const routeSteps = allLegSteps.map(({ step, legIndex }, index) => {
      const isFinalArrival = step.maneuver.type === "arrive" && legIndex === route.legs.length - 1;
      const isTurn = step.maneuver.type === "turn" || Boolean(step.maneuver.modifier?.includes("turn"));
      let coachingSkill: string | null = null;
      if (isFinalArrival && skills.includes("parking")) coachingSkill = "parking";
      else if (isTurn && skills.includes("turns")) coachingSkill = "turns";
      else if (isTurn && skills.includes("intersections")) coachingSkill = "intersections";
      else if (["merge", "fork", "on ramp", "off ramp"].includes(step.maneuver.type) && skills.includes("lane-changes")) coachingSkill = "lane-changes";
      else if (step.distance > 450 && skills.includes("speed-control")) coachingSkill = "speed-control";
      else if (skills.includes("lane-changes") && index === 1) coachingSkill = "lane-changes";
      return {
        instruction: describeStep(step),
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        maneuverType: step.maneuver.type,
        coachingSkill,
        coordinate: { latitude: step.maneuver.location[1], longitude: step.maneuver.location[0] },
      };
    });
    for (const skill of skills) {
      if (routeSteps.some((step) => step.coachingSkill === skill)) continue;
      let candidate = -1;
      if (skill === "parking") candidate = routeSteps.length - 1;
      else if (skill === "turns" || skill === "intersections") candidate = routeSteps.findIndex((step) => step.maneuverType === "turn");
      else if (skill === "speed-control") candidate = routeSteps.reduce((best, step, index) => step.distanceMeters > (routeSteps[best]?.distanceMeters ?? -1) ? index : best, 0);
      else if (skill === "lane-changes") candidate = routeSteps.findIndex((step, index) => index > 0 && step.maneuverType !== "arrive");
      if (candidate >= 0) routeSteps[candidate].coachingSkill = skill;
    }
    const result = CreatePracticeRouteResponse.parse({
      id: randomUUID(),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
      steps: routeSteps,
      skills,
    });
    res.json(result);
  } catch (error) {
    req.log.error({ error }, "Directions service failed");
    res.status(502).json({ error: "A practice route could not be created right now. Please try again before departure." });
  }
});

export default router;