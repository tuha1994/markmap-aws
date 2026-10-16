import { useEffect, useRef } from 'react';

import type { ConflictChoice } from './useSaveQueue';

type Props = {
  localMarkdown: string;
  remoteMarkdown: string;
  onResolve(choice: ConflictChoice): void;
};

export function ConflictDialog({ localMarkdown, remoteMarkdown, onResolve }: Props) {
  const keepMineRef = useRef<HTMLButtonElement>(null);
  const useRemoteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    keepMineRef.current?.focus();
  }, []);

  return (
    <section
      className="conflict-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          return;
        }
        if (event.key !== 'Tab') return;

        event.preventDefault();
        if (event.shiftKey) {
          if (document.activeElement === keepMineRef.current) useRemoteRef.current?.focus();
          else keepMineRef.current?.focus();
        } else if (document.activeElement === useRemoteRef.current) {
          keepMineRef.current?.focus();
        } else {
          useRemoteRef.current?.focus();
        }
      }}
    >
      <div className="conflict-dialog-panel">
        <h2 id="conflict-title">Remote change detected</h2>
        <p>Your local draft and the remote version are both preserved until you choose one.</p>
        <section aria-label="Your draft">
          <h3>Your draft</h3>
          <pre>{localMarkdown}</pre>
        </section>
        <section aria-label="Remote version">
          <h3>Remote version</h3>
          <pre>{remoteMarkdown}</pre>
        </section>
        <button ref={keepMineRef} type="button" onClick={() => onResolve('keepMine')}>Keep mine</button>
        <button ref={useRemoteRef} type="button" onClick={() => onResolve('useRemote')}>Use remote</button>
      </div>
    </section>
  );
}
