export type AdminNotificationKind =
  | "rsvp_created"
  | "rsvp_updated"
  | "guestbook_created"
  | "guestbook_updated";

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type AdminNotificationResult = {
  notifications: AdminNotification[];
  unreadCount: number;
  emailConfigured: boolean;
};
