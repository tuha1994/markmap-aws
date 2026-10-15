import { useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { getOwnAuthorization } from './accessRepository';

type AccessPhase = 'checking' | 'allowed' | 'denied' | 'error';

export function AccessGate({
  children,
  onPrivateStateClear
}: {
  children: ReactNode;
  onPrivateStateClear(): void;
}) {
  const { phase: authPhase, signOut, user } = useAuth();
  const [accessPhase, setAccessPhase] = useState<AccessPhase>('checking');
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let active = true;

    if (authPhase !== 'signedIn' || !user) {
      onPrivateStateClear();
      setAccessPhase('checking');
      return () => {
        active = false;
      };
    }

    setAccessPhase('checking');
    void getOwnAuthorization(user.uid)
      .then((authorization) => {
        if (!active) {
          return;
        }

        if (authorization?.enabled) {
          setAccessPhase('allowed');
          return;
        }

        onPrivateStateClear();
        setAccessPhase('denied');
      })
      .catch(() => {
        if (!active) {
          return;
        }

        onPrivateStateClear();
        setAccessPhase('error');
      });

    return () => {
      active = false;
    };
  }, [authPhase, onPrivateStateClear, retryVersion, user]);

  if (authPhase !== 'signedIn' || !user) {
    return null;
  }

  if (accessPhase === 'checking') {
    return <main aria-label="Access loading">Checking access…</main>;
  }

  if (accessPhase === 'allowed') {
    return <>{children}</>;
  }

  return (
    <main aria-label="Access denied">
      <p role="alert">
        {accessPhase === 'denied'
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
