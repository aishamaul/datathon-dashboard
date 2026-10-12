import { DEFAULT_SUPPORTING_DATA, type SupportingData, type TourismDNA } from '@/lib/data/transferability';

export type ScenarioKey = 'optimal' | 'current' | 'crisis';
export type PressureKey = 'marine' | 'waste' | 'eco';

export type Candidate = {
  visitors: number;
  alos: number;
  yield: number;
  ehi: number;
  marineHealth: number;
  wasteHealth: number;
  ecoHealth: number;
  pareto: boolean;
};

export type IllustrativeResult = {
  scenario: ScenarioKey;
  disturbanceFactor: number;
  baselineDisturbance: number;
  disturbance: number;
  visitorCap: number;
  targetALOS: number;
  balancedCandidate: Candidate;
  ehi: number;
  economicYield: number;
  marineHealth: number;
  wasteHealth: number;
  ecoHealth: number;
  bindingConstraint: PressureKey;
  bindingExplanation: string;
  candidates: Candidate[];
  frontier: Candidate[];
  recommendations: string[];
};

const SCENARIO_FACTORS: Record<ScenarioKey, number> = { optimal: 0.5, current: 1, crisis: 1.5 };
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function classifyTourismDNA(dna: TourismDNA): string {
  const values = [dna.marine, dna.retail, dna.eco];
  const max = Math.max(...values);
  if (max < 0.45) return 'Balanced Tourism Profile';
  if (max === dna.marine) return 'Marine-Dominant Island';
  if (max === dna.retail) return 'Retail-Dominant Island';
  return 'Eco-Dominant Island';
}

export function dominantSector(dna: TourismDNA): 'marine' | 'retail' | 'eco' | 'balanced' {
  const values = [dna.marine, dna.retail, dna.eco];
  if (Math.max(...values) < 0.45) return 'balanced';
  const index = values.indexOf(Math.max(...values));
  return index === 0 ? 'marine' : index === 1 ? 'retail' : 'eco';
}

export function evaluateDataCompleteness(dna: TourismDNA) {
  return dna.marine + dna.retail + dna.eco > 0;
}

export function calculateIllustrativePillars(
  visitors: number,
  alos: number,
  dna: TourismDNA,
  data: SupportingData,
  scenario: ScenarioKey,
) {
  const visitorNights = visitors * alos;
  const disturbance = data.baselineDisturbance * SCENARIO_FACTORS[scenario];
  const marineHealth = clamp((data.baselineLiveCoralCover - disturbance * 0.22) / 0.82);
  const wastePressure = visitorNights * 1.17 / Math.max(1, data.annualWasteCapacityTonnes * 1000);
  const wasteHealth = clamp(1 - wastePressure ** 1.35);
  const volumePressure = visitors / Math.max(1, data.historicalPeakArrivals);
  const ecoHealth = clamp(1 - Math.max(0, volumePressure ** 1.5 - 0.1));
  const ehi = dna.marine * marineHealth + dna.retail * wasteHealth + dna.eco * ecoHealth;
  return { disturbance, marineHealth, wasteHealth, ecoHealth, ehi, visitorNights };
}

function isDominated(candidate: Candidate, candidates: Candidate[]) {
  return candidates.some((other) => other !== candidate && other.yield >= candidate.yield && other.ehi >= candidate.ehi && (other.yield > candidate.yield || other.ehi > candidate.ehi));
}

export function generateIllustrativeScenarios(dna: TourismDNA, data: SupportingData, scenario: ScenarioKey): IllustrativeResult {
  const candidates: Candidate[] = [];
  for (let visitorStep = 0; visitorStep <= 18; visitorStep += 1) {
    const visitors = data.historicalPeakArrivals * (0.45 + visitorStep * 0.055);
    for (let alosStep = 0; alosStep <= 10; alosStep += 1) {
      const alos = data.baselineALOS * (0.7 + alosStep * 0.05);
      const pillars = calculateIllustrativePillars(visitors, alos, dna, data, scenario);
      candidates.push({ visitors, alos, yield: pillars.visitorNights, ehi: pillars.ehi, marineHealth: pillars.marineHealth, wasteHealth: pillars.wasteHealth, ecoHealth: pillars.ecoHealth, pareto: false });
    }
  }
  const frontier = candidates.filter((candidate) => !isDominated(candidate, candidates)).sort((a, b) => a.yield - b.yield);
  frontier.forEach((point) => { point.pareto = true; });
  const maxYield = Math.max(...candidates.map((candidate) => candidate.yield));
  const selected = frontier.reduce((best, candidate) => {
    const distance = Math.hypot(1 - candidate.yield / maxYield, 1 - candidate.ehi);
    const bestDistance = Math.hypot(1 - best.yield / maxYield, 1 - best.ehi);
    return distance < bestDistance ? candidate : best;
  }, frontier[0]);
  const pillars = calculateIllustrativePillars(selected.visitors, selected.alos, dna, data, scenario);
  const pressures = { marine: 1 - selected.marineHealth, waste: 1 - selected.wasteHealth, eco: 1 - selected.ecoHealth };
  const bindingConstraint = (Object.keys(pressures) as PressureKey[]).reduce((worst, key) => pressures[key] > pressures[worst] ? key : worst, 'marine');
  const disturbanceFactor = SCENARIO_FACTORS[scenario];
  const estimatedWasteTonnes = pillars.visitorNights * 1.17 / 1000;
  const volumeVsPeak = selected.visitors / data.historicalPeakArrivals;
  const bindingExplanation = bindingConstraint === 'marine'
    ? `Marine health is the lowest pillar at ${(selected.marineHealth * 100).toFixed(1)}%. Under this synthetic scenario, coral cover starts at ${(data.baselineLiveCoralCover * 100).toFixed(1)}% and disturbance is ${(pillars.disturbance * 100).toFixed(1)}% (${(disturbanceFactor * 100).toFixed(0)}% of its ${(data.baselineDisturbance * 100).toFixed(1)}% baseline).`
    : bindingConstraint === 'waste'
      ? `At ${Math.round(pillars.visitorNights).toLocaleString('en-US')} visitor-nights, the 1.17 kg/person-night assumption implies ${estimatedWasteTonnes.toFixed(0)} tonnes of waste against ${data.annualWasteCapacityTonnes.toLocaleString('en-US')} tonnes of synthetic annual capacity; this gives the lowest pillar health at ${(selected.wasteHealth * 100).toFixed(1)}%.`
      : `The selected ${(volumeVsPeak * 100).toFixed(0)}% of historical-peak arrival level produces the lowest terrestrial health score (${(selected.ecoHealth * 100).toFixed(1)}%) under the engine's nonlinear volume-to-peak pressure function.`;
  const recommendations = derivePolicyInsights(dna, bindingConstraint, selected);
  return { scenario, disturbanceFactor, baselineDisturbance: data.baselineDisturbance, disturbance: pillars.disturbance, visitorCap: selected.visitors, targetALOS: selected.alos, balancedCandidate: selected, ehi: selected.ehi, economicYield: selected.yield, marineHealth: selected.marineHealth, wasteHealth: selected.wasteHealth, ecoHealth: selected.ecoHealth, bindingConstraint, bindingExplanation, candidates, frontier, recommendations };
}

export function derivePolicyInsights(dna: TourismDNA, constraint: PressureKey, result: Pick<Candidate, 'visitors' | 'alos'>): string[] {
  const insights: Record<PressureKey, string> = {
    marine: 'Prioritise reef monitoring and practical disturbance reduction before increasing visitor volume.',
    waste: 'Strengthen waste-processing capacity and align visitor-nights with what the island can handle.',
    eco: 'Use timed access and site-level visitor management to protect terrestrial attractions.',
  };
  const DNAInsight = dna.retail > dna.marine && dna.retail > dna.eco
    ? 'A retail-led profile makes infrastructure efficiency central to tourism value.'
    : dna.marine > dna.eco
      ? 'A marine-led profile places greater attention on reef condition and disturbance management.'
      : 'A stronger eco profile makes terrestrial carrying capacity and site stewardship important.';
  return [insights[constraint], DNAInsight, `Balance ${Math.round(result.visitors).toLocaleString('en-US')} arrivals with a ${result.alos.toFixed(2)}-night target rather than maximising volume alone.`];
}

export function runIllustrativeAnalysis(dna: TourismDNA, data: SupportingData = DEFAULT_SUPPORTING_DATA, scenario: ScenarioKey = 'current') {
  return generateIllustrativeScenarios(dna, data, scenario);
}
