import { useMemo, useState } from "react";
import { MessageCircle, Phone, UserRound, UsersRound } from "lucide-react";
import {
  invitationContent,
  type WeddingEvent,
  type WeddingFamilyContact
} from "@wedding-game/shared";
import { buildFamilyContactLinks } from "../invitation/familyContactLinks";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { coupleSides } from "../invitation/coupleOrder";
import { BottomSheet } from "./BottomSheet";

type FamilyContactSheetProps = {
  onClose: () => void;
  familyContacts?: WeddingEvent["familyContacts"];
};

type WeddingSide = WeddingFamilyContact["side"];

function recipientLabel(contact: WeddingFamilyContact) {
  return contact.name ? `${contact.relation} ${contact.name}` : contact.relation;
}

export function FamilyContactSheet({
  onClose,
  familyContacts = invitationContent.event.familyContacts
}: FamilyContactSheetProps) {
  const coupleOrder = useCoupleOrder();
  const sideOrder = coupleSides(coupleOrder);
  const [activeSide, setActiveSide] = useState<WeddingSide>(sideOrder[0]);
  const contacts = useMemo(
    () => familyContacts.contacts
      .filter((contact) => contact.side === activeSide)
      .map((contact) => ({ contact, links: buildFamilyContactLinks(contact.phone) }))
      .filter(({ links }) => links.telephone !== null),
    [activeSide, familyContacts.contacts]
  );

  return (
    <BottomSheet title="혼주 연락처" onClose={onClose}>
      <div className="family-contact-sheet" data-nosnippet="">
        <div className="family-contact-sheet__intro">
          <UsersRound aria-hidden="true" />
          <p>{familyContacts.notice}</p>
        </div>

        <div className="family-contact-sheet__tabs" role="tablist" aria-label="연락처 구분">
          {sideOrder.map((side) => {
            const label = side === "groom" ? "신랑 측" : "신부 측";
            return (
              <button
                key={side}
                id={`family-contact-tab-${side}`}
                type="button"
                role="tab"
                aria-selected={activeSide === side}
                aria-controls="family-contact-panel"
                onClick={() => setActiveSide(side)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <section
          id="family-contact-panel"
          className="family-contact-sheet__panel"
          role="tabpanel"
          aria-labelledby={`family-contact-tab-${activeSide}`}
        >
          {contacts.length === 0 ? (
            <div className="family-contact-sheet__empty">
              <Phone aria-hidden="true" />
              <strong>{activeSide === "groom" ? "신랑 측" : "신부 측"} 연락처 준비 중</strong>
              <span>
                {activeSide === "groom"
                  ? "신랑과 아버지·어머니의 연락처는 추후 안내드리겠습니다."
                  : "신부와 아버지·어머니의 연락처는 추후 안내드리겠습니다."}
              </span>
            </div>
          ) : (
            <div className="family-contact-sheet__people">
              {contacts.map(({ contact, links }) => (
                <section key={contact.id} className="family-contact-sheet__person">
                  <div className="family-contact-sheet__identity">
                    <UserRound aria-hidden="true" />
                    <div>
                      <strong>{recipientLabel(contact)}</strong>
                      <span>{contact.phone}</span>
                    </div>
                  </div>
                  <div className="family-contact-sheet__actions">
                    <a href={links.telephone ?? undefined} aria-label={`${recipientLabel(contact)}에게 전화하기`}>
                      <Phone aria-hidden="true" />
                      전화
                    </a>
                    {links.sms ? (
                      <a href={links.sms} aria-label={`${recipientLabel(contact)}에게 문자 보내기`}>
                        <MessageCircle aria-hidden="true" />
                        문자
                      </a>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <p className="family-contact-sheet__privacy">
          연락처는 예식 관련 연락이 필요하신 분을 위해서만 안내드립니다.
        </p>
      </div>
    </BottomSheet>
  );
}
