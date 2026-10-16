import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WORKSPACE_LAYOUT_STORAGE_KEY, useWorkspaceLayout } from './useWorkspaceLayout';

describe('useWorkspaceLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })));
  });

  it('uses the system theme on a first visit without persisting any workspace data', () => {
    const { result } = renderHook(() => useWorkspaceLayout());

    expect(result.current.theme).toBe('dark');
    expect(result.current.mode).toBe('edit');
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('persists only theme, mode, and sidebar state when UI preferences change', () => {
    const { result } = renderHook(() => useWorkspaceLayout());

    act(() => {
      result.current.setTheme('light');
      result.current.setMode('focus');
      result.current.setSidebarCollapsed(true);
    });

    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'light',
      mode: 'focus',
      sidebarCollapsed: true
    });
  });

  it('restores valid persisted UI preferences and ignores malformed storage', () => {
    window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({
      theme: 'light', mode: 'focus', sidebarCollapsed: true, markdown: '# private data'
    }));
    const { result, unmount } = renderHook(() => useWorkspaceLayout());

    expect(result.current).toMatchObject({ theme: 'light', mode: 'focus', sidebarCollapsed: true });
    unmount();

    window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, '{broken');
    const malformed = renderHook(() => useWorkspaceLayout());
    expect(malformed.result.current).toMatchObject({ theme: 'dark', mode: 'edit', sidebarCollapsed: false });
  });
});
