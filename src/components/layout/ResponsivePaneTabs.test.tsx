import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResponsivePaneTabs } from './ResponsivePaneTabs';

describe('ResponsivePaneTabs', () => {
  it('shows Maps, Edit, and Preview as accessible mobile tabs', () => {
    render(
      <ResponsivePaneTabs
        maps={<p>Map navigation</p>}
        editor={<p>Editor content</p>}
        preview={<p>Preview content</p>}
      />
    );

    expect(screen.getByRole('tab', { name: 'Maps' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Map navigation');

    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

  });

  it('moves the active tab with arrow keys', () => {
    render(
      <ResponsivePaneTabs
        maps={<p>Map navigation</p>}
        editor={<p>Editor content</p>}
        preview={<p>Preview content</p>}
      />
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Maps' }), { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Editor content');
  });
});
