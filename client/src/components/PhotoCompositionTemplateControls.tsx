import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LayoutTemplate,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useState } from "react";
import {
  builtInPhotoCompositionTemplates,
  createPhotoCompositionTemplate,
  defaultPhotoStickerTransform,
  loadPhotoCompositionTemplates,
  normalizePhotoStickerTransform,
  savePhotoCompositionTemplates,
  type PhotoCompositionTemplate,
  type PhotoFrameTransform,
  type PhotoStickerStyle,
  type PhotoStickerTransform
} from "../game/photoFrameEditor";
import "../photo-frame-editor.css";

type PhotoStickerTransformControlsProps = {
  value: PhotoStickerTransform;
  onChange: (value: PhotoStickerTransform) => void;
};

export function PhotoStickerTransformControls({ value, onChange }: PhotoStickerTransformControlsProps) {
  const update = (patch: Partial<PhotoStickerTransform>) => onChange(normalizePhotoStickerTransform({ ...value, ...patch }));
  return (
    <div className="photo-sticker-transform-controls" role="group" aria-label="문구 스티커 위치와 각도">
      <span>위치</span>
      <button type="button" aria-label="스티커 왼쪽으로" title="왼쪽으로" onClick={() => update({ x: value.x - 0.08 })}><ArrowLeft aria-hidden="true" /></button>
      <button type="button" aria-label="스티커 위로" title="위로" onClick={() => update({ y: value.y - 0.08 })}><ArrowUp aria-hidden="true" /></button>
      <button type="button" aria-label="스티커 아래로" title="아래로" onClick={() => update({ y: value.y + 0.08 })}><ArrowDown aria-hidden="true" /></button>
      <button type="button" aria-label="스티커 오른쪽으로" title="오른쪽으로" onClick={() => update({ x: value.x + 0.08 })}><ArrowRight aria-hidden="true" /></button>
      <i aria-hidden="true" />
      <button type="button" aria-label="스티커 작게" title="작게" onClick={() => update({ scale: value.scale - 0.1 })}><ZoomOut aria-hidden="true" /></button>
      <button type="button" aria-label="스티커 왼쪽 회전" title="왼쪽 회전" onClick={() => update({ rotation: value.rotation - 5 })}><RotateCcw aria-hidden="true" /></button>
      <button type="button" aria-label="스티커 오른쪽 회전" title="오른쪽 회전" onClick={() => update({ rotation: value.rotation + 5 })}><RotateCw aria-hidden="true" /></button>
      <button type="button" aria-label="스티커 크게" title="크게" onClick={() => update({ scale: value.scale + 0.1 })}><ZoomIn aria-hidden="true" /></button>
      <button type="button" aria-label="스티커 위치 초기화" title="위치 초기화" onClick={() => onChange(defaultPhotoStickerTransform)}><RotateCcw aria-hidden="true" /></button>
    </div>
  );
}

type PhotoCompositionTemplateControlsProps = {
  photoTransform: PhotoFrameTransform;
  stickerStyle: PhotoStickerStyle;
  stickerTransform: PhotoStickerTransform;
  onApply: (template: PhotoCompositionTemplate) => void;
};

export function PhotoCompositionTemplateControls({
  photoTransform,
  stickerStyle,
  stickerTransform,
  onApply
}: PhotoCompositionTemplateControlsProps) {
  const [customTemplates, setCustomTemplates] = useState(loadPhotoCompositionTemplates);
  const [message, setMessage] = useState("");

  const saveCurrent = () => {
    if (customTemplates.length >= 3) {
      setMessage("내 프레임은 세 개까지 저장할 수 있어요.");
      return;
    }
    const next = [...customTemplates, createPhotoCompositionTemplate(photoTransform, stickerStyle, stickerTransform, customTemplates.length)];
    setCustomTemplates(next);
    savePhotoCompositionTemplates(next);
    setMessage(`${next.at(-1)!.label}을 저장했어요.`);
  };

  const remove = (id: string) => {
    const next = customTemplates.filter((template) => template.id !== id);
    setCustomTemplates(next);
    savePhotoCompositionTemplates(next);
    setMessage("내 프레임을 삭제했어요.");
  };

  return (
    <section className="photo-composition-templates" aria-label="웨딩 프레임 템플릿">
      <header><LayoutTemplate aria-hidden="true" /><strong>웨딩 프레임</strong><small>사진·문구 구도를 한 번에 적용</small></header>
      <div className="photo-composition-templates__presets">
        {builtInPhotoCompositionTemplates.map((template) => <button key={template.id} type="button" onClick={() => { onApply(template); setMessage(`${template.label} 구도를 적용했어요.`); }}>{template.label}</button>)}
      </div>
      {customTemplates.length > 0 ? <div className="photo-composition-templates__custom" aria-label="저장한 내 프레임">{customTemplates.map((template) => <span key={template.id}><button type="button" onClick={() => { onApply(template); setMessage(`${template.label}을 적용했어요.`); }}>{template.label}</button><button type="button" aria-label={`${template.label} 삭제`} title="내 프레임 삭제" onClick={() => remove(template.id)}><Trash2 aria-hidden="true" /></button></span>)}</div> : null}
      <button className="photo-composition-templates__save" type="button" disabled={customTemplates.length >= 3} onClick={saveCurrent}><Save aria-hidden="true" />현재 구도 저장</button>
      {message ? <small role="status">{message}</small> : null}
    </section>
  );
}
