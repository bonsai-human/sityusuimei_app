/**
 * 保存した命式の置き場。
 *
 * IndexedDB にこのブラウザの中だけで持つ。サーバーへは送らないので、
 * 端末を移るときは JSON で書き出して読み込ませる（`exportAll` / `importAll`）。
 */

import Dexie, { type Table } from 'dexie';

import { buildChart } from '../core/chart';
import type { EventCategory } from '../core/lifelog';
import type { BirthInput, Chart } from '../core/types';

export interface SavedChart {
  id?: number;
  /** 入力そのもの。命式は開くたびに組み直すので、算出結果は持たない */
  input: BirthInput;
  memo: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;

  // ---- 以下は検索・並べ替えのために入力から取り出した写し ----
  /** 検索用に小文字化した名前とメモ */
  searchText: string;
  birthYear: number;
  /** 'YYYY-MM-DD'。生年月日での並べ替えと検索に使う */
  birthDate: string;
  gender: BirthInput['gender'];
  /** 年・月・日・時の干支。干支での絞り込みに使う（時柱不明なら空） */
  yearGZ: string;
  monthGZ: string;
  dayGZ: string;
  hourGZ: string;
}

/** 人生ログの1件。どの命式のものかを chartId で持つ。 */
export interface LifeEventRow {
  id?: number;
  chartId: number;
  /** 'YYYY-MM-DD' */
  date: string;
  title: string;
  category: EventCategory;
  note: string;
  createdAt: number;
}

class MeishikiDatabase extends Dexie {
  charts!: Table<SavedChart, number>;
  events!: Table<LifeEventRow, number>;

  constructor() {
    super('meishiki-note');
    this.version(1).stores({
      // 先頭が主キー。以降は索引を張る列
      charts: '++id, updatedAt, createdAt, birthDate, birthYear, gender, dayGZ, yearGZ, *tags',
    });
    this.version(2).stores({
      events: '++id, chartId, date, [chartId+date]',
    });
  }
}

export const db = new MeishikiDatabase();

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 入力から、検索・並べ替え用の項目を組み立てる。
 * 干支は命式を組まないと分からないので、ここで一度だけ算出して写しておく。
 */
export function deriveFields(
  input: BirthInput,
  memo: string
): Omit<SavedChart, 'id' | 'input' | 'memo' | 'tags' | 'createdAt' | 'updatedAt'> {
  let chart: Chart | null = null;
  try {
    chart = buildChart(input);
  } catch {
    // 命式を組めない入力でも保存自体は通す（あとで直せるように）
    chart = null;
  }

  return {
    searchText: `${input.name} ${memo}`.toLowerCase(),
    birthYear: input.year,
    birthDate: `${input.year}-${pad(input.month)}-${pad(input.day)}`,
    gender: input.gender,
    yearGZ: chart ? chart.year.gan + chart.year.zhi : '',
    monthGZ: chart ? chart.month.gan + chart.month.zhi : '',
    dayGZ: chart ? chart.day.gan + chart.day.zhi : '',
    hourGZ: chart?.hour ? chart.hour.gan + chart.hour.zhi : '',
  };
}

export async function saveChart(
  input: BirthInput,
  memo = '',
  tags: string[] = []
): Promise<number> {
  const now = Date.now();
  return db.charts.add({
    input,
    memo,
    tags,
    createdAt: now,
    updatedAt: now,
    ...deriveFields(input, memo),
  });
}

export async function updateChart(
  id: number,
  input: BirthInput,
  memo: string,
  tags: string[]
): Promise<void> {
  await db.charts.update(id, {
    input,
    memo,
    tags,
    updatedAt: Date.now(),
    ...deriveFields(input, memo),
  });
}

export async function deleteChart(id: number): Promise<void> {
  // 命式を消したら、その人の出来事も残さない
  await db.transaction('rw', db.charts, db.events, async () => {
    await db.events.where('chartId').equals(id).delete();
    await db.charts.delete(id);
  });
}

export async function getChart(id: number): Promise<SavedChart | undefined> {
  return db.charts.get(id);
}

export type SortKey = 'updatedAt' | 'createdAt' | 'birthDate' | 'name';

export interface ChartQuery {
  /** 名前・メモ・生年月日にかかる語 */
  text?: string;
  gender?: BirthInput['gender'];
  /** 干支での絞り込み。'癸未' のような 2 文字、または '癸' '未' のような 1 文字 */
  ganZhi?: string;
  sort?: SortKey;
  descending?: boolean;
}

function matchesGanZhi(row: SavedChart, query: string): boolean {
  const all = [row.yearGZ, row.monthGZ, row.dayGZ, row.hourGZ].filter(Boolean);
  if (query.length >= 2) return all.some((gz) => gz === query);
  // 1 文字なら天干・地支のどちらかに含まれていればよい
  return all.some((gz) => gz.includes(query));
}

export async function queryCharts(q: ChartQuery = {}): Promise<SavedChart[]> {
  let rows = await db.charts.toArray();

  if (q.text?.trim()) {
    const needle = q.text.trim().toLowerCase();
    // 生年月日は 2003-01-10 でも 20030110 でも 2003/01/10 でも引けるようにする
    const digits = needle.replace(/[^0-9]/g, '');
    rows = rows.filter(
      (r) =>
        r.searchText.includes(needle) ||
        r.birthDate.includes(needle) ||
        (digits.length >= 4 && r.birthDate.replace(/-/g, '').includes(digits))
    );
  }
  if (q.gender) rows = rows.filter((r) => r.gender === q.gender);
  if (q.ganZhi?.trim()) {
    const needle = q.ganZhi.trim();
    rows = rows.filter((r) => matchesGanZhi(r, needle));
  }

  const sort = q.sort ?? 'updatedAt';
  rows.sort((a, b) => {
    if (sort === 'name') return a.input.name.localeCompare(b.input.name, 'ja');
    if (sort === 'birthDate') return a.birthDate.localeCompare(b.birthDate);
    return a[sort] - b[sort];
  });
  if (q.descending ?? sort !== 'name') rows.reverse();

  return rows;
}

export async function countCharts(): Promise<number> {
  return db.charts.count();
}

/* ------------------------------------------------------------ 人生ログ */

export async function listEvents(chartId: number): Promise<LifeEventRow[]> {
  const rows = await db.events.where('chartId').equals(chartId).toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function addEvent(
  event: Omit<LifeEventRow, 'id' | 'createdAt'>
): Promise<number> {
  return db.events.add({ ...event, createdAt: Date.now() });
}

export async function updateEvent(
  id: number,
  patch: Partial<Omit<LifeEventRow, 'id' | 'chartId' | 'createdAt'>>
): Promise<void> {
  await db.events.update(id, patch);
}

export async function deleteEvent(id: number): Promise<void> {
  await db.events.delete(id);
}

export async function countEvents(chartId: number): Promise<number> {
  return db.events.where('chartId').equals(chartId).count();
}

/* ------------------------------------------------- バックアップと復元 */

export type BackupEvent = Omit<LifeEventRow, 'id' | 'chartId'>;

/** 出来事は命式の入れ子にする。読み込み時に id が変わっても対応づけが崩れない。 */
export type BackupChart = Omit<SavedChart, 'id'> & { events: BackupEvent[] };

export interface Backup {
  format: 'meishiki-note';
  version: 2;
  exportedAt: string;
  charts: BackupChart[];
}

export async function exportAll(): Promise<Backup> {
  const [charts, events] = await Promise.all([db.charts.toArray(), db.events.toArray()]);
  const byChart = new Map<number, BackupEvent[]>();
  for (const { id: _id, chartId, ...rest } of events) {
    const list = byChart.get(chartId) ?? [];
    list.push(rest);
    byChart.set(chartId, list);
  }

  return {
    format: 'meishiki-note',
    version: 2,
    exportedAt: new Date().toISOString(),
    charts: charts.map(({ id, ...rest }) => ({
      ...rest,
      events: (byChart.get(id!) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    })),
  };
}

export interface ImportResult {
  added: number;
  skipped: number;
  events: number;
}

/**
 * バックアップを読み込む。同じ人を二重に増やさないよう、
 * 名前と生年月日時が一致するものは飛ばす。
 * 出来事を持たない古い形式（version 1）も読める。
 */
export async function importAll(data: unknown): Promise<ImportResult> {
  const backup = data as Partial<Backup>;
  if (backup?.format !== 'meishiki-note' || !Array.isArray(backup.charts)) {
    throw new Error('このファイルは命式ノートのバックアップではないようです');
  }

  const existing = await db.charts.toArray();
  const key = (r: { input: BirthInput }) =>
    `${r.input.name}|${r.input.year}-${r.input.month}-${r.input.day}|${JSON.stringify(r.input.time)}`;
  const seen = new Set(existing.map(key));

  let added = 0;
  let skipped = 0;
  let eventCount = 0;

  await db.transaction('rw', db.charts, db.events, async () => {
    for (const row of backup.charts!) {
      if (!row?.input || seen.has(key(row))) {
        skipped++;
        continue;
      }
      seen.add(key(row));

      const { events, ...chartRow } = row;
      // 索引用の項目は、保存時のものを信じずに組み直す
      const chartId = await db.charts.add({
        ...chartRow,
        memo: chartRow.memo ?? '',
        tags: Array.isArray(chartRow.tags) ? chartRow.tags : [],
        createdAt: chartRow.createdAt ?? Date.now(),
        updatedAt: chartRow.updatedAt ?? Date.now(),
        ...deriveFields(chartRow.input, chartRow.memo ?? ''),
      });
      added++;

      if (Array.isArray(events) && events.length > 0) {
        await db.events.bulkAdd(
          events.map((e) => ({
            chartId,
            date: e.date,
            title: e.title ?? '',
            category: e.category ?? 'その他',
            note: e.note ?? '',
            createdAt: e.createdAt ?? Date.now(),
          }))
        );
        eventCount += events.length;
      }
    }
  });

  return { added, skipped, events: eventCount };
}
