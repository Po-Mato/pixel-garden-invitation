import { Move, ZoomIn } from "lucide-react";
import { useRef, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import {
  panPhotoFrameTransform,
  photoFramePreviewStyle,
  zoomPhotoFrameTransform,
  type PhotoFrameTransform
} from "../game/photoFrameEditor";
import "../photo-frame-editor.css";

type PointerPoint = { x: number; y: number };

type PhotoFrameTouchEditorProps = {
  src: string;
  alt: string;
  transform: PhotoFrameTransform;
  onChange: (transform: PhotoFrameTransform) => void;
  ariaLabel: string;
};

function center(points: PointerPoint[]) {
  return points.length === 1
    ? points[0]
    : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

function distance(points: PointerPoint[]) {
  return points.length < 2 ? 0 : Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
}

export function PhotoFrameTouchEditor({ src, alt, transform, onChange, ariaLabel }: PhotoFrameTouchEditorProps) {
  const pointers = useRef(new Map<number, PointerPoint>());
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const commitTransform = (next: PhotoFrameTransform) => {
    transformRef.current = next;
    onChange(next);
  };

  const movePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previousPoints = [...pointers.current.values()].slice(0, 2);
    if (!pointers.current.has(event.pointerId) || previousPoints.length === 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const nextPoints = [...pointers.current.values()].slice(0, 2);
    const before = center(previousPoints);
    const after = center(nextPoints);
    const bounds = event.currentTarget.getBoundingClientRect();
    let next = panPhotoFrameTransform(transformRef.current, after.x - before.x, after.y - before.y, bounds.width, bounds.height);
    const previousDistance = distance(previousPoints);
    const nextDistance = distance(nextPoints);
    if (previousDistance > 0 && nextDistance > 0) next = zoomPhotoFrameTransform(next, nextDistance / previousDistance);
    commitTransform(next);
  };

  const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const zoomWithWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    commitTransform(zoomPhotoFrameTransform(transformRef.current, Math.exp(-event.deltaY * 0.002)));
  };

  return (
    <div
      className="photo-frame-touch-editor"
      role="group"
      aria-label={ariaLabel}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); }}
      onPointerMove={movePointer}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onWheel={zoomWithWheel}
    >
      <img src={src} alt={alt} draggable={false} style={photoFramePreviewStyle(transform)} />
      <span aria-hidden="true"><Move /><ZoomIn /></span>
    </div>
  );
}
