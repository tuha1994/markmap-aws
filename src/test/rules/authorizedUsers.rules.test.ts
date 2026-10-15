import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from 'firebase/firestore';

const projectId = 'markmap-aws-rules';
const approvedUid = 'approved-user';
let testEnv: RulesTestEnvironment;

function authorizedUser(uid: string, enabled: boolean): Record<string, unknown> {
  return {
    enabled,
    grantedAt: new Date('2026-10-15T00:00:00.000Z'),
    grantedBy: 'privileged-operator'
  };
}

async function seedAuthorizedUser(uid: string, enabled = true): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'authorizedUsers', uid), authorizedUser(uid, enabled));
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe('authorizedUsers Firestore Rules', () => {
  it('denies unauthenticated, unapproved, and disabled user access', async () => {
    await seedAuthorizedUser(approvedUid);
    await seedAuthorizedUser('disabled-user', false);

    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'folders', 'folder-1')));
    await assertFails(getDoc(doc(testEnv.authenticatedContext('unapproved-user').firestore(), 'folders', 'folder-1')));
    await assertFails(getDoc(doc(testEnv.authenticatedContext('disabled-user').firestore(), 'folders', 'folder-1')));
  });

  it('allows an approved user to get only their own allow-list record', async () => {
    await seedAuthorizedUser(approvedUid);
    await seedAuthorizedUser('another-approved-user');

    const approvedDb = testEnv.authenticatedContext(approvedUid).firestore();

    await assertSucceeds(getDoc(doc(approvedDb, 'authorizedUsers', approvedUid)));
    await assertFails(getDoc(doc(approvedDb, 'authorizedUsers', 'another-approved-user')));
  });

  it('denies browser list/create/update/delete access to authorizedUsers', async () => {
    await seedAuthorizedUser(approvedUid);
    const approvedDb = testEnv.authenticatedContext(approvedUid).firestore();
    const ownRecord = doc(approvedDb, 'authorizedUsers', approvedUid);

    await assertFails(getDocs(collection(approvedDb, 'authorizedUsers')));
    await assertFails(setDoc(doc(approvedDb, 'authorizedUsers', 'self-provisioned'), authorizedUser('self-provisioned', true)));
    await assertFails(updateDoc(ownRecord, { enabled: false }));
    await assertFails(deleteDoc(ownRecord));
  });
});
