import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeMindMap } from '../../test/factories';
import { MapList } from './MapList';

describe('MapList', () => {
  it('renders an empty state and lets the owner select an active map', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<MapList maps={[]} selectedMapId={null} onSelect={onSelect} />);
    expect(screen.getByText('Create your first map to start editing.')).toBeInTheDocument();

    rerender(
      <MapList
        maps={[{ ...makeMindMap({ title: 'Architecture' }), id: 'map-1' }]}
        selectedMapId={null}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Architecture' }));
    expect(onSelect).toHaveBeenCalledWith('map-1');
  });
});
