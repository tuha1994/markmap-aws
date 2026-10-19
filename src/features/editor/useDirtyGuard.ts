import { useEffect } from 'react';

import type { SaveStatus } from './useSaveQueue';

function needsUnloadProtection(status: SaveStatus): boolean {
  return ['unsaved', 'saving', 'offlinePending', 'error', 'conflict'].includes(status);
}

export function useDirtyGuard(status: SaveStatus): void {
  useEffect(() => {
    if (!needsUnloadProtection(status)) {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [status]);
}
