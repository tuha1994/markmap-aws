export type MarkmapAsset = { href?: string; src?: string };
export type MarkmapAssets = { styles: MarkmapAsset[]; scripts: MarkmapAsset[] };

type LoaderOptions = {
  appendStyle: (href: string) => void;
  appendScript: (src: string) => void;
  isAllowedUrl: (url: string) => boolean;
};

export function createMarkmapAssetLoader(options: LoaderOptions) {
  const loaded = new Set<string>();

  const append = (url: string, action: (value: string) => void) => {
    if (!options.isAllowedUrl(url)) throw new Error('unapproved asset');
    if (loaded.has(url)) return;
    loaded.add(url);
    action(url);
  };

  return {
    async load(assets: MarkmapAssets): Promise<void> {
      for (const style of assets.styles) {
        if (style.href) append(style.href, options.appendStyle);
      }
      for (const script of assets.scripts) {
        if (script.src) append(script.src, options.appendScript);
      }
    },
  };
}

export const emptyMarkmapAssets: MarkmapAssets = { styles: [], scripts: [] };
