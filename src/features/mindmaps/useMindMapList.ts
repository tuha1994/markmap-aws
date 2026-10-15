import { useEffect, useState } from 'react';

import { getFirebaseClient } from '../../lib/firebase/client';
import { subscribeMindMaps, type StoredMindMap } from './mindMapRepository';

export function useMindMapList(ownerUid: string | null): {
  maps: StoredMindMap[];
  loading: boolean;
  error: Error | null;
} {
  const [maps, setMaps] = useState<StoredMindMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerUid) {
      setMaps([]);
      setLoading(false);
      setError(null);
      return;
    }

    setMaps([]);
    setLoading(true);
    setError(null);
    const client = getFirebaseClient();
    if (!client) {
      setLoading(false);
      setError(new Error('Firebase configuration is unavailable.'));
      return;
    }

    return subscribeMindMaps(
      client.firestore,
      ownerUid,
      (nextMaps) => {
        setMaps(nextMaps);
        setLoading(false);
        setError(null);
      },
      (nextError) => {
        setMaps([]);
        setLoading(false);
        setError(nextError);
      }
    );
  }, [ownerUid]);

  return { maps, loading, error };
}
