import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Copy, ExternalLink, HeartHandshake, Landmark } from "lucide-react";
import {
  type WeddingEvent,
  type WeddingGiftAccount
} from "@wedding-game/shared";
import { copyText } from "../invitation/browserActions";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { coupleSides } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { BottomSheet } from "./BottomSheet";

type GiftAccountSheetProps = {
  onClose: () => void;
  giftAccounts?: WeddingEvent["giftAccounts"];
};

type GiftAccountContentProps = Omit<GiftAccountSheetProps, "onClose">;

type WeddingSide = WeddingGiftAccount["side"];
type CopyStatus = { accountId: WeddingGiftAccount["id"]; state: "copying" | "copied" | "error" } | null;

function recipientLabel(account: WeddingGiftAccount) {
  return account.name ? `${account.relation} ${account.name}` : account.relation;
}

function safeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hasAccountDetails(account: WeddingGiftAccount) {
  return Boolean(account.bank.trim() && account.accountNumber.trim() && account.holder.trim());
}

function hasVisibleDetails(account: WeddingGiftAccount) {
  return hasAccountDetails(account) || Boolean(safeHttpsUrl(account.kakaoPayUrl) || safeHttpsUrl(account.tossUrl));
}

export function GiftAccountContent({
  giftAccounts
}: GiftAccountContentProps) {
  const published = usePublishedInvitationContent();
  const resolvedGiftAccounts = giftAccounts ?? published.event.giftAccounts;
  const coupleOrder = useCoupleOrder();
  const sideOrder = coupleSides(coupleOrder);
  const [activeSide, setActiveSide] = useState<WeddingSide>(sideOrder[0]);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const accounts = useMemo(
    () => resolvedGiftAccounts.accounts.filter((account) => account.side === activeSide && hasVisibleDetails(account)),
    [activeSide, resolvedGiftAccounts.accounts]
  );

  const copyAccountNumber = async (account: WeddingGiftAccount) => {
    if (copyStatus?.state === "copying") return;

    setCopyStatus({ accountId: account.id, state: "copying" });
    try {
      await copyText(account.accountNumber);
      setCopyStatus({ accountId: account.id, state: "copied" });
    } catch {
      setCopyStatus({ accountId: account.id, state: "error" });
    }
  };

  return (
    <div className="gift-account-sheet" data-nosnippet="">
        <div className="gift-account-sheet__intro">
          <HeartHandshake aria-hidden="true" />
          <div>
            <span>PRIVATE THANKS</span>
            <p>{resolvedGiftAccounts.notice}</p>
            <small>필요한 분의 계좌만 열어 확인하실 수 있습니다.</small>
          </div>
        </div>

        <div className="gift-account-sheet__tabs" role="tablist" aria-label="계좌 구분">
          {sideOrder.map((side) => {
            const label = side === "groom" ? "신랑 측" : "신부 측";
            return (
              <button
                key={side}
                id={`gift-account-tab-${side}`}
                type="button"
                role="tab"
                aria-selected={activeSide === side}
                aria-controls="gift-account-panel"
                onClick={() => {
                  setActiveSide(side);
                  setCopyStatus(null);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <section
          id="gift-account-panel"
          className="gift-account-sheet__panel"
          role="tabpanel"
          aria-labelledby={`gift-account-tab-${activeSide}`}
        >
          {accounts.length === 0 ? (
            <div className="gift-account-sheet__empty">
              <Landmark aria-hidden="true" />
              <strong>{activeSide === "groom" ? "신랑 측" : "신부 측"} 계좌 정보 준비 중</strong>
              <span>본인과 아버지·어머니 계좌 및 간편송금 링크는 추후 안내드리겠습니다.</span>
            </div>
          ) : (
            <div className="gift-account-sheet__accounts">
              {accounts.map((account, index) => {
                const kakaoPayUrl = safeHttpsUrl(account.kakaoPayUrl);
                const tossUrl = safeHttpsUrl(account.tossUrl);
                const status = copyStatus?.accountId === account.id ? copyStatus.state : "idle";

                return (
                  <details key={account.id} className="gift-account-sheet__account" open={index === 0 ? true : undefined}>
                    <summary>
                      <span className="gift-account-sheet__summary-icon">
                        <Landmark aria-hidden="true" />
                      </span>
                      <span className="gift-account-sheet__summary-copy">
                        <strong>{recipientLabel(account)}</strong>
                        <small>
                          {hasAccountDetails(account)
                            ? `${account.bank} · 계좌번호 확인`
                            : "간편송금으로 마음 전하기"}
                        </small>
                      </span>
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <div className="gift-account-sheet__account-body">
                      {hasAccountDetails(account) ? (
                        <div className="gift-account-sheet__number-row">
                          <div>
                            <span>{account.bank} · 예금주 {account.holder}</span>
                            <strong>{account.accountNumber}</strong>
                          </div>
                          <button
                            type="button"
                            aria-label={`${recipientLabel(account)} 계좌번호 복사`}
                            data-status={status}
                            disabled={status === "copying"}
                            onClick={() => void copyAccountNumber(account)}
                          >
                            {status === "copied" ? <CheckCircle2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
                            {status === "copying" ? "복사 중" : status === "copied" ? "복사 완료" : "계좌 복사"}
                          </button>
                        </div>
                      ) : null}

                      {kakaoPayUrl || tossUrl ? (
                        <div className="gift-account-sheet__transfer-links">
                          {kakaoPayUrl ? (
                            <a href={kakaoPayUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink aria-hidden="true" />
                              카카오페이
                            </a>
                          ) : null}
                          {tossUrl ? (
                            <a href={tossUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink aria-hidden="true" />
                              토스
                            </a>
                          ) : null}
                        </div>
                      ) : null}

                      {status === "copied" || status === "error" ? (
                        <div
                          className="gift-account-sheet__status"
                          data-status={status}
                          role={status === "error" ? "alert" : "status"}
                          aria-live={status === "copied" ? "polite" : undefined}
                        >
                          {status === "copied" ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
                          <span>
                            <strong>{status === "copied" ? "계좌번호 복사 완료" : "자동 복사를 완료하지 못했어요"}</strong>
                            <small>
                              {status === "copied"
                                ? "은행 앱에서 바로 붙여넣을 수 있습니다."
                                : "위 계좌번호를 길게 눌러 직접 복사해 주세요."}
                            </small>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <p className="gift-account-sheet__privacy">
          계좌 정보는 마음을 전하고자 하시는 분을 위해서만 안내드립니다.
        </p>
    </div>
  );
}

export function GiftAccountSheet({ onClose, giftAccounts }: GiftAccountSheetProps) {
  return (
    <BottomSheet
      title="마음 전하실 곳"
      eyebrow="WITH GRATITUDE"
      description="마음을 전하실 분의 정보만 선택해 확인하세요."
      className="invitation-detail-sheet invitation-detail-sheet--gift"
      onClose={onClose}
    >
      <GiftAccountContent giftAccounts={giftAccounts} />
    </BottomSheet>
  );
}
