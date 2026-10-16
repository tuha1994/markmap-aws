import type { FirebaseOptions } from 'firebase/app';

type FirebaseEnvironment = {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_USE_EMULATORS?: string;
  VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST?: string;
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT?: string;
  VITE_E2E_APPROVED_EMAIL?: string;
  VITE_E2E_DENIED_EMAIL?: string;
  VITE_E2E_AUTH_PASSWORD?: string;
};

export type FirebaseEmulatorConfig = {
  authUrl: string;
  firestoreHost: string;
  firestorePort: number;
};

export type LocalEmulatorAccount = 'approved' | 'denied';

export type LocalEmulatorCredentials = Record<LocalEmulatorAccount, { email: string; password: string }>;

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

export function getFirebaseEmulatorConfig(environment: FirebaseEnvironment): FirebaseEmulatorConfig | null {
  if (environment.VITE_FIREBASE_USE_EMULATORS !== 'true') return null;
  const authUrl = environment.VITE_FIREBASE_AUTH_EMULATOR_URL?.trim();
  const firestoreHost = environment.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST?.trim();
  const firestorePort = Number(environment.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT);
  if (!authUrl || !firestoreHost || !Number.isInteger(firestorePort) || firestorePort < 1 || firestorePort > 65535) return null;
  return { authUrl, firestoreHost, firestorePort };
}

export function getLocalEmulatorCredentials(environment: FirebaseEnvironment): LocalEmulatorCredentials | null {
  if (!getFirebaseEmulatorConfig(environment)) return null;
  const approvedEmail = environment.VITE_E2E_APPROVED_EMAIL?.trim();
  const deniedEmail = environment.VITE_E2E_DENIED_EMAIL?.trim();
  const password = environment.VITE_E2E_AUTH_PASSWORD?.trim();
  if (!approvedEmail || !deniedEmail || !password) return null;
  return {
    approved: { email: approvedEmail, password },
    denied: { email: deniedEmail, password }
  };
}

export const firebaseConfig = getFirebaseConfig(import.meta.env);
export const firebaseEmulatorConfig = getFirebaseEmulatorConfig(import.meta.env);
export const localEmulatorCredentials = getLocalEmulatorCredentials(import.meta.env);
