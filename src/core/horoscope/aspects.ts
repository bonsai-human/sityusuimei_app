/**
 * アスペクト（天体どうしの角度）の走査。
 *
 * 四柱推命の `pairRelations` と同じ考え方で、ここも「2 つの点の集まりのあいだで角度を見る」
 * 一本にまとめてある。出生図の中（同じ集まり）でも、トランジットと出生図でも、
 * 二人のあいだ（シナストリー）でも、この関数で足りる。
 *
 * 成立しているという事実と、ちょうどからのずれ、接近中か分離中かだけを返す。
 * 良し悪しの点数は付けない。
 */

import { ASPECTS, type AspectKind, type PointId } from './constants';
import { norm180, separation } from './math';
import type { Aspect, HoroscopeOptions } from './types';

export interface AspectPoint {
  id: PointId;
  lon: number;
  /** 1 日あたりの動き。感受点のように速すぎて意味を持たないものは null */
  speed: number | null;
}

const LUMINARIES: PointId[] = ['sun', 'moon'];
const ANGLES: PointId[] = ['asc', 'mc', 'dsc', 'ic', 'vertex'];

function orbFor(kind: AspectKind, a: PointId, b: PointId, options: HoroscopeOptions): number {
  const base = options.orbs[kind];
  const luminary = LUMINARIES.includes(a) || LUMINARIES.includes(b);
  return luminary ? base + options.luminaryOrbBonus : base;
}

/**
 * 少し先の時刻でずれが小さくなるなら接近中。
 *
 * 角度の差の符号を追うより、実際に動かしてみてずれを比べるほうが、
 * 0 度をまたぐ場合も逆行どうしの場合も取り違えが起きない。
 */
function isApplying(
  a: AspectPoint,
  b: AspectPoint,
  exact: number,
  orb: number
): boolean | null {
  if (a.speed == null || b.speed == null) return null;
  const dt = 0.05;
  const later = Math.abs(separation(a.lon + a.speed * dt, b.lon + b.speed * dt) - exact);
  return later < orb;
}

export interface PairOptions {
  /** 同じ集まりの中を見るか（自分自身と、同じ組み合わせの重複を避ける） */
  sameSet?: boolean;
  /** 感受点どうしのアスペクトも拾うか。既定では拾わない */
  betweenAngles?: boolean;
}

export function pairAspects(
  first: AspectPoint[],
  second: AspectPoint[],
  options: HoroscopeOptions,
  pairOptions: PairOptions = {}
): Aspect[] {
  const defs = ASPECTS.filter((d) => d.major || options.minorAspects);
  const found: Aspect[] = [];

  first.forEach((a, i) => {
    second.forEach((b, j) => {
      if (pairOptions.sameSet && j <= i) return;
      if (a.id === b.id && pairOptions.sameSet) return;
      // ASC と MC のように、どちらも出生地から決まる点どうしは角度を見ない
      // （必ず一定の関係になり、読む意味が無い）
      if (!pairOptions.betweenAngles && ANGLES.includes(a.id) && ANGLES.includes(b.id)) return;

      const sep = separation(a.lon, b.lon);
      for (const def of defs) {
        const diff = Math.abs(sep - def.angle);
        const allowed = orbFor(def.kind, a.id, b.id, options);
        if (diff > allowed) continue;

        found.push({
          a: a.id,
          b: b.id,
          kind: def.kind,
          tone: def.tone,
          exact: def.angle,
          separation: sep,
          orb: diff,
          applying: isApplying(a, b, def.angle, diff),
        });
        // ひとつ成立したら、同じ組み合わせで他の角度は見ない
        break;
      }
    });
  });

  // ちょうどに近いものから並べる。読むときに効きの強い順になる
  return found.sort((x, y) => x.orb - y.orb);
}

/** 一つの図の中のアスペクト。 */
export function findAspects(points: AspectPoint[], options: HoroscopeOptions): Aspect[] {
  return pairAspects(points, points, options, { sameSet: true });
}

/** 「30度08分」のような、オーブの表示。 */
export function formatOrb(orb: number): string {
  const deg = Math.floor(orb);
  const min = Math.round((orb - deg) * 60);
  return min === 60 ? `${deg + 1}°00′` : `${deg}°${String(min).padStart(2, '0')}′`;
}

/** 二点のあいだの、向きつきの角度差（−180〜180）。図を描くときに使う。 */
export function signedGap(a: number, b: number): number {
  return norm180(a - b);
}
