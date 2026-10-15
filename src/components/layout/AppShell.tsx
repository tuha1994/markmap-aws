import type { ReactNode } from 'react';

type Props = {
  sidebar: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
};

export function AppShell({ sidebar, editor, preview }: Props) {
  return (
    <div className="app-shell">
      <div className="desktop-pane-layout">
        <aside aria-label="Workspace navigation">{sidebar}</aside>
        <section aria-label="Markdown editor">{editor}</section>
        <section aria-label="Preview pane">{preview}</section>
      </div>
    </div>
  );
}
