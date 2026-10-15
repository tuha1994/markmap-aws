import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('../../lib/firebase/client', () => ({ getFirebaseClient: vi.fn() }));

import { getFirebaseClient } from '../../lib/firebase/client';
import { getOwnAuthorization } from './accessRepository';

describe('getOwnAuthorization', () => {
  it('reads only the caller allow-list document', async () => {
    const documentReference = {};
    vi.mocked(getFirebaseClient).mockReturnValue({ firestore: {} } as never);
    firestore.doc.mockReturnValue(documentReference);
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ enabled: true, grantedAt: 'timestamp', grantedBy: 'operator' })
    });

    await expect(getOwnAuthorization('caller-uid')).resolves.toEqual({
      enabled: true,
      grantedAt: 'timestamp',
      grantedBy: 'operator'
    });
    expect(firestore.doc).toHaveBeenCalledWith({}, 'authorizedUsers', 'caller-uid');
    expect(firestore.getDoc).toHaveBeenCalledWith(documentReference);
  });
});
