import { expect, test } from "@playwright/test";
import { newAthlete, toast } from "./support";

// QA journey 1 — "My week": fixed sessions and weekly targets.
test("add a fixed session and a weekly target, then remove them", async ({ page }) => {
  await newAthlete(page, "Wes Week");
  await page.goto("/onboarding");

  await page.getByRole("button", { name: "Add to my week" }).click();
  await page.getByRole("button", { name: /Yoga/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Pick at least one day")).toBeVisible();
  await page.getByRole("button", { name: "Sunday" }).click();
  await page.fill("#schedule-time", "09:15");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(toast(page, "1 session added to your schedule.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Yoga on Sunday" })).toBeVisible();

  await page.getByRole("button", { name: "Add to my week" }).click();
  await page.getByRole("button", { name: /Swimming/ }).click();
  await page.getByRole("radio", { name: "Weekly target" }).click();
  await page.getByRole("button", { name: "Increase sessions per week" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(toast(page, "Weekly target saved.")).toBeVisible();
  await expect(page.getByText("0/3 this week")).toBeVisible();

  await page.getByRole("button", { name: "Remove Swimming weekly target" }).click();
  await expect(toast(page, "Weekly target removed.")).toBeVisible();
  await page.getByRole("button", { name: "Remove Yoga on Sunday" }).click();
  await expect(page.getByRole("button", { name: "Remove Yoga on Sunday" })).toHaveCount(0);
});
