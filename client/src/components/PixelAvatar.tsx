import type { AvatarColor, AvatarType } from "@wedding-game/shared";

type PixelAvatarProps = {
  avatar: AvatarType;
  color: AvatarColor;
  label?: string;
  className?: string;
};

export function PixelAvatar({ avatar, color, label, className = "" }: PixelAvatarProps) {
  return (
    <div className={`pixel-avatar pixel-avatar--${avatar} pixel-avatar--${color} ${className}`} aria-label={label}>
      <span className="pixel-avatar__head" />
      <span className="pixel-avatar__body" />
    </div>
  );
}
