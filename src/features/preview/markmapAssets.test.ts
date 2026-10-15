import { describe, expect, it, vi } from 'vitest';
import { createMarkmapAssetLoader } from './markmapAssets';

describe('createMarkmapAssetLoader', () => {
  it('deduplicates approved package assets and rejects arbitrary descriptors', async () => {
    const append = vi.fn();
    const loader = createMarkmapAssetLoader({
      appendStyle: append,
      appendScript: append,
      isAllowedUrl: (url) => url.startsWith('https://cdn.jsdelivr.net/npm/markmap-'),
    });

    await loader.load({ styles: [{ href: 'https://cdn.jsdelivr.net/npm/markmap-view/style.css' }], scripts: [] });
    await loader.load({ styles: [{ href: 'https://cdn.jsdelivr.net/npm/markmap-view/style.css' }], scripts: [] });
    await expect(loader.load({ styles: [{ href: 'https://evil.example/payload.css' }], scripts: [] })).rejects.toThrow('unapproved asset');

    expect(append).toHaveBeenCalledTimes(1);
  });
});
