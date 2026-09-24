import { describe, expect, it } from "vitest";
import { toSystemStatus } from "./system-status";

describe("toSystemStatus", () => {
  it("reports the API as down when there is no readiness payload", () => {
    expect(toSystemStatus(undefined)).toEqual({
      healthy: false,
      checks: [{ name: "api", healthy: false, detail: "API unreachable" }],
    });
  });

  it("lists the API first, then every dependency by name", () => {
    const status = toSystemStatus({
      status: "unavailable",
      checks: { storage: "ok", database: "connection refused" },
    });
    expect(status.healthy).toBe(false);
    expect(status.checks).toEqual([
      { name: "api", healthy: true, detail: "ok" },
      { name: "database", healthy: false, detail: "connection refused" },
      { name: "storage", healthy: true, detail: "ok" },
    ]);
  });

  it("is healthy when every dependency is ok", () => {
    const status = toSystemStatus({ status: "ok", checks: { database: "ok" } });
    expect(status.healthy).toBe(true);
  });
});
