import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';

import { observeAuthState, signInWithGoogle, signOutFromGoogle } from './authApi';

export type AuthState = {
  phase: 'loading' | 'signedOut' | 'signedIn' | 'error';
  user: User | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
};

type AuthSnapshot = Pick<AuthState, 'phase' | 'user'>;

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ phase: 'loading', user: null });

  useEffect(() => {
    return observeAuthState(
      (user) => setSnapshot({ phase: user ? 'signedIn' : 'signedOut', user }),
      () => setSnapshot({ phase: 'error', user: null })
    );
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ...snapshot,
      async signIn() {
        try {
          await signInWithGoogle();
        } catch {
          setSnapshot({ phase: 'error', user: null });
        }
      },
      async signOut() {
        try {
          await signOutFromGoogle();
        } finally {
          setSnapshot({ phase: 'signedOut', user: null });
        }
      }
    }),
    [snapshot]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
