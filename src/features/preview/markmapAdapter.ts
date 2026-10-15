import { Transformer, type IAssets, type IFeatures, type ITransformResult } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { createPackageAssetLoader, type MarkmapAssets } from './markmapAssets';
import { sanitizeMarkdownForMarkmap } from './markdownRenderSecurity';

type Root = object;
type View = { setData(root: Root): Promise<unknown> | unknown; fit(): Promise<unknown> | unknown; rescale(ratio: number): Promise<unknown> | unknown; destroy(): void };
type TransformerLike = { transform(markdown: string): ITransformResult | { root: Root; features: IFeatures }; getAssets(): IAssets; getUsedAssets(features: IFeatures): IAssets };
type AdapterDependencies = { transformer?: TransformerLike; transform?: (markdown: string) => Promise<{ root: Root; features: IFeatures }> | { root: Root; features: IFeatures }; createView?: () => View; loadAssets?: (assets: MarkmapAssets) => Promise<void> };

export type RenderResult = { markdown: string };

export function createMarkmapAdapter(svg: SVGSVGElement, dependencies?: AdapterDependencies) {
  const transformer = dependencies?.transformer ?? new Transformer();
  const approvedAssets = transformer.getAssets();
  const view = dependencies?.createView?.() ?? Markmap.create(svg) as unknown as View;
  const transform = dependencies?.transform ?? ((markdown: string) => transformer.transform(markdown));
  const getUsedAssets = dependencies?.transform && !dependencies.transformer
    ? () => ({})
    : (features: IFeatures) => transformer.getUsedAssets(features);
  const loadAssets = dependencies?.loadAssets ?? createPackageAssetLoader(approvedAssets).load;
  return {
    async render(markdown: string): Promise<RenderResult> {
      const safeMarkdown = sanitizeMarkdownForMarkmap(markdown);
      const result = await transform(safeMarkdown);
      await loadAssets(getUsedAssets(result.features));
      await view.setData(result.root);
      return { markdown: safeMarkdown };
    },
    fit: () => { void view.fit(); },
    zoomIn: () => { void view.rescale(1.2); },
    zoomOut: () => { void view.rescale(1 / 1.2); },
    reset: () => { void view.fit(); },
    destroy: () => view.destroy(),
  };
}

export type MarkmapAdapter = ReturnType<typeof createMarkmapAdapter>;