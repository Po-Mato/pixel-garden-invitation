import { useMemo, useState } from "react";
import { ChevronDown, Copy, ExternalLink, HeartHandshake, Landmark } from "lucide-react";
import {
  invitationContent,
  type WeddingEvent,
  type WeddingGiftAccount
} from "@wedding-game/shared";
import { copyText } from "../invitation/browserActions";
import { BottomSheet } from "./BottomSheet";

type GiftAccountSheetProps = {
  onClose: () => void;
  giftAccounts?: WeddingEvent["giftAccounts"];
};

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

export function GiftAccountSheet({
  onClose,
  giftAccounts = invitationContent.event.giftAccounts
}: GiftAccountSheetProps) {
  const [activeSide, setActiveSide] = useState<WeddingSide>("bride");
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const accounts = useMemo(
    () => giftAccounts.accounts.filter((account) => account.side === activeSide && hasVisibleDetails(account)),
    [activeSide, giftAccounts.accounts]
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
    <BottomSheet title="마음 전하실 곳" onClose={onClose}>
      <div className="gift-account-sheet" data-nosnippet="">
        <div className="gift-account-sheet__intro">
          <HeartHandshake aria-hidden="true" />
          <p>{giftAccounts.notice}</p>
        </div>

        <div className="gift-account-sheet__tabs" role="tablist" aria-label="계좌 구분">
          {(["bride", "groom"] as const).map((side) => {
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
              {accounts.map((account) => {
                const kakaoPayUrl = safeHttpsUrl(account.kakaoPayUrl);
                const tossUrl = safeHttpsUrl(account.tossUrl);
                const status = copyStatus?.accountId === account.id ? copyStatus.state : "idle";

                return (
                  <details key={account.id} className="gift-account-sheet__account">
                    <summary>
                      <span>
                        <Landmark aria-hidden="true" />
                        <strong>{recipientLabel(account)}</strong>
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
                            disabled={status === "copying"}
                            onClick={() => void copyAccountNumber(account)}
                          >
                            <Copy aria-hidden="true" />
                            복사
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

                      <p className="gift-account-sheet__status" aria-live="polite">
                        {status === "copied" ? "계좌번호를 복사했습니다." : null}
                        {status === "error" ? "복사하지 못했습니다. 계좌번호를 길게 눌러 복사해주세요." : null}
                      </p>
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
    </BottomSheet>
  );
}
