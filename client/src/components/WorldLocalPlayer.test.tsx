import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { createWorldMotionStore } from "../game/worldMotionStore";
import { WorldLocalPlayer } from "./WorldLocalPlayer";

it("shows a full accessible nickname inside the compact one-line nameplate", () => {
  const motionStore = createWorldMotionStore({
    position: { x: 285, y: 375 },
    direction: "down",
    moving: false,
    stepFrame: 0
  });

  render(
    <WorldLocalPlayer
      appearance={{ presetId: "feminine-long-wave-dress" }}
      nickname="모바일초대장긴하객이름"
      motionStore={motionStore}
      activeZoneId="home"
      reaction={null}
    />
  );

  const nameplate = screen.getByTitle("모바일초대장긴하객이름");
  expect(nameplate).toHaveClass("world-player__name");
  expect(nameplate).toHaveTextContent("모바일초대장긴하객이름");
  expect(screen.getByLabelText("모바일초대장긴하객이름")).toContainElement(nameplate);
});
