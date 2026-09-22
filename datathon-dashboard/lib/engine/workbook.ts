// Typed readers for data_new.xlsx (the Pandas `read_excel` calls in ml8.py, plus the
// socio-economic sheet used by the Langkawi charts). Nothing here contains data values:
// everything is read from the workbook at runtime.

import * as XLSX from 'xlsx';

type Row = Record<string, unknown>;

/**
 * Model inputs that ml8.py hard-codes in its `__main__` (not in the workbook).
 * `wasteLimitTons` can be overridden per island with an optional `Waste_Limit_Tons`
 * column on the Island_Profiles sheet.
 */
export const ISLAND_CONFIG = {
  Langkawi: { proxyReef: 'Pulau Payar', wasteLimitTons: 11000 },
  Tioman: { proxyReef: 'Pulau Tioman', wasteLimitTons: 4000 },
} as const;

export type IslandKey = keyof typeof ISLAND_CONFIG;
export const ISLAND_KEYS = Object.keys(ISLAND_CONFIG) as IslandKey[];

export const SHEETS = {
  profiles: 'Island_Profiles',
  coral: 'Coral_Reef_Status',
  socio: 'Langkawi_Socioeconomic_Master',
} as const;

export interface IslandProfile {
  island: string;
  beachRooms: number;
  cityRooms: number;
  ecoRooms: number;
  currentAlos: number;
  wasteLimitOverride: number | null;
}

export interface IslandYear {
  year: number;
  visitorsK: number | null;
  alos: number | null;
  receiptsM: number | null;
  lcc: number | null;
}

export interface CoralRow {
  year: number;
  island: string;
  lcc: number | null;
  disturbance: number | null;
}

export interface SocioRow {
  year: number;
  visitorsK: number | null;
  alos: number | null;
  receiptsM: number | null;
  decoupling: number | null;
  /** Services-sector GDP, RM million (optional column). */
  services: number | null;
  /** Unemployment rate, % (optional column). */
  unemploymentPct: number | null;
  /** Tourism receipts per trip, RM (Avg_Receipts_Per_Trip_RM column). */
  receiptsPerTripRM: number | null;
}

export interface MonthlyRow {
  year: number;
  month: number; // 1-12
  total: number;
  international: number | null;
}

export interface WorkbookData {
  profiles: IslandProfile[];
  islandYears: Record<IslandKey, IslandYear[]>;
  coral: CoralRow[];
  socio: SocioRow[];
  monthly: MonthlyRow[];
  monthlySheetName: string;
}

const MONTH_NUM: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

export const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function readSheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" was not found in data_new.xlsx. Sheets present: ${wb.SheetNames.join(', ')}.`);
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
}

/** Required numeric column: a missing/blank value is a data error we surface to the user. */
function required(row: Row, col: string, sheet: string): number {
  const n = toNum(row[col]);
  if (n === null) throw new Error(`Sheet "${sheet}" has a missing or non-numeric "${col}" value.`);
  return n;
}

export function readWorkbook(wb: XLSX.WorkBook): WorkbookData {
  const profiles = readSheet(wb, SHEETS.profiles).map<IslandProfile>((r) => ({
    island: String(r['Island']).trim(),
    beachRooms: required(r, 'Beach_Rooms', SHEETS.profiles),
    cityRooms: required(r, 'City_Rooms', SHEETS.profiles),
    ecoRooms: required(r, 'Eco_Hill_Rooms', SHEETS.profiles),
    currentAlos: required(r, 'Current_ALOS', SHEETS.profiles),
    wasteLimitOverride: toNum(r['Waste_Limit_Tons']),
  }));

  const islandYears = {} as Record<IslandKey, IslandYear[]>;
  for (const key of ISLAND_KEYS) {
    const sheet = `${key}_ML`;
    islandYears[key] = readSheet(wb, sheet).map<IslandYear>((r) => ({
      year: required(r, 'Year', sheet),
      visitorsK: toNum(r['Domestic_Visitors_k']),
      alos: toNum(r['Average_Length_of_Stay_nights']),
      receiptsM: toNum(r['Tourism_Receipts_RM_mil']),
      lcc: toNum(r['Live_Coral_Cover_Pct']),
    }));
  }

  const coral = readSheet(wb, SHEETS.coral).map<CoralRow>((r) => ({
    year: required(r, 'Year', SHEETS.coral),
    island: String(r['Island']).trim(),
    lcc: toNum(r['Live_Coral_Cover_Pct']),
    disturbance: toNum(r['Disturbance_Indicators_Pct']),
  }));

  const socio = readSheet(wb, SHEETS.socio).map<SocioRow>((r) => ({
    year: required(r, 'Year', SHEETS.socio),
    visitorsK: toNum(r['Domestic_Visitors_k']),
    alos: toNum(r['Average_Length_of_Stay_nights']),
    receiptsM: toNum(r['Tourism_Receipts_RM_mil']),
    decoupling: toNum(r['Decoupling_Index_RM_per_Ton']),
    services: toNum(r['Services']),
    unemploymentPct: toNum(r['Unemployment_Rate_pct']),
    receiptsPerTripRM: toNum(r['Avg_Receipts_Per_Trip_RM']),
  }));

  // ml8.py: the first sheet whose name contains "month" holds the monthly arrivals.
  const monthlySheetName = wb.SheetNames.find((s) => s.toLowerCase().includes('month'));
  if (!monthlySheetName) throw new Error('No sheet with "month" in its name was found for the monthly arrivals series.');
  const monthly = readSheet(wb, monthlySheetName)
    .map((raw) => {
      // ml8.py standardises headers with strip().upper()
      const r: Row = {};
      for (const [k, v] of Object.entries(raw)) r[String(k).trim().toUpperCase()] = v;
      const month = MONTH_NUM[String(r['MONTH']).trim().toUpperCase()];
      const year = toNum(r['YEAR']);
      const total = toNum(r['TOTAL']);
      const international = toNum(r['INTERNATIONAL']);
      return year !== null && total !== null && month ? ({ year, month, total, international } as MonthlyRow) : null;
    })
    .filter((r): r is MonthlyRow => r !== null)
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return { profiles, islandYears, coral, socio, monthly, monthlySheetName };
}
