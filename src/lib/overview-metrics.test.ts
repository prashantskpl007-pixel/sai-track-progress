import { describe, expect, it } from "vitest";
import { istDate, isCompleted } from "./overview-metrics";

describe("overview metrics", () => {
  it("uses India date for 'today'", () => {
    expect(istDate(new Date("2026-10-12T20:00:00Z"))).toBe("2026-10-13");
  });
  it("Closed workflow status counts as completed", () => {
    expect(isCompleted({ workflow_status: "Closed", current_status: "documents_received" })).toBe(true);
  });
  it("open workflow status is pending even if legacy stage is final", () => {
    expect(isCompleted({ workflow_status: "Draftinng", current_status: "agreement_ready" })).toBe(false);
  });
});
