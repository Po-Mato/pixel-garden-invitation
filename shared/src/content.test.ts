import { describe, expect, it } from "vitest";
import { invitationContent } from "./content";

describe("invitationContent", () => {
  it("contains every MVP world spot", () => {
    expect(invitationContent.spots.map((spot) => spot.id)).toEqual([
      "wedding-info",
      "directions",
      "rsvp",
      "guestbook",
      "couple",
      "gallery",
      "story"
    ]);
  });
});
