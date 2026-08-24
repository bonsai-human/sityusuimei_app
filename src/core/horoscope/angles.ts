/**
 * 感受点（アセンダント・MC・バーテックス）。
 *
 * 天体と違って天体暦は要らず、その瞬間の恒星時と出生地の緯度・経度だけで決まる。
 * 逆に言えば、出生時刻が 4 分ずれると 1 度動くので、時刻の精度がそのまま効く。
 */

import * as Astronomy from 'astronomy-engine';

import { atan2, cos, norm360, sin, tan } from './math';

/**
 * 地方恒星時（度）。
 *
 * グリニッジ視恒星時に東経を足したもので、いま真南（北半球なら）に来ている
 * 天の赤経を表す。MC の赤経（RAMC）そのもの。
 */
export function localSiderealDegrees(time: Astronomy.AstroTime, longitude: number): number {
  return norm360(Astronomy.SiderealTime(time) * 15 + longitude);
}

/**
 * MC（南中点）の黄経。
 *
 * 赤経が RAMC の黄道上の点。黄道と赤道の関係 tan(赤経) = tan(黄経)·cos(傾斜角) を
 * 黄経について解いたもの。
 */
export function midheaven(ramc: number, obliquity: number): number {
  return norm360(atan2(sin(ramc), cos(ramc) * cos(obliquity)));
}

/**
 * アセンダント（東の地平線と黄道の交点）の黄経。
 *
 * 緯度が高いほど、黄道が地平線に対して寝る時間帯と立つ時間帯の差が大きくなり、
 * サインごとの上りやすさが偏る（インターセプトの原因）。
 */
export function ascendant(ramc: number, latitude: number, obliquity: number): number {
  return norm360(
    atan2(cos(ramc), -(sin(ramc) * cos(obliquity) + tan(latitude) * sin(obliquity)))
  );
}

/**
 * バーテックス（黄道と、東西と天頂を通る大円との、西側の交点）。
 *
 * 余緯度（90 度 − 緯度）の土地で、反対側の子午線から見たアセンダントに当たる。
 * 南半球でも余緯度をそのまま 90 − 緯度（90 度を超える）で通してよい。
 * 正接の周期が 180 度なので、90 度を超えたぶんは式の中で吸収される。
 *
 * 赤道の近くでは余緯度が 90 度に近づいて正接が発散するため、値が意味を持たなくなる。
 * 使う側で断る必要がある（`buildHoroscope` が注記を添える）。
 */
export function vertex(ramc: number, latitude: number, obliquity: number): number {
  return ascendant(norm360(ramc + 180), 90 - latitude, obliquity);
}
