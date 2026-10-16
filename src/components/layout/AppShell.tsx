import type { ReactNode } from 'react';

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

export function AppShell({
  sidebar,
  editor,
  preview,
  mode,
  sidebarCollapsed,
  onModeChange,
  onSidebarCollapsedChange
}: Props) {
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
        <aside data-workspace-panel="sidebar" aria-label="Workspace navigation" hidden={sidebarHidden}>{sidebar}</aside>
        <section data-workspace-panel="editor" aria-label="Markdown editor" hidden={isFocusMode}>{editor}</section>
        <section data-workspace-panel="preview" aria-label="Preview pane">{preview}</section>
      </div>
    </div>
  );
}
