import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { DesktopTheme } from '../../../shared/appearanceContracts.js';

const themes: readonly DesktopTheme[] = ['graphite', 'paper', 'slate'];
const names: Record<DesktopTheme, string> = {
  graphite: 'Graphite',
  paper: 'Paper',
  slate: 'Slate'
};
type AppearanceStatus = 'loading' | 'default' | 'saved' | 'saving' | 'load-failed' | 'save-failed';
const messages: Record<AppearanceStatus, string> = {
  loading: '화면 설정 불러오는 중',
  default: '기본 테마',
  saved: '저장됨',
  saving: '저장 중',
  'load-failed': '화면 설정을 불러오지 못했습니다',
  'save-failed': '이번 실행에만 적용'
};

export const AppearanceSettings = (): ReactElement => {
  const [theme, setTheme] = useState<DesktopTheme>('graphite');
  const [status, setStatus] = useState<AppearanceStatus>('loading');
  const [open, setOpen] = useState(false);
  const generation = useRef(0);
  const active = useRef(false);
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    active.current = true;
    const request = ++generation.current;
    const load = async (): Promise<void> => {
      try {
        const settings = await window.tokenwatch.appearance.getSettings();
        if (!active.current || request !== generation.current) return;
        setTheme(settings.theme);
        setStatus(settings.status === 'unavailable' ? 'load-failed' : settings.status);
      } catch {
        if (active.current && request === generation.current) setStatus('load-failed');
      }
    };
    void load();
    return () => {
      active.current = false;
      generation.current += 1;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
  }, [theme]);

  useEffect(() => {
    if (!open) return;
    const frame = document.querySelector('.dashboard-frame');
    frame?.setAttribute('inert', '');
    const focusSelected = (): void => {
      dialog.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    };
    focusSelected();
    const keepFocus = (event: FocusEvent): void => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) focusSelected();
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === 'Tab') {
        const controls = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>('input:checked, button') ?? []
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('focusin', keepFocus);
      frame?.removeAttribute('inert');
      opener.current?.focus();
    };
  }, [open]);

  const selectTheme = async (next: DesktopTheme): Promise<void> => {
    const request = ++generation.current;
    setTheme(next);
    setStatus('saving');
    try {
      const settings = await window.tokenwatch.appearance.setTheme(next);
      if (!active.current || request !== generation.current) return;
      setStatus(settings.status === 'saved' ? 'saved' : 'save-failed');
    } catch {
      if (active.current && request === generation.current) setStatus('save-failed');
    }
  };

  return (
    <>
      <button
        ref={opener}
        className="settings-button"
        type="button"
        aria-label="화면 설정"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        설정
      </button>
      {open
        ? createPortal(
            <div className="appearance-backdrop">
              <div
                ref={dialog}
                className="appearance-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="appearance-title"
              >
                <h2 id="appearance-title">화면 설정</h2>
                <div className="theme-choices" role="radiogroup" aria-label="테마">
                  {themes.map((choice, index) => (
                    <label key={choice} className="theme-choice" data-choice={choice}>
                      <input
                        type="radio"
                        aria-label={names[choice]}
                        name="desktop-theme"
                        value={choice}
                        checked={theme === choice}
                        onChange={() => void selectTheme(choice)}
                        onKeyDown={(event) => {
                          const direction =
                            event.key === 'ArrowRight' || event.key === 'ArrowDown'
                              ? 1
                              : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                                ? -1
                                : 0;
                          if (!direction) return;
                          event.preventDefault();
                          const next = themes[(index + direction + themes.length) % themes.length];
                          if (!next) return;
                          void selectTheme(next);
                          dialog.current
                            ?.querySelector<HTMLInputElement>(`input[value="${next}"]`)
                            ?.focus();
                        }}
                      />
                      <span className="theme-swatch" aria-hidden="true" />
                      <span>{names[choice]}</span>
                      <span className="theme-selected">{theme === choice ? '선택됨' : ''}</span>
                    </label>
                  ))}
                </div>
                <p className="appearance-status" role="status" aria-live="polite">
                  {messages[status]}
                </p>
                <button className="settings-button" type="button" onClick={() => setOpen(false)}>
                  돌아가기
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};
