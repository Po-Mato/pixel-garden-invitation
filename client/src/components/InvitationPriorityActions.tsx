import { CalendarDays, Images, MapPin, MessageCircleHeart, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WeddingEvent } from "@wedding-game/shared";
import {
  invitationPriorityActions,
  type InvitationPriorityActionId
} from "../invitation/invitationPriorityActions";
import {
  loadRsvpCredential,
  rsvpCredentialChangedEvent
} from "../invitation/rsvpStorage";

type InvitationPriorityActionsProps = {
  event: WeddingEvent;
  now?: Date;
  onSelect: (sectionId: InvitationPriorityActionId) => void;
};

const icons = {
  rsvp: Send,
  schedule: CalendarDays,
  directions: MapPin,
  guestbook: MessageCircleHeart,
  gallery: Images
} satisfies Record<InvitationPriorityActionId, typeof Send>;

export function InvitationPriorityActions({ event, now, onSelect }: InvitationPriorityActionsProps) {
  const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
  const [hasSavedRsvp, setHasSavedRsvp] = useState(() => Boolean(loadRsvpCredential(invitationId)));

  useEffect(() => {
    const sync = () => setHasSavedRsvp(Boolean(loadRsvpCredential(invitationId)));
    window.addEventListener(rsvpCredentialChangedEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(rsvpCredentialChangedEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, [invitationId]);

  const actions = useMemo(
    () => invitationPriorityActions(event, hasSavedRsvp, now),
    [event, hasSavedRsvp, now]
  );

  return (
    <nav className="invitation-priority-actions" aria-label="지금 필요한 안내">
      <span className="invitation-priority-actions__label">지금 확인하세요</span>
      <div>
        {actions.map(({ id, label, detail }, index) => {
          const Icon = icons[id];
          return (
            <button
              key={id}
              type="button"
              className={index === 0 ? "is-primary" : undefined}
              onClick={() => onSelect(id)}
            >
              <Icon aria-hidden="true" />
              <span><strong>{label}</strong><small>{detail}</small></span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
