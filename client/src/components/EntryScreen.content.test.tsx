import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@wedding-game/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wedding-game/shared")>();

  return {
    ...actual,
    invitationContent: {
      ...actual.invitationContent,
      event: {
        ...actual.invitationContent.event,
        couple: { groom: "테스트신랑", bride: "테스트신부" },
        startAt: "2031-06-07T13:00:00+09:00",
        endAt: "2031-06-07T14:00:00+09:00"
      }
    }
  };
});

import { EntryScreen } from "./EntryScreen";

afterEach(cleanup);

it("derives the entry heading names and year from the shared wedding event", () => {
  render(<EntryScreen onEnter={vi.fn()} />);

  expect(screen.getByText("WEDDING GARDEN · 2031")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "테스트신랑 & 테스트신부의 정원" })).toBeInTheDocument();
});
