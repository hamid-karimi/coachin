import { expect, test } from "@playwright/test";
import { newAthlete, toast } from "./support";

// QA journey 9 — goals and measurements (a goal pays +200 once).
test("a weight goal starts from the first reading and pays when reached", async ({ page }) => {
  await newAthlete(page, "Gus Goals");
  await page.goto("/profile");
  await page.getByLabel("New goal").selectOption("weight");
  await page.getByLabel("Target").fill("75");
  await page.getByRole("button", { name: "Set goal" }).click();
  await expect(toast(page, "Goal created")).toBeVisible();

  await page.goto("/profile?tab=progress");
  await page.getByLabel("Weight (kg)").fill("80");
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(toast(page, "Measurement logged.")).toBeVisible();
  await page.getByLabel("Weight (kg)").fill("74.6");
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(toast(page, "Goal achieved: Weight 75kg! +200 XP")).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByText("Goal achieved").first()).toBeVisible();
});
