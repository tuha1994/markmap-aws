import { useCallback, useState } from 'react';

export type WorkspaceMode = 'edit' | 'focus';
export type WorkspaceTheme = 'light' | 'dark';

type StoredWorkspaceLayout = {
  theme?: unknown;
  mode?: unknown;
  sidebarCollapsed?: unknown;
};

export type WorkspaceLayout = {
  mode: WorkspaceMode;
  theme: WorkspaceTheme;
  sidebarCollapsed: boolean;
  setMode(mode: WorkspaceMode): void;
  setTheme(theme: WorkspaceTheme): void;
  setSidebarCollapsed(collapsed: boolean): void;
};

export const WORKSPACE_LAYOUT_STORAGE_KEY = 'markmap-aws.workspace-layout';

function systemTheme(): WorkspaceTheme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readPreferences(): Pick<WorkspaceLayout, 'mode' | 'theme' | 'sidebarCollapsed'> {
  const fallback = { theme: systemTheme(), mode: 'edit' as const, sidebarCollapsed: false };
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = JSON.parse(window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? 'null') as StoredWorkspaceLayout | null;
    if (!stored) return fallback;
    return {
      theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : fallback.theme,
      mode: stored.mode === 'edit' || stored.mode === 'focus' ? stored.mode : fallback.mode,
      sidebarCollapsed: typeof stored.sidebarCollapsed === 'boolean' ? stored.sidebarCollapsed : fallback.sidebarCollapsed
    };
  } catch {
    return fallback;
  }
}

export function useWorkspaceLayout(): WorkspaceLayout {
  const [preferences, setPreferences] = useState(readPreferences);
  const updatePreferences = useCallback((update: Partial<Pick<WorkspaceLayout, 'mode' | 'theme' | 'sidebarCollapsed'>>) => {
    setPreferences((current) => {
      const next = { ...current, ...update };
      try {
        window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage is a non-essential UI enhancement.
      }
      return next;
    });
  }, []);

  return {
    ...preferences,
    setMode: (mode) => updatePreferences({ mode }),
    setTheme: (theme) => updatePreferences({ theme }),
    setSidebarCollapsed: (sidebarCollapsed) => updatePreferences({ sidebarCollapsed })
  };
}
