import { describe, expect, it } from "vitest";
import { boardCopy, boardHref, resolveBoard } from "./community";

describe("community boards", () => {
  it("resolves and links boards", () => {
    expect(resolveBoard("club")).toBe("club");
    expect(resolveBoard("moon")).toBe("global");
    expect(resolveBoard(["club"])).toBe("global");
    expect(boardHref("global")).toBe("/community/boards");
    expect(boardHref("circle")).toBe("/community/boards?board=circle");
  });

  it("describes each board", () => {
    expect(boardCopy({ board: "club", primaryClubName: "Night Runners", weekly: true })).toEqual({
      title: "My Club · Night Runners",
      rules: "XP this week · resets Monday · members of Night Runners (your primary club)",
      empty: "No club XP this week yet. Log a session to put your club on the board.",
    });
    expect(boardCopy({ board: "club", weekly: true }).empty).toBe(
      "Join a club to compete on a smaller board with people you know.",
    );
    expect(boardCopy({ board: "global", weekly: false }).rules).toBe(
      "lifetime XP (no XP logged this week yet) · everyone on CoachIn",
    );
  });
});
