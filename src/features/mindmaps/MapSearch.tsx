import { useState } from 'react';

import type { StoredMindMap } from './mindMapRepository';
import { searchMindMaps } from './search';

type Props = {
  maps: StoredMindMap[];
  loading?: boolean;
  onSelect(mapId: string): void;
};

export function MapSearch({ maps, loading = false, onSelect }: Props) {
  const [query, setQuery] = useState('');

  if (loading) return <p role="status">Loading private maps…</p>;

  const results = searchMindMaps(maps, query);
  return (
    <section aria-label="Private map search">
      <label>
        Search private maps
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {query && results.length === 0 ? <p role="status">No private maps match your search.</p> : null}
      {results.length > 0 ? (
        <ul aria-label="Search results">
          {results.map(({ map }) => (
            <li key={map.id}><button type="button" onClick={() => onSelect(map.id)}>{map.title}</button></li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
