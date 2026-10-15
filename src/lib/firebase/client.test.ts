import { describe, expect, it, vi } from 'vitest';

const firebaseApp = vi.hoisted(() => ({
  getApps: vi.fn(),
  initializeApp: vi.fn()
}));
const firebaseAuth = vi.hoisted(() => ({ getAuth: vi.fn() }));
const firebaseFirestore = vi.hoisted(() => ({ getFirestore: vi.fn() }));

vi.mock('firebase/app', () => firebaseApp);
vi.mock('firebase/auth', () => firebaseAuth);
vi.mock('firebase/firestore', () => firebaseFirestore);

import { createFirebaseClient } from './client';

describe('createFirebaseClient', () => {
  it('does not initialize Firebase when the public configuration is unavailable', () => {
    expect(createFirebaseClient(null)).toBeNull();
    expect(firebaseApp.initializeApp).not.toHaveBeenCalled();
  });

  it('initializes the modular clients once from public configuration', () => {
    const app = {};
    const auth = {};
    const firestore = {};
    firebaseApp.getApps.mockReturnValue([]);
    firebaseApp.initializeApp.mockReturnValue(app);
    firebaseAuth.getAuth.mockReturnValue(auth);
    firebaseFirestore.getFirestore.mockReturnValue(firestore);

    expect(
      createFirebaseClient({
        apiKey: 'public-api-key',
        authDomain: 'project.firebaseapp.com',
        projectId: 'project-id',
        appId: 'app-id'
      })
    ).toEqual({ auth, firestore });
    expect(firebaseApp.initializeApp).toHaveBeenCalledTimes(1);
  });
});
