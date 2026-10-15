import type { Timestamp } from 'firebase/firestore';

export type AuthorizedUser = {
  enabled: boolean;
  grantedAt: Timestamp;
  grantedBy: string;
};
