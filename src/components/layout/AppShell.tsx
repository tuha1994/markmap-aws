import { useState, type ReactNode } from 'react';

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
const EDITOR_DEFAULT = 39;

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
  const isFocusMode = mode === 'focus';
  const sidebarHidden = isFocusMode || sidebarCollapsed;

  return (
    <div className="app-shell" data-workspace-mode={mode} data-sidebar-collapsed={sidebarCollapsed}>
      <div className="workspace-layout-toolbar" aria-label="Workspace layout controls">
        <div role="group" aria-label="Workspace mode">
          <button type="button" aria-pressed={!isFocusMode} onClick={() => onModeChange('edit')}>Edit mode</button>
          <button type="button" aria-pressed={isFocusMode} onClick={() => onModeChange('focus')}>Focus mode</button>
        </div>
        <button type="button" onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}>
          {sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        </button>
      </div>
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
        <div className="workspace-main-split">
          <section data-workspace-panel="editor" aria-label="Markdown editor" hidden={isFocusMode} style={{ flexBasis: `${editorWidth}%` }}>{editor}</section>
          {!isFocusMode ? <ResizableSplit
            direction="horizontal"
            label="Editor width"
            min={EDITOR_MIN}
            max={EDITOR_MAX}
            defaultValue={EDITOR_DEFAULT}
            value={editorWidth}
            onValueChange={setEditorWidth}
          /> : null}
          <section data-workspace-panel="preview" aria-label="Preview pane" style={{ minWidth: '320px' }}>{preview}</section>
        </div>
      </div>
    </div>
  );
}