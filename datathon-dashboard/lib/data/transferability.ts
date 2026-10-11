export type TourismDNA = {
  marine: number;
  retail: number;
  eco: number;
};

export type DataStatus = 'illustrative' | 'user-entered' | 'report-validated';

export type SupportingData = {
  historicalAnnualArrivals: number;
  historicalPeakArrivals: number;
  baselineALOS: number;
  annualWasteCapacityTonnes: number;
  baselineLiveCoralCover: number;
  baselineDisturbance: number;
};

export type IslandDemoProfile = {
  id: string;
  name: string;
  tourismDNA: TourismDNA;
  accommodationRoomCounts: { marine: number; retail: number; eco: number };
  supportingData: SupportingData;
  dataSource: string;
  dataStatus: DataStatus;
};

export const TRANSFERABILITY_PRESETS: IslandDemoProfile[] = [
  {
    id: 'redang', name: 'Redang', tourismDNA: { marine: 0.75, retail: 0.10, eco: 0.15 },
    accommodationRoomCounts: { marine: 750, retail: 100, eco: 150 },
    supportingData: { historicalAnnualArrivals: 320000, historicalPeakArrivals: 380000, baselineALOS: 3.1, annualWasteCapacityTonnes: 1800, baselineLiveCoralCover: 0.72, baselineDisturbance: 0.28 },
    dataSource: 'Synthetic demo profile for presentation', dataStatus: 'illustrative',
  },
  {
    id: 'perhentian', name: 'Perhentian', tourismDNA: { marine: 0.80, retail: 0.05, eco: 0.15 },
    accommodationRoomCounts: { marine: 800, retail: 50, eco: 150 },
    supportingData: { historicalAnnualArrivals: 210000, historicalPeakArrivals: 265000, baselineALOS: 3.6, annualWasteCapacityTonnes: 1100, baselineLiveCoralCover: 0.79, baselineDisturbance: 0.22 },
    dataSource: 'Synthetic demo profile for presentation', dataStatus: 'illustrative',
  },
  {
    id: 'pangkor', name: 'Pangkor', tourismDNA: { marine: 0.35, retail: 0.50, eco: 0.15 },
    accommodationRoomCounts: { marine: 350, retail: 500, eco: 150 },
    supportingData: { historicalAnnualArrivals: 470000, historicalPeakArrivals: 540000, baselineALOS: 2.4, annualWasteCapacityTonnes: 3000, baselineLiveCoralCover: 0.64, baselineDisturbance: 0.34 },
    dataSource: 'Synthetic demo profile for presentation', dataStatus: 'illustrative',
  },
];

export const DEFAULT_SUPPORTING_DATA: SupportingData = {
  historicalAnnualArrivals: 300000,
  historicalPeakArrivals: 360000,
  baselineALOS: 3,
  annualWasteCapacityTonnes: 1800,
  baselineLiveCoralCover: 0.7,
  baselineDisturbance: 0.3,
};

export const REPORT_COMPARISON = [
  { name: 'Langkawi', dna: { marine: 0.404, retail: 0.573, eco: 0.023 }, constraint: 'Waste-processing capacity', cap: '1,752,000', alos: '3.32 nights', ehi: '69.8%', priority: 'Strengthen waste capacity', status: 'Report validated' },
  { name: 'Tioman', dna: { marine: 0.612, retail: 0.173, eco: 0.214 }, constraint: 'Reef disturbance', cap: '190,000', alos: '3.72 nights', ehi: '84.5%', priority: 'Reduce reef disturbance', status: 'Report validated' },
] as const;

export function normaliseTourismDNA(values: TourismDNA): TourismDNA {
  const safe = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number.isFinite(value) && value > 0 ? value : 0])) as TourismDNA;
  const total = safe.marine + safe.retail + safe.eco;
  if (total <= 0) return { marine: 0, retail: 0, eco: 0 };
  return { marine: safe.marine / total, retail: safe.retail / total, eco: safe.eco / total };
}

export function profileFromPreset(preset: IslandDemoProfile): IslandDemoProfile {
  return { ...preset, tourismDNA: normaliseTourismDNA(preset.tourismDNA) };
}
