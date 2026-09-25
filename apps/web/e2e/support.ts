import { expect, type APIResponse, type Page } from "@playwright/test";

/** Demo accounts from `make seed` (an active coach ↔ trainee pair). */
export const DEMO = {
  trainee: { email: "trainee@coachin.local", name: "Tara Trainee" },
  coach: { email: "coach@coachin.local", name: "Cody Coach" },
  password: "Coachin-demo1",
};

const PASSWORD = "Journey-e2e1";

/** Auth endpoints are rate limited; wait out a 429 instead of failing the journey. */
async function withBackoff(call: () => Promise<APIResponse>): Promise<APIResponse> {
  for (let attempt = 0; ; attempt++) {
    const response = await call();
    if (response.status() !== 429 || attempt === 5) return response;
    await new Promise((resolve) => setTimeout(resolve, 6_500));
  }
}

/** A fresh athlete, signed in on this page's context (the session cookie is shared). */
export async function newAthlete(page: Page, fullName: string): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const response = await withBackoff(() =>
    page.request.post("/api/v1/auth/register", {
      data: { email, password: PASSWORD, confirmPassword: PASSWORD, fullName },
    }),
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return email;
}

/** Sign in through the form (the journey QA walks). */
export async function signIn(page: Page, email: string, password = DEMO.password) {
  await page.goto("/auth/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"));
}

/** Calls the API as the signed-in user (arranging state a journey doesn't walk). */
export async function api(page: Page, method: "GET" | "POST" | "PUT" | "DELETE", path: string, data?: unknown) {
  const response = await page.request.fetch(`/api/v1${path}`, { method, data });
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy();
  return response.json().catch(() => null);
}

/** The newest toast containing text. */
export function toast(page: Page, text: string | RegExp) {
  return page.locator("[data-sonner-toast]").filter({ hasText: text }).last();
}
