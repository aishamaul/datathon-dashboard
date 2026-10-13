'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Expand, Factory, Leaf, Minimize2, RotateCcw, Star, Waves } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { REPORT_COMPARISON, TRANSFERABILITY_PRESETS, DEFAULT_SUPPORTING_DATA, normaliseTourismDNA, type IslandDemoProfile, type TourismDNA } from '@/lib/data/transferability';
import { classifyTourismDNA, dominantSector, runIllustrativeAnalysis, type Candidate, type IllustrativeResult, type ScenarioKey } from '@/lib/engine/transferability';
import { fmtInt, pct1 } from '@/lib/format';
import { AnalysisOverlay, type PreviewPoint } from './analysis-overlay';
import { MyPulauMark } from './brand';
import { Badge, Callout, CardHeader, GlassCard } from './ui';
import { useChartColors } from './chart-theme';

const DNA_META = [
  { key: 'marine', label: 'Marine / Coastal', short: 'Marine', color: '#06b6d4', soft: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/30' },
  { key: 'retail', label: 'Retail / Local Economy', short: 'Retail', color: '#f59e0b', soft: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' },
  { key: 'eco', label: 'Eco / Geotourism', short: 'Eco', color: '#10b981', soft: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' },
] as const;

const pressureLabels = { marine: 'Reef / Marine', waste: 'Waste / Infrastructure', eco: 'Eco / Terrestrial' } as const;
const DATA_NEEDS = {
  marine: ['Reef condition and disturbance records', 'Waste-processing capacity', 'Annual arrivals and average stay'],
  retail: ['Waste-processing capacity', 'Annual arrivals and average stay', 'Reef condition and disturbance records'],
  eco: ['Terrestrial site condition and visitor pressure', 'Annual arrivals and average stay', 'Waste-processing capacity'],
  balanced: ['Annual arrivals and average stay', 'Waste-processing capacity', 'Reef condition and disturbance records'],
} as const;
type TradeoffPoint = { x: number; y: number; z: number; kind: 'candidate' | 'frontier' | 'balanced'; visitors: number; alos: number; visitorNights: number; ehi: number };
const toTradeoffPoint = (point: Candidate, kind: TradeoffPoint['kind']): TradeoffPoint => ({ x: point.yield / 1_000_000, y: point.ehi * 100, z: kind === 'balanced' ? 480 : kind === 'frontier' ? 2 : 1, kind, visitors: point.visitors, alos: point.alos, visitorNights: point.yield, ehi: point.ehi * 100 });

function DnaDonut({ dna, size = 220 }: { dna: TourismDNA; size?: number }) {
  const data = DNA_META.map((item) => ({ name: item.short, value: dna[item.key], color: item.color }));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={size * 0.31} outerRadius={size * 0.45} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
          {data.map((item) => <Cell key={item.name} fill={item.color} />)}
        </Pie>
      </PieChart>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div><Waves className="mx-auto mb-1 text-cyan-500" size={22} /><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Tourism</p><p className="text-lg font-black text-sky-950 dark:text-white">DNA</p></div>
      </div>
    </div>
  );
}

function StepHeader({ step, title, sub, badge }: { step: string; title: string; sub: string; badge?: ReactNode }) {
  return (
    <div className="mb-5 text-center">
      <span className="mx-auto inline-grid h-8 w-8 place-items-center rounded-full border border-cyan-300 bg-cyan-50 text-xs font-black text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">{step}</span>
      <h3 className="mt-2 text-base font-black tracking-tight text-sky-950 dark:text-sky-50">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-sky-700/75 dark:text-sky-300/70">{sub}</p>
      {badge && <div className="mt-2">{badge}</div>}
    </div>
  );
}

function formatPressure(key: keyof typeof pressureLabels) { return pressureLabels[key]; }

// Bar scales are fixed so switching island presets visibly moves the bars.
const EVIDENCE_SCALE = { arrivals: 600_000, alos: 5, waste: 3_500 } as const;

function EvidenceBar({ share, peakShare, color }: { share: number; peakShare?: number; color: string }) {
  const clampPct = (value: number) => `${Math.min(100, Math.max(0, value * 100))}%`;
  return (
    <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-slate-800">
      {peakShare !== undefined && <div className="absolute inset-y-0 left-0 rounded-full opacity-35 transition-[width] duration-700" style={{ width: clampPct(peakShare), backgroundColor: color }} />}
      <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: clampPct(share), backgroundColor: color }} />
    </div>
  );
}

function EvidenceTile({ label, value, note, feeds, children }: { label: string; value: string; note: string; feeds: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-sky-200/80 bg-white/70 p-3 dark:border-sky-800/60 dark:bg-slate-950/30">
      <p className="text-[10px] font-black uppercase tracking-wide text-sky-600 dark:text-sky-300">{label}</p>
      <p className="mt-1 text-lg font-black leading-none tabular-nums text-sky-950 dark:text-white">{value}</p>
      {children}
      <p className="mt-2 text-[11px] leading-snug text-sky-700/80 dark:text-sky-200/75">{note}</p>
      <p className="mt-auto pt-2 text-[10px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Feeds &rarr; {feeds}</p>
    </div>
  );
}

function EvidencePanel({ data, custom }: { data: IslandDemoProfile['supportingData']; custom: boolean }) {
  const coral = Math.min(1, Math.max(0, data.baselineLiveCoralCover));
  const ringRadius = 15;
  const ringLength = 2 * Math.PI * ringRadius;
  return (
    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-500/30 dark:bg-amber-500/5" aria-label="Synthetic evidence used by the analysis">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black">Evidence behind the analysis</p>
          <p className="mt-0.5 text-xs leading-relaxed text-sky-700/80 dark:text-sky-200/75">The DNA only sets how much each pillar counts. These island figures set the limits the scenarios are tested against.</p>
        </div>
        <Badge tone="amber">SYNTHETIC</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <EvidenceTile label="Visitor arrivals" value={`${fmtInt(data.historicalPeakArrivals)} peak`} note={`Typical year ${fmtInt(data.historicalAnnualArrivals)} visitors`} feeds="Visitor ceiling">
          <EvidenceBar share={data.historicalAnnualArrivals / EVIDENCE_SCALE.arrivals} peakShare={data.historicalPeakArrivals / EVIDENCE_SCALE.arrivals} color="#0ea5e9" />
        </EvidenceTile>
        <EvidenceTile label="Length of stay" value={`${data.baselineALOS.toFixed(1)} nights`} note="Average stay today" feeds="Stay-length range">
          <EvidenceBar share={data.baselineALOS / EVIDENCE_SCALE.alos} color="#14b8a6" />
        </EvidenceTile>
        <EvidenceTile label="Waste capacity" value={`${fmtInt(data.annualWasteCapacityTonnes)} t/yr`} note="Tonnes the island can process" feeds="Waste pressure">
          <EvidenceBar share={data.annualWasteCapacityTonnes / EVIDENCE_SCALE.waste} color="#f59e0b" />
        </EvidenceTile>
        <EvidenceTile label="Reef condition" value={`${pct1(coral)} coral`} note={`Baseline disturbance ${pct1(data.baselineDisturbance)}`} feeds="Marine health">
          <div className="mt-2 flex items-center gap-3">
            <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r={ringRadius} fill="none" strokeWidth="5" className="stroke-sky-100 dark:stroke-slate-800" />
              <circle cx="18" cy="18" r={ringRadius} fill="none" strokeWidth="5" strokeLinecap="round" stroke="#06b6d4" strokeDasharray={`${ringLength * coral} ${ringLength}`} className="transition-[stroke-dasharray] duration-700" />
            </svg>
            <div className="min-w-0 flex-1"><EvidenceBar share={data.baselineDisturbance} color="#f43f5e" /></div>
          </div>
        </EvidenceTile>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">Invented for this demo, not observed statistics{custom ? '; a custom island name uses a generic synthetic profile' : ''}. Real targets need real island data.</p>
    </section>
  );
}

export function TransferabilityLab() {
  const journeyRef = useRef<HTMLDivElement>(null);
  const [overlayActive, setOverlayActive] = useState(false);
  const [islandName, setIslandName] = useState('Redang');
  const [selectedPreset, setSelectedPreset] = useState('redang');
  const [values, setValues] = useState({ marine: 75, retail: 10, eco: 15 });
  const [analysisPhase, setAnalysisPhase] = useState<'editing' | 'results'>('editing');
  const [simulationMode, setSimulationMode] = useState(false);
  const [scenario, setScenario] = useState<ScenarioKey>('current');

  const dna = useMemo(() => normaliseTourismDNA(values), [values]);
  const total = values.marine + values.retail + values.eco;
  const totalIsHundred = Math.abs(total - 100) <= 0.05;
  const isValid = total > 0 && Object.values(values).every((value) => Number.isFinite(value) && value >= 0)
    && totalIsHundred;
  const classification = classifyTourismDNA(dna);
  const leadSector = dominantSector(dna);
  const activePreset = TRANSFERABILITY_PRESETS.find((preset) => preset.id === selectedPreset);
  const supportingData = activePreset?.supportingData ?? DEFAULT_SUPPORTING_DATA;
  const analysisRequested = simulationMode || overlayActive;
  const result = useMemo<IllustrativeResult | null>(() => analysisRequested && isValid ? runIllustrativeAnalysis(dna, supportingData, scenario) : null, [analysisRequested, dna, isValid, scenario, supportingData]);
  const previewPoints = useMemo<PreviewPoint[]>(() => {
    if (!overlayActive || !result) return [];
    const run = result;
    const xs = run.candidates.map((p) => p.yield);
    const ys = run.candidates.map((p) => p.ehi);
    const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
    const [xr, yr] = [Math.max(...xs) - x0 || 1, Math.max(...ys) - y0 || 1];
    const norm = (p: Candidate, kind: PreviewPoint['kind']): PreviewPoint => ({ x: (p.yield - x0) / xr, y: (p.ehi - y0) / yr, kind });
    const selected = run.balancedCandidate;
    return [
      ...run.candidates.filter((p, i) => !p.pareto && i % 2 === 0).map((p) => norm(p, 'candidate')),
      ...run.frontier.map((p) => norm(p, 'frontier')),
      norm(selected, 'balanced'),
    ];
  }, [overlayActive, result]);
  const equilibrium = result?.balancedCandidate;
  const candidatePoints = result?.candidates.filter((point, index) => !point.pareto && index % 5 === 0).map((point) => toTradeoffPoint(point, 'candidate')) ?? [];
  const frontierPoints = result?.frontier.filter((point) => point !== equilibrium).map((point) => toTradeoffPoint(point, 'frontier')) ?? [];
  const equilibriumPoint = equilibrium ? [toTradeoffPoint(equilibrium, 'balanced')] : [];
  const radarData = result ? [
    { subject: 'Marine', score: result.marineHealth * 100, weight: dna.marine * 100 },
    { subject: 'Waste', score: result.wasteHealth * 100, weight: dna.retail * 100 },
    { subject: 'Terrestrial', score: result.ecoHealth * 100, weight: dna.eco * 100 },
  ] : [];

  const updateValue = (key: keyof TourismDNA, value: string) => {
    setAnalysisPhase('editing');
    setSimulationMode(false);
    setValues((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));
  };
  const choosePreset = (preset: IslandDemoProfile) => {
    setSelectedPreset(preset.id); setIslandName(preset.name); setValues({ marine: +(preset.tourismDNA.marine * 100).toFixed(2), retail: +(preset.tourismDNA.retail * 100).toFixed(2), eco: +(preset.tourismDNA.eco * 100).toFixed(2) }); setAnalysisPhase('editing'); setSimulationMode(false);
  };
  const completeOverlay = () => {
    setSimulationMode(true);
    setAnalysisPhase('results');
    setOverlayActive(false);
    requestAnimationFrame(() => journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const analyse = () => {
    if (!isValid || !islandName.trim()) return;
    setSimulationMode(false);
    setOverlayActive(true);
  };
  const normalisePercentages = () => { if (!total) return; setValues({ marine: +(values.marine / total * 100).toFixed(2), retail: +(values.retail / total * 100).toFixed(2), eco: +(values.eco / total * 100).toFixed(2) }); };
  const reset = () => { const preset = TRANSFERABILITY_PRESETS[0]; choosePreset(preset); setAnalysisPhase('editing'); setScenario('current'); };

  return <div className="space-y-5 text-sky-950 dark:text-sky-50">
    {overlayActive && <AnalysisOverlay islandName={islandName} dna={dna} points={previewPoints} onComplete={completeOverlay} />}
    <section className="senyih-fade overflow-hidden rounded-[2rem] border border-cyan-200/70 bg-white/55 p-6 shadow-xl shadow-cyan-900/5 backdrop-blur-xl md:p-9 dark:border-cyan-400/15 dark:bg-slate-900/55">
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="MY Pulau solution">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Malaysia · DOSM Datathon 2026</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div><h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight text-sky-950 dark:text-white md:text-5xl">Colour <span className="bg-cover bg-center bg-clip-text text-transparent" style={{ backgroundImage: "url('/malaysia.jpg')", WebkitBackgroundClip: 'text' }}>MY</span> Island, Majukan Negara.</h2><p className="mt-4 max-w-xl text-sm leading-relaxed text-sky-800/80 dark:text-sky-200/75">Watch one reusable decision-making framework adapt to a new island profile. Tourism DNA is a starting structure, not a substitute for island-specific evidence.</p><div className="mt-6 flex flex-wrap gap-3"><div className="rounded-2xl border border-sky-200 bg-white/70 px-4 py-3 dark:border-sky-800/60 dark:bg-slate-950/40"><p className="text-[10px] font-black uppercase tracking-widest text-sky-500">Shared architecture</p><p className="mt-1 text-sm font-bold">DNA → pressure → scenarios</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Scientific boundary</p><p className="mt-1 text-sm font-bold">DNA informs. Evidence sets targets</p></div></div></div>
        <div className="relative rounded-[1.75rem] border border-cyan-200/70 bg-gradient-to-br from-cyan-500/15 via-white/50 to-emerald-400/10 p-6 dark:border-cyan-400/20 dark:from-cyan-400/10 dark:via-slate-900/30"><div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-cyan-300/0 via-cyan-400 to-emerald-400/0" /><div className="relative flex items-center justify-center gap-3 sm:gap-8"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"><Waves size={28} /></div><ArrowRight className="text-cyan-500 motion-safe:animate-pulse" /><div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><Leaf size={28} /></div><ArrowRight className="text-emerald-500 motion-safe:animate-pulse" /><div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30"><Factory size={28} /></div></div><p className="relative mt-5 text-center text-xs font-bold text-sky-700 dark:text-sky-200">Same framework ≠ Same recommendation</p></div>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
      <GlassCard className="p-6"><StepHeader step="01" title="Choose or create an island" sub="Every preset is synthetic illustrative demo data." badge={<Badge tone="amber">ILLUSTRATIVE DEMO DATA</Badge>} />
        <div className="grid grid-cols-3 gap-2">{TRANSFERABILITY_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => choosePreset(preset)} className={`rounded-2xl border p-3 text-left transition ${selectedPreset === preset.id ? 'border-cyan-400 bg-cyan-50 shadow-sm dark:border-cyan-400/60 dark:bg-cyan-500/10' : 'border-sky-200 bg-white/50 hover:border-cyan-300 dark:border-sky-800/70 dark:bg-slate-900/30'}`}><span className="block text-sm font-black">{preset.name}</span><span className="mt-1 block text-[10px] font-bold text-cyan-600">Illustrative</span></button>)}</div>
        <label className="mt-5 block text-xs font-bold text-sky-700 dark:text-sky-200" htmlFor="island-name">Island name</label><div className="mt-2 flex gap-2"><input id="island-name" value={islandName} onChange={(event) => { setIslandName(event.target.value); setSelectedPreset('custom'); setAnalysisPhase('editing'); setSimulationMode(false); }} className="min-w-0 flex-1 rounded-xl border border-sky-200 bg-white/80 px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 dark:border-sky-800 dark:bg-slate-950/40" placeholder="Enter an island name" /><button type="button" onClick={reset} aria-label="Reset island profile" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-200 text-sky-600 hover:bg-sky-50 dark:border-sky-800 dark:hover:bg-slate-800"><RotateCcw size={16} /></button></div>
        <div className="mt-6 flex items-end justify-between gap-3"><div><p className="text-sm font-black">Tourism DNA inputs</p><p className="text-xs text-sky-700/70 dark:text-sky-300/70">Enter each sector&apos;s share as a percentage or ratio, then normalise to 100%.</p></div><span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black tabular-nums ${totalIsHundred ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100'}`}>Total {total.toFixed(1)}%</span></div>
        <div className="mt-4 space-y-4">{DNA_META.map((item) => <div key={item.key} className={`rounded-2xl border p-3 ${item.soft}`}><div className="flex items-center justify-between gap-3"><label htmlFor={`dna-${item.key}`} className="flex items-center gap-2 text-sm font-bold"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</label><div className="flex items-center gap-1"><input id={`dna-${item.key}`} type="number" min="0" step="0.1" value={values[item.key]} onChange={(event) => updateValue(item.key, event.target.value)} className="w-20 rounded-lg border border-white/80 bg-white/80 px-2 py-1 text-right text-sm font-black outline-none dark:border-slate-700 dark:bg-slate-950/40" /><span className="text-xs font-bold text-sky-600 dark:text-sky-300">%</span></div></div><input type="range" min="0" max="100" step="1" value={Math.min(100, values[item.key])} onChange={(event) => updateValue(item.key, event.target.value)} className="senyih-range mt-3 w-full" aria-label={`${item.label} share`} style={{ '--fill': `${Math.min(100, values[item.key])}%` } as React.CSSProperties} /></div>)}</div>
        {!totalIsHundred && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"><span>Inputs total {total.toFixed(1)}%. Normalise them into a 100% profile before analysing.</span><button type="button" onClick={normalisePercentages} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 font-black text-white">Normalise to 100%</button></div>}
        <EvidencePanel data={supportingData} custom={!activePreset} />
        <button type="button" disabled={!isValid || !islandName.trim()} onClick={analyse} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">Analyse Island with Demo Data <ArrowRight size={17} /></button>
      </GlassCard>

      <GlassCard className="relative flex flex-col p-6 xl:sticky xl:top-24 xl:self-start">
        <span aria-hidden="true" className="absolute -top-[27px] left-1/2 z-10 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 xl:-left-[27px] xl:top-24 xl:translate-x-0"><ArrowRight size={16} className="rotate-90 xl:rotate-0" /></span>
        <StepHeader step="02" title="Island sustainability passport" sub="Output of step 01: built live from the sector shares and evidence on the left. Tourism structure is not an ecological health score." badge={<Badge tone="teal">LIVE PROFILE</Badge>} />
        <div className="flex flex-col gap-5">
          <div className="grid items-center gap-5 sm:grid-cols-[240px_1fr]">
            <div>
              <DnaDonut dna={dna} />
              <div className="mx-auto mt-2 max-w-[220px] rounded-xl border border-cyan-200/80 bg-cyan-50/70 px-3 py-2 text-center dark:border-cyan-500/25 dark:bg-cyan-500/10">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">Leading tourism sector</p>
                <p className="mt-0.5 text-sm font-black text-sky-950 dark:text-sky-50">
                  {leadSector === 'balanced' ? 'Balanced profile' : `${DNA_META.find((item) => item.key === leadSector)?.short} · ${pct1(dna[leadSector])}`}
                </p>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-sky-950 dark:text-white">{classification}</p>
              <p className="mt-2 text-sm leading-relaxed text-sky-700/80 dark:text-sky-200/75">{leadSector === 'marine' ? 'This marine-oriented structure suggests reef monitoring and disturbance data will be important to assess.' : leadSector === 'retail' ? 'This retail-oriented structure suggests waste capacity and visitor-night data will be important to assess.' : leadSector === 'eco' ? 'This eco-oriented structure suggests terrestrial site condition and visitor pressure data will be important to assess.' : 'This balanced structure suggests checking pressures across all three sectors.'} Actual ecological health requires destination-specific evidence.</p>
              <div className="mt-5 space-y-2">{DNA_META.map((item) => <div key={item.key} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.short}</span><span className="font-black tabular-nums">{pct1(dna[item.key])}</span></div>)}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white/60 p-4 dark:border-sky-800/60 dark:bg-slate-950/30">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Data to collect for quantitative targets</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">
              {DATA_NEEDS[leadSector].map((need, index) => <li key={need} className={`rounded-xl border px-3 py-2 text-xs font-semibold leading-snug ${index === 0 ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-100' : 'border-sky-200 bg-white/70 text-sky-800 dark:border-sky-800/60 dark:bg-slate-900/40 dark:text-sky-200'}`}>{index === 0 && <span className="mb-0.5 block text-[9px] font-black uppercase tracking-wider opacity-70">Priority</span>}{need}</li>)}
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>

    {analysisPhase === 'results' && result && <div ref={journeyRef} className="senyih-fade scroll-mt-24 space-y-5">
      <SimulationResults result={result} dna={dna} islandName={islandName} scenario={scenario} onScenarioChange={setScenario} candidatePoints={candidatePoints} frontierPoints={frontierPoints} equilibriumPoint={equilibriumPoint} radarData={radarData} />
      <Comparison currentName={islandName || 'New Island'} dna={dna} result={result} />
    </div>}
  </div>;
}

function ParetoPlot({ candidatePoints, frontierPoints, equilibriumPoint, colors, expanded = false }: {
  candidatePoints: TradeoffPoint[];
  frontierPoints: TradeoffPoint[];
  equilibriumPoint: TradeoffPoint[];
  colors: ReturnType<typeof useChartColors>;
  expanded?: boolean;
}) {
  const allPoints = [...candidatePoints, ...frontierPoints, ...equilibriumPoint];
  const xValues = allPoints.map((point) => point.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const xPadding = Math.max((maxX - minX) * 0.06, 0.05);

  return <ResponsiveContainer width="100%" height="100%">
    <ScatterChart margin={expanded ? { top: 24, right: 40, bottom: 40, left: 24 } : { top: 12, right: 18, bottom: 18, left: 2 }}>
      <XAxis type="number" dataKey="x" name="Yield" domain={[minX - xPadding, maxX + xPadding]} tickFormatter={(value) => `${Number(value).toFixed(1)}M`} tick={{ fill: colors.tickX, fontSize: expanded ? 14 : 11 }} />
      <YAxis type="number" dataKey="y" name="EHI" domain={[0, 100]} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: colors.tickLeft, fontSize: expanded ? 14 : 11 }} />
      <ZAxis type="number" dataKey="z" domain={[1, 480]} range={[12, 400]} />
      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
        const point = payload?.[0]?.payload as TradeoffPoint | undefined;
        if (!active || !point) return null;
        return <div className="rounded-xl border border-sky-200 bg-white p-3 text-xs shadow-xl dark:border-sky-700 dark:bg-slate-900">
          <p className="mb-2 font-black text-sky-950 dark:text-white">{point.kind === 'balanced' ? 'Balanced equilibrium' : point.kind === 'frontier' ? 'Pareto-efficient scenario' : 'Illustrative candidate'}</p>
          <p>Annual visitors: <b>{fmtInt(point.visitors)}</b></p><p>Target ALOS: <b>{point.alos.toFixed(2)} nights</b></p>
          <p>Tourist-nights: <b>{fmtInt(point.visitorNights)}</b></p><p>Illustrative EHI: <b>{point.ehi.toFixed(1)}%</b></p>
        </div>;
      }} />
      <Scatter name="Candidate scenarios" data={candidatePoints} fill="#38bdf8" fillOpacity={0.35} shape="circle" isAnimationActive={false} legendType="circle" />
      <Scatter name="Pareto-efficient" data={frontierPoints} fill="#10b981" shape="diamond" isAnimationActive animationDuration={550} legendType="diamond" />
      <Scatter name="Balanced equilibrium" data={equilibriumPoint} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} shape="star" isAnimationActive animationDuration={700} legendType="star" zIndex={900} />
    </ScatterChart>
  </ResponsiveContainer>;
}

function SimulationResults({ result, islandName, scenario, onScenarioChange, candidatePoints, frontierPoints, equilibriumPoint, radarData }: { result: IllustrativeResult; dna: TourismDNA; islandName: string; scenario: ScenarioKey; onScenarioChange: (value: ScenarioKey) => void; candidatePoints: TradeoffPoint[]; frontierPoints: TradeoffPoint[]; equilibriumPoint: TradeoffPoint[]; radarData: { subject: string; score: number; weight: number }[] }) {
  const colors = useChartColors();
  const [paretoExpanded, setParetoExpanded] = useState(false);
  const scenarioName = scenario[0].toUpperCase() + scenario.slice(1);
  const weightedTerms = radarData.map((pillar) => `${pillar.subject}: ${pillar.weight.toFixed(1)}% weight × ${pillar.score.toFixed(1)}% health`).join(' · ');

  useEffect(() => {
    if (!paretoExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setParetoExpanded(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [paretoExpanded]);

  return (
    <div className="space-y-5">
      <Callout tone="amber" title="Illustrative Simulation — Synthetic Data">
        These outputs use synthetic supporting data for {islandName}. They are not observed {islandName} tourism or environmental statistics, validated policy recommendations, or outputs from the report&apos;s trained Ridge model.
      </Callout>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Illustrative visitor target" value={fmtInt(result.visitorCap)} />
        <Stat label="Illustrative target ALOS" value={`${result.targetALOS.toFixed(2)} nights`} />
        <Stat label="Illustrative composite EHI" value={pct1(result.ehi)} />
        <Stat label="Calculated binding constraint" value={formatPressure(result.bindingConstraint)} detail={result.bindingExplanation} />
      </div>

      <GlassCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CardHeader title={`${islandName} · illustrative scenario explorer`} sub="Each point is a synthetic arrivals-and-stay combination. The star marks the balanced solution selected from the Pareto-efficient set." />
          <div className="flex rounded-xl border border-sky-200 bg-white/70 p-1 dark:border-sky-800 dark:bg-slate-950/40" role="group" aria-label="Disturbance scenario">
            {(['optimal', 'current', 'crisis'] as ScenarioKey[]).map((key) => {
              const factor = key === 'optimal' ? 50 : key === 'current' ? 100 : 150;
              return <button key={key} type="button" aria-pressed={scenario === key} onClick={() => onScenarioChange(key)} className={`rounded-lg px-3 py-2 text-left capitalize transition ${scenario === key ? 'bg-cyan-500 text-white' : 'text-sky-700 dark:text-sky-200'}`}>
                <span className="block text-xs font-black">{key}</span><span className="block text-[10px] opacity-80">{factor}% baseline</span>
              </button>;
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700 dark:text-sky-300">Illustrative economic yield vs ecological health</p>
              <button type="button" onClick={() => setParetoExpanded(true)} aria-label="Expand Pareto chart" title="Expand Pareto chart" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sky-200 bg-white/70 text-sky-700 transition hover:border-cyan-400 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-sky-800 dark:bg-slate-900/70 dark:text-sky-200 dark:hover:bg-slate-800">
                <Expand size={16} />
              </button>
            </div>
            <div className="h-72 min-w-0"><ParetoPlot candidatePoints={candidatePoints} frontierPoints={frontierPoints} equilibriumPoint={equilibriumPoint} colors={colors} /></div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-sky-800 dark:text-sky-200" aria-label="Trade-off chart legend">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-sky-400" />Candidate scenarios</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rotate-45 bg-emerald-500" />Pareto-efficient</span>
              <span className="inline-flex items-center gap-1.5"><Star size={13} className="fill-amber-400 text-amber-500" />Balanced equilibrium</span>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-100"><Star size={14} className="fill-amber-400 text-amber-500" />Selected balanced solution</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <p>Annual visitors <b className="block text-sm">{fmtInt(result.visitorCap)}</b></p>
                <p>ALOS <b className="block text-sm">{result.targetALOS.toFixed(2)} nights</b></p>
                <p>Tourist-nights <b className="block text-sm">{fmtInt(result.economicYield)}</b></p>
                <p>Illustrative EHI <b className="block text-sm">{pct1(result.ehi)}</b></p>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-sky-700 dark:text-sky-300">Illustrative environmental health and DNA weights</p>
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke={colors.grid} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: colors.tickX, fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: colors.tickLeft, fontSize: 9 }} />
                  <Radar name="Pillar health" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                  <Radar name="Tourism DNA weight" dataKey="weight" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[11px]">
              {radarData.map((pillar) => <div key={pillar.subject} className="rounded-lg border border-sky-200 bg-white/60 px-2 py-2 dark:border-sky-800/60 dark:bg-slate-950/30"><p className="font-black">{pillar.subject}</p><p className="mt-1 text-emerald-700 dark:text-emerald-300">Health {pillar.score.toFixed(1)}%</p><p className="text-amber-700 dark:text-amber-300">DNA weight {pillar.weight.toFixed(1)}%</p></div>)}
            </div>
            <p className="rounded-xl bg-sky-50/80 p-3 text-xs leading-relaxed text-sky-800 dark:bg-sky-500/10 dark:text-sky-100">
              The composite EHI is a Tourism-DNA-weighted average of Marine, Waste and Terrestrial health. Weights × scores here: {weightedTerms}. Together they produce <b>{pct1(result.ehi)}</b>. DNA weights describe tourism structure, not health.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="amber">{scenarioName}: {Math.round(result.disturbanceFactor * 100)}% of baseline · adjusted level {pct1(result.disturbance)}</Badge>
          <Badge tone="teal">{result.candidates.length} illustrative combinations · {result.frontier.length} Pareto-efficient</Badge>
        </div>
      </GlassCard>

      {paretoExpanded && <div className="fixed inset-0 z-[110] grid place-items-center bg-sky-950/45 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setParetoExpanded(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="expanded-pareto-title" className="flex h-[min(92vh,980px)] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-2xl shadow-sky-950/30 sm:p-6 dark:border-sky-800 dark:bg-slate-950/95">
          <header className="flex shrink-0 items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Illustrative Simulation · Synthetic Data</p>
              <h2 id="expanded-pareto-title" className="mt-1 text-xl font-black text-sky-950 dark:text-white sm:text-2xl">{islandName} · Pareto trade-off explorer</h2>
              <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">Candidate scenarios, Pareto-efficient choices, and the selected balanced equilibrium.</p>
            </div>
            <button type="button" onClick={() => setParetoExpanded(false)} aria-label="Close expanded Pareto chart" title="Close expanded chart" autoFocus className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-sky-200 bg-white text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"><Minimize2 size={17} /></button>
          </header>
          <div className="mt-3 flex min-h-0 flex-1 items-center justify-center">
            <div className="h-full min-h-[320px] w-full"><ParetoPlot candidatePoints={candidatePoints} frontierPoints={frontierPoints} equilibriumPoint={equilibriumPoint} colors={colors} expanded /></div>
          </div>
          <footer className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-sky-100 pt-3 text-xs dark:border-sky-800">
            <div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold text-sky-800 dark:text-sky-200"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />Candidate</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rotate-45 bg-emerald-500" />Pareto-efficient</span><span><Star size={12} className="mr-1 inline fill-amber-400 text-amber-500" />Balanced equilibrium</span></div>
            <p className="text-sky-600 dark:text-sky-300">Selected: {fmtInt(result.visitorCap)} visitors · {result.targetALOS.toFixed(2)} nights · {pct1(result.ehi)} EHI</p>
          </footer>
        </section>
      </div>}

      <GlassCard className="p-6">
        <CardHeader title={`What this means for ${islandName}`} sub="A transparent reading of the synthetic scenario, not a validated operating recommendation." />
        <p className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 text-sm leading-relaxed text-sky-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-sky-100">
          The balanced solution pairs <b>{fmtInt(result.visitorCap)} annual visitors</b> with a <b>{result.targetALOS.toFixed(2)}-night stay</b>, yielding <b>{fmtInt(result.economicYield)} tourist-nights</b> at an illustrative EHI of <b>{pct1(result.ehi)}</b>. It trades some visitor-night yield for stronger ecological health instead of choosing the highest-volume candidate.
        </p>
        <div className="grid gap-3 md:grid-cols-3">{result.recommendations.map((recommendation, index) => <div key={recommendation} className="rounded-2xl border border-sky-200 bg-white/55 p-4 dark:border-sky-800/60 dark:bg-slate-950/30"><div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300">{index === 0 ? <Factory size={17} /> : index === 1 ? <Waves size={17} /> : <Leaf size={17} />}</div><p className="text-sm font-semibold leading-relaxed">{recommendation}</p></div>)}</div>
      </GlassCard>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/25 dark:bg-cyan-500/10"><p className="text-[10px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">{label}</p><p className="mt-2 text-xl font-black tabular-nums text-sky-950 dark:text-white">{value}</p>{detail && <p className="mt-2 text-xs leading-relaxed text-sky-800/80 dark:text-sky-100/80">{detail}</p>}</div>; }

function Comparison({ currentName, dna, result }: { currentName: string; dna: TourismDNA; result: IllustrativeResult | null }) {
  const current = { name: currentName, dna, constraint: result ? formatPressure(result.bindingConstraint) : 'Additional data required', cap: result ? fmtInt(result.visitorCap) : '—', alos: result ? `${result.targetALOS.toFixed(2)} nights` : '—', ehi: result ? pct1(result.ehi) : '—', priority: result?.recommendations[0] ?? 'Qualitative profile only', status: result ? 'Illustrative simulation' : 'DNA only' };
  const rows = [...REPORT_COMPARISON, current];
  return <GlassCard className="p-6"><CardHeader title="One framework. Different island decisions." sub="The method transfers; the numerical targets do not." /><div className="grid gap-3 lg:grid-cols-3">{rows.map((island) => <div key={island.name} className={`rounded-2xl border p-4 ${island.name === currentName ? 'border-cyan-400 bg-cyan-50/70 dark:border-cyan-400/50 dark:bg-cyan-500/10' : 'border-sky-200 bg-white/45 dark:border-sky-800/60 dark:bg-slate-950/20'}`}><div className="flex items-center justify-between gap-2"><h3 className="text-lg font-black">{island.name}</h3><span className="text-[10px] font-black uppercase tracking-wide text-cyan-600">{island.status}</span></div><div className="mt-3 flex h-3 overflow-hidden rounded-full bg-sky-100 dark:bg-slate-800">{DNA_META.map((item) => <div key={item.key} style={{ width: `${island.dna[item.key] * 100}%`, backgroundColor: item.color }} />)}</div><div className="mt-3 grid grid-cols-3 text-center text-xs font-black">{DNA_META.map((item) => <div key={item.key} style={{ color: item.color }}>{Math.round(island.dna[item.key] * 100)}%</div>)}</div><dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-sky-600 dark:text-sky-300">Constraint</dt><dd className="text-right font-bold">{island.constraint}</dd></div><div className="flex justify-between gap-3"><dt className="text-sky-600 dark:text-sky-300">Visitor target</dt><dd className="font-bold">{island.cap}</dd></div><div className="flex justify-between gap-3"><dt className="text-sky-600 dark:text-sky-300">ALOS / EHI</dt><dd className="font-bold">{island.alos} · {island.ehi}</dd></div></dl><p className="mt-4 border-t border-sky-200/70 pt-3 text-xs font-semibold leading-relaxed text-sky-700 dark:border-sky-800/60 dark:text-sky-200">{island.priority}</p></div>)}</div><div className="mt-6 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 p-5 text-white"><p className="text-2xl font-black">Same Framework ≠ Same Recommendation</p><p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">Every destination has its own tourism structure, ecological conditions and infrastructure capacity. We transfer the method, not another island&apos;s numerical targets.</p></div></GlassCard>;
}
