import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type IndexField = {
  fieldPath: string;
  order: 'ASCENDING' | 'DESCENDING';
};

type FirestoreIndexes = {
  indexes: Array<{
    collectionGroup: string;
    queryScope: string;
    fields: IndexField[];
  }>;
  fieldOverrides: Array<{
    collectionGroup: string;
    fieldPath: string;
    indexes: unknown[];
  }>;
};

function hasCompositeIndex(
  config: FirestoreIndexes,
  collectionGroup: string,
  fields: IndexField[]
): boolean {
  return config.indexes.some((index) =>
    index.collectionGroup === collectionGroup
    && index.queryScope === 'COLLECTION'
    && JSON.stringify(index.fields) === JSON.stringify(fields)
  );
}

describe('Firestore index contract', () => {
  it('declares every active-list multi-field query in firestore.indexes.json', () => {
    const config = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as FirestoreIndexes;

    expect(hasCompositeIndex(config, 'mindMaps', [
      { fieldPath: 'ownerUid', order: 'ASCENDING' },
      { fieldPath: 'deletedAt', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' }
    ])).toBe(true);
    expect(hasCompositeIndex(config, 'folders', [
      { fieldPath: 'ownerUid', order: 'ASCENDING' },
      { fieldPath: 'archivedAt', order: 'ASCENDING' },
      { fieldPath: 'sortOrder', order: 'ASCENDING' }
    ])).toBe(true);
    expect(config.fieldOverrides).toEqual(expect.arrayContaining([
      { collectionGroup: 'mindMaps', fieldPath: 'markdown', indexes: [] },
      { collectionGroup: 'mindMaps', fieldPath: 'contentSearchText', indexes: [] }
    ]));
  });
});
