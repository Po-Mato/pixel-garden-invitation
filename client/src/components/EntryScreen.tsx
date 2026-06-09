import { useState } from "react";
import type { AvatarColor, AvatarType } from "@wedding-game/shared";
import { PixelAvatar } from "./PixelAvatar";

export type EntryProfile = {
  nickname: string;
  avatar: AvatarType;
  color: AvatarColor;
};

type EntryScreenProps = {
  onEnter: (profile: EntryProfile) => void;
};

const avatarOptions: Array<{ value: AvatarType; label: string }> = [
  { value: "classic", label: "클래식" },
  { value: "suit", label: "수트" },
  { value: "dress", label: "드레스" },
  { value: "hanbok", label: "한복" }
];

const colorOptions: Array<{ value: AvatarColor; label: string }> = [
  { value: "rose", label: "장미" },
  { value: "leaf", label: "잎새" },
  { value: "sky", label: "하늘" },
  { value: "gold", label: "금빛" },
  { value: "soil", label: "흙빛" }
];

export function EntryScreen({ onEnter }: EntryScreenProps) {
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<AvatarType>("classic");
  const [color, setColor] = useState<AvatarColor>("rose");

  const canEnter = nickname.trim().length > 0;

  return (
    <section className="entry-screen">
      <div className="entry-screen__preview">
        <PixelAvatar avatar={avatar} color={color} label="선택한 캐릭터" />
      </div>
      <h1>서준 & 하린의 정원</h1>
      <label className="field">
        <span>닉네임</span>
        <input value={nickname} maxLength={16} onChange={(event) => setNickname(event.target.value)} />
      </label>
      <div className="choice-group" aria-label="캐릭터 선택">
        {avatarOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={avatar === option.value ? "choice choice--selected" : "choice"}
            onClick={() => setAvatar(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="choice-group" aria-label="색상 선택">
        {colorOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={color === option.value ? "choice choice--selected" : "choice"}
            onClick={() => setColor(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        className="primary-button"
        type="button"
        disabled={!canEnter}
        onClick={() => onEnter({ nickname: nickname.trim(), avatar, color })}
      >
        정원 입장
      </button>
    </section>
  );
}
