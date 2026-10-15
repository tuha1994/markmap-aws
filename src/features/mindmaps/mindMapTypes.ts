import type { Timestamp } from 'firebase/firestore';

export interface MindMap {
  ownerUid: string;
  folderId: string | null;
  title: string;
  titleLower: string;
  markdown: string;
  contentSearchText: string;
  contentVersion: number;
  currentRevisionId: string | null;
  currentRevisionAt: Timestamp | null;
  revisionPrunePending: boolean;
  deletedAt: Timestamp | null;
  deletedByUid: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
