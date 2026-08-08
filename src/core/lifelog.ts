/**
 * 出来事のあった日に、その人の命式で何が巡っていたかを引き当てる。
 *
 * 命式を「当てにいく」のではなく、実際に起きたことと巡っていた運を並べて、
 * 自分の命式の読み方を確かめるための道具。だから何かを言い切ることはせず、
 * その時点の大運・流年と、それが命式のどこに掛かっていたかだけを出す。
 */

import { Solar } from 'lunar-typescript';

import { ELEMENT_LABEL } from './constants';
import { twelveStage, tenGod, zhiTenGod } from './ganzhi';
import {
  RELATION_TONE,
  SLOT_LABEL,
  findCrossRelations,
  splitGanZhi,
  type CrossRelation,
} from './relations';
import type { Chart, DaYunEntry, LiuNianEntry } from './types';

export const EVENT_CATEGORIES = [
  '仕事',
  '住まい',
  '健康',
  '人間関係',
  '学び',
  'お金',
  'その他',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface LuckPillarView {
  gan: string;
  zhi: string;
  ganTenGod: string;
  zhiTenGod: string;
  stage: string;
}

export interface EventContext {
  /** 'YYYY-MM-DD' */
  date: string;
  /** その日の満年齢 */
  age: number;
  /** 立春を境にした年（1月生まれの出来事は前年に属することがある） */
  liChunYear: number;
  daYun: DaYunEntry | null;
  liuNian: LiuNianEntry | null;
  /** 節を境にした、その日の月柱 */
  month: LuckPillarView;
  /** その日の日柱（日辰） */
  day: LuckPillarView;
  /** 大運が命式に掛けている関係 */
  daYunRelations: CrossRelation[];
  /** 流年が命式に掛けている関係 */
  liuNianRelations: CrossRelation[];
  /** 大運と流年のあいだの関係 */
  luckRelations: CrossRelation[];
  /** 出来事の日が命式の範囲外（起運前や大運10本の外）だった場合の断り */
  note: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' を年月日に分ける。読めなければ null。 */
export function parseDate(date: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export function todayString(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function luckView(chart: Chart, ganZhi: string): LuckPillarView | null {
  const gz = splitGanZhi(ganZhi);
  if (!gz) return null;
  return {
    gan: gz.gan,
    zhi: gz.zhi,
    ganTenGod: tenGod(chart.dayMaster, gz.gan),
    zhiTenGod: zhiTenGod(chart.dayMaster, gz.zhi),
    stage: twelveStage(chart.dayMaster, gz.zhi),
  };
}

/**
 * ある日に巡っていたものを引き当てる。
 *
 * 年柱は立春、月柱は節で切り替わるので、暦の年月ではなくその日の干支から求める。
 * そのうえで、命式の大運・流年の表から同じ干支の年を探して対応づける。
 */
export function eventContext(chart: Chart, date: string): EventContext | null {
  const parsed = parseDate(date);
  if (!parsed) return null;

  // 時刻は分からないので正午で見る（年柱・月柱・日柱は時刻に左右されない）
  const eightChar = Solar.fromYmdHms(parsed.y, parsed.m, parsed.d, 12, 0, 0)
    .getLunar()
    .getEightChar();

  const yearGZ = eightChar.getYear();
  const monthView = luckView(chart, eightChar.getMonth());
  const dayView = luckView(chart, eightChar.getDay());

  // 1月・2月初旬の出来事は前年の立春年に属するので、暦年と暦年−1 の両方から探す
  let daYun: DaYunEntry | null = null;
  let liuNian: LiuNianEntry | null = null;
  for (const entry of chart.luck.entries) {
    const hit = entry.liuNian.find(
      (n) => n.gan + n.zhi === yearGZ && (n.year === parsed.y || n.year === parsed.y - 1)
    );
    if (hit) {
      daYun = entry;
      liuNian = hit;
      break;
    }
  }

  const birth = Date.UTC(chart.input.year, chart.input.month - 1, chart.input.day);
  const at = Date.UTC(parsed.y, parsed.m - 1, parsed.d);
  let age = parsed.y - chart.input.year;
  const beforeBirthday =
    parsed.m < chart.input.month ||
    (parsed.m === chart.input.month && parsed.d < chart.input.day);
  if (beforeBirthday) age -= 1;

  const natal = chart.pillars.map((p) => ({ slot: p.slot, gan: p.gan, zhi: p.zhi }));

  const daYunRelations = daYun
    ? findCrossRelations(natal, [{ slot: 'daYun', gan: daYun.gan, zhi: daYun.zhi }])
    : [];
  const liuNianRelations = liuNian
    ? findCrossRelations(natal, [{ slot: 'liuNian', gan: liuNian.gan, zhi: liuNian.zhi }])
    : [];
  const luckRelations =
    daYun && liuNian
      ? findCrossRelations(
          [{ slot: 'daYun', gan: daYun.gan, zhi: daYun.zhi }],
          [{ slot: 'liuNian', gan: liuNian.gan, zhi: liuNian.zhi }]
        )
      : [];

  let note: string | null = null;
  if (at < birth) {
    note = '生まれる前の日付です。';
  } else if (!daYun) {
    note =
      age < chart.luck.startAge
        ? `起運（${chart.luck.startAge}歳）より前なので、まだ大運に入っていません。`
        : '算出している大運10本の範囲の外です。';
  }

  return {
    date,
    age,
    liChunYear: liuNian?.year ?? parsed.y,
    daYun,
    liuNian,
    month: monthView ?? { gan: '', zhi: '', ganTenGod: '', zhiTenGod: '', stage: '' },
    day: dayView ?? { gan: '', zhi: '', ganTenGod: '', zhiTenGod: '', stage: '' },
    daYunRelations,
    liuNianRelations,
    luckRelations,
    note,
  };
}

/** その時期に何が巡っていたかを一文にする。一覧の脇に添える用。 */
export function describeContext(ctx: EventContext): string {
  const parts: string[] = [];
  if (ctx.daYun) parts.push(`大運 ${ctx.daYun.gan}${ctx.daYun.zhi}（${ctx.daYun.ganTenGod}）`);
  if (ctx.liuNian) {
    parts.push(`流年 ${ctx.liuNian.gan}${ctx.liuNian.zhi}（${ctx.liuNian.ganTenGod}）`);
  }
  if (parts.length === 0) return ctx.note ?? '';
  return parts.join('・');
}

export interface LoggedEvent {
  date: string;
  title: string;
  category: EventCategory;
  note: string;
}

/**
 * 人生ログをまとめて LLM に渡せる文章にする。
 * 「当ててください」ではなく「実際に起きたことと巡っていた運の対応を読んでください」という形にする。
 */
export function lifeLogSummary(chart: Chart, events: LoggedEvent[]): string {
  const name = chart.input.name.trim() || '本人';
  const lines: string[] = [];

  lines.push(`## ${name}の出来事と、その時期に巡っていた運`);
  lines.push('');
  lines.push(
    `命式: ${chart.pillars.map((p) => `${p.gan}${p.zhi}`).join(' ')}（日干 ${chart.dayMaster}／${ELEMENT_LABEL[chart.dayMasterElement]}）`
  );
  lines.push(`大運は${chart.luck.forward ? '順行' : '逆行'}、${chart.luck.startAge}歳から。`);
  lines.push('');

  if (events.length === 0) {
    lines.push('記録された出来事はまだありません。');
    return lines.join('\n');
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  for (const ev of sorted) {
    const ctx = eventContext(chart, ev.date);
    lines.push(`### ${ev.date}（${ctx ? `満${ctx.age}歳` : '日付不明'}）${ev.title}`);
    lines.push('');
    lines.push(`- 分野: ${ev.category}`);
    if (ev.note.trim()) lines.push(`- 内容: ${ev.note.trim()}`);
    if (ctx) {
      if (ctx.daYun) {
        lines.push(
          `- 大運: ${ctx.daYun.gan}${ctx.daYun.zhi}（天干 ${ctx.daYun.ganTenGod}・地支 ${ctx.daYun.zhiTenGod}・${ctx.daYun.stage}）${ctx.daYun.startYear}〜${ctx.daYun.endYear}年`
        );
      }
      if (ctx.liuNian) {
        lines.push(
          `- 流年: ${ctx.liuNian.gan}${ctx.liuNian.zhi}（天干 ${ctx.liuNian.ganTenGod}・地支 ${ctx.liuNian.zhiTenGod}・${ctx.liuNian.stage}）`
        );
      }
      lines.push(`- その月の柱: ${ctx.month.gan}${ctx.month.zhi} ／ その日の柱: ${ctx.day.gan}${ctx.day.zhi}`);

      const rels = [...ctx.daYunRelations, ...ctx.liuNianRelations, ...ctx.luckRelations];
      if (rels.length > 0) {
        lines.push(
          `- 掛かっていた関係: ${rels
            .map(
              (r) =>
                `${SLOT_LABEL[r.otherSlot]}が${SLOT_LABEL[r.selfSlot]}と${r.kind}（${r.label}）`
            )
            .join('、')}`
        );
      } else {
        lines.push('- 掛かっていた関係: なし');
      }
      if (ctx.note) lines.push(`- 補足: ${ctx.note}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '上は実際に起きた出来事と、その時期に巡っていた運の対応です。' +
      '出来事を言い当てる必要はありません。それぞれの時期に巡っていた干支が命式のどこに作用し、' +
      'それが記録された出来事とどう噛み合って見えるかを読んでください。' +
      '噛み合わないところがあれば、無理に合わせずそのまま指摘してください。'
  );

  return lines.join('\n');
}

/** 結びつきと揺さぶりの数。一覧で時期の性質をひと目で見るのに使う。 */
export function toneCount(ctx: EventContext): { bond: number; clash: number } {
  const rels = [...ctx.daYunRelations, ...ctx.liuNianRelations, ...ctx.luckRelations];
  return {
    bond: rels.filter((r) => RELATION_TONE[r.kind] === 'bond').length,
    clash: rels.filter((r) => RELATION_TONE[r.kind] === 'clash').length,
  };
}
