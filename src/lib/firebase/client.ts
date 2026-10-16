import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

import { firebaseConfig, firebaseEmulatorConfig } from './config';

export type FirebaseClient = {
  auth: Auth;
  firestore: Firestore;
};

let firebaseClient: FirebaseClient | null | undefined;

export function createFirebaseClient(config: FirebaseOptions | null): FirebaseClient | null {
  if (!config) {
    return null;
  }

  const app = getApps().length === 0 ? initializeApp(config) : getApp();

  const auth = getAuth(app);
  const firestore = getFirestore(app);
  if (firebaseEmulatorConfig) {
    connectAuthEmulator(auth, firebaseEmulatorConfig.authUrl, { disableWarnings: true });
    connectFirestoreEmulator(firestore, firebaseEmulatorConfig.firestoreHost, firebaseEmulatorConfig.firestorePort);
  }
  return { auth, firestore };
}

export function getFirebaseClient(): FirebaseClient | null {
  firebaseClient ??= createFirebaseClient(firebaseConfig);
  return firebaseClient;
}
