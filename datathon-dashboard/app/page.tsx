"use client";

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Palmtree, Waves } from 'lucide-react';
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

const pills: { id: PageId; label: string }[] = [
  { id: 'macro', label: 'Macro Anchor · Langkawi' },
  { id: 'micro', label: 'Micro Stress-Test · Tioman' },
];

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
      <header className="sticky top-0 z-50 border-b border-sky-200/70 bg-white/60 backdrop-blur-xl dark:border-sky-800/50 dark:bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-sky-500/30">
                <Palmtree size={20} strokeWidth={2.5} />
              </div>
              <h1 className="text-lg font-black tracking-tight">
                DOSM <span className="text-sky-500">Datathon 2026</span>
              </h1>
            </div>
            {analysis && (
              <div className="hidden md:flex items-center gap-6 pl-6 border-l border-sky-200 dark:border-sky-800/60">
                <div>
                  <p className="text-xl font-black leading-none">{pct1(analysis.marine.r2)}</p>
                  <p className="text-[11px] text-sky-700/70 dark:text-sky-300/70 mt-1">Coral variance explained</p>
                </div>
                <div>
                  <p className="text-xl font-black leading-none flex items-center gap-1.5">
                    {fmtInt(N_SEARCH)} <Waves size={16} className="text-cyan-500" />
                  </p>
                  <p className="text-[11px] text-sky-700/70 dark:text-sky-300/70 mt-1">Scenarios searched per island</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex gap-2" aria-label="Dashboard pages">
              {pills.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePage(p.id)}
                  aria-current={activePage === p.id ? 'page' : undefined}
                  className={`px-5 py-2 text-sm font-bold rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                    activePage === p.id
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-transparent shadow-md shadow-sky-500/30'
                      : 'bg-white/70 text-sky-700 border-sky-200 hover:bg-white dark:bg-slate-800/60 dark:text-sky-200 dark:border-sky-800/60 dark:hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-8">
        {error ? (
          <GlassCard className="p-8">
            <h2 className="font-bold text-lg text-rose-600 dark:text-rose-300 mb-2">Couldn&apos;t load the Excel data</h2>
            <p className="text-sm text-sky-900 dark:text-sky-100">{error}</p>
          </GlassCard>
        ) : !analysis ? (
          <GlassCard className="p-8">
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Loading data from Excel and running the policy engine…</p>
          </GlassCard>
        ) : activePage === 'macro' ? (
          <LangkawiPage analysis={analysis} />
        ) : (
          <TiomanPage analysis={analysis} />
        )}
      </main>
    </div>
  );
}
