import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  LayoutTemplate,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Share2,
  ShieldCheck,
  Trash2,
  Users,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useEffect, useState } from "react";
import type { PhotoFrameGalleryItem } from "@wedding-game/shared";
import {
  fetchPublicPhotoFrameGallery,
  submitPhotoFrameGallery
} from "../api/photoFrameGalleryApi";
import { WeddingApiError } from "../api/weddingApi";
import {
  builtInPhotoCompositionTemplates,
  createPhotoCompositionTemplate,
  createPhotoCompositionTemplateShareUrl,
  defaultPhotoStickerTransform,
  loadPhotoCompositionTemplates,
  normalizePhotoStickerTransform,
  readPhotoCompositionTemplateFromUrl,
  removePhotoCompositionTemplateFromUrl,
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
  stickerText: string;
  stickerStyle: PhotoStickerStyle;
  stickerTransform: PhotoStickerTransform;
  contributorName: string;
  onApply: (template: PhotoCompositionTemplate) => void;
};

export function PhotoCompositionTemplateControls({
  photoTransform,
  stickerText,
  stickerStyle,
  stickerTransform,
  contributorName,
  onApply
}: PhotoCompositionTemplateControlsProps) {
  const [customTemplates, setCustomTemplates] = useState(loadPhotoCompositionTemplates);
  const [message, setMessage] = useState("");
  const [sharePreview, setSharePreview] = useState<{ label: string; url: string; qr: string } | null>(null);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityFrames, setCommunityFrames] = useState<PhotoFrameGalleryItem[]>([]);
  const [communityLabel, setCommunityLabel] = useState(`${contributorName.slice(0, 12)}의 프레임`);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const imported = readPhotoCompositionTemplateFromUrl(window.location.href);
    if (!imported) return;
    setCustomTemplates((current) => {
      const next = [...current.filter(({ label }) => label !== imported.label), imported].slice(-3);
      savePhotoCompositionTemplates(next);
      return next;
    });
    onApply(imported);
    window.history.replaceState(null, "", removePhotoCompositionTemplateFromUrl(window.location.href));
    setMessage("다른 기기에서 공유한 프레임을 가져왔어요.");
  }, []);

  const saveCurrent = () => {
    if (customTemplates.length >= 3) {
      setMessage("내 프레임은 세 개까지 저장할 수 있어요.");
      return;
    }
    const next = [...customTemplates, createPhotoCompositionTemplate(photoTransform, stickerStyle, stickerTransform, customTemplates.length, undefined, stickerText)];
    setCustomTemplates(next);
    savePhotoCompositionTemplates(next);
    setMessage(`${next.at(-1)!.label}을 저장했어요.`);
  };

  const prepareShare = async (template: PhotoCompositionTemplate) => {
    const url = createPhotoCompositionTemplateShareUrl(template, window.location.href);
    const { default: QRCode } = await import("qrcode");
    const qr = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: "#5f4750", light: "#fffaf1" } });
    setSharePreview({ label: template.label, url, qr });
    setMessage("QR을 스캔하거나 링크를 공유해 다른 기기에서 불러오세요.");
  };

  const shareLink = async () => {
    if (!sharePreview) return;
    try {
      const nativeShare = typeof navigator.share === "function";
      if (nativeShare) await navigator.share({ title: `${sharePreview.label} 웨딩 프레임`, url: sharePreview.url });
      else await navigator.clipboard.writeText(sharePreview.url);
      setMessage(nativeShare ? "프레임 링크를 공유했어요." : "프레임 링크를 복사했어요.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("프레임 링크를 공유하지 못했어요.");
    }
  };

  const remove = (id: string) => {
    const next = customTemplates.filter((template) => template.id !== id);
    setCustomTemplates(next);
    savePhotoCompositionTemplates(next);
    setMessage("내 프레임을 삭제했어요.");
  };

  const communityTemplate = (item: PhotoFrameGalleryItem): PhotoCompositionTemplate => ({
    id: `community-${item.id}`,
    ...item.design,
    custom: true
  });

  const loadCommunity = async (force = false) => {
    if (communityBusy || (communityLoaded && !force)) return;
    setCommunityBusy(true);
    try {
      const result = await fetchPublicPhotoFrameGallery();
      setCommunityFrames(result.items);
      setCommunityLoaded(true);
      if (force) setMessage("승인된 공동 프레임을 새로 불러왔어요.");
    } catch {
      setMessage("공동 프레임을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCommunityBusy(false);
    }
  };

  const submitCommunity = async () => {
    const label = communityLabel.replace(/\s+/g, " ").trim();
    if (!label) {
      setMessage("공동 갤러리에 표시할 프레임 이름을 입력해 주세요.");
      return;
    }
    setCommunityBusy(true);
    try {
      await submitPhotoFrameGallery({
        contributorName,
        design: {
          label,
          photoTransform,
          stickerText,
          stickerStyle,
          stickerTransform
        }
      });
      setMessage("승인 요청을 보냈어요. 관리자가 확인한 뒤 공동 갤러리에 공개됩니다.");
    } catch (error) {
      setMessage(error instanceof WeddingApiError && error.code === "rate_limited"
        ? "오늘 보낼 수 있는 승인 요청을 모두 사용했어요. 내일 다시 시도해 주세요."
        : "승인 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCommunityBusy(false);
    }
  };

  return (
    <section className="photo-composition-templates" aria-label="웨딩 프레임 템플릿">
      <header><LayoutTemplate aria-hidden="true" /><strong>웨딩 프레임</strong><small>사진·문구 구도를 한 번에 적용</small></header>
      <div className="photo-composition-templates__presets">
        {builtInPhotoCompositionTemplates.map((template) => <button key={template.id} type="button" onClick={() => { onApply(template); setMessage(`${template.label} 구도를 적용했어요.`); }}>{template.label}</button>)}
      </div>
      {customTemplates.length > 0 ? <div className="photo-composition-templates__custom" aria-label="저장한 내 프레임">{customTemplates.map((template) => <span key={template.id}><button type="button" onClick={() => { onApply(template); setMessage(`${template.label}을 적용했어요.`); }}>{template.label}</button><button type="button" aria-label={`${template.label} 공유`} title="다른 기기로 공유" onClick={() => void prepareShare(template)}><Share2 aria-hidden="true" /></button><button type="button" aria-label={`${template.label} 삭제`} title="내 프레임 삭제" onClick={() => remove(template.id)}><Trash2 aria-hidden="true" /></button></span>)}</div> : null}
      <button className="photo-composition-templates__save" type="button" disabled={customTemplates.length >= 3} onClick={saveCurrent}><Save aria-hidden="true" />현재 구도 저장</button>
      <section className="photo-frame-community" data-open={communityOpen || undefined} aria-label="포토프레임 공동 갤러리">
        <button
          type="button"
          className="photo-frame-community__toggle"
          aria-expanded={communityOpen}
          onClick={() => {
            const next = !communityOpen;
            setCommunityOpen(next);
            if (next) void loadCommunity();
          }}
        >
          <Users aria-hidden="true" />
          <span><strong>함께 만든 프레임</strong><small>승인된 하객 구도를 골라 적용</small></span>
          {communityBusy ? <LoaderCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
        </button>
        {communityOpen ? (
          <div className="photo-frame-community__body">
            <header>
              <span><ShieldCheck aria-hidden="true" />공개 전 관리자 확인</span>
              <button type="button" aria-label="공동 프레임 새로고침" title="새로고침" disabled={communityBusy} onClick={() => void loadCommunity(true)}><RefreshCw aria-hidden="true" /></button>
            </header>
            {communityFrames.length > 0 ? (
              <div className="photo-frame-community__gallery" role="list" aria-label="승인된 공동 프레임">
                {communityFrames.map((item) => (
                  <article key={item.id} role="listitem" data-tone={item.design.stickerStyle.tone}>
                    <button type="button" aria-label={`${item.design.label}, ${item.contributorName} 프레임 적용`} onClick={() => {
                      onApply(communityTemplate(item));
                      setMessage(`${item.contributorName}님의 ${item.design.label}을 적용했어요.`);
                    }}>
                      <span aria-hidden="true"><i style={{ transform: `translate(${item.design.photoTransform.offsetX * 8}px, ${item.design.photoTransform.offsetY * 8}px) rotate(${item.design.photoTransform.rotation}deg) scale(${item.design.photoTransform.zoom})` }} /><em>{item.design.stickerText || "WEDDING DAY"}</em></span>
                      <strong>{item.design.label}</strong>
                      <small>by {item.contributorName}</small>
                    </button>
                  </article>
                ))}
              </div>
            ) : communityLoaded ? <p>아직 승인된 공동 프레임이 없어요. 첫 구도를 제안해 보세요.</p> : <p>승인된 프레임을 불러오고 있어요.</p>}
            <form onSubmit={(event) => { event.preventDefault(); void submitCommunity(); }}>
              <label><span>내 프레임 이름</span><input value={communityLabel} maxLength={24} onChange={(event) => setCommunityLabel(event.target.value)} /></label>
              <button type="submit" disabled={communityBusy || !communityLabel.trim()}><ShieldCheck aria-hidden="true" />현재 구도 승인 요청</button>
            </form>
          </div>
        ) : null}
      </section>
      {sharePreview ? <figure className="photo-composition-templates__share"><img src={sharePreview.qr} alt={`${sharePreview.label} 공유 QR`} /><figcaption><strong>{sharePreview.label}</strong><small>다른 휴대폰 카메라로 스캔</small><button type="button" onClick={() => void shareLink()}><Share2 aria-hidden="true" />링크 공유</button></figcaption></figure> : null}
      {message ? <small role="status">{message}</small> : null}
    </section>
  );
}
