import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOMER_VIDEO_BYTES,
  validateCustomerVideo,
} from "./video-validation";

describe("Premium customer video validation", () => {
  it.each(["video/mp4", "video/webm"])("accepts %s below 100 MB", (contentType) => {
    expect(
      validateCustomerVideo({
        fileName: "campaign-video.mp4",
        contentType,
        fileSize: MAX_CUSTOMER_VIDEO_BYTES,
      }),
    ).toBeNull();
  });

  it.each([
    [{ fileName: "", contentType: "video/mp4", fileSize: 10 }, "filnamn"],
    [
      { fileName: "video.mov", contentType: "video/quicktime", fileSize: 10 },
      "Endast MP4",
    ],
    [{ fileName: "video.mp4", contentType: "video/mp4", fileSize: 0 }, "tom"],
    [
      {
        fileName: "video.mp4",
        contentType: "video/mp4",
        fileSize: MAX_CUSTOMER_VIDEO_BYTES + 1,
      },
      "högst 100 MB",
    ],
  ])("rejects invalid video %#", (input, error) => {
    expect(validateCustomerVideo(input)).toContain(error);
  });
});
