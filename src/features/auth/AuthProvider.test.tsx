import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthProvider';
import { observeAuthState } from './authApi';

vi.mock('./authApi', () => ({
  observeAuthState: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutFromGoogle: vi.fn()
}));

function AuthPhase() {
  const { phase } = useAuth();
  return <output>{phase}</output>;
}

describe('AuthProvider', () => {
  it('shows signed out after the Firebase observer reports no user', () => {
    vi.mocked(observeAuthState).mockImplementation((onUser) => {
      onUser(null);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <AuthPhase />
      </AuthProvider>
    );

    expect(screen.getByText('signedOut')).toBeInTheDocument();
  });
});
