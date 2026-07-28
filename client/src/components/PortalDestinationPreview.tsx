import { ArrowRight, MapPinned } from "lucide-react";
import type { Point, Rect, WorldPortal, WorldZone } from "../game/world";

type PortalDestinationPreviewProps = {
  portal: WorldPortal;
  destinationZone: WorldZone;
};

const previewWidth = 156;
const previewHeight = 82;
const previewPadding = 7;

function previewScale(zone: WorldZone): number {
  return Math.min(
    (previewWidth - previewPadding * 2) / zone.bounds.width,
    (previewHeight - previewPadding * 2) / zone.bounds.height
  );
}

function projectPoint(point: Point, zone: WorldZone) {
  const scale = previewScale(zone);
  const contentWidth = zone.bounds.width * scale;
  const contentHeight = zone.bounds.height * scale;
  return {
    x: (previewWidth - contentWidth) / 2 + point.x * scale,
    y: (previewHeight - contentHeight) / 2 + point.y * scale
  };
}

function projectRect(rect: Rect, zone: WorldZone) {
  const start = projectPoint(rect, zone);
  const scale = previewScale(zone);
  return {
    x: start.x,
    y: start.y,
    width: Math.max(1, rect.width * scale),
    height: Math.max(1, rect.height * scale)
  };
}

export function PortalDestinationPreview({ portal, destinationZone }: PortalDestinationPreviewProps) {
  const arrival = projectPoint(portal.spawn, destinationZone);

  return (
    <aside
      className="portal-destination-preview"
      aria-label={`${portal.label} 다음 맵 미리보기`}
      onClick={(event) => event.stopPropagation()}
    >
      <header>
        <span>{portal.label}</span>
        <ArrowRight aria-hidden="true" />
        <strong>{destinationZone.label}</strong>
      </header>
      <div className="portal-destination-preview__body">
        <svg
          viewBox={`0 0 ${previewWidth} ${previewHeight}`}
          role="img"
          aria-label={`${destinationZone.label} 도착 지점`}
        >
          <rect className="portal-destination-preview__boundary" {...projectRect(destinationZone.bounds, destinationZone)} />
          {destinationZone.paths.map((path) => (
            <rect
              key={path.id}
              className={`portal-destination-preview__path portal-destination-preview__path--${path.kind}`}
              {...projectRect(path, destinationZone)}
            />
          ))}
          {destinationZone.blocked.map((blocked, index) => (
            <rect
              key={`${blocked.x}-${blocked.y}-${index}`}
              className="portal-destination-preview__blocked"
              {...projectRect(blocked, destinationZone)}
            />
          ))}
          <g className="portal-destination-preview__arrival" transform={`translate(${arrival.x} ${arrival.y})`}>
            <circle r="8" />
            <circle r="3" />
            <path d="M 0 -12 V -6 M 0 6 V 12 M -12 0 H -6 M 6 0 H 12" />
          </g>
        </svg>
        <span><MapPinned aria-hidden="true" /><strong>도착 타일</strong><small>{destinationZone.subtitle}</small></span>
      </div>
    </aside>
  );
}
