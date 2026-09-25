import { expect, test } from "@playwright/test";
import { DEMO, signIn } from "./support";

// QA journey 0 — accounts & sign-in.
test("signed out, every page sends you to sign in", async ({ page }) => {
  for (const path of ["/", "/dashboard", "/profile", "/coaching"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/login$/);
  }
});

test("register, log out, sign in again", async ({ page }) => {
  const email = `e2e-register-${Date.now()}@example.com`;
  await page.goto("/auth/register");
  await page.fill("#fullName", "Rae Runner");
  await page.fill("#email", email);
  await page.fill("#password", "Journey-e2e1");
  await page.fill("#confirmPassword", "Journey-e2e1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Hi, Rae" })).toBeVisible();

  // Signed in, the auth pages send you home.
  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/profile?tab=settings");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/auth/login");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login$/);

  await page.fill("#email", email);
  await page.fill("#password", "Wrong-password1");
  await page.click("button[type=submit]");
  await expect(page.getByText("Invalid login credentials")).toBeVisible();
  await signIn(page, email.toUpperCase(), "Journey-e2e1");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a coach lands on the hub; a trainee can't open it", async ({ page }) => {
  await signIn(page, DEMO.coach.email);
  await expect(page).toHaveURL(/\/coaching$/);
  await page.request.post("/api/v1/auth/logout");

  await signIn(page, DEMO.trainee.email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/coaching");
  await expect(page).toHaveURL(/\/dashboard$/);
});
