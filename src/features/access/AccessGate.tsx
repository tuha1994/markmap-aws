import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { getOwnAuthorization } from './accessRepository';

type AccessPhase = 'checking' | 'allowed' | 'denied' | 'error';

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'permission-denied';
}

export function AccessGate({
  children,
  onPrivateStateClear
}: {
  children: ReactNode;
  onPrivateStateClear(): void;
}) {
  const { phase: authPhase, signOut, user } = useAuth();
  const uid = user?.uid ?? null;
  const [access, setAccess] = useState<{ phase: AccessPhase; uid: string | null }>({
    phase: 'checking',
    uid: null
  });
  const [retryVersion, setRetryVersion] = useState(0);
  const previousUid = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    if (authPhase !== 'signedIn' || !uid) {
      onPrivateStateClear();
      previousUid.current = null;
      setAccess({ phase: 'checking', uid: null });
      return () => {
        active = false;
      };
    }

    if (previousUid.current && previousUid.current !== uid) {
      onPrivateStateClear();
    }
    previousUid.current = uid;
    setAccess({ phase: 'checking', uid });

    void getOwnAuthorization(uid)
      .then((authorization) => {
        if (!active) {
          return;
        }

        if (authorization?.enabled) {
          setAccess({ phase: 'allowed', uid });
          return;
        }

        onPrivateStateClear();
        setAccess({ phase: 'denied', uid });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        onPrivateStateClear();
        setAccess({ phase: isPermissionDenied(error) ? 'denied' : 'error', uid });
      });

    return () => {
      active = false;
    };
  }, [authPhase, onPrivateStateClear, retryVersion, uid]);

  if (authPhase !== 'signedIn' || !uid) {
    return null;
  }

  if (access.uid !== uid || access.phase === 'checking') {
    return <main aria-label="Access loading">Checking access…</main>;
  }

  if (access.phase === 'allowed') {
    return <>{children}</>;
  }

  return (
    <main aria-label="Access denied">
      <p role="alert">
        {access.phase === 'denied'
          ? 'This account has not been granted access.'
          : 'Access could not be verified. Please retry.'}
      </p>
      <button type="button" onClick={() => setRetryVersion((version) => version + 1)}>
        Retry access check
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  );
}
