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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

const projectId = 'markmap-aws-owner-data-rules';
const ownerUid = 'map-owner';
const otherUid = 'other-owner';
let testEnv: RulesTestEnvironment;

function folderData(owner: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerUid: owner,
    name: 'Architecture',
    normalizedName: 'architecture',
    color: null,
    sortOrder: 1,
    archivedAt: null,
    archivedByUid: null,
    createdAt: new Date('2026-10-15T00:00:00.000Z'),
    updatedAt: new Date('2026-10-15T00:00:00.000Z'),
    ...overrides
  };
}

function mapData(owner: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerUid: owner,
    folderId: null,
    title: 'Cloud foundations',
    titleLower: 'cloud foundations',
    markdown: '# Cloud foundations',
    contentSearchText: 'cloud foundations',
    contentVersion: 1,
    currentRevisionId: null,
    currentRevisionAt: null,
    revisionPrunePending: false,
    deletedAt: null,
    deletedByUid: null,
    createdAt: new Date('2026-10-15T00:00:00.000Z'),
    updatedAt: new Date('2026-10-15T00:00:00.000Z'),
    ...overrides
  };
}

function revisionData(owner: string, mapId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerUid: owner,
    mapId,
    sourceContentVersion: 1,
    title: 'Cloud foundations',
    folderId: null,
    markdown: '# Cloud foundations',
    reason: 'manual',
    createdAt: new Date('2026-10-15T00:00:00.000Z'),
    createdByUid: owner,
    ...overrides
  };
}

async function seed(data: Record<string, Record<string, unknown>>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(Object.entries(data).map(([path, value]) => setDoc(doc(db, path), value)));
  });
}

async function seedApproved(uid: string, enabled = true): Promise<void> {
  await seed({
    [`authorizedUsers/${uid}`]: {
      enabled,
      grantedAt: new Date('2026-10-15T00:00:00.000Z'),
      grantedBy: 'privileged-operator'
    }
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('owner-scoped Firestore Rules', () => {
  it('denies cross-owner direct document access and unconstrained owner query', async () => {
    await seedApproved(ownerUid);
    await seedApproved(otherUid);
    await seed({
      'mindMaps/owner-map': mapData(ownerUid),
      'folders/owner-folder': folderData(ownerUid)
    });

    const otherDb = testEnv.authenticatedContext(otherUid).firestore();

    await assertFails(getDoc(doc(otherDb, 'mindMaps', 'owner-map')));
    await assertFails(getDoc(doc(otherDb, 'folders', 'owner-folder')));
    await assertFails(getDocs(collection(otherDb, 'mindMaps')));
    await assertFails(getDocs(query(collection(otherDb, 'mindMaps'), where('ownerUid', '==', ownerUid), where('deletedAt', '==', null))));
  });

  it('denies immutable owner UID changes for maps and folders', async () => {
    await seedApproved(ownerUid);
    await seed({
      'folders/folder-1': folderData(ownerUid),
      'mindMaps/map-1': mapData(ownerUid)
    });
    const db = testEnv.authenticatedContext(ownerUid).firestore();

    await assertFails(updateDoc(doc(db, 'folders', 'folder-1'), { ownerUid: otherUid }));
    await assertFails(updateDoc(doc(db, 'mindMaps', 'map-1'), { ownerUid: otherUid }));
  });

  it('accepts 256 KiB UTF-8 ASCII and Unicode Markdown and rejects values above 262144 bytes through Rules', async () => {
    await seedApproved(ownerUid);
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    const sizes = [
      ['ascii-below', 'a'.repeat(262143), true],
      ['ascii-equal', 'a'.repeat(262144), true],
      ['ascii-above', 'a'.repeat(262145), false],
      ['unicode-below', '😀'.repeat(65535) + 'aa', true],
      ['unicode-equal', '😀'.repeat(65536), true],
      ['unicode-above', '😀'.repeat(65536) + 'a', false]
    ] as const;

    for (const [id, markdown, allowed] of sizes) {
      const write = setDoc(doc(db, 'mindMaps', id), mapData(ownerUid, {
        title: id,
        titleLower: id,
        markdown,
        contentSearchText: markdown
      }));

      if (allowed) {
        await assertSucceeds(write);
      } else {
        await assertFails(write);
      }
    }
  });

  it('denies physical map/folder deletes, archived/deleted-object reads, and permits owner logical archive transitions', async () => {
    await seedApproved(ownerUid);
    await seed({
      'folders/folder-1': folderData(ownerUid),
      'mindMaps/map-1': mapData(ownerUid)
    });
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    const folderRef = doc(db, 'folders', 'folder-1');
    const mapRef = doc(db, 'mindMaps', 'map-1');

    await assertFails(deleteDoc(folderRef));
    await assertFails(deleteDoc(mapRef));
    await assertSucceeds(updateDoc(folderRef, {
      archivedAt: serverTimestamp(),
      archivedByUid: ownerUid,
      updatedAt: serverTimestamp()
    }));
    await assertFails(getDoc(folderRef));

    await assertSucceeds(updateDoc(mapRef, {
      deletedAt: serverTimestamp(),
      deletedByUid: ownerUid,
      updatedAt: serverTimestamp()
    }));
    await assertFails(getDoc(mapRef));
  });

  it('permits valid owner-constrained map and folder access', async () => {
    await seedApproved(ownerUid);
    const db = testEnv.authenticatedContext(ownerUid).firestore();
    const folderRef = doc(db, 'folders', 'folder-1');
    const mapRef = doc(db, 'mindMaps', 'map-1');

    await assertSucceeds(setDoc(folderRef, folderData(ownerUid)));
    await assertSucceeds(setDoc(mapRef, mapData(ownerUid, { folderId: 'folder-1' })));
    await assertSucceeds(getDocs(query(
      collection(db, 'folders'),
      where('ownerUid', '==', ownerUid),
      where('archivedAt', '==', null)
    )));
    await assertSucceeds(getDocs(query(
      collection(db, 'mindMaps'),
      where('ownerUid', '==', ownerUid),
      where('deletedAt', '==', null)
    )));
  });

  it('permits valid revision creation but denies revision mutation and non-owner access', async () => {
    await seedApproved(ownerUid);
    await seedApproved(otherUid);
    await seed({ 'mindMaps/map-1': mapData(ownerUid) });
    const ownerDb = testEnv.authenticatedContext(ownerUid).firestore();
    const otherDb = testEnv.authenticatedContext(otherUid).firestore();
    const revisionRef = doc(ownerDb, 'mindMaps', 'map-1', 'revisions', 'revision-1');

    await assertSucceeds(setDoc(revisionRef, revisionData(ownerUid, 'map-1')));
    await assertFails(updateDoc(revisionRef, { title: 'Changed' }));
    await assertFails(getDoc(doc(otherDb, 'mindMaps', 'map-1', 'revisions', 'revision-1')));
  });
});
