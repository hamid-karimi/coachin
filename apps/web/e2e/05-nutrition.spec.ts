import { expect, test } from "@playwright/test";
import { newAthlete, toast } from "./support";

// QA journey 5 — nutrition logging (+ the share cards of journey 8).
test("log a meal by hand, share the day, remove it", async ({ page }) => {
  await newAthlete(page, "Nia Nutrition");
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Manual" }).click();
  await page.getByRole("button", { name: "Dinner" }).click();
  await page.getByLabel("Food").fill("Lentil soup");
  await page.getByLabel("kcal").fill("320");
  await page.getByLabel("Protein").fill("18");
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(toast(page, "Meal logged")).toContainText("+5 XP");
  await expect(page.getByText("Lentil soup")).toBeVisible();

  // Share today: additive stats only, never the target.
  await page.getByRole("button", { name: "Share today" }).click();
  await expect(page.getByRole("img", { name: /Share card preview/ })).toHaveAttribute(
    "alt",
    "Share card preview: Today's fuel, 320 kcal, 18 g protein, 1 meal",
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save image" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("coachin-card.png");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Remove Lentil soup" }).click();
  await expect(toast(page, "Meal removed")).toBeVisible();
  await expect(page.getByText("Lentil soup")).toHaveCount(0);
});
