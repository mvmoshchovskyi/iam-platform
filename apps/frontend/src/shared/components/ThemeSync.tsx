import { useEffect } from 'react';
import { resolveTheme, useThemeStore } from '@/shared/stores/theme.store';

/** Applies the persisted theme as a `dark` class on <html> and follows the OS when set to "system". */
export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const apply = () =>
      document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark');
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
}
