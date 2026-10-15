import type { StoredMindMap } from './mindMapRepository';

type Props = {
  maps: StoredMindMap[];
  selectedMapId: string | null;
  onSelect(mapId: string): void;
};

export function MapList({ maps, selectedMapId, onSelect }: Props) {
  if (maps.length === 0) {
    return <p role="status">Create your first map to start editing.</p>;
  }

  return (
    <nav aria-label="Maps">
      <ul>
        {maps.map((map) => (
          <li key={map.id}>
            <button
              type="button"
              aria-current={selectedMapId === map.id ? 'page' : undefined}
              onClick={() => onSelect(map.id)}
            >
              {map.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
