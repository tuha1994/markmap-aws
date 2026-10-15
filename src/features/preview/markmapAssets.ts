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
  const loaded = new Set<string>();
  const assetKey = (kind: 'style' | 'script', item: { type: string; data: unknown }): string | undefined => {
    if (item.type === 'stylesheet' && typeof item.data === 'object' && item.data && typeof (item.data as { href?: unknown }).href === 'string') {
      return `${kind}:stylesheet:${JSON.stringify({ href: (item.data as { href: string }).href })}`;
    }
    if (item.type === 'style' && typeof item.data === 'string') return `${kind}:style:${JSON.stringify({ textContent: item.data })}`;
    if (item.type === 'script' && typeof item.data === 'object' && item.data) {
      const data = item.data as { src?: unknown; textContent?: unknown; async?: unknown; defer?: unknown };
      if (typeof data.src !== 'string' && typeof data.textContent !== 'string') return undefined;
      return `${kind}:script:${JSON.stringify({ src: data.src, textContent: data.textContent, async: data.async === true, defer: data.defer === true })}`;
    }
    if (item.type === 'iife' && typeof item.data === 'object' && item.data) {
      const data = item.data as { fn?: unknown; getParams?: unknown };
      if (typeof data.fn !== 'function' || (data.getParams !== undefined && typeof data.getParams !== 'function')) return undefined;
      return `${kind}:iife:${JSON.stringify({ fn: Function.prototype.toString.call(data.fn), getParams: data.getParams && Function.prototype.toString.call(data.getParams) })}`;
    }
    return undefined;
  };
  const approvedKeys = new Set([
    ...(approved.styles ?? []).map((item) => assetKey('style', item)).filter((key): key is string => Boolean(key)),
    ...(approved.scripts ?? []).map((item) => assetKey('script', item)).filter((key): key is string => Boolean(key)),
  ]);
  const assertApproved = (kind: 'style' | 'script', item: { type: string; data: unknown }) => {
    const key = assetKey(kind, item);
    if (!key || !approvedKeys.has(key)) throw new Error('unapproved asset');
    return key;
  };
  return { async load(assets: MarkmapAssets): Promise<void> {
    for (const style of assets.styles ?? []) {
      const key = assertApproved('style', style); if (loaded.has(key)) continue; loaded.add(key);
      if (style.type === 'stylesheet') { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = style.data.href; document.head.append(link); }
      else { const element = document.createElement('style'); element.textContent = style.data; document.head.append(element); }
    }
    for (const script of assets.scripts ?? []) {
      const key = assertApproved('script', script); if (loaded.has(key)) continue; loaded.add(key);
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