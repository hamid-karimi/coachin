import { expect, test } from "@playwright/test";
import { api, newAthlete } from "./support";

// QA journey 3 — logging on Today.
test("log today's routine session once", async ({ page }) => {
  await newAthlete(page, "Tom Today");
  await api(page, "POST", "/routine/schedules", { sportTypeId: 1, days: [new Date().getDay()] });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Hi, Tom" })).toBeVisible();
  await expect(page.getByText("0 of 1 done").first()).toBeVisible();
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByText(/\+60 XP earned/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Done · \+60 XP/)).toBeVisible();
  await expect(page.getByText("1 of 1 done").first()).toBeVisible();
  // A second log of the same sport today is refused by the API too.
  const again = await page.request.post("/api/v1/today/workouts", { data: { sportTypeId: 1 } });
  expect(again.status()).toBe(409);
});
