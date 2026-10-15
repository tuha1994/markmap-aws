import { useEffect, useRef, type ReactNode } from 'react';

import { useAuth } from './AuthProvider';

export function AuthGate({
  children,
  onPrivateStateClear
}: {
  children: ReactNode;
  onPrivateStateClear(): void;
}) {
  const { phase, signIn } = useAuth();
  const hadSignedInUser = useRef(false);

  useEffect(() => {
    if (phase === 'signedIn') {
      hadSignedInUser.current = true;
      return;
    }

    if (hadSignedInUser.current && (phase === 'signedOut' || phase === 'error')) {
      onPrivateStateClear();
    }
  }, [onPrivateStateClear, phase]);

  if (phase === 'loading') {
    return <main aria-label="Authentication loading">Checking sign-in status…</main>;
  }

  if (phase === 'signedIn') {
    return <>{children}</>;
  }

  return (
    <main aria-label="Authentication required">
      {phase === 'error' && <p role="alert">Sign-in is unavailable. Check the site configuration and retry.</p>}
      <button type="button" onClick={() => void signIn()}>
        Continue with Google
      </button>
    </main>
  );
}
