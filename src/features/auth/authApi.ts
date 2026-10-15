import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';

import { getFirebaseClient } from '../../lib/firebase/client';

const googleProvider = new GoogleAuthProvider();
const missingConfigurationMessage = 'Firebase configuration is unavailable. Check the deployment configuration and retry.';

function getAuth() {
  const client = getFirebaseClient();

  if (!client) {
    throw new Error(missingConfigurationMessage);
  }

  return client.auth;
}

export function observeAuthState(onUser: (user: User | null) => void, onError: (error: Error) => void) {
  try {
    return onAuthStateChanged(getAuth(), onUser, () => {
      onError(new Error('Your sign-in session could not be verified. Please retry.'));
    });
  } catch (error) {
    onError(error instanceof Error ? error : new Error(missingConfigurationMessage));
    return () => undefined;
  }
}

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(getAuth(), googleProvider);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;

    if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in was interrupted. Please allow the popup and retry.');
    }

    if (code === 'auth/unauthorized-domain') {
      throw new Error('Google sign-in could not open for this site. Check the authorized domain and retry.');
    }

    if (error instanceof Error && error.message === missingConfigurationMessage) {
      throw error;
    }

    throw new Error('Google sign-in failed. Please retry.');
  }
}

export async function signOutFromGoogle(): Promise<void> {
  await signOut(getAuth());
}
