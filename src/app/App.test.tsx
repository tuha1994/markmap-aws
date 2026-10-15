import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('../features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock('../features/auth/AuthGate', () => ({
  AuthGate: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock('../features/access/AccessGate', () => ({
  AccessGate: ({ children }: { children: ReactNode }) => <>{children}</>
}));

describe('App', () => {
  it('places the application shell behind the auth and access gates', () => {
    render(<App />);

    expect(screen.getByRole('main', { name: 'Markmap AWS workspace' })).toBeInTheDocument();
  });
});
