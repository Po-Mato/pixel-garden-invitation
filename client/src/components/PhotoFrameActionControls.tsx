import { Redo2, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import {
  photoFramePresetLabels,
  photoFramePresetTransform,
  rotatePhotoFrameTransform,
  type PhotoFramePreset,
  type PhotoFrameTransform
} from "../game/photoFrameEditor";

type PhotoFrameActionControlsProps = {
  value: PhotoFrameTransform;
  onChange: (value: PhotoFrameTransform) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
};

export function PhotoFrameActionControls({ value, onChange, onUndo, onRedo, canUndo, canRedo, disabled = false }: PhotoFrameActionControlsProps) {
  return (
    <div className="photo-frame-action-controls" aria-label="사진 구도 빠른 편집">
      <div role="group" aria-label="구도 프리셋">
        {(Object.keys(photoFramePresetLabels) as PhotoFramePreset[]).map((preset) => (
          <button key={preset} type="button" disabled={disabled} onClick={() => onChange(photoFramePresetTransform(preset))}>{photoFramePresetLabels[preset]}</button>
        ))}
      </div>
      <div role="group" aria-label="회전과 편집 이력">
        <button type="button" aria-label="왼쪽으로 3도 회전" title="왼쪽 회전" disabled={disabled || value.rotation <= -12} onClick={() => onChange(rotatePhotoFrameTransform(value, -3))}><RotateCcw aria-hidden="true" /></button>
        <button type="button" aria-label="오른쪽으로 3도 회전" title="오른쪽 회전" disabled={disabled || value.rotation >= 12} onClick={() => onChange(rotatePhotoFrameTransform(value, 3))}><RotateCw aria-hidden="true" /></button>
        <button type="button" aria-label="사진 편집 실행 취소" title="실행 취소" disabled={disabled || !canUndo} onClick={onUndo}><Undo2 aria-hidden="true" /></button>
        <button type="button" aria-label="사진 편집 다시 실행" title="다시 실행" disabled={disabled || !canRedo} onClick={onRedo}><Redo2 aria-hidden="true" /></button>
      </div>
    </div>
  );
}
