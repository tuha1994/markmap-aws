import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

import { firestoreEmulatorEndpoint } from './emulator';

const projectId = 'markmap-aws-revision-rules';
const ownerUid = 'revision-owner';
let testEnv: RulesTestEnvironment;

function mapData(): Record<string, unknown> {
  return {
    ownerUid, folderId: null, title: 'Map', titleLower: 'map', markdown: '# Map', contentSearchText: 'map',
    contentVersion: 1, currentRevisionId: null, currentRevisionAt: null, revisionPrunePending: false,
    deletedAt: null, deletedByUid: null, createdAt: new Date(), updatedAt: new Date()
  };
}

function revisionData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerUid, mapId: 'map-1', sourceContentVersion: 1, title: 'Map', folderId: null, markdown: '# Map',
    reason: 'manual', createdAt: new Date(), createdByUid: ownerUid, ...overrides
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId, firestore: { ...firestoreEmulatorEndpoint(), rules: readFileSync('firestore.rules', 'utf8') }
  });
});
afterEach(async () => testEnv.clearFirestore());
afterAll(async () => testEnv.cleanup());

describe('revision Rules', () => {
  it('rejects every revision update through Rules', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      await setDoc(doc(database, `authorizedUsers/${ownerUid}`), { enabled: true, grantedAt: new Date(), grantedBy: 'operator' });
      await setDoc(doc(database, 'mindMaps/map-1'), mapData());
      await setDoc(doc(database, 'mindMaps/map-1/revisions/revision-1'), revisionData());
    });
    const database = testEnv.authenticatedContext(ownerUid).firestore();

    await assertFails(updateDoc(doc(database, 'mindMaps/map-1/revisions/revision-1'), { title: 'Mutated' }));
  });

  it('rejects revision Markdown exceeding the 256 KiB UTF-8 cap', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      await setDoc(doc(database, `authorizedUsers/${ownerUid}`), { enabled: true, grantedAt: new Date(), grantedBy: 'operator' });
      await setDoc(doc(database, 'mindMaps/map-1'), mapData());
    });
    const database = testEnv.authenticatedContext(ownerUid).firestore();

    await assertSucceeds(setDoc(doc(database, 'mindMaps/map-1/revisions/valid'), revisionData()));
    await assertFails(setDoc(doc(database, 'mindMaps/map-1/revisions/oversized'), revisionData({ markdown: 'a'.repeat(262_145) })));
  });
});
