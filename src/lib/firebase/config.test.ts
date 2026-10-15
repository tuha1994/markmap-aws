import { describe, expect, it } from 'vitest';

import { getFirebaseConfig } from './config';

describe('getFirebaseConfig', () => {
  it('returns null when required public Firebase configuration is missing', () => {
    expect(
      getFirebaseConfig({
        VITE_FIREBASE_API_KEY: 'public-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: '',
        VITE_FIREBASE_PROJECT_ID: 'project-id',
        VITE_FIREBASE_APP_ID: 'app-id'
      })
    ).toBeNull();
  });

  it('returns only the required public Firebase values', () => {
    expect(
      getFirebaseConfig({
        VITE_FIREBASE_API_KEY: 'public-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'project-id.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'project-id',
        VITE_FIREBASE_APP_ID: 'app-id'
      })
    ).toEqual({
      apiKey: 'public-api-key',
      authDomain: 'project-id.firebaseapp.com',
      projectId: 'project-id',
      appId: 'app-id'
    });
  });
});
