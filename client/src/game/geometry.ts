import type { GardenWorld, Point, Rect, WorldSpot } from "./world";

export function clampToWorld(point: Point, bounds: Rect): Point {
  return {
    x: Math.min(bounds.x + bounds.width, Math.max(bounds.x, point.x)),
    y: Math.min(bounds.y + bounds.height, Math.max(bounds.y, point.y))
  };
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function isBlocked(point: Point, world: GardenWorld): boolean {
  return world.blocked.some((rect) => pointInRect(point, rect));
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getNearbySpot(point: Point, world: GardenWorld): WorldSpot | null {
  return world.spots.find((spot) => distance(point, center(spot)) <= spot.actionRadius) ?? null;
}
