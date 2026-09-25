import { expect, type APIResponse, type Locator, type Page } from "@playwright/test";

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

/** Sign in through the form (the journey QA walks), waiting out the auth rate limit. */
export async function signIn(page: Page, email: string, password = DEMO.password) {
  await page.goto("/auth/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  const limited = page.getByText("Too many attempts");
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.click("button[type=submit]");
    const outcome = await Promise.race([
      page.waitForURL((url) => !url.pathname.startsWith("/auth")).then(() => "in" as const),
      limited.waitFor().then(() => "limited" as const),
    ]);
    if (outcome === "in") return;
    await page.waitForTimeout(6_500);
  }
  throw new Error(`Sign-in for ${email} stayed rate limited`);
}

/**
 * Sets files on the file input labelled label. While a refresh streams in, React
 * briefly keeps a hidden second copy of the page, so the input can be duplicated
 * for a moment: retry until exactly one is there and the files are set.
 */
export async function upload(page: Page, label: string, files: Parameters<Locator["setInputFiles"]>[0]) {
  const input = page.locator(`input[type=file][aria-label='${label}']`);
  await expect(async () => {
    await expect(input).toHaveCount(1, { timeout: 1_000 });
    await input.setInputFiles(files, { timeout: 1_000 });
  }).toPass();
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

/** A solid-color JPEG drawn in the page (the fake moderation reads its shape: tall = body photo). */
export async function jpeg(page: Page, name: string, width: number, height: number, color: string) {
  const base64 = await page.evaluate(
    ([w, h, fill]) => {
      const canvas = document.createElement("canvas");
      canvas.width = Number(w);
      canvas.height = Number(h);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = String(fill);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
    },
    [width, height, color],
  );
  return { name, mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}
