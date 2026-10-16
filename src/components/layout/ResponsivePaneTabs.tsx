import { useEffect, useId, useState, type ReactNode } from 'react';

type Pane = 'maps' | 'editor' | 'preview';

type Props = {
  maps: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
  focusMode?: boolean;
};

const panes: Array<{ id: Pane; label: string }> = [
  { id: 'maps', label: 'Maps' },
  { id: 'editor', label: 'Edit' },
  { id: 'preview', label: 'Preview' }
];

export function ResponsivePaneTabs({ maps, editor, preview, focusMode = false }: Props) {
  const [activePane, setActivePane] = useState<Pane>('maps');
  const prefix = useId();
  useEffect(() => {
    if (focusMode) setActivePane('preview');
  }, [focusMode]);
  function selectWithKey(key: string, current: Pane, target: HTMLButtonElement) {
    const currentIndex = panes.findIndex((pane) => pane.id === current);
    const nextIndex = key === 'ArrowRight'
      ? (currentIndex + 1) % panes.length
      : key === 'ArrowLeft'
        ? (currentIndex - 1 + panes.length) % panes.length
        : currentIndex;
    if (nextIndex === currentIndex) return;
    const nextPane = panes[nextIndex];
    setActivePane(nextPane.id);
    target.closest('[role="tablist"]')?.querySelector<HTMLButtonElement>(`#${prefix}-${nextPane.id}-tab`)?.focus();
  }

  const content = { maps, editor, preview }[activePane];

  return (
    <section className="mobile-pane-tabs" aria-label="Workspace panes">
      <div role="tablist" aria-label="Workspace panes">
        {panes.map((pane) => (
          <button
            key={pane.id}
            id={`${prefix}-${pane.id}-tab`}
            type="button"
            role="tab"
            aria-controls={`${prefix}-${pane.id}-panel`}
            aria-selected={activePane === pane.id}
            tabIndex={activePane === pane.id ? 0 : -1}
            onClick={() => setActivePane(pane.id)}
            onKeyDown={(event) => selectWithKey(event.key, pane.id, event.currentTarget)}
          >
            {pane.label}
          </button>
        ))}
      </div>
      <div
        id={`${prefix}-${activePane}-panel`}
        role="tabpanel"
        aria-labelledby={`${prefix}-${activePane}-tab`}
      >
        {content}
      </div>
    </section>
  );
}
