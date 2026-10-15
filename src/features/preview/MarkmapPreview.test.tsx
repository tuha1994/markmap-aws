import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkmapPreview } from './MarkmapPreview';

describe('MarkmapPreview', () => {
  it('renders an SVG host and reports transform errors without exposing source HTML', async () => {
    const renderMarkdown = vi.fn().mockRejectedValue(new Error('bad markdown'));
    render(<MarkmapPreview markdown={'<script>secret()</script>'} createAdapter={() => ({ render: renderMarkdown, destroy: vi.fn(), fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn() })} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to render preview');
    expect(screen.queryByText('secret()')).not.toBeInTheDocument();
  });
});
