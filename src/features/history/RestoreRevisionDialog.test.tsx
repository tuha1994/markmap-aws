import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeRevision } from '../../test/factories';
import { RestoreRevisionDialog } from './RestoreRevisionDialog';

describe('RestoreRevisionDialog', () => {
  it('requires explicit confirmation and explains that the current map is protected first', () => {
    const onRestore = vi.fn();
    render(<RestoreRevisionDialog revision={makeRevision({ title: 'Last known good' })} onRestore={onRestore} onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Restore Last known good?' })).toHaveTextContent('A protected snapshot of the current map will be created first.');
    screen.getByRole('button', { name: 'Restore revision' }).click();
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});
