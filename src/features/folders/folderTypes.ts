import type { Timestamp } from 'firebase/firestore';

export interface Folder {
  ownerUid: string;
  name: string;
  normalizedName: string;
  color: string | null;
  sortOrder: number;
  archivedAt: Timestamp | null;
  archivedByUid: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
