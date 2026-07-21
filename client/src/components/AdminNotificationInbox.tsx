import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Mail, RefreshCw } from "lucide-react";
import type { AdminNotification, AdminNotificationResult } from "@wedding-game/shared";

import {
  fetchAdminNotifications,
  markAdminNotificationsRead,
  WeddingApiError
} from "../api/weddingApi";

type AdminNotificationInboxProps = {
  token: string;
  onUnauthorized: () => void;
};

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Seoul"
    }).format(date);
}

function notificationPage(notification: AdminNotification): { href: string; label: string } {
  return notification.kind.startsWith("rsvp_")
    ? { href: "?admin=rsvp", label: "참석 답변" }
    : { href: "?admin=guestbook", label: "방명록" };
}

export function AdminNotificationInbox({ token, onUnauthorized }: AdminNotificationInboxProps) {
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const onUnauthorizedRef = useRef(onUnauthorized);
  const [result, setResult] = useState<AdminNotificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  async function load(showProgress = true) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showProgress) setLoading(true);
    setError("");
    try {
      const next = await fetchAdminNotifications(token);
      if (mountedRef.current) setResult(next);
    } catch (loadError) {
      if (!mountedRef.current) return;
      if (loadError instanceof WeddingApiError && loadError.status === 401) {
        onUnauthorizedRef.current();
      } else if (showProgress) {
        setError("알림을 불러오지 못했습니다.");
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current && showProgress) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // The token identifies the complete lifetime of this notification inbox.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function markRead(notificationIds?: string[]) {
    const operationId = notificationIds?.[0] ?? "all";
    if (busyId) return;
    setBusyId(operationId);
    setError("");
    try {
      const next = await markAdminNotificationsRead(token, notificationIds);
      if (mountedRef.current) setResult(next);
    } catch (markError) {
      if (!mountedRef.current) return;
      if (markError instanceof WeddingApiError && markError.status === 401) {
        onUnauthorizedRef.current();
      } else {
        setError("알림 상태를 변경하지 못했습니다.");
      }
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  return (
    <section className="admin-notification-inbox" aria-labelledby="admin-notification-title">
      <div className="admin-notification-inbox__header">
        <div>
          <span className="admin-notification-inbox__icon" aria-hidden="true"><Bell /></span>
          <div>
            <h2 id="admin-notification-title">신규 응답 알림</h2>
            <p>
              {result?.unreadCount
                ? `확인하지 않은 알림 ${result.unreadCount}건`
                : "확인하지 않은 알림이 없습니다."}
            </p>
          </div>
        </div>
        <div className="admin-notification-inbox__actions">
          <button
            type="button"
            className="rsvp-admin-secondary admin-notification-inbox__icon-button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="알림 새로고침"
            title="알림 새로고침"
          >
            <RefreshCw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rsvp-admin-secondary"
            onClick={() => void markRead()}
            disabled={!result?.unreadCount || busyId !== null}
          >
            <CheckCheck aria-hidden="true" /> 전체 확인
          </button>
        </div>
      </div>

      {error && <p className="admin-notification-inbox__error" role="alert">{error}</p>}
      {!result && loading ? (
        <p className="admin-notification-inbox__empty" aria-live="polite">알림을 불러오고 있습니다.</p>
      ) : result?.notifications.length ? (
        <ul className="admin-notification-list">
          {result.notifications.map((notification) => {
            const page = notificationPage(notification);
            return (
              <li
                key={notification.id}
                className={notification.readAt ? "admin-notification-item" : "admin-notification-item admin-notification-item--unread"}
              >
                <div>
                  <span className="admin-notification-item__type">{page.label}</span>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                  <time dateTime={notification.createdAt}>{formatNotificationDate(notification.createdAt)}</time>
                </div>
                <div className="admin-notification-item__actions">
                  <a className="rsvp-admin-nav-link" href={page.href}>{page.label} 열기</a>
                  {!notification.readAt && (
                    <button
                      type="button"
                      className="rsvp-admin-secondary admin-notification-inbox__icon-button"
                      onClick={() => void markRead([notification.id])}
                      disabled={busyId !== null}
                      aria-label={`${notification.title} 확인 처리`}
                      title="확인 처리"
                    >
                      <Check aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="admin-notification-inbox__empty">아직 수신된 응답 알림이 없습니다.</p>
      )}

      <p className="admin-notification-inbox__delivery">
        <Mail aria-hidden="true" />
        {result?.emailConfigured ? "관리자 이메일 알림 연결됨" : "관리자 화면 알림 사용 중"}
      </p>
    </section>
  );
}
