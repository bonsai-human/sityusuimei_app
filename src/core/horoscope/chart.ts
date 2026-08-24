/**
 * 生年月日時から出生図（Horoscope）を組み立てる。
 *
 * ■ 時間の扱いについて
 *
 * 四柱推命とは基準が違うので、そこだけは取り違えないようにする。
 *
 *   四柱推命   … 日柱・時柱はその土地の太陽の位置で決まるので、真太陽時に直した時刻を使う
 *   ホロスコープ … 天体の位置は世界時（UT）だけで決まる。時計の時刻から標準時のオフセットを
 *                  引くだけでよく、経度補正も均時差も掛けない
 *
 * 経度は「その瞬間の空をどの向きから見上げるか」としてアセンダント側で効く。
 * 時刻にも足すと二重に効いてしまうので、`core/solarTime.ts` の補正はここでは通さない。
 */

import * as Astronomy from 'astronomy-engine';

import { resolveSolarDate } from '../chart';
import { hourFromZhi } from '../ganzhi';
import type { BirthInput } from '../types';
import { findAspects, type AspectPoint } from './aspects';
import { bodyState, sunAltitude, trueObliquity } from './bodies';
import {
  BODY_IDS,
  SIGN_ELEMENT,
  SIGN_QUALITY,
  SIGN_RULER_CLASSIC,
  SIGN_RULER_MODERN,
  type AngleId,
  type BodyId,
  type Element4,
  type Quality,
} from './constants';
import { ascendant, localSiderealDegrees, midheaven, vertex } from './angles';
import { buildHouses, houseOf } from './houses';
import { norm360, signPosition } from './math';
import { defaultHoroscopeOptions } from './types';
import type {
  AnglePlacement,
  Horoscope,
  HoroscopeOptions,
  Placement,
  Stellium,
  Tally,
} from './types';

/** 天体として数える 10 個。ドラゴンヘッドとリリスは天体ではないので、集計には入れない。 */
export const PLANETS: BodyId[] = BODY_IDS.filter(
  (id) => id !== 'northNode' && id !== 'lilith'
);

/** astronomy-engine が冥王星を出せる範囲。 */
const PLUTO_YEAR_RANGE = { from: 1700, to: 2200 };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}年${pad(d.getUTCMonth() + 1)}月${pad(d.getUTCDate())}日 ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UT`
  );
}

interface ResolvedTime {
  /** 時計の時刻（サマータイム調整後の現地標準時） */
  hour: number;
  minute: number;
  precision: 'exact' | 'zhi' | 'unknown';
}

function resolveTime(input: BirthInput): ResolvedTime {
  if (input.time.kind === 'hm') {
    return { hour: input.time.hour, minute: input.time.minute, precision: 'exact' };
  }
  if (input.time.kind === 'zhi') {
    // 時支のまん中を採る。子刻だけは 23 時から翌 1 時なので、まん中は 0 時
    return { hour: hourFromZhi(input.time.zhi), minute: 0, precision: 'zhi' };
  }
  // 時刻が分からないときは、その日のまん中で天体の位置を出す。
  // 感受点とハウスは出さないので、この時刻はサインと度数の代表値にしかならない
  return { hour: 12, minute: 0, precision: 'unknown' };
}

/** 現地の壁掛け時計の時刻を、世界時のミリ秒に直す。 */
function toUtcMillis(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
  input: BirthInput
): number {
  const dstOffset = input.dst ? 60 : 0;
  return (
    Date.UTC(y, m - 1, d, hour, minute) -
    (input.place.tzOffsetMinutes + dstOffset) * 60_000
  );
}

function tally<T extends string>(
  keys: readonly T[],
  of: (sign: number) => T,
  placements: Placement[],
  ascSign: number | null
): Tally<T>[] {
  return keys.map((key) => {
    let count = 0;
    let weighted = 0;
    for (const p of placements) {
      if (of(p.position.sign) !== key) continue;
      count++;
      // 太陽と月は他の天体より強く働くと見て 2 つぶんに数える
      weighted += p.id === 'sun' || p.id === 'moon' ? 2 : 1;
    }
    if (ascSign != null && of(ascSign) === key) weighted += 2;
    return { key, count, weighted };
  });
}

function findStelliums(placements: Placement[]): Stellium[] {
  const out: Stellium[] = [];

  const bySign = new Map<number, BodyId[]>();
  const byHouse = new Map<number, BodyId[]>();
  for (const p of placements) {
    bySign.set(p.position.sign, [...(bySign.get(p.position.sign) ?? []), p.id]);
    if (p.house != null) byHouse.set(p.house, [...(byHouse.get(p.house) ?? []), p.id]);
  }

  for (const [index, bodies] of [...bySign].sort((a, b) => a[0] - b[0])) {
    if (bodies.length >= 3) out.push({ kind: 'sign', index, bodies });
  }
  for (const [index, bodies] of [...byHouse].sort((a, b) => a[0] - b[0])) {
    if (bodies.length >= 3) out.push({ kind: 'house', index, bodies });
  }
  return out;
}

export function buildHoroscope(
  input: BirthInput,
  options: HoroscopeOptions = defaultHoroscopeOptions()
): Horoscope {
  const { y, m, d } = resolveSolarDate(input);
  if (y < PLUTO_YEAR_RANGE.from || y > PLUTO_YEAR_RANGE.to) {
    throw new Error(
      `使っている天体暦が扱えるのは西暦 ${PLUTO_YEAR_RANGE.from} 年から ${PLUTO_YEAR_RANGE.to} 年までです`
    );
  }

  const { hour, minute, precision } = resolveTime(input);
  const utcMs = toUtcMillis(y, m, d, hour, minute, input);
  const time = Astronomy.MakeTime(new Date(utcMs));
  const obliquity = trueObliquity(time);

  const notes: string[] = [];
  const latitude = input.place.latitude;
  const timeKnown = precision !== 'unknown';

  if (precision === 'unknown') {
    notes.push(
      '出生時刻が分からないので、アセンダント・MC・ハウスは出していません。' +
        '天体の位置はその日の 12 時のもので、月はその日のうちに動く幅を添えています。'
    );
  }
  if (precision === 'zhi') {
    notes.push(
      '時支だけの指定なので、その刻のまん中で組んでいます。' +
        'アセンダントは前後 1 時間で 15 度ほど動くため、サインが変わることがあります。'
    );
  }
  if (latitude == null) {
    notes.push(
      '出生地の緯度が入力されていないので、アセンダント・MC・ハウスは出していません。' +
        '入力の画面で緯度を入れると出せます。'
    );
  }
  if (input.calendar !== 'solar') {
    notes.push('旧暦で入力された日付を、新暦に直してから天体の位置を求めています。');
  }
  if (latitude != null && Math.abs(latitude) < 5) {
    notes.push(
      '赤道の近くではバーテックスが定まらない（黄道と東西の大円がほとんど重なる）ため、' +
        'その値は読まないでください。'
    );
  }

  // --- 天体 -------------------------------------------------------------

  // 時刻が分からないときは、その日の 0 時と 24 時でも位置を出して、動く幅を添える
  const dayStart = timeKnown ? null : Astronomy.MakeTime(new Date(toUtcMillis(y, m, d, 0, 0, input)));
  const dayEnd = timeKnown ? null : Astronomy.MakeTime(new Date(toUtcMillis(y, m, d, 24, 0, input)));

  const rawPlacements = BODY_IDS.map((id) => {
    const state = bodyState(id, time, options.nodeKind);
    const range =
      dayStart && dayEnd
        ? {
            from: bodyState(id, dayStart, options.nodeKind).lon,
            to: bodyState(id, dayEnd, options.nodeKind).lon,
          }
        : null;
    return { id, state, range };
  });

  // --- 感受点とハウス ---------------------------------------------------

  let angles: Record<AngleId, AnglePlacement> | null = null;
  let houses: Horoscope['houses'] = null;
  let lst: number | null = null;

  if (timeKnown && latitude != null) {
    lst = localSiderealDegrees(time, input.place.longitude);
    const asc = ascendant(lst, latitude, obliquity);
    const mc = midheaven(lst, obliquity);
    const vx = vertex(lst, latitude, obliquity);

    const make = (id: AngleId, lon: number): AnglePlacement => ({
      id,
      lon,
      position: signPosition(lon),
    });
    angles = {
      asc: make('asc', asc),
      mc: make('mc', mc),
      dsc: make('dsc', norm360(asc + 180)),
      ic: make('ic', norm360(mc + 180)),
      vertex: make('vertex', vx),
    };

    const sun = rawPlacements.find((p) => p.id === 'sun')!;
    houses = buildHouses(
      options.houseSystem,
      { ramc: lst, asc, mc, latitude, obliquity },
      sun.state.lon
    );
    if (houses.note) notes.push(houses.note);
  }

  const placements: Placement[] = rawPlacements.map(({ id, state, range }) => ({
    id,
    lon: state.lon,
    lat: state.lat,
    speed: state.speed,
    // ドラゴンヘッドは常に逆行しているので、わざわざ逆行とは呼ばない
    retrograde: state.speed < 0 && id !== 'northNode' && id !== 'lilith',
    position: signPosition(state.lon),
    house: houses ? houseOf(state.lon, houses.cusps) : null,
    range,
  }));

  // --- アスペクト -------------------------------------------------------

  const points: AspectPoint[] = placements.map((p) => ({
    id: p.id,
    lon: p.lon,
    speed: p.speed,
  }));
  if (angles) {
    // 感受点は 1 日で一周してしまうので、接近・分離は見ない（速度を null にする）
    points.push({ id: 'asc', lon: angles.asc.lon, speed: null });
    points.push({ id: 'mc', lon: angles.mc.lon, speed: null });
  }
  const aspects = findAspects(points, options);

  // --- 全体の傾き -------------------------------------------------------

  const planets = placements.filter((p) => PLANETS.includes(p.id));
  const ascSign = angles ? angles.asc.position.sign : null;

  const elements = tally<Element4>(
    ['fire', 'earth', 'air', 'water'],
    (sign) => SIGN_ELEMENT[sign],
    planets,
    ascSign
  );
  const qualities = tally<Quality>(
    ['cardinal', 'fixed', 'mutable'],
    (sign) => SIGN_QUALITY[sign],
    planets,
    ascSign
  );

  let dayChart: boolean | null = null;
  if (timeKnown && latitude != null) {
    dayChart = sunAltitude(time, latitude, input.place.longitude) > 0;
  }

  let ascRuler: Horoscope['ascRuler'] = null;
  if (ascSign != null) {
    const table = options.modernRulers ? SIGN_RULER_MODERN : SIGN_RULER_CLASSIC;
    const body = table[ascSign];
    const placement = placements.find((p) => p.id === body);
    if (placement) ascRuler = { body, placement };
  }

  const hemispheres = houses
    ? {
        east: planets.filter((p) => p.house != null && (p.house >= 10 || p.house <= 3)).length,
        west: planets.filter((p) => p.house != null && p.house >= 4 && p.house <= 9).length,
        south: planets.filter((p) => p.house != null && p.house >= 7).length,
        north: planets.filter((p) => p.house != null && p.house <= 6).length,
      }
    : null;

  return {
    input,
    options,
    placements,
    angles,
    houses,
    aspects,
    elements,
    qualities,
    dayChart,
    ascRuler,
    stelliums: findStelliums(planets),
    hemispheres,
    meta: {
      utc: formatUtc(utcMs),
      standardDateTime: `${y}年${pad(m)}月${pad(d)}日 ${pad(hour % 24)}:${pad(minute)}`,
      timePrecision: precision,
      obliquity,
      localSiderealTime: lst,
      notes,
    },
  };
}
