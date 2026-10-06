// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/desktop/renderer/src/App.js';
import { AppearanceSettings } from '../../src/desktop/renderer/src/components/AppearanceSettings.js';
import type { TokenWatchDesktopApi } from '../../src/desktop/shared/api.js';
import type { DesktopAppearanceSettings } from '../../src/desktop/shared/appearanceContracts.js';
import type { DesktopDashboardSnapshot } from '../../src/desktop/shared/contracts.js';
import { createDeferred, installTokenwatchApi, setupSnapshot } from './helpers/rendererFixtures.js';

const deferredSettings = () => {
  let resolve!: (settings: DesktopAppearanceSettings) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<DesktopAppearanceSettings>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const saved = (theme: DesktopAppearanceSettings['theme']): DesktopAppearanceSettings => ({
  theme,
  status: 'saved'
});
const installAppearance = (overrides: Partial<TokenWatchDesktopApi['appearance']> = {}) => {
  const appearance: TokenWatchDesktopApi['appearance'] = {
    getSettings: vi.fn<TokenWatchDesktopApi['appearance']['getSettings']>(async () => ({
      theme: 'graphite',
      status: 'default'
    })),
    setTheme: vi.fn<TokenWatchDesktopApi['appearance']['setTheme']>(async (theme) => saved(theme)),
    ...overrides
  };
  installTokenwatchApi({ appearance });
  return appearance;
};
const openSettings = (): HTMLButtonElement => {
  const opener = screen.getByRole<HTMLButtonElement>('button', { name: '화면 설정' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};
const choose = (name: 'Graphite' | 'Paper' | 'Slate'): void => {
  fireEvent.click(screen.getByRole('radio', { name }));
};

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'tokenwatch');
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty('color-scheme');
});

describe('desktop appearance settings', () => {
  it('restores a saved theme through the typed API and applies the root color scheme', async () => {
    installAppearance({ getSettings: vi.fn(async () => saved('paper')) });
    render(<AppearanceSettings />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('paper'));
    expect(document.documentElement.style.colorScheme).toBe('light');
    openSettings();
    expect(screen.getByRole('radiogroup', { name: '테마' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Paper' })).toHaveProperty('checked', true);
    expect(screen.getByRole('status').textContent).toBe('저장됨');
  });

  it('applies a choice immediately and keeps all choices enabled while saving', async () => {
    const pending = deferredSettings();
    const setTheme = vi.fn<TokenWatchDesktopApi['appearance']['setTheme']>(() => pending.promise);
    installAppearance({ setTheme });
    render(<AppearanceSettings />);
    openSettings();
    choose('Slate');
    expect(document.documentElement.dataset.theme).toBe('slate');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(setTheme).toHaveBeenCalledWith('slate');
    expect(screen.getByRole('status').textContent).toBe('저장 중');
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toHaveProperty('disabled', false);
    await act(async () => pending.resolve(saved('slate')));
    expect(screen.getByRole('status').textContent).toBe('저장됨');
  });

  it('keeps the chosen theme for this run after a save rejection', async () => {
    const pending = deferredSettings();
    installAppearance({ setTheme: () => pending.promise });
    render(<AppearanceSettings />);
    openSettings();
    choose('Paper');
    await act(async () => pending.reject(new Error('unavailable')));
    expect(document.documentElement.dataset.theme).toBe('paper');
    expect(screen.getByRole('status').textContent).toBe('이번 실행에만 적용');
  });

  it('treats an unavailable save response as a failure rather than a saved preference', async () => {
    installAppearance({ setTheme: async (theme) => ({ theme, status: 'unavailable' }) });
    render(<AppearanceSettings />);
    openSettings();
    choose('Slate');
    await screen.findByText('이번 실행에만 적용');
    expect(document.documentElement.dataset.theme).toBe('slate');
  });

  it.each(['rejection', 'unavailable'] as const)(
    'reports a load %s without claiming a default or saved preference',
    async (failure) => {
      installAppearance({
        getSettings: async () => {
          if (failure === 'rejection') throw new Error('unavailable');
          return { theme: 'graphite', status: 'unavailable' };
        }
      });
      render(<AppearanceSettings />);
      openSettings();
      await screen.findByText('화면 설정을 불러오지 못했습니다');
      expect(document.documentElement.dataset.theme).toBe('graphite');
      choose('Paper');
      await screen.findByText('저장됨');
      expect(document.documentElement.dataset.theme).toBe('paper');
    }
  );

  it.each(['success', 'rejection'] as const)(
    'ignores an older save %s after a rapid new selection',
    async (completion) => {
      const first = deferredSettings();
      const second = deferredSettings();
      const setTheme = vi
        .fn<TokenWatchDesktopApi['appearance']['setTheme']>()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise);
      installAppearance({ setTheme });
      render(<AppearanceSettings />);
      openSettings();
      choose('Paper');
      choose('Slate');
      expect(setTheme.mock.calls).toEqual([['paper'], ['slate']]);
      await act(async () => second.resolve(saved('slate')));
      await act(async () => {
        if (completion === 'success') first.resolve(saved('paper'));
        else first.reject(new Error('unavailable'));
      });
      expect(document.documentElement.dataset.theme).toBe('slate');
      expect(screen.getByRole('radio', { name: 'Slate' })).toHaveProperty('checked', true);
      expect(screen.getByRole('status').textContent).toBe('저장됨');
    }
  );

  it.each(['success', 'rejection'] as const)(
    'ignores a stale initial load %s after a user selection',
    async (completion) => {
      const initial = deferredSettings();
      installAppearance({ getSettings: () => initial.promise });
      render(<AppearanceSettings />);
      openSettings();
      choose('Slate');
      await screen.findByText('저장됨');
      await act(async () => {
        if (completion === 'success') initial.resolve(saved('paper'));
        else initial.reject(new Error('unavailable'));
      });
      expect(document.documentElement.dataset.theme).toBe('slate');
      expect(screen.getByRole('status').textContent).toBe('저장됨');
    }
  );

  it.each(['success', 'rejection'] as const)(
    'does not apply a pending load or save %s after unmount',
    async (completion) => {
      const initial = deferredSettings();
      const save = deferredSettings();
      installAppearance({ getSettings: () => initial.promise, setTheme: () => save.promise });
      const view = render(<AppearanceSettings />);
      openSettings();
      choose('Slate');
      view.unmount();
      await act(async () => {
        if (completion === 'success') {
          initial.resolve(saved('paper'));
          save.resolve(saved('paper'));
        } else {
          initial.reject(new Error('unavailable'));
          save.reject(new Error('unavailable'));
        }
      });
      expect(document.documentElement.dataset.theme).toBe('slate');
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  );

  it('does not let an older success hide the newest save failure', async () => {
    const first = deferredSettings();
    const second = deferredSettings();
    const setTheme = vi
      .fn<TokenWatchDesktopApi['appearance']['setTheme']>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    installAppearance({ setTheme });
    render(<AppearanceSettings />);
    openSettings();
    choose('Paper');
    choose('Slate');
    await act(async () => second.reject(new Error('unavailable')));
    await act(async () => first.resolve(saved('paper')));
    expect(document.documentElement.dataset.theme).toBe('slate');
    expect(screen.getByRole('status').textContent).toBe('이번 실행에만 적용');
  });

  it('makes settings available during loading and database setup without changing the dashboard request', async () => {
    const snapshot = createDeferred<DesktopDashboardSnapshot>();
    const getSnapshot = vi.fn(() => snapshot.promise);
    installTokenwatchApi({ getSnapshot });
    render(<App />);
    openSettings();
    choose('Paper');
    await screen.findByText('저장됨');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByLabelText('Loading dashboard snapshot')).toBeTruthy();
    await act(async () => snapshot.resolve(setupSnapshot()));
    openSettings();
    expect(screen.getByRole('radio', { name: 'Paper' })).toHaveProperty('checked', true);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('makes settings available when the dashboard fails', async () => {
    installTokenwatchApi({
      getSnapshot: async () => {
        throw new Error('unavailable');
      }
    });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByLabelText('Dashboard status').textContent).toContain('Protected error')
    );
    openSettings();
    expect(screen.getByRole('dialog', { name: '화면 설정' })).toBeTruthy();
  });

  it('supports arrow navigation, traps focus, dismisses with Escape and restores the opener', async () => {
    installAppearance();
    render(<AppearanceSettings />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('graphite'));
    const opener = openSettings();
    const graphite = screen.getByRole('radio', { name: 'Graphite' });
    expect(document.activeElement).toBe(graphite);
    fireEvent.keyDown(graphite, { key: 'ArrowRight' });
    const paper = screen.getByRole('radio', { name: 'Paper' });
    expect(document.activeElement).toBe(paper);
    expect(paper).toHaveProperty('checked', true);
    expect(document.documentElement.dataset.theme).toBe('paper');
    const back = screen.getByRole('button', { name: '돌아가기' });
    fireEvent.keyDown(paper, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(back);
    fireEvent.keyDown(back, { key: 'Tab' });
    expect(document.activeElement).toBe(paper);
    opener.focus();
    expect(document.activeElement).toBe(paper);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
