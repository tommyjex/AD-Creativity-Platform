import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/project-display";

describe("formatDate", () => {
  it("displays UTC timestamps in China Standard Time", () => {
    expect(formatDate("2026-08-15T03:00:25Z")).toBe("08/15 11:00");
  });

  it("treats legacy timezone-naive API timestamps as UTC", () => {
    expect(formatDate("2026-08-15T03:00:25")).toBe("08/15 11:00");
  });
});
