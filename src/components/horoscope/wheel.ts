/**
 * 円形の図を描くための下ごしらえ。出生図と、二人ぶんを重ねた図で共有する。
 *
 * 向きは慣習どおり、基準の点（ふつうはアセンダント）を左（9 時の方向）に置き、
 * 黄経が増える向きを反時計回りにする。
 */

import { norm360 } from '../../core/horoscope/math';

export const SIZE = 400;
export const C = SIZE / 2;
/** 感受点の札は円の外に出すので、その分だけ viewBox を広げる。 */
export const PAD = 18;

export const VIEW_BOX = `${-PAD} ${-PAD} ${SIZE + PAD * 2} ${SIZE + PAD * 2}`;

export interface Point {
  x: number;
  y: number;
}

export function polar(angle: number, radius: number): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C - radius * Math.sin(rad) };
}

/** 扇形（ドーナツの一片）のパス。 */
export function sectorPath(from: number, to: number, rOut: number, rIn: number): string {
  const a = polar(from, rOut);
  const b = polar(to, rOut);
  const c = polar(to, rIn);
  const d = polar(from, rIn);
  const large = norm360(to - from) > 180 ? 1 : 0;
  return [
    `M ${a.x} ${a.y}`,
    `A ${rOut} ${rOut} 0 ${large} 0 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${rIn} ${rIn} 0 ${large} 1 ${d.x} ${d.y}`,
    'Z',
  ].join(' ');
}

/**
 * 近すぎる札をずらす。
 *
 * 黄経の順に並べ、前の札から gap 未満なら押し出す。一周ぶん見たあとに
 * 最後と最初がぶつかっていたら、全体を少し戻して均す。
 */
export function spread<T extends string>(
  angles: { id: T; angle: number }[],
  gap: number
): Map<T, number> {
  const sorted = [...angles].sort((a, b) => a.angle - b.angle);
  const placed = new Map<T, number>();
  let previous: number | null = null;

  for (const item of sorted) {
    let angle = item.angle;
    if (previous != null && angle - previous < gap) angle = previous + gap;
    placed.set(item.id, angle);
    previous = angle;
  }

  const first = sorted.length > 0 ? placed.get(sorted[0].id) : null;
  if (first != null && previous != null && previous - first > 360 - gap) {
    const overflow = previous - first - (360 - gap);
    sorted.forEach((item, i) => {
      placed.set(item.id, placed.get(item.id)! - (overflow * (sorted.length - i)) / sorted.length);
    });
  }
  return placed;
}
