import { describe, expect, it, vi } from 'vitest';
import { createMarkmapAssetLoader, loadMarkmapAssets } from './markmapAssets';

describe('createMarkmapAssetLoader', () => {
  it('deduplicates approved package assets and rejects arbitrary descriptors', async () => {
    const append = vi.fn();
    const loader = createMarkmapAssetLoader({
      appendStyle: append,
      appendScript: append,
      isAllowedUrl: (url) => url.startsWith('https://cdn.jsdelivr.net/npm/markmap-'),
    });

    await loader.load({ styles: [{ type: 'stylesheet', data: { href: 'https://cdn.jsdelivr.net/npm/markmap-view/style.css' } }], scripts: [] });
    await loader.load({ styles: [{ type: 'stylesheet', data: { href: 'https://cdn.jsdelivr.net/npm/markmap-view/style.css' } }], scripts: [] });
    await expect(loader.load({ styles: [{ type: 'stylesheet', data: { href: 'https://evil.example/payload.css' } }], scripts: [] })).rejects.toThrow('unapproved asset');

    expect(append).toHaveBeenCalledTimes(1);
  });

  it('loads only descriptors from the reviewed package asset inventory', async () => {
    const approved = { styles: [{ type: 'stylesheet' as const, data: { href: 'https://cdn.jsdelivr.net/npm/katex/style.css' } }], scripts: [] };

    await loadMarkmapAssets(approved, approved);

    expect(document.head.querySelector('link[href="https://cdn.jsdelivr.net/npm/katex/style.css"]')).toBeInTheDocument();
    await expect(loadMarkmapAssets({ styles: [{ type: 'stylesheet', data: { href: 'https://evil.example/payload.css' } }], scripts: [] }, approved)).rejects.toThrow('unapproved asset');
  });
});
