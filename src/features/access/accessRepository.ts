import { doc, getDoc } from 'firebase/firestore';

import { getFirebaseClient } from '../../lib/firebase/client';
import type { AuthorizedUser } from './accessTypes';

export async function getOwnAuthorization(uid: string): Promise<AuthorizedUser | null> {
  const client = getFirebaseClient();

  if (!client) {
    throw new Error('Firebase configuration is unavailable. Check the deployment configuration and retry.');
  }

  const authorizationSnapshot = await getDoc(doc(client.firestore, 'authorizedUsers', uid));

  if (!authorizationSnapshot.exists()) {
    return null;
  }

  const authorization = authorizationSnapshot.data();

  if (
    typeof authorization.enabled !== 'boolean' ||
    typeof authorization.grantedBy !== 'string' ||
    !('grantedAt' in authorization)
  ) {
    return null;
  }

  return authorization as AuthorizedUser;
}
