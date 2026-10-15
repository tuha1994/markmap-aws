import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessGate } from '../features/access/AccessGate';
import { getOwnAuthorization } from '../features/access/accessRepository';
import { AuthGate } from '../features/auth/AuthGate';
import { useAuth } from '../features/auth/AuthProvider';
import { App } from './App';

const auth = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('../features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => auth.current
}));
vi.mock('../features/access/accessRepository', () => ({
  getOwnAuthorization: vi.fn()
}));
vi.mock('../features/preview/MarkmapPreview', () => ({
  MarkmapPreview: () => (
    <section aria-label="Mind map preview">
      <button type="button">Fit preview</button>
    </section>
  )
}));
const mockedGetOwnAuthorization = vi.mocked(getOwnAuthorization);

function PrivateWorkspace({ onRender }: { onRender?(uid: string): void }) {
  const { user } = useAuth();

  onRender?.(user?.uid ?? 'missing-user');
  return <main aria-label="Markmap AWS workspace" />;
}

function ComposedGates({
  onPrivateStateClear,
  onPrivateRender
}: {
  onPrivateStateClear(): void;
  onPrivateRender?(uid: string): void;
}) {
  return (
    <AuthGate onPrivateStateClear={onPrivateStateClear}>
      <AccessGate onPrivateStateClear={onPrivateStateClear}>
        <PrivateWorkspace onRender={onPrivateRender} />
      </AccessGate>
    </AuthGate>
  );
}

function signedIn(uid: string) {
  return {
    phase: 'signedIn' as const,
    user: { uid } as never,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined)
  };
}

function signedOutOrError(phase: 'signedOut' | 'error') {
  return {
    phase,
    user: null,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined)
  };
}

describe('App auth and access composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.current = signedIn('user-a');
    mockedGetOwnAuthorization.mockResolvedValue({ enabled: true } as never);
  });

  it('cleans the private-state boundary when an allowed user signs out after private UI rendered', async () => {
    const onPrivateStateClear = vi.fn();
    const view = render(<ComposedGates onPrivateStateClear={onPrivateStateClear} />);

    await screen.findByRole('main', { name: 'Markmap AWS workspace' });

    auth.current = signedOutOrError('signedOut');
    view.rerender(<ComposedGates onPrivateStateClear={onPrivateStateClear} />);

    expect(screen.getByRole('main', { name: 'Authentication required' })).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: 'Markmap AWS workspace' })).not.toBeInTheDocument();
    await waitFor(() => expect(onPrivateStateClear).toHaveBeenCalledTimes(1));
  });

  it('cleans the private-state boundary when the observer errors after private UI rendered', async () => {
    const onPrivateStateClear = vi.fn();
    const view = render(<ComposedGates onPrivateStateClear={onPrivateStateClear} />);

    await screen.findByRole('main', { name: 'Markmap AWS workspace' });

    auth.current = signedOutOrError('error');
    view.rerender(<ComposedGates onPrivateStateClear={onPrivateStateClear} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in is unavailable.');
    expect(screen.queryByRole('main', { name: 'Markmap AWS workspace' })).not.toBeInTheDocument();
    await waitFor(() => expect(onPrivateStateClear).toHaveBeenCalledTimes(1));
  });

  it('removes A private UI and cleans state before checking B authorization', async () => {
    let resolveBAuthorization: ((authorization: { enabled: boolean }) => void) | undefined;
    const bAuthorization = new Promise<{ enabled: boolean }>((resolve) => {
      resolveBAuthorization = resolve;
    });
    mockedGetOwnAuthorization.mockImplementation((uid) =>
      uid === 'user-a' ? Promise.resolve({ enabled: true } as never) : bAuthorization as never
    );
    const onPrivateStateClear = vi.fn();
    const renderedPrivateUserIds: string[] = [];
    const view = render(
      <ComposedGates
        onPrivateStateClear={onPrivateStateClear}
        onPrivateRender={(uid) => renderedPrivateUserIds.push(uid)}
      />
    );

    await screen.findByRole('main', { name: 'Markmap AWS workspace' });
    expect(renderedPrivateUserIds).toEqual(['user-a']);

    auth.current = signedIn('user-b');
    view.rerender(
      <ComposedGates
        onPrivateStateClear={onPrivateStateClear}
        onPrivateRender={(uid) => renderedPrivateUserIds.push(uid)}
      />
    );

    expect(renderedPrivateUserIds).not.toContain('user-b');
    expect(screen.getByRole('main', { name: 'Access loading' })).toBeInTheDocument();
    await waitFor(() => expect(mockedGetOwnAuthorization).toHaveBeenLastCalledWith('user-b'));
    await waitFor(() => expect(onPrivateStateClear).toHaveBeenCalledTimes(1));

    resolveBAuthorization?.({ enabled: true });

    await screen.findByRole('main', { name: 'Markmap AWS workspace' });
  });

  it('provides an authenticated live Markdown editor and Markmap preview demo', async () => {
    render(<App />);

    await screen.findByRole('main', { name: 'Markmap AWS workspace' });
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Mind map preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit preview' })).toBeInTheDocument();
  });
});
