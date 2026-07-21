export type AdminNotificationKind =
  | "rsvp_created"
  | "rsvp_updated"
  | "guestbook_created"
  | "guestbook_updated";

export type AdminNotificationEmailStatus = "pending" | "retrying" | "sent" | "failed";

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  emailStatus: AdminNotificationEmailStatus;
  emailAttempts: number;
  emailSentAt: string | null;
};

export type AdminNotificationResult = {
  notifications: AdminNotification[];
  unreadCount: number;
  emailConfigured: boolean;
  emailPendingCount: number;
  emailFailedCount: number;
  lastEmailSentAt: string | null;
};
