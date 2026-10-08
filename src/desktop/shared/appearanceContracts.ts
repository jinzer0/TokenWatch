import { z } from 'zod';

export const desktopThemes = ['graphite', 'paper', 'slate'] as const;
export const desktopThemeSchema = z.enum(desktopThemes);
export type DesktopTheme = z.infer<typeof desktopThemeSchema>;

export const desktopAppearanceSettingsSchema = z
  .object({
    theme: desktopThemeSchema,
    status: z.enum(['default', 'saved', 'unavailable'])
  })
  .strict();
export type DesktopAppearanceSettings = z.infer<typeof desktopAppearanceSettingsSchema>;

export const desktopAppearanceSetThemeArgsSchema = z.tuple([desktopThemeSchema]);
export const desktopAppearanceIpcChannels = {
  getSettings: 'appearance:get-settings',
  setTheme: 'appearance:set-theme'
} as const;
export type DesktopAppearanceIpcChannel =
  (typeof desktopAppearanceIpcChannels)[keyof typeof desktopAppearanceIpcChannels];
