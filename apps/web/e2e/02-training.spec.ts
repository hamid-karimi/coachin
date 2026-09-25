import { expect, test } from "@playwright/test";
import { newAthlete, toast } from "./support";

// QA journey 2 — AI training plans (the fake Claude in compose.e2e.yaml answers).
test("generate a muscle-building plan, see it, archive it", async ({ page }) => {
  await newAthlete(page, "Pia Plans");
  await page.goto("/training/new?kind=hypertrophy");
  await page.selectOption("#equipment", "home");
  await page.selectOption("#weeksTotal", "8");
  await page.getByRole("button", { name: "Generate my plan" }).click();
  await expect(toast(page, "Your plan is ready.")).toBeVisible({ timeout: 30_000 });
  await page.waitForURL("**/training");
  await expect(page.getByRole("button", { name: "Archive plan" })).toBeVisible();

  await page.getByRole("button", { name: "Archive plan" }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(toast(page, "Plan archived.")).toBeVisible();
  await expect(page.getByText("Create a plan")).toBeVisible();
});

test("a race less than 4 weeks away is refused", async ({ page }) => {
  await newAthlete(page, "Sol Soon");
  const soon = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  await page.goto("/training/new?kind=race");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Train for a race" }).click();
  await page.fill("#race_date", soon);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Generate my plan" }).click();
  await expect(toast(page, "Race must be at least 4 weeks away for a useful plan")).toBeVisible();
});
