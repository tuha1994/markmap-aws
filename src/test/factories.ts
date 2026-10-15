import type { Folder } from '../features/folders/folderTypes';
import type { Revision, RevisionReason } from '../features/history/revisionTypes';
import type { MindMap } from '../features/mindmaps/mindMapTypes';

const timestamp = new Date('2026-10-15T00:00:00.000Z') as never;

export function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    ownerUid: 'owner-uid', name: 'Architecture', normalizedName: 'architecture', color: null,
    sortOrder: 1, archivedAt: null, archivedByUid: null, createdAt: timestamp, updatedAt: timestamp, ...overrides
  };
}

export function makeMindMap(overrides: Partial<MindMap> = {}): MindMap {
  return {
    ownerUid: 'owner-uid', folderId: null, title: 'Cloud foundations', titleLower: 'cloud foundations',
    markdown: '# Cloud foundations', contentSearchText: 'cloud foundations', contentVersion: 1,
    currentRevisionId: null, currentRevisionAt: null, revisionPrunePending: false,
    deletedAt: null, deletedByUid: null, createdAt: timestamp, updatedAt: timestamp, ...overrides
  };
}

export function makeRevision(overrides: Partial<Revision> = {}, reason: RevisionReason = 'manual'): Revision {
  return {
    ownerUid: 'owner-uid', mapId: 'map-1', sourceContentVersion: 1, title: 'Cloud foundations',
    folderId: null, markdown: '# Cloud foundations', reason, createdAt: timestamp, createdByUid: 'owner-uid', ...overrides
  };
}
