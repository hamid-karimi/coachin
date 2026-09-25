import { expect, test } from "@playwright/test";
import { newAthlete, toast } from "./support";

// QA journey 10 — community (compose.e2e.yaml turns FEATURE_COMMUNITY on).
test("start a group streak and let a friend join with the code", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await newAthlete(owner, "Otto Owner");
  await owner.goto("/community/groups");
  await owner.fill("#group-name", "Dawn Patrol");
  await owner.getByRole("button", { name: "Create", exact: true }).click();
  const created = toast(owner, "Group created");
  await expect(created).toBeVisible();
  const code = (await created.innerText()).match(/GRP-[A-Z0-9]+/)?.[0];
  expect(code).toBeTruthy();
  await expect(owner.getByText("needs a 2nd member to start")).toBeVisible();

  const friend = await (await browser.newContext()).newPage();
  await newAthlete(friend, "Fay Friend");
  await friend.goto("/community/groups");
  await friend.fill("#group-code", code!.toLowerCase());
  await friend.getByRole("button", { name: "Join", exact: true }).click();
  await expect(toast(friend, "Joined the group.")).toBeVisible();
  await friend.getByRole("button", { name: "Join", exact: true }).click();
  await friend.fill("#group-code", code!);
  await friend.getByRole("button", { name: "Join", exact: true }).click();
  await expect(toast(friend, "You are already in this group.")).toBeVisible();

  await owner.reload();
  await expect(owner.getByText("Fay Friend")).toBeVisible();
  // A group formed today settles nothing until tomorrow.
  await expect(owner.getByText("0 day streak · best 0")).toBeVisible();
});
