import type { IAssets } from 'markmap-lib';
import { Markmap } from 'markmap-view';

export type MarkmapAssets = IAssets;

type LoaderOptions = { appendStyle: (href: string) => void; appendScript: (src: string) => void; isAllowedUrl: (url: string) => boolean };
type ProductionLoader = { load(assets: MarkmapAssets): Promise<void> };

function externalUrl(item: { type: string; data: unknown }): string | undefined {
  if (item.type === 'stylesheet' && typeof item.data === 'object' && item.data) return (item.data as { href?: string }).href;
  if (item.type === 'script' && typeof item.data === 'object' && item.data) return (item.data as { src?: string }).src;
  return undefined;
}

export function createMarkmapAssetLoader(options: LoaderOptions) {
  const loaded = new Set<string>();
  const append = (url: string, action: (value: string) => void) => {
    if (!options.isAllowedUrl(url)) throw new Error('unapproved asset');
    if (loaded.has(url)) return;
    loaded.add(url);
    action(url);
  };
  return { async load(assets: MarkmapAssets): Promise<void> {
    for (const style of assets.styles ?? []) { const url = externalUrl(style); if (style.type === 'stylesheet' && url) append(url, options.appendStyle); }
    for (const script of assets.scripts ?? []) { const url = externalUrl(script); if (script.type === 'script' && url) append(url, options.appendScript); }
  } };
}

function createProductionLoader(approved: MarkmapAssets): ProductionLoader {
  const approvedStyles = new Set(approved.styles ?? []);
  const approvedScripts = new Set(approved.scripts ?? []);
  const loaded = new Set<string>();
  const descriptorKeys = new WeakMap<object, number>();
  let nextDescriptorKey = 0;
  const assetKey = (kind: string, item: { type: string; data: unknown }) => {
    const url = externalUrl(item);
    if (url) return `${kind}:${item.type}:${url}`;
    if (!descriptorKeys.has(item)) descriptorKeys.set(item, nextDescriptorKey += 1);
    return `${kind}:${item.type}:${descriptorKeys.get(item)}`;
  };
  const assertApproved = (kind: 'style' | 'script', item: object) => {
    const allowed = kind === 'style' ? approvedStyles as Set<object> : approvedScripts as Set<object>;
    if (!allowed.has(item)) throw new Error('unapproved asset');
  };
  return { async load(assets: MarkmapAssets): Promise<void> {
    for (const style of assets.styles ?? []) {
      assertApproved('style', style);
      const key = assetKey('style', style); if (loaded.has(key)) continue; loaded.add(key);
      if (style.type === 'stylesheet') { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = style.data.href; document.head.append(link); }
      else { const element = document.createElement('style'); element.textContent = style.data; document.head.append(element); }
    }
    for (const script of assets.scripts ?? []) {
      assertApproved('script', script);
      const key = assetKey('script', script); if (loaded.has(key)) continue; loaded.add(key);
      if (script.type === 'iife') { script.data.fn(...(script.data.getParams?.({ getMarkmap: () => Markmap }) ?? [])); continue; }
      const element = document.createElement('script');
      if (script.data.src) element.src = script.data.src;
      if (script.data.textContent) element.textContent = script.data.textContent;
      element.async = script.data.async ?? false; element.defer = script.data.defer ?? false;
      document.head.append(element);
    }
  } };
}

export function loadMarkmapAssets(assets: MarkmapAssets, approved: MarkmapAssets): Promise<void> {
  return createProductionLoader(approved).load(assets);
}

export function createPackageAssetLoader(approved: MarkmapAssets): ProductionLoader {
  return createProductionLoader(approved);
}