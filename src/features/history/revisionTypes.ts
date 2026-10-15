import type { Timestamp } from 'firebase/firestore';

export type RevisionReason = 'autosave' | 'manual' | 'restore-protection';

export interface Revision {
  ownerUid: string;
  mapId: string;
  sourceContentVersion: number;
  title: string;
  folderId: string | null;
  markdown: string;
  reason: RevisionReason;
  createdAt: Timestamp;
  createdByUid: string;
}
