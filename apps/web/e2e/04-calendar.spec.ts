import { expect, test } from "@playwright/test";
import { api, newAthlete } from "./support";

// QA journey 4 — the calendar week: routine sessions on real dates, week paging.
test("this week shows the routine; paging moves by a week", async ({ page }) => {
  await newAthlete(page, "Cal Endar");
  await api(page, "POST", "/routine/schedules", { sportTypeId: 1, days: [new Date().getDay()] });

  await page.goto("/calendar");
  await expect(page.getByText("· this week")).toBeVisible();
  await expect(page.getByText("Running").first()).toBeVisible();

  await page.getByRole("link", { name: "Next" }).click();
  await page.waitForURL(/\/calendar\?week=/);
  await expect(page.getByText("· this week")).toHaveCount(0);
  await page.getByRole("link", { name: "Prev" }).click();
  await expect(page.getByText("· this week")).toBeVisible();
});
