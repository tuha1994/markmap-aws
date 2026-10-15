import type { MindMap } from './mindMapTypes';

export type SearchMatch = 'title-exact' | 'title-prefix' | 'title-substring' | 'content';

export type SearchResult<T extends MindMap = MindMap> = {
  map: T;
  match: SearchMatch;
};

const searchPriority: Record<SearchMatch, number> = {
  'title-exact': 0,
  'title-prefix': 1,
  'title-substring': 2,
  content: 3
};

type SearchCandidate<T extends MindMap> = {
  map: T;
  index: number;
  match: SearchMatch | null;
};

export function searchMindMaps<T extends MindMap>(maps: T[], query: string): SearchResult<T>[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return maps
    .map((map, index): SearchCandidate<T> => ({ map, index, match: findMatch(map, normalizedQuery) }))
    .filter((candidate): candidate is SearchCandidate<T> & { match: SearchMatch } => candidate.match !== null)
    .sort((left, right) => searchPriority[left.match] - searchPriority[right.match] || left.index - right.index)
    .map(({ map, match }) => ({ map, match }));
}

function findMatch(map: MindMap, normalizedQuery: string): SearchMatch | null {
  const title = normalizeSearchText(map.title);
  if (title === normalizedQuery) return 'title-exact';
  if (title.startsWith(normalizedQuery)) return 'title-prefix';
  if (title.includes(normalizedQuery)) return 'title-substring';

  const content = normalizeSearchText(`${map.contentSearchText}\n${map.markdown}`);
  return content.includes(normalizedQuery) ? 'content' : null;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
