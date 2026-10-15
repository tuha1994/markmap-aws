import { useEffect, useState } from 'react';

import { getFirebaseClient } from '../../lib/firebase/client';
import { subscribeMindMaps, type StoredMindMap } from './mindMapRepository';

export function useMindMapList(ownerUid: string | null): {
  maps: StoredMindMap[];
  error: Error | null;
} {
  const [maps, setMaps] = useState<StoredMindMap[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerUid) {
      setMaps([]);
      setError(null);
      return;
    }

    const client = getFirebaseClient();
    if (!client) {
      setMaps([]);
      setError(new Error('Firebase configuration is unavailable.'));
      return;
    }

    return subscribeMindMaps(client.firestore, ownerUid, setMaps, setError);
  }, [ownerUid]);

  return { maps, error };
}
