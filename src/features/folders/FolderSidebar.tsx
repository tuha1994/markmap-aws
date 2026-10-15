import type { StoredMindMap } from '../mindmaps/mindMapRepository';

import type { StoredFolder } from './folderRepository';

type Props = {
  folders: StoredFolder[];
  maps: StoredMindMap[];
  onArchive(folderId: string): void;
  archiveDisabled?: boolean;
};

export function FolderSidebar({ folders, maps, onArchive, archiveDisabled = false }: Props) {
  return (
    <section aria-label="Folders">
      <h2>Folders</h2>
      <p>All maps ({maps.length})</p>
      <p>Uncategorized maps are shown in the active map list.</p>
      {folders.map((folder) => {
        const mapCount = maps.filter((map) => map.folderId === folder.id).length;
        return (
          <div key={folder.id}>
            <p>{folder.name} ({mapCount})</p>
            <button type="button" onClick={() => onArchive(folder.id)} disabled={archiveDisabled}>Archive {folder.name}</button>
          </div>
        );
      })}
    </section>
  );
}
