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
});
