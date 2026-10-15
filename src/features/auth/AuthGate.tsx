import type { ReactNode } from 'react';

import { useAuth } from './AuthProvider';

export function AuthGate({ children }: { children: ReactNode }) {
  const { phase, signIn } = useAuth();

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
