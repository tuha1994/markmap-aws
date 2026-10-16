import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

const svg = document.querySelector('svg');
const status = document.querySelector('output');
const fit = document.querySelector('button');

if (!svg || !status || !fit) throw new Error('Markmap E2E fixture is incomplete.');

const transformer = new Transformer();
const { root } = transformer.transform('# Synthetic root\n## Synthetic child\n### Synthetic leaf');
const markmap = Markmap.create(svg, undefined, root);

fit.addEventListener('click', () => {
  markmap.fit();
  status.textContent = 'fit';
});
