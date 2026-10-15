import { describe, expect, it, vi } from 'vitest';

const firebaseAuth = vi.hoisted(() => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('firebase/auth', () => firebaseAuth);
vi.mock('../../lib/firebase/client', () => ({
  getFirebaseClient: vi.fn()
}));

import { getFirebaseClient } from '../../lib/firebase/client';
import { signInWithGoogle } from './authApi';

describe('signInWithGoogle', () => {
  it('maps popup authorization errors to a safe retry message', async () => {
    vi.mocked(getFirebaseClient).mockReturnValue({ auth: {} } as never);
    firebaseAuth.signInWithPopup.mockRejectedValue({ code: 'auth/unauthorized-domain' });

    await expect(signInWithGoogle()).rejects.toThrow(
      'Google sign-in could not open for this site. Check the authorized domain and retry.'
    );
  });
});
