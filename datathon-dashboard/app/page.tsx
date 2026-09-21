"use client";

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Palmtree, TriangleAlert, Waves } from 'lucide-react';
import { buildAnalysis, type Analysis } from '@/lib/engine/analysis';
import { N_SEARCH } from '@/lib/engine/pareto';
import { fmtInt, pct1 } from '@/lib/format';
import { GlassCard } from '@/components/senyih/ui';
import { LangkawiPage } from '@/components/senyih/langkawi-page';
import { TiomanPage } from '@/components/senyih/tioman-page';
import { ThemeToggle } from '@/components/senyih/theme-toggle';

// =====================================================================
// SETTINGS
// =====================================================================

/** The workbook every number on this dashboard is computed from (served from /public). */
const EXCEL_PATH = '/data_new.xlsx';

type PageId = 'macro' | 'micro';

const pills: { id: PageId; label: string; short: string }[] = [
  { id: 'macro', label: 'Macro Anchor · Langkawi', short: 'Langkawi' },
  { id: 'micro', label: 'Micro Stress-Test · Tioman', short: 'Tioman' },
];

// =====================================================================
// LOADING PLACEHOLDER
// =====================================================================

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`rounded-3xl border border-sky-200/60 bg-white/50 dark:border-sky-400/10 dark:bg-slate-900/40 motion-safe:animate-pulse ${className}`}
  />
);

const LoadingState = () => (
  <div role="status" aria-live="polite" className="space-y-5">
    <p className="px-1 text-sm font-semibold text-sky-700 dark:text-sky-300">
      Loading data from Excel and running the policy engine…
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-44" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Skeleton className="h-80" />
      <Skeleton className="h-80" />
    </div>
  </div>
);

// =====================================================================
// MAIN APP WRAPPER
// =====================================================================

export default function DashboardApp() {
  const [activePage, setActivePage] = useState<PageId>('macro');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read the workbook once when the page opens and run the ml8.py pipeline on it.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(EXCEL_PATH, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(
            `Could not load ${EXCEL_PATH} (HTTP ${res.status}). Make sure data_new.xlsx is inside your project's public/ folder.`
          );
        }
        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const built = buildAnalysis(workbook);
        if (!cancelled) setAnalysis(built);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="senyih-bg min-h-screen font-sans text-sky-950 dark:text-sky-50 selection:bg-sky-200 dark:selection:bg-sky-700">
      <header className="sticky top-0 z-50 border-b border-sky-200/60 bg-white/70 backdrop-blur-2xl dark:border-sky-400/10 dark:bg-slate-950/70">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-500 text-white shadow-lg shadow-sky-500/30 ring-1 ring-inset ring-white/40">
                <Palmtree size={22} strokeWidth={2.25} />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none">
                  DOSM{' '}
                  <span className="bg-gradient-to-r from-sky-500 to-cyan-500 bg-clip-text text-transparent">Datathon 2026</span>
                </h1>
                <p className="mt-1 text-[11px] font-medium text-sky-700/70 dark:text-sky-300/70">Island tourism policy engine</p>
              </div>
            </div>
            {analysis && (
              <div className="hidden md:flex items-center gap-6 pl-6 border-l border-sky-200 dark:border-sky-800/60">
                <div>
                  <p className="text-xl font-black leading-none tabular-nums">{pct1(analysis.marine.r2)}</p>
                  <p className="text-[11px] text-sky-700/70 dark:text-sky-300/70 mt-1">Coral variance explained</p>
                </div>
                <div>
                  <p className="text-xl font-black leading-none tabular-nums flex items-center gap-1.5">
                    {fmtInt(N_SEARCH)} <Waves size={16} className="text-cyan-500" />
                  </p>
                  <p className="text-[11px] text-sky-700/70 dark:text-sky-300/70 mt-1">Scenarios searched per island</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            <nav
              className="flex flex-1 gap-1 rounded-full border border-sky-200/80 bg-white/60 p-1 sm:flex-none dark:border-sky-400/15 dark:bg-slate-900/60"
              aria-label="Dashboard pages"
            >
              {pills.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePage(p.id)}
                  aria-current={activePage === p.id ? 'page' : undefined}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:flex-none sm:px-5 ${
                    activePage === p.id
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-500/30'
                      : 'text-sky-700 hover:bg-sky-100/80 dark:text-sky-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="sm:hidden">{p.short}</span>
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 pb-14 lg:px-8 lg:pt-8 lg:pb-16">
        {error ? (
          <GlassCard className="p-8 flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <TriangleAlert size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-lg text-rose-600 dark:text-rose-300 mb-1">Couldn&apos;t load the Excel data</h2>
              <p className="text-sm text-sky-900 dark:text-sky-100">{error}</p>
            </div>
          </GlassCard>
        ) : !analysis ? (
          <LoadingState />
        ) : activePage === 'macro' ? (
          <LangkawiPage analysis={analysis} />
        ) : (
          <TiomanPage analysis={analysis} />
        )}
      </main>
    </div>
  );
}
