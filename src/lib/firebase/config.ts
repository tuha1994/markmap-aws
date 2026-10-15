import type { FirebaseOptions } from 'firebase/app';

type FirebaseEnvironment = {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
};

export function getFirebaseConfig(environment: FirebaseEnvironment): FirebaseOptions | null {
  const apiKey = environment.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = environment.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = environment.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = environment.VITE_FIREBASE_APP_ID?.trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return { apiKey, authDomain, projectId, appId };
}

export const firebaseConfig = getFirebaseConfig(import.meta.env);
