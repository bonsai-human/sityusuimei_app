/**
 * ある日に、天体が出生図のどこへ掛かっていたか。
 *
 * 四柱推命の大運・流年に当たるもので、見方も揃えてある。
 * 「その日に何が起きるか」を言い当てるためではなく、実際に起きたことと並べて
 * 読み方を確かめるために出す。だから成立している角度とオーブだけを返し、吉凶は付けない。
 *
 *   トランジット   … その日の空。いま動いている天体が、出生図の天体・感受点に掛ける角度
 *   二次進行       … 生後 1 日を 1 年と読み替えた図。ゆっくり動く内面の移り変わり
 *   ソーラーリターン … 太陽が出生時と同じ黄経に戻る瞬間の図。その 1 年の図として読まれる
 */

import * as Astronomy from 'astronomy-engine';

import type { BirthInput } from '../types';
import { formatOrb, pairAspects, type AspectPoint } from './aspects';
import { buildHoroscope } from './chart';
import {
  ASPECT_BY_KIND,
  BODY_IDS,
  POINT_LABEL,
  SIGN_LABEL,
  type AspectKind,
  type BodyId,
} from './constants';
import { houseOf } from './houses';
import { formatSignPosition, signPosition } from './math';
import type { Aspect, Horoscope, HoroscopeOptions, Placement } from './types';

/**
 * トランジットのオーブ。出生図の中どうしより狭く取る。
 * 広く取ると常に何かが当たっている状態になり、時期を見る役に立たなくなる。
 */
export const DEFAULT_TRANSIT_ORBS: Record<AspectKind, number> = {
  conjunction: 3,
  opposition: 3,
  trine: 3,
  square: 3,
  sextile: 2,
  quincunx: 1,
  semisextile: 1,
  semisquare: 1,
  sesquiquadrate: 1,
};

/** 1 太陽年の日数。二次進行の読み替えに使う。 */
const TROPICAL_YEAR = 365.242189;

export interface TransitOptions {
  orbs: Record<AspectKind, number>;
  /**
   * 月も見るか。月は 1 日で 13 度動くので、日付だけを指定して見るときは
   * 当たっているかどうかが時刻次第になる。既定では外す。
   */
  includeMoon: boolean;
}

export function defaultTransitOptions(): TransitOptions {
  return { orbs: { ...DEFAULT_TRANSIT_ORBS }, includeMoon: false };
}

export interface TransitSet {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 実際に見た瞬間（現地標準時） */
  moment: string;
  /** その日の天体。ハウスは出生図のハウスで読む */
  placements: Placement[];
  /** a がトランジット側、b が出生図側 */
  aspects: Aspect[];
  notes: string[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 出生の入力を下敷きに、別の日時の入力を作る。
 *
 * 出生地と設定はそのまま引き継ぐ。トランジットも進行も返りも、
 * 同じ場所から見た空として組むため。
 */
export function inputOnDate(
  base: BirthInput,
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number
): BirthInput {
  return {
    ...base,
    calendar: 'solar',
    year: y,
    month: m,
    day: d,
    time: { kind: 'hm', hour, minute },
    // サマータイムは出生時の話なので、別の日を見るときには引き継がない
    dst: false,
  };
}

/** 世界時のミリ秒から、その土地の壁掛け時計に合わせた入力を作る。 */
function inputAtMoment(base: BirthInput, utcMs: number): BirthInput {
  const local = new Date(utcMs + base.place.tzOffsetMinutes * 60_000);
  return inputOnDate(
    base,
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    local.getUTCHours(),
    local.getUTCMinutes()
  );
}

/** 出生の瞬間（世界時のミリ秒）。 */
function birthMillis(natal: Horoscope): number {
  const utc = natal.meta.utc.match(/(\d+)年(\d+)月(\d+)日 (\d+):(\d+)/);
  if (!utc) throw new Error('出生の瞬間を読み取れませんでした');
  const [, y, m, d, h, mi] = utc;
  return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi));
}

/**
 * その日のトランジット。
 *
 * 日付だけを指定して見るので、時刻はその土地の正午に取る。
 * 月以外は 1 日で 1 度も動かないので、正午で見れば足りる。
 */
export function transitsOn(
  natal: Horoscope,
  date: string,
  options: HoroscopeOptions,
  transitOptions: TransitOptions = defaultTransitOptions()
): TransitSet {
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) throw new Error('日付は YYYY-MM-DD の形で指定してください');
  const [, y, m, d] = parts;

  const input = inputOnDate(natal.input, Number(y), Number(m), Number(d), 12, 0);
  const sky = buildHoroscope(input, options);

  const notes: string[] = [];
  if (transitOptions.includeMoon) {
    notes.push(
      '月は 1 日で 13 度あまり動くので、その日のうちでも当たり方が変わります。' +
        'ここではその土地の正午の位置で見ています。'
    );
  }

  const bodies = sky.placements.filter((p) => {
    if (p.id === 'moon') return transitOptions.includeMoon;
    return true;
  });

  // ハウスは出生図のものを使う。「トランジットの土星が 7 室に入っている」は
  // その日の空のハウスではなく、その人の出生図のハウスで読む
  const placements: Placement[] = bodies.map((p) => ({
    ...p,
    house: natal.houses ? houseOf(p.lon, natal.houses.cusps) : null,
  }));

  const transitPoints: AspectPoint[] = placements.map((p) => ({
    id: p.id,
    lon: p.lon,
    speed: p.speed,
  }));

  // 出生図の側は動かないので速度は 0。感受点は出生時刻の精度がそのまま効くので
  // 速度を持たせず、接近・分離も出さない
  const natalPoints: AspectPoint[] = natal.placements.map((p) => ({
    id: p.id,
    lon: p.lon,
    speed: 0,
  }));
  if (natal.angles) {
    natalPoints.push({ id: 'asc', lon: natal.angles.asc.lon, speed: null });
    natalPoints.push({ id: 'mc', lon: natal.angles.mc.lon, speed: null });
  }

  const aspects = pairAspects(
    transitPoints,
    natalPoints,
    { ...options, orbs: transitOptions.orbs },
    // トランジットと出生図は別の集まりなので、同じ天体どうしも見る
    { betweenAngles: false }
  );

  return {
    date,
    moment: `${y}年${m}月${d}日 12:00`,
    placements,
    aspects,
    notes,
  };
}

/**
 * 二次進行の図。生後 1 日を 1 年と読み替える。
 *
 * 進行の日付は「出生の瞬間 ＋ 経過年数を日に読み替えたぶん」。
 * その瞬間を、出生地から見た図として組む。
 */
export function progressedOn(
  natal: Horoscope,
  date: string,
  options: HoroscopeOptions
): { horoscope: Horoscope; progressedDate: string; years: number } {
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) throw new Error('日付は YYYY-MM-DD の形で指定してください');
  const [, y, m, d] = parts;

  const birth = birthMillis(natal);
  // 経過年数は、その土地の正午までで数える（世界時の正午で数えると、
  // 出生地の時差のぶんだけ最初からずれる）
  const target =
    Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0) -
    natal.input.place.tzOffsetMinutes * 60_000;
  const years = (target - birth) / (TROPICAL_YEAR * 86_400_000);
  const progressedMs = birth + years * 86_400_000;

  const input = inputAtMoment(natal.input, progressedMs);
  const horoscope = buildHoroscope(input, options);

  const local = new Date(progressedMs + natal.input.place.tzOffsetMinutes * 60_000);
  return {
    horoscope,
    progressedDate: `${local.getUTCFullYear()}年${pad(local.getUTCMonth() + 1)}月${pad(
      local.getUTCDate()
    )}日 ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
    years,
  };
}

/**
 * ソーラーリターン。太陽が出生時と同じ黄経に戻る瞬間の図。
 *
 * 帰る場所は流派が分かれる（出生地で見るか、いま住んでいる土地で見るか）。
 * ここでは出生地で組み、そのことを注記に出す。
 */
export function solarReturnOf(
  natal: Horoscope,
  year: number,
  options: HoroscopeOptions
): { horoscope: Horoscope; moment: string } {
  const natalSun = natal.placements.find((p) => p.id === 'sun');
  if (!natalSun) throw new Error('出生図に太陽がありません');

  // 誕生日の少し前から探せば、その年の回帰が最初に見つかる
  const birth = new Date(birthMillis(natal));
  const from = new Date(Date.UTC(year, birth.getUTCMonth(), birth.getUTCDate()) - 3 * 86_400_000);
  const found = Astronomy.SearchSunLongitude(natalSun.lon, from, 10);
  if (!found) throw new Error('太陽の回帰が見つかりませんでした');

  const input = inputAtMoment(natal.input, found.date.getTime());
  const horoscope = buildHoroscope(input, options);

  return { horoscope, moment: horoscope.meta.standardDateTime };
}

/** 「土星 山羊座 15°36′」のような、トランジット天体の短い表示。 */
export function transitLabel(placement: Placement, signLabel: string[]): string {
  const pos = signPosition(placement.lon);
  return `${signLabel[pos.sign]} ${pos.deg}°${pad(pos.min)}′`;
}

/** ゆっくり動く天体だけに絞る。時期を見るときはこちらが効く。 */
export const SLOW_BODIES: BodyId[] = BODY_IDS.filter(
  (id) => !['moon', 'sun', 'mercury', 'venus', 'mars', 'lilith'].includes(id)
);

/**
 * 出来事の一覧に、その日のめぐりを添えた書き出し。
 *
 * 四柱推命側の `lifeLogSummary` に続けて渡すことを想定している。
 * 同じ出来事を二つの体系から見るのが目的なので、どちらかに寄せた言い方はしない。
 */
export function transitLogSummary(
  natal: Horoscope,
  events: { date: string; title: string }[],
  options: HoroscopeOptions,
  transitOptions: TransitOptions = defaultTransitOptions()
): string {
  const lines: string[] = [];

  lines.push('## 同じ出来事に、天体がどう掛かっていたか');
  lines.push('');
  lines.push(
    '出生図: ' +
      natal.placements
        .map((p) => `${POINT_LABEL[p.id]} ${formatSignPosition(p.position, SIGN_LABEL)}`)
        .join(' ／ ')
  );
  if (natal.angles) {
    lines.push(
      `アセンダント ${formatSignPosition(natal.angles.asc.position, SIGN_LABEL)} ／ ` +
        `MC ${formatSignPosition(natal.angles.mc.position, SIGN_LABEL)}`
    );
  }
  lines.push('');

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  for (const ev of sorted) {
    lines.push(`### ${ev.date} ${ev.title}`);
    lines.push('');
    let aspects;
    try {
      aspects = transitsOn(natal, ev.date, options, transitOptions).aspects.filter((a) =>
        SLOW_BODIES.includes(a.a as BodyId)
      );
    } catch {
      lines.push('- この日のめぐりは出せませんでした（天体暦の範囲外の日付です）');
      lines.push('');
      continue;
    }

    if (aspects.length === 0) {
      lines.push('- 木星から先の天体が掛かっているものはありません');
    } else {
      for (const a of aspects) {
        const phase = a.applying === null ? '' : a.applying ? '・接近中' : '・分離中';
        lines.push(
          `- めぐる${POINT_LABEL[a.a]}が出生の${POINT_LABEL[a.b]}に${
            ASPECT_BY_KIND[a.kind].label
          }（${a.exact}度・オーブ ${formatOrb(a.orb)}${phase}）`
        );
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    'ここでは、数日で通り過ぎてしまう天体（月・太陽・水星・金星・火星）を外し、' +
      '木星から先だけを見ています。時期を画するのはそちらだからです。' +
      '出来事を言い当てる必要はありません。四柱推命の側と同じことを指している箇所と、' +
      'そうでない箇所を分けて読んでください。'
  );

  return lines.join('\n');
}
