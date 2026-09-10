import { expect, it } from "vitest";
import { createWorldMotionStore } from "./worldMotionStore";
import { createGuest03VisualMotion } from "./guest03VisualMotion";

function setup() {
  const source = createWorldMotionStore({ position: { x: 0, y: 0 }, direction: "right", moving: false, stepFrame: 1 });
  const visual = createGuest03VisualMotion(source);
  source.subscribe(visual.receive);
  visual.tick(0);
  return { source, visual, snapshot: visual.store.getSnapshot };
}

it("interpolates a tile at 125px/s without changing logical coordinates", () => {
  const { source, visual, snapshot } = setup();
  source.update({ position: { x: 30, y: 0 }, moving: true });
  visual.tick(120);
  expect(snapshot().position).toEqual({ x: 15, y: 0 });
  expect(source.getSnapshot().position).toEqual({ x: 30, y: 0 });
  visual.tick(240);
  expect(snapshot().position).toEqual({ x: 30, y: 0 });
});

it("finishes accepted motion after release, then stops on neutral", () => {
  const { source, visual, snapshot } = setup();
  source.update({ position: { x: 30, y: 0 }, moving: true });
  visual.tick(80);
  source.update({ moving: false });
  expect(snapshot().moving).toBe(true);
  visual.tick(240);
  expect(snapshot()).toMatchObject({ position: { x: 30, y: 0 }, moving: false, stepFrame: 1 });
});

it("preserves a corner path instead of cutting diagonally through obstacles", () => {
  const { source, visual, snapshot } = setup();
  source.update({ position: { x: 30, y: 0 }, moving: true });
  visual.tick(120);
  source.update({ position: { x: 30, y: 30 }, direction: "down" });
  visual.tick(240);
  expect(snapshot().position).toEqual({ x: 30, y: 0 });
  visual.tick(360);
  expect(snapshot()).toMatchObject({ position: { x: 30, y: 15 }, direction: "down" });
});

it("uses the visible travel direction during a reversal", () => {
  const { source, visual, snapshot } = setup();
  source.update({ position: { x: 30, y: 0 }, moving: true });
  visual.tick(120);
  source.update({ position: { x: 0, y: 0 }, direction: "left" });
  visual.tick(200);
  expect(snapshot().direction).toBe("right");
  visual.tick(360);
  expect(snapshot()).toMatchObject({ position: { x: 15, y: 0 }, direction: "left" });
});

it("snaps teleports and reset instead of interpolating across the map", () => {
  const { source, visual, snapshot } = setup();
  source.update({ position: { x: 300, y: 300 } });
  expect(snapshot().position).toEqual({ x: 300, y: 300 });
  source.update({ position: { x: 330, y: 300 }, moving: true });
  visual.reset();
  expect(snapshot()).toMatchObject({ position: { x: 330, y: 300 }, moving: false });
});

it("discards animation backlog after a background pause", () => {
  const { source, visual, snapshot } = setup();
  source.update({ position: { x: 30, y: 0 }, moving: true });
  visual.tick(1000);
  expect(snapshot()).toMatchObject({ position: { x: 30, y: 0 }, moving: false });
});
