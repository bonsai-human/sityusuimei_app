/** 角度まわりの小道具。度で扱い、0 以上 360 未満に正規化して持ち回る。 */

import type { SignPosition } from './types';

export function norm360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/** −180 以上 180 未満に畳む。差を取るときに使う。 */
export function norm180(deg: number): number {
  return norm360(deg + 180) - 180;
}

/** 二点のあいだの角度（0 以上 180 以下）。向きは持たない。 */
export function separation(a: number, b: number): number {
  return Math.abs(norm180(a - b));
}

export const DEG = Math.PI / 180;

export function sin(deg: number): number {
  return Math.sin(deg * DEG);
}

export function cos(deg: number): number {
  return Math.cos(deg * DEG);
}

export function tan(deg: number): number {
  return Math.tan(deg * DEG);
}

export function asin(x: number): number {
  return Math.asin(x) / DEG;
}

export function atan2(y: number, x: number): number {
  return Math.atan2(y, x) / DEG;
}

/** 黄経を、サインと度分に割る。 */
export function signPosition(lon: number): SignPosition {
  const l = norm360(lon);
  const sign = Math.floor(l / 30);
  const degree = l - sign * 30;
  const deg = Math.floor(degree);
  // 59.6 分を 60 分と書いてしまわないよう、分は切り捨てる
  const min = Math.floor((degree - deg) * 60);
  return { sign, degree, deg, min };
}

/** 「牡羊座 12°34′」の形。 */
export function formatSignPosition(pos: SignPosition, signLabel: string[]): string {
  return `${signLabel[pos.sign]} ${pos.deg}°${String(pos.min).padStart(2, '0')}′`;
}
