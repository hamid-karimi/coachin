import { describe, expect, it } from "vitest";
import { jpegName, scaledSize } from "./client-image";

describe("client image", () => {
  it("caps the longest edge at 1600px without upscaling", () => {
    expect(scaledSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(1000, 3000)).toEqual({ width: 533, height: 1600 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("renames to .jpg", () => {
    expect(jpegName("IMG_0042.HEIC")).toBe("IMG_0042.jpg");
    expect(jpegName("lunch")).toBe("lunch.jpg");
  });
});
