import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, writeBatch, type Firestore } from 'firebase/firestore';

import { moveMapsAndArchiveFolder } from '../../features/folders/folderRepository';
import { createRevisionAndSaveMap } from '../../features/history/revisionRepository';
import { firestoreEmulatorEndpoint } from './emulator';

const projectId = 'markmap-aws-repository-integration';
const ownerUid = 'repository-owner';
let testEnv: RulesTestEnvironment;

function folderData(id: string): Record<string, unknown> {
  return {
    ownerUid,
    name: id,
    normalizedName: id,
    color: null,
    sortOrder: 1,
    archivedAt: null,
    archivedByUid: null,
    createdAt: new Date('2026-10-15T00:00:00.000Z'),
    updatedAt: new Date('2026-10-15T00:00:00.000Z')
  };
}

function mapData(folderId: string | null, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerUid,
    folderId,
    title: 'Map',
    titleLower: 'map',
    markdown: '# Map',
    contentSearchText: 'map',
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

async function seed(data: Record<string, Record<string, unknown>>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    for (const entries of chunk(Object.entries(data), 400)) {
      const batch = writeBatch(database);
      for (const [path, value] of entries) {
        batch.set(doc(database, path), value);
      }
      await batch.commit();
    }
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function asRepositoryDatabase(database: unknown): Firestore {
  return database as Firestore;
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { ...firestoreEmulatorEndpoint(), rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore repository regressions', () => {
  it('relocates more than one Firestore batch of maps with exactly one version increment before archiving the folder', async () => {
    const maps = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [
      `mindMaps/map-${index}`,
      mapData('source-folder')
    ]));
    await seed({
      [`authorizedUsers/${ownerUid}`]: { enabled: true, grantedAt: new Date(), grantedBy: 'operator' },
      'folders/source-folder': folderData('source-folder'),
      'folders/destination-folder': folderData('destination-folder'),
      ...maps
    });

    const database = testEnv.authenticatedContext(ownerUid).firestore();
    await expect(moveMapsAndArchiveFolder(asRepositoryDatabase(database), {
      ownerUid,
      folderId: 'source-folder',
      destinationFolderId: 'destination-folder'
    })).resolves.toEqual({ status: 'archived' });

    const moved = await getDoc(doc(database, 'mindMaps', 'map-500'));
    let sourceData: Record<string, unknown> | undefined;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      sourceData = (await getDoc(doc(context.firestore(), 'folders', 'source-folder'))).data();
    });
    expect(moved.data()).toMatchObject({ folderId: 'destination-folder', contentVersion: 2 });
    expect(moved.data()?.updatedAt.toMillis()).toBeGreaterThan(new Date('2026-10-15T00:00:00.000Z').getTime());
    expect(sourceData).toMatchObject({ archivedByUid: ownerUid });
  }, 30_000);

  it('returns a non-error pending result and creates no autosave snapshot when pruning is pending', async () => {
    await seed({
      [`authorizedUsers/${ownerUid}`]: { enabled: true, grantedAt: new Date(), grantedBy: 'operator' },
      'mindMaps/pending-map': mapData(null, { contentVersion: 4, revisionPrunePending: true })
    });
    const database = testEnv.authenticatedContext(ownerUid).firestore();

    await expect(createRevisionAndSaveMap(asRepositoryDatabase(database), {
      ownerUid,
      mapId: 'pending-map',
      expectedContentVersion: 4,
      title: 'Updated map',
      folderId: null,
      markdown: '# Updated',
      contentSearchText: 'updated',
      reason: 'autosave'
    })).resolves.toEqual({ status: 'prune-pending' });

    expect((await getDoc(doc(database, 'mindMaps', 'pending-map'))).data()).toMatchObject({
      title: 'Updated map', markdown: '# Updated', contentVersion: 5, revisionPrunePending: true
    });
    expect((await getDocs(collection(database, 'mindMaps', 'pending-map', 'revisions'))).docs).toHaveLength(0);
  });
});
