'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useMounted } from './chart-theme';

/** Icon-only light/dark switch: shows the icon of the mode you will switch to. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-10 h-10 rounded-full border border-sky-200 bg-white/70 text-sky-700 hover:bg-white transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:border-sky-700/60 dark:bg-slate-800/70 dark:text-amber-300 dark:hover:bg-slate-800"
    >
      {isDark ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
    </button>
  );
}
