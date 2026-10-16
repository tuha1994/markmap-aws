import { useState } from 'react';

import { MarkdownImportError, parseMarkdownFile, type ParsedMarkdownFile } from './importMarkdown';

type Props = {
  onImport(value: ParsedMarkdownFile): Promise<void> | void;
  onCancel(): void;
  busy?: boolean;
};

export function ImportDialog({ onImport, onCancel, busy = false }: Props) {
  const [parsed, setParsed] = useState<ParsedMarkdownFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function selectFile(file: File | null) {
    setParsed(null);
    setError(null);
    if (!file) return;
    try {
      setParsed(await parseMarkdownFile(file));
    } catch (reason) {
      setError(reason instanceof MarkdownImportError ? reason.message : 'The file could not be imported.');
    }
  }

  async function confirmImport() {
    if (!parsed || busy || importing) return;
    setImporting(true);
    try {
      await onImport(parsed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The new map could not be created.');
      setImporting(false);
    }
  }

  const disabled = busy || importing;
  return (
    <section role="dialog" aria-modal="true" aria-label="Import Markdown">
      <p>Importing creates a new map and does not replace the current map.</p>
      <label>
        Markdown file
        <input
          aria-label="Markdown file"
          type="file"
          accept=".md,text/markdown"
          disabled={disabled}
          onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {parsed ? <p>New map title: <strong>{parsed.title}</strong></p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" disabled={!parsed || disabled} onClick={() => void confirmImport()}>Import as new map</button>
      <button type="button" disabled={disabled} onClick={onCancel}>Cancel</button>
    </section>
  );
}
