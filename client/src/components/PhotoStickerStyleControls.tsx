import { Type } from "lucide-react";
import {
  photoStickerFontLabels,
  photoStickerToneLabels,
  type PhotoStickerFont,
  type PhotoStickerStyle,
  type PhotoStickerTone
} from "../game/photoFrameEditor";
import "../photo-frame-editor.css";

type PhotoStickerStyleControlsProps = {
  value: PhotoStickerStyle;
  onChange: (value: PhotoStickerStyle) => void;
};

export function PhotoStickerStyleControls({ value, onChange }: PhotoStickerStyleControlsProps) {
  return (
    <div className="photo-sticker-style-controls" aria-label="스티커 서식">
      <span className="photo-sticker-style-controls__tones" role="group" aria-label="스티커 색상">
        {(Object.keys(photoStickerToneLabels) as PhotoStickerTone[]).map((tone) => <button key={tone} type="button" data-tone={tone} aria-label={`${photoStickerToneLabels[tone]} 스티커 색상`} title={photoStickerToneLabels[tone]} aria-pressed={value.tone === tone} onClick={() => onChange({ ...value, tone })}><i aria-hidden="true" /></button>)}
      </span>
      <span className="photo-sticker-style-controls__fonts" role="group" aria-label="스티커 글꼴">
        <Type aria-hidden="true" />
        {(Object.keys(photoStickerFontLabels) as PhotoStickerFont[]).map((font) => <button key={font} type="button" data-font={font} aria-pressed={value.font === font} onClick={() => onChange({ ...value, font })}>{photoStickerFontLabels[font]}</button>)}
      </span>
    </div>
  );
}
