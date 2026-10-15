import { describe, expect, it, vi } from 'vitest';
import { createMarkmapAdapter } from './markmapAdapter';

describe('createMarkmapAdapter', () => {
  it('sanitizes Markdown before transforming and renders the transformed root', async () => {
    const transform = vi.fn().mockResolvedValue({ root: { v: 'root' }, assets: undefined });
    const setData = vi.fn();
    const destroy = vi.fn();
    const adapter = createMarkmapAdapter(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
      transform,
      createView: () => ({ setData, fit: vi.fn(), rescale: vi.fn(), destroy }),
      loadAssets: vi.fn().mockResolvedValue(undefined),
    });

    await adapter.render('<script>alert(1)</script>');

    expect(transform).toHaveBeenCalledWith(expect.not.stringContaining('<script>'));
    expect(setData).toHaveBeenCalledWith({ v: 'root' });
    adapter.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('retains last valid view when transform fails', async () => {
    const transform = vi.fn()
      .mockResolvedValueOnce({ root: { v: 'first' }, assets: undefined })
      .mockRejectedValueOnce(new Error('bad markdown'));
    const setData = vi.fn();
    const adapter = createMarkmapAdapter(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
      transform,
      createView: () => ({ setData, fit: vi.fn(), rescale: vi.fn(), destroy: vi.fn() }),
      loadAssets: vi.fn().mockResolvedValue(undefined),
    });

    await adapter.render('# first');
    await expect(adapter.render('# second')).rejects.toThrow('bad markdown');
    expect(setData).toHaveBeenCalledTimes(1);
  });

  it('does not pass external image URLs into transformed or rendered data', async () => {
    const transform = vi.fn((markdown: string) => ({ root: { markdown }, features: {} }));
    const setData = vi.fn();
    const adapter = createMarkmapAdapter(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
      transform,
      createView: () => ({ setData, fit: vi.fn(), rescale: vi.fn(), destroy: vi.fn() }),
      loadAssets: vi.fn().mockResolvedValue(undefined),
    });

    await adapter.render('![alt [nested]](https://evil.example/image.png)');

    expect(transform.mock.calls[0][0]).not.toContain('evil.example');
    expect(JSON.stringify(setData.mock.calls[0][0])).not.toMatch(/evil\.example|<img/i);
  });

  it('derives loadable assets from Transformer getAssets and getUsedAssets', async () => {
    const getAssets = vi.fn(() => ({ styles: [{ type: 'stylesheet' as const, data: { href: 'https://cdn.jsdelivr.net/npm/katex/style.css' } }], scripts: [] }));
    const getUsedAssets = vi.fn(() => ({ styles: [{ type: 'stylesheet' as const, data: { href: 'https://cdn.jsdelivr.net/npm/katex/style.css' } }], scripts: [] }));
    const transform = vi.fn(() => ({ root: { v: 'root' }, features: { katex: true } }));
    const loadAssets = vi.fn().mockResolvedValue(undefined);
    const adapter = createMarkmapAdapter(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
      transformer: { transform, getAssets, getUsedAssets },
      createView: () => ({ setData: vi.fn(), fit: vi.fn(), rescale: vi.fn(), destroy: vi.fn() }),
      loadAssets,
    });

    await adapter.render('# root');

    expect(getAssets).toHaveBeenCalledOnce();
    expect(getUsedAssets).toHaveBeenCalledWith({ katex: true });
    expect(loadAssets).toHaveBeenCalledWith(getUsedAssets.mock.results[0].value);
  });
});
