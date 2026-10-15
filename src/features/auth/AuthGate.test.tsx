import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthGate } from './AuthGate';
import { useAuth } from './AuthProvider';

vi.mock('./AuthProvider', () => ({
  useAuth: vi.fn()
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('AuthGate', () => {
  it('shows the Google sign-in action while signed out', () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      phase: 'signedOut',
      user: null,
      signIn,
      signOut: vi.fn().mockResolvedValue(undefined)
    });

    render(
      <AuthGate onPrivateStateClear={vi.fn()}>
        <p>Private workspace</p>
      </AuthGate>
    );

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.queryByText('Private workspace')).not.toBeInTheDocument();
  });
});
