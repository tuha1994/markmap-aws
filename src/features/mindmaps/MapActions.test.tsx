import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MapActions } from './MapActions';

describe('MapActions', () => {
  it('confirms create, rename, and logical archive actions', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onRename = vi.fn().mockResolvedValue(undefined);
    const onArchive = vi.fn().mockResolvedValue(undefined);
    render(<MapActions mapTitle="Architecture" onCreate={onCreate} onRename={onRename} onArchive={onArchive} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create map' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Map title' }), { target: { value: 'New map' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreate).toHaveBeenCalledWith('New map');

    fireEvent.click(screen.getByRole('button', { name: 'Rename map' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Map title' }), { target: { value: 'Renamed map' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onRename).toHaveBeenCalledWith('Renamed map');

    fireEvent.click(screen.getByRole('button', { name: 'Archive map' }));
    expect(screen.getByRole('dialog', { name: 'Archive Architecture?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it('disables map-switching actions while the current draft is not durable', () => {
    render(<MapActions mapTitle="Architecture" onCreate={vi.fn()} onRename={vi.fn()} onArchive={vi.fn()} disabled />);

    expect(screen.getByRole('button', { name: 'Create map' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rename map' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive map' })).toBeDisabled();
  });

});
