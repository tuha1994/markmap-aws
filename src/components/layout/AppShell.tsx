import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ResizableSplit } from './ResizableSplit';
import type { WorkspaceMode } from './useWorkspaceLayout';

type Props = {
  sidebar: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
  mode: WorkspaceMode;
  sidebarCollapsed: boolean;
  onModeChange(mode: WorkspaceMode): void;
  onSidebarCollapsedChange(collapsed: boolean): void;
};

const SIDEBAR_MIN = 224;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 300;
const EDITOR_MIN = 27;
const EDITOR_MAX = 62;
const EDITOR_DEFAULT = 35;
const PREVIEW_MIN_WIDTH = 320;
const SPLIT_DIVIDER_WIDTH = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getEditorBounds(containerWidth: number) {
  if (containerWidth <= 0) return { min: EDITOR_MIN, max: EDITOR_MAX };

  const previewSafeMax = (containerWidth - SPLIT_DIVIDER_WIDTH - PREVIEW_MIN_WIDTH) / containerWidth * 100;
  const max = Math.min(EDITOR_MAX, Math.max(0, previewSafeMax));
  return { min: Math.min(EDITOR_MIN, max), max };
}

export function AppShell({
  sidebar,
  editor,
  preview,
  mode,
  sidebarCollapsed,
  onModeChange,
  onSidebarCollapsedChange
}: Props) {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [editorWidth, setEditorWidth] = useState(EDITOR_DEFAULT);
  const mainSplitRef = useRef<HTMLDivElement>(null);
  const [mainSplitWidth, setMainSplitWidth] = useState(0);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 720px)').matches === true);
  const isFocusMode = mode === 'focus';

  useEffect(() => {
    if (!window.matchMedia) return;
    const mobileMedia = window.matchMedia('(max-width: 720px)');
    const updateMobileViewport = () => setIsMobile(mobileMedia.matches);
    updateMobileViewport();
    mobileMedia.addEventListener('change', updateMobileViewport);
    return () => mobileMedia.removeEventListener('change', updateMobileViewport);
  }, []);

  useEffect(() => {
    const measure = () => setMainSplitWidth(mainSplitRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' || !mainSplitRef.current
      ? null
      : new ResizeObserver(measure);
    if (mainSplitRef.current) observer?.observe(mainSplitRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  const editorBounds = getEditorBounds(mainSplitWidth);
  const renderedEditorWidth = clamp(editorWidth, editorBounds.min, editorBounds.max);
  const sidebarHidden = isFocusMode || sidebarCollapsed;

  return (
    <div className="app-shell" data-workspace-mode={mode} data-sidebar-collapsed={sidebarCollapsed}>
      {isMobile ? null : <div className="workspace-layout-toolbar" aria-label="Workspace layout controls">
        <div role="group" aria-label="Workspace mode">
          <button type="button" aria-pressed={!isFocusMode} onClick={() => onModeChange('edit')}>Edit mode</button>
          <button type="button" aria-pressed={isFocusMode} onClick={() => onModeChange('focus')}>Focus mode</button>
        </div>
        <button type="button" onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}>
          {sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        </button>
      </div>}
      <div className="desktop-pane-layout">
        <aside data-workspace-panel="sidebar" aria-label="Workspace navigation" hidden={sidebarHidden} style={{ flexBasis: `${sidebarWidth}px` }}>{sidebar}</aside>
        {!sidebarHidden ? <ResizableSplit
          direction="horizontal"
          label="Sidebar width"
          min={SIDEBAR_MIN}
          max={SIDEBAR_MAX}
          defaultValue={SIDEBAR_DEFAULT}
          value={sidebarWidth}
          step={8}
          onValueChange={setSidebarWidth}
        /> : null}
        <div ref={mainSplitRef} className="workspace-main-split">
          <section
            data-workspace-panel="editor"
            aria-label="Markdown editor"
            hidden={isFocusMode}
            style={{ flex: `0 0 ${renderedEditorWidth}%` }}
          >{editor}</section>
          {!isFocusMode ? <ResizableSplit
            direction="horizontal"
            label="Editor width"
            min={editorBounds.min}
            max={editorBounds.max}
            defaultValue={EDITOR_DEFAULT}
            value={renderedEditorWidth}
            valueUnit="percent"
            onValueChange={(value) => setEditorWidth(clamp(value, editorBounds.min, editorBounds.max))}
          /> : null}
          <section
            data-workspace-panel="preview"
            aria-label="Preview pane"
            style={{ flex: `1 0 ${PREVIEW_MIN_WIDTH}px`, minWidth: `${PREVIEW_MIN_WIDTH}px` }}
          >{preview}</section>
        </div>
      </div>
    </div>
  );
}