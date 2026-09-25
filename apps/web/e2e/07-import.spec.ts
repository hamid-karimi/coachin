import { expect, test } from "@playwright/test";
import { newAthlete, toast } from "./support";

/** A 30-minute run (~5.3 km) that started daysAgo at 07:00 UTC, as GPX. */
function gpxRun(daysAgo: number) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysAgo);
  start.setUTCHours(7, 0, 0, 0);
  const points = Array.from({ length: 61 }, (_, i) => {
    const at = new Date(start.getTime() + i * 30_000).toISOString().replace(".000", "");
    return `<trkpt lat="${(35.7 + i * 0.0008).toFixed(6)}" lon="51.4"><time>${at}</time></trkpt>`;
  });
  const xml = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${points.join("")}</trkseg></trk></gpx>`;
  return { name: `run-${daysAgo}.gpx`, mimeType: "application/gpx+xml", buffer: Buffer.from(xml) };
}

// QA journey 7 — watch-file import (Profile → Body).
test("import a recent run once; a run older than 14 days is skipped", async ({ page }) => {
  await newAthlete(page, "Ivy Import");
  await page.goto("/profile?tab=body");
  await page.locator("input[type=file][aria-label='Watch files']").setInputFiles([gpxRun(2), gpxRun(20)]);
  await expect(toast(page, "parsed")).toBeVisible();
  await page.getByRole("button", { name: /Log 2 runs/ }).click();
  await expect(toast(page, "Imported 1 run")).toContainText("1 skipped");

  await page.locator("input[type=file][aria-label='Watch files']").setInputFiles([gpxRun(2)]);
  await expect(toast(page, "parsed")).toBeVisible();
  await page.getByRole("button", { name: /Log 1 run/ }).click();
  await expect(toast(page, "Those days already have a logged run")).toBeVisible();
});
