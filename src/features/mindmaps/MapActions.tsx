import { useState } from 'react';

type Props = {
  mapTitle?: string;
  onCreate(title: string): Promise<void> | void;
  onRename(title: string): Promise<void> | void;
  onArchive(): Promise<void> | void;
  disabled?: boolean;
};

type Dialog = 'create' | 'rename' | 'archive' | null;

export function MapActions({ mapTitle, onCreate, onRename, onArchive, disabled = false }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [title, setTitle] = useState(mapTitle ?? '');

  function open(nextDialog: Exclude<Dialog, null>) {
    setTitle(nextDialog === 'create' ? '' : mapTitle ?? '');
    setDialog(nextDialog);
  }

  async function submit() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }
    if (dialog === 'create') {
      await onCreate(normalizedTitle);
    } else if (dialog === 'rename') {
      await onRename(normalizedTitle);
    }
    setDialog(null);
  }

  async function archive() {
    await onArchive();
    setDialog(null);
  }

  return (
    <div className="map-actions" role="toolbar" aria-label="Map actions">
      <button className="map-actions-create" type="button" disabled={disabled} onClick={() => open('create')}>Create map</button>
      <button type="button" disabled={disabled || !mapTitle} onClick={() => open('rename')}>Rename map</button>
      <button className="map-actions-archive" type="button" disabled={disabled || !mapTitle} onClick={() => open('archive')}>Archive map</button>

      {dialog === 'create' || dialog === 'rename' ? (
        <section role="dialog" aria-modal="true" aria-label={dialog === 'create' ? 'Create map' : `Rename ${mapTitle}?`}>
          <label>
            Map title
            <input aria-label="Map title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </label>
          <button type="button" onClick={() => void submit()}>{dialog === 'create' ? 'Create' : 'Rename'}</button>
          <button type="button" onClick={() => setDialog(null)}>Cancel</button>
        </section>
      ) : null}

      {dialog === 'archive' ? (
        <section role="dialog" aria-modal="true" aria-label={`Archive ${mapTitle}?`}>
          <p>Archived maps are removed from active lists and their revision parent is retained.</p>
          <button type="button" onClick={() => void archive()}>Archive</button>
          <button type="button" onClick={() => setDialog(null)}>Cancel</button>
        </section>
      ) : null}
    </div>
  );
}
