import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccessGate } from './AccessGate';
import { getOwnAuthorization } from './accessRepository';
import { useAuth } from '../auth/AuthProvider';

vi.mock('../auth/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('./accessRepository', () => ({ getOwnAuthorization: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetOwnAuthorization = vi.mocked(getOwnAuthorization);

describe('AccessGate', () => {
  it.each([
    ['absent', null],
    ['disabled', { enabled: false, grantedAt: 'timestamp', grantedBy: 'operator' }]
  ])('opens unauthorized state for an absent or disabled allow-list record (%s)', async (_state, authorization) => {
    const onPrivateStateClear = vi.fn();
    mockedUseAuth.mockReturnValue({
      phase: 'signedIn',
      user: { uid: 'user-1' } as never,
      signIn: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined)
    });
    mockedGetOwnAuthorization.mockResolvedValue(authorization as never);

    render(
      <AccessGate onPrivateStateClear={onPrivateStateClear}>
        <p>Private workspace</p>
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByText('This account has not been granted access.')).toBeInTheDocument());
    expect(screen.queryByText('Private workspace')).not.toBeInTheDocument();
    expect(onPrivateStateClear).toHaveBeenCalledTimes(1);
  });

  it('clears private state and subscriptions on sign-out', async () => {
    const onPrivateStateClear = vi.fn();
    mockedUseAuth.mockReturnValue({
      phase: 'signedOut',
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined)
    });

    render(
      <AccessGate onPrivateStateClear={onPrivateStateClear}>
        <p>Private workspace</p>
      </AccessGate>
    );

    await waitFor(() => expect(onPrivateStateClear).toHaveBeenCalledTimes(1));
  });
});
