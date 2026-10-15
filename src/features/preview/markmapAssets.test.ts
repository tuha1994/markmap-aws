import { describe, expect, it, vi } from 'vitest';
import { Transformer } from 'markmap-lib';
import { createMarkmapAssetLoader, createPackageAssetLoader, loadMarkmapAssets } from './markmapAssets';

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

  it('loads a newly-created descriptor for a real approved feature asset', async () => {
    const transformer = new Transformer();
    const approved = transformer.getAssets();
    const { features } = transformer.transform('$x$');
    const katexAsset = transformer.getUsedAssets(features).styles?.find((asset) => asset.type === 'stylesheet');

    expect(katexAsset).toBeDefined();
    if (!katexAsset || katexAsset.type !== 'stylesheet') throw new Error('expected KaTeX stylesheet asset');

    const equivalentDescriptor = { type: 'stylesheet' as const, data: { href: katexAsset.data.href } };
    const reviewedDescriptor = approved.styles?.find((asset) => asset.type === 'stylesheet' && asset.data.href === katexAsset.data.href);
    expect(equivalentDescriptor).not.toBe(reviewedDescriptor);

    await createPackageAssetLoader(approved).load({ styles: [equivalentDescriptor], scripts: [] });

    expect(document.head.querySelector(`link[href="${katexAsset.data.href}"]`)).toBeInTheDocument();
  });
});
