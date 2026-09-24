import { serverApi } from "@/lib/api/server";
import { toSystemStatus, type SystemStatus } from "@/lib/api/system-status";

/** Reads API readiness for the status page; never throws. */
export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const api = await serverApi();
    const { data, error } = await api.GET("/readyz");
    return toSystemStatus(data ?? error);
  } catch {
    return toSystemStatus(undefined);
  }
}
