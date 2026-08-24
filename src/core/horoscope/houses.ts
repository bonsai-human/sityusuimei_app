/**
 * ハウスの分割。
 *
 * 方式によって結果がまるごと変わるところなので、既定（プラシーダス）以外も選べるようにし、
 * 落ちたときは何に落としたかを言葉で返す。四柱推命の側で流派を選ばせているのと同じ扱い。
 */

import { asin, atan2, cos, norm360, sin, tan } from './math';
import type { HouseSystem, Houses } from './types';

export interface HouseParams {
  /** MC の赤経（＝地方恒星時、度） */
  ramc: number;
  /** アセンダントの黄経 */
  asc: number;
  /** MC の黄経 */
  mc: number;
  latitude: number;
  obliquity: number;
}

/** 黄経から、その点の赤緯を出す（黄緯 0 の点として扱う）。 */
function declinationOf(lon: number, obliquity: number): number {
  return asin(sin(obliquity) * sin(lon));
}

/** 赤経から、黄道上でその赤経を持つ点の黄経を出す。 */
function longitudeFromRA(ra: number, obliquity: number): number {
  return norm360(atan2(sin(ra), cos(ra) * cos(obliquity)));
}

/**
 * プラシーダスのカスプを 1 本求める。
 *
 * その点が「日周運動で半弧のどれだけを進んだところに居るか」で決まるので、
 * 黄経 → 赤緯 → 半弧 → 赤経 → 黄経 と巡って落ち着くまで繰り返す。
 *
 * @param fraction 半弧に対する比（11 室なら 1/3、12 室なら 2/3）
 * @param nocturnal 地平線の下側（2 室・3 室）なら true
 * @returns 収束したカスプの黄経。半弧が定義できない緯度なら null
 */
function placidusCusp(
  params: HouseParams,
  fraction: number,
  nocturnal: boolean
): number | null {
  const { ramc, latitude, obliquity } = params;

  // 赤緯 0（＝半弧がちょうど 90 度）のときの位置から始める
  let ra = nocturnal ? ramc + 180 - fraction * 90 : ramc + fraction * 90;
  let lon = longitudeFromRA(ra, obliquity);

  for (let i = 0; i < 40; i++) {
    const dec = declinationOf(lon, obliquity);
    const x = tan(latitude) * tan(dec);
    // |x| > 1 は、その赤緯の点がこの緯度では沈まない（または昇らない）ということ。
    // 半弧が定義できないので、プラシーダスは組めない
    if (Math.abs(x) > 1) return null;

    // 出没差。半昼弧は 90 + これ、半夜弧は 90 − これ
    const ad = asin(x);
    const semiArc = nocturnal ? 90 - ad : 90 + ad;
    ra = nocturnal ? ramc + 180 - fraction * semiArc : ramc + fraction * semiArc;

    const next = longitudeFromRA(ra, obliquity);
    const moved = Math.abs(((next - lon + 540) % 360) - 180);
    lon = next;
    if (moved < 1e-9) return lon;
  }
  return lon;
}

function opposite(lon: number): number {
  return norm360(lon + 180);
}

/** 12 本のカスプを、1 室から順に並べる。 */
function fromQuadrants(
  asc: number,
  c11: number,
  c12: number,
  c2: number,
  c3: number,
  mc: number
): number[] {
  return [
    asc,
    c2,
    c3,
    opposite(mc),
    opposite(c11),
    opposite(c12),
    opposite(asc),
    opposite(c2),
    opposite(c3),
    mc,
    c11,
    c12,
  ];
}

/**
 * ハウスを分割する。
 *
 * プラシーダスが組めない緯度（およそ南北 66 度より高い）では、ホールサインに落として
 * その旨を `note` に入れる。黙って別の方式の数字を出さない。
 */
export function buildHouses(
  requested: HouseSystem,
  params: HouseParams,
  sunLongitude: number
): Houses {
  const { asc, mc } = params;

  if (requested === 'solar') {
    const start = Math.floor(norm360(sunLongitude) / 30) * 30;
    return {
      system: 'solar',
      requested,
      note: null,
      cusps: Array.from({ length: 12 }, (_, i) => norm360(start + i * 30)),
    };
  }

  if (requested === 'whole') {
    const start = Math.floor(norm360(asc) / 30) * 30;
    return {
      system: 'whole',
      requested,
      note: null,
      cusps: Array.from({ length: 12 }, (_, i) => norm360(start + i * 30)),
    };
  }

  if (requested === 'equal') {
    return {
      system: 'equal',
      requested,
      note: null,
      cusps: Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30)),
    };
  }

  const c11 = placidusCusp(params, 1 / 3, false);
  const c12 = placidusCusp(params, 2 / 3, false);
  const c2 = placidusCusp(params, 2 / 3, true);
  const c3 = placidusCusp(params, 1 / 3, true);

  if (c11 == null || c12 == null || c2 == null || c3 == null) {
    const fallback = buildHouses('whole', params, sunLongitude);
    return {
      ...fallback,
      requested,
      note:
        `緯度 ${params.latitude.toFixed(1)} 度では、天球の一部が地平線を出入りしないため` +
        'プラシーダスのカスプが定まりません。ホールサインで表示しています。',
    };
  }

  return {
    system: 'placidus',
    requested,
    note: null,
    cusps: fromQuadrants(asc, c11, c12, c2, c3, mc),
  };
}

/** その黄経がどのハウスに入るか（1〜12）。 */
export function houseOf(lon: number, cusps: number[]): number {
  const l = norm360(lon);
  for (let i = 0; i < 12; i++) {
    const from = cusps[i];
    const to = cusps[(i + 1) % 12];
    const span = norm360(to - from);
    const offset = norm360(l - from);
    // カスプちょうどはその室の始まりとして扱う
    if (offset < span || span === 0) return i + 1;
  }
  return 12;
}
