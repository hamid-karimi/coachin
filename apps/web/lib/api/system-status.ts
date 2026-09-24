import type { components } from "./schema";

type ReadyBody = components["schemas"]["ReadyBody"];

export type ServiceCheck = { name: string; healthy: boolean; detail: string };

export type SystemStatus = {
  healthy: boolean;
  checks: ServiceCheck[];
};

/**
 * Turns the API's readiness payload (or its absence, when the API itself is
 * unreachable) into what the status page renders.
 */
export function toSystemStatus(body: ReadyBody | undefined): SystemStatus {
  if (!body) {
    return {
      healthy: false,
      checks: [{ name: "api", healthy: false, detail: "API unreachable" }],
    };
  }
  const checks = Object.entries(body.checks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, detail]) => ({ name, healthy: detail === "ok", detail }));
  return {
    healthy: body.status === "ok",
    checks: [{ name: "api", healthy: true, detail: "ok" }, ...checks],
  };
}
