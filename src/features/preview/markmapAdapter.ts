import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { emptyMarkmapAssets, type MarkmapAssets } from './markmapAssets';
import { sanitizeMarkdownForMarkmap } from './markdownRenderSecurity';

type Root = object;
type View = {
  setData(root: Root): Promise<unknown> | unknown;
  fit(): void;
  rescale(ratio: number): void;
  destroy(): void;
};

type TransformResult = { root: Root; assets?: MarkmapAssets };

type AdapterDependencies = {
  transform: (markdown: string) => Promise<TransformResult> | TransformResult;
  createView: () => View;
  loadAssets: (assets: MarkmapAssets) => Promise<void>;
};

export type RenderResult = { markdown: string };

export function createMarkmapAdapter(svg: SVGSVGElement, dependencies?: AdapterDependencies) {
  const transformer = new Transformer();
  const view = dependencies?.createView() ?? Markmap.create(svg) as unknown as View;
  const transform = dependencies?.transform ?? ((markdown: string) => transformer.transform(markdown) as TransformResult);
  const loadAssets = dependencies?.loadAssets ?? (async () => undefined);

  return {
    async render(markdown: string): Promise<RenderResult> {
      const safeMarkdown = sanitizeMarkdownForMarkmap(markdown);
      const result = await transform(safeMarkdown);
      await loadAssets(result.assets ?? emptyMarkmapAssets);
      await view.setData(result.root);
      return { markdown: safeMarkdown };
    },
    fit: () => view.fit(),
    zoomIn: () => view.rescale(1.2),
    zoomOut: () => view.rescale(1 / 1.2),
    reset: () => view.fit(),
    destroy: () => view.destroy(),
  };
}

export type MarkmapAdapter = ReturnType<typeof createMarkmapAdapter>;
