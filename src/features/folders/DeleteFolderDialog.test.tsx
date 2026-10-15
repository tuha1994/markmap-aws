import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeFolder } from '../../test/factories';
import { DeleteFolderDialog } from './DeleteFolderDialog';

describe('DeleteFolderDialog', () => {
  it('requires a destination or cancellation before archiving a non-empty folder', () => {
    const onArchive = vi.fn();
    const onCancel = vi.fn();

    render(
      <DeleteFolderDialog
        folder={{ ...makeFolder({ name: 'Source' }), id: 'source-folder' }}
        folders={[{ ...makeFolder({ name: 'Destination' }), id: 'destination-folder' }]}
        mapCount={2}
        onArchive={onArchive}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('button', { name: 'Archive folder' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onArchive).not.toHaveBeenCalled();
  });

  it('moves maps to Uncategorized only after the user explicitly chooses it', () => {
    const onArchive = vi.fn();

    render(
      <DeleteFolderDialog
        folder={{ ...makeFolder({ name: 'Source' }), id: 'source-folder' }}
        folders={[{ ...makeFolder({ name: 'Destination' }), id: 'destination-folder' }]}
        mapCount={1}
        onArchive={onArchive}
        onCancel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Move maps to' }), { target: { value: '__uncategorized__' } });
    fireEvent.click(screen.getByRole('button', { name: 'Archive folder' }));

    expect(onArchive).toHaveBeenCalledWith(null);
  });

  it('does not offer the folder being archived as a destination', () => {
    render(
      <DeleteFolderDialog
        folder={{ ...makeFolder({ name: 'Source' }), id: 'source-folder' }}
        folders={[
          { ...makeFolder({ name: 'Source' }), id: 'source-folder' },
          { ...makeFolder({ name: 'Destination' }), id: 'destination-folder' }
        ]}
        mapCount={1}
        onArchive={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('option', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Source' })).not.toBeInTheDocument();
  });

  it('offers only active folders owned by the folder owner as destinations', () => {
    render(
      <DeleteFolderDialog
        folder={{ ...makeFolder({ name: 'Source' }), id: 'source-folder' }}
        folders={[
          { ...makeFolder({ name: 'Destination' }), id: 'destination-folder' },
          { ...makeFolder({ name: 'Other owner' }), id: 'other-owner-folder', ownerUid: 'other-owner' },
          { ...makeFolder({ name: 'Archived' }), id: 'archived-folder', archivedAt: new Date() as never }
        ]}
        mapCount={1}
        onArchive={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('option', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Other owner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Archived' })).not.toBeInTheDocument();
  });
});
