import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeRevision } from '../../test/factories';
import { VersionHistoryPanel } from './VersionHistoryPanel';

describe('VersionHistoryPanel', () => {
  it('requests a manual immutable version save', () => {
    const onSaveVersion = vi.fn();
    render(<VersionHistoryPanel revisions={[]} onRestore={vi.fn()} onSaveVersion={onSaveVersion} />);

    screen.getByRole('button', { name: 'Save version' }).click();
    expect(onSaveVersion).toHaveBeenCalledTimes(1);
  });

  it('lists immutable revisions newest first and requests confirmation before restore', () => {
    const onRestore = vi.fn();
    render(<VersionHistoryPanel revisions={[
      { id: 'revision-2', ...makeRevision({ title: 'Newest', sourceContentVersion: 2 }) },
      { id: 'revision-1', ...makeRevision({ title: 'Oldest', sourceContentVersion: 1 }) }
    ]} onRestore={onRestore} />);

    expect(screen.getByRole('heading', { name: 'Version history' })).toBeInTheDocument();
    const revisions = screen.getAllByRole('listitem');
    expect(revisions[0]).toHaveTextContent('Newest');
    screen.getByRole('button', { name: 'Restore Newest' }).click();
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'revision-2', title: 'Newest' }));
  });
});
