import { expect, test } from "@playwright/test";
import { jpeg, newAthlete, toast, upload } from "./support";

// QA journey 8 — progress photos: add two, compare, "Share progress".
test("add two progress photos, compare them, build the share card", async ({ page }) => {
  await newAthlete(page, "Pam Photos");
  await page.goto("/profile?tab=progress");
  for (const [name, color] of [
    ["before.jpg", "#335"],
    ["after.jpg", "#533"],
  ]) {
    await upload(page, "Progress photo", await jpeg(page, name, 600, 800, color));
    await expect(toast(page, "Progress photo added.")).toBeVisible();
  }

  await page.getByRole("button", { name: "Compare" }).click();
  const tiles = page.locator("button[aria-pressed]");
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await page.getByRole("button", { name: "Share progress" }).click();
  await expect(page.getByRole("img", { name: /Share card preview/ })).toHaveAttribute(
    "alt",
    "Share card preview: Progress, not perfection, 1 week between",
  );
  // A two-photo card has no photo picker of its own.
  await expect(page.getByRole("button", { name: "Add a photo" })).toHaveCount(0);
});
