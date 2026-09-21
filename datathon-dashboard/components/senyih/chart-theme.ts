'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';

// Recharts takes plain colour strings, so the light/dark palettes live here.
// Light values are the dashboard's original sky / cyan / amber tokens.

export interface ChartColors {
  grid: string;
  tickX: string;
  tickLeft: string;
  tickRight: string;
  sky: string;
  skyBright: string;
  amber: string;
  rose: string;
  roseText: string;
  teal: string;
  muted: string;
  refLine: string;
  cursorFill: string;
  track: string;
  ringText: string;
  ringFrom: string;
  ringTo: string;
  waveA: string;
  waveB: string;
  tooltip: { contentStyle: React.CSSProperties; labelStyle: React.CSSProperties; itemStyle: React.CSSProperties };
}

const LIGHT: ChartColors = {
  grid: '#bae6fd',
  tickX: '#0369a1',
  tickLeft: '#0284c7',
  tickRight: '#d97706',
  sky: '#0284c7',
  skyBright: '#0ea5e9',
  amber: '#f59e0b',
  rose: '#fb7185',
  roseText: '#e11d48',
  teal: '#14b8a6',
  muted: '#94a3b8',
  refLine: '#7dd3fc',
  cursorFill: 'rgba(186,230,253,0.35)',
  track: '#e0f2fe',
  ringText: '#0c4a6e',
  ringFrom: '#38bdf8',
  ringTo: '#0e7490',
  waveA: '#e0f2fe',
  waveB: '#fef3c7',
  tooltip: {
    contentStyle: {
      borderRadius: '12px',
      border: '1px solid #bae6fd',
      background: 'rgba(255,255,255,0.92)',
      boxShadow: '0 8px 24px rgba(14,116,144,0.15)',
    },
    labelStyle: { color: '#0c4a6e', fontWeight: 700 },
    itemStyle: { color: '#0c4a6e' },
  },
};

const DARK: ChartColors = {
  grid: '#0c4a6e',
  tickX: '#7dd3fc',
  tickLeft: '#38bdf8',
  tickRight: '#fbbf24',
  sky: '#38bdf8',
  skyBright: '#7dd3fc',
  amber: '#fbbf24',
  rose: '#fb7185',
  roseText: '#fda4af',
  teal: '#2dd4bf',
  muted: '#64748b',
  refLine: '#0369a1',
  cursorFill: 'rgba(56,189,248,0.12)',
  track: '#0c4a6e',
  ringText: '#e0f2fe',
  ringFrom: '#7dd3fc',
  ringTo: '#0891b2',
  waveA: '#0a3350',
  waveB: '#2d2413',
  tooltip: {
    contentStyle: {
      borderRadius: '12px',
      border: '1px solid #0c4a6e',
      background: 'rgba(15,23,42,0.94)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
    },
    labelStyle: { color: '#e0f2fe', fontWeight: 700 },
    itemStyle: { color: '#e0f2fe' },
  },
};

const subscribe = () => () => {};

/** False during SSR and hydration, true once running in the browser (no setState-in-effect). */
export const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false);

const NARROW_QUERY = '(max-width: 639px)';
const subscribeNarrow = (onChange: () => void) => {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

/** True on phone-width screens, where charts need tighter axes and fewer labels. */
export const useNarrow = () =>
  useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW_QUERY).matches, () => false);

/** Palette for the active theme; the light palette until the client has mounted (avoids hydration mismatch). */
export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  return mounted && resolvedTheme === 'dark' ? DARK : LIGHT;
}
