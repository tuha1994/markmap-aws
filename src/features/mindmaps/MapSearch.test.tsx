import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeMindMap } from '../../test/factories';
import { MapSearch } from './MapSearch';

describe('MapSearch', () => {
  it('shows only a private loading state until the owner-scoped map list is ready', () => {
    render(<MapSearch maps={[{ ...makeMindMap({ title: 'Private map' }), id: 'map-1' }]} loading onSelect={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading private maps');
    expect(screen.queryByRole('textbox', { name: 'Search private maps' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Private map' })).not.toBeInTheDocument();
  });

  it('searches the supplied owner-local maps and selects a result', () => {
    const onSelect = vi.fn();
    render(<MapSearch maps={[{ ...makeMindMap({ title: 'Private map' }), id: 'map-1' }]} onSelect={onSelect} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search private maps' }), { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Private map' }));

    expect(onSelect).toHaveBeenCalledWith('map-1');
  });
});
