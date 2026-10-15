import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { firebaseConfig } from './config';

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

  return {
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}

export function getFirebaseClient(): FirebaseClient | null {
  firebaseClient ??= createFirebaseClient(firebaseConfig);
  return firebaseClient;
}
