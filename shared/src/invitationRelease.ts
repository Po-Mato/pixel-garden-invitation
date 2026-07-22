export type InvitationReleaseAction = "publish" | "scheduled" | "restore";

export type InvitationReleaseComponentStatus = {
  draftRevision: number;
  publishedRevision: number | null;
  updatedAt: string | null;
  publishedAt: string | null;
  ready: boolean;
  changed: boolean;
  issues: string[];
};

export type InvitationReleaseSchedule = {
  id: string;
  contentRevision: number;
  galleryRevision: number;
  scheduledFor: string;
  createdAt: string;
  updatedAt: string;
};

export type InvitationReleaseVersion = {
  id: string;
  releaseNumber: number;
  action: InvitationReleaseAction;
  sourceReleaseId: string | null;
  contentRevision: number;
  galleryRevision: number;
  createdAt: string;
};

export type InvitationReleaseAdminResult = {
  content: InvitationReleaseComponentStatus;
  gallery: InvitationReleaseComponentStatus;
  schedule: InvitationReleaseSchedule | null;
  latestRelease: InvitationReleaseVersion | null;
  history: InvitationReleaseVersion[];
};

export type InvitationReleasePublicResult = {
  content: EditableInvitationContent | null;
  gallery: EditableInvitationGallery | null;
  releaseNumber: number | null;
  contentRevision: number | null;
  galleryRevision: number | null;
  publishedAt: string | null;
};
import type { EditableInvitationContent } from "./editableInvitationContent";
import type { EditableInvitationGallery } from "./editableInvitationGallery";
