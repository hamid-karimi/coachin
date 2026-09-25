import { expect, test } from "@playwright/test";
import { DEMO, newAthlete, signIn, toast } from "./support";

// QA journey 6 — a coach invites a trainee with a code.
test("a new trainee joins the demo coach with an invite code", async ({ browser }) => {
  const coach = await (await browser.newContext()).newPage();
  await signIn(coach, DEMO.coach.email);
  await expect(coach.getByRole("heading", { name: "Invite codes" })).toBeVisible();
  await coach.getByLabel("Generate invite code for sport").selectOption({ label: "Running" });
  await coach.getByRole("button", { name: "New invite code" }).click();
  const generated = toast(coach, "New invite code generated");
  await expect(generated).toBeVisible();
  const code = (await generated.innerText()).match(/COACH-[A-Z0-9-]+/)?.[0];
  expect(code, await generated.innerText()).toBeTruthy();

  // With Community on, "My coach" lives on the Circle page.
  const trainee = await (await browser.newContext()).newPage();
  await newAthlete(trainee, "Tia Trainee");
  await trainee.goto("/community/circle");
  await trainee.getByLabel("Coach invite code").fill("coach-9-nope");
  await trainee.getByRole("button", { name: "Add coach" }).click();
  await expect(toast(trainee, "Invalid invite code")).toBeVisible();
  await trainee.getByLabel("Coach invite code").fill(code!.toLowerCase());
  await trainee.getByRole("button", { name: "Add coach" }).click();
  await expect(toast(trainee, "Coach added")).toBeVisible();

  await coach.reload();
  await expect(coach.getByText("Tia Trainee").first()).toBeVisible();
});
