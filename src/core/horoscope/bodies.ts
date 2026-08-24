/**
 * 天体の位置。
 *
 * astronomy-engine から見かけの地心位置を取り、その日の真の黄道座標（＝トロピカルの黄経）に
 * 直して返す。占星術で使う黄経はこれで、春分点を 0 度とする。
 *
 * ドラゴンヘッドとリリスは天体ではないので、扱いが分かれる。
 *   ドラゴンヘッド … 平均（Meeus の多項式）と、その瞬間の実際の交点（月の位置と速度から）の 2 通り
 *   リリス         … 月の平均遠地点。平均近地点の 180 度反対側として出す
 *
 * キロンなどの小惑星は astronomy-engine が持たないので、ここでは扱わない。
 */

import * as Astronomy from 'astronomy-engine';

import type { BodyId } from './constants';
import { atan2, norm360 } from './math';
import type { NodeKind } from './types';

/** 速度を出すときの前後の幅（日）。留の前後でも符号を取り違えない程度に取る。 */
const DT = 0.25;

const ASTRONOMY_BODY: Partial<Record<BodyId, Astronomy.Body>> = {
  sun: Astronomy.Body.Sun,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

export interface EclipticPosition {
  lon: number;
  lat: number;
}

/**
 * その日の真の黄道傾斜角（度）。
 *
 * 自前の近似式を持たず、astronomy-engine の回転行列から取り出す。
 * 黄道座標系から赤道座標系への回転は x 軸まわりの傾斜角ぶんの回転そのものなので、
 * 行列の成分がそのまま cos・sin になっている。
 */
export function trueObliquity(time: Astronomy.AstroTime): number {
  const m = Astronomy.Rotation_ECT_EQD(time).rot;
  return atan2(-m[2][1], m[2][2]);
}

/** ユリウス世紀（TT、J2000 起点）。平均交点と平均遠地点の多項式に使う。 */
function julianCenturies(time: Astronomy.AstroTime): number {
  return time.tt / 36525;
}

/**
 * 月の平均昇交点（ドラゴンヘッド）の黄経。Meeus『Astronomical Algorithms』第 47 章。
 * 常に逆行し、およそ 18.6 年で一周する。
 */
export function meanNode(time: Astronomy.AstroTime): number {
  const t = julianCenturies(time);
  return norm360(
    125.0445479 -
      1934.1362891 * t +
      0.0020754 * t * t +
      (t * t * t) / 467441 -
      (t * t * t * t) / 60616000
  );
}

/**
 * 月の平均遠地点（リリス）の黄経。
 * 平均近地点は「月の平均黄経 − 平均近点離角」で、その 180 度反対側が遠地点になる。
 */
export function meanLilith(time: Astronomy.AstroTime): number {
  const t = julianCenturies(time);
  const meanLongitude =
    218.3164477 +
    481267.88123421 * t -
    0.0015786 * t * t +
    (t * t * t) / 538841 -
    (t * t * t * t) / 65194000;
  const meanAnomaly =
    134.9633964 +
    477198.8675055 * t +
    0.0087414 * t * t +
    (t * t * t) / 69699 -
    (t * t * t * t) / 14712000;
  return norm360(meanLongitude - meanAnomaly + 180);
}

/**
 * その瞬間の実際の昇交点（真のノード）の黄経。
 *
 * 月の位置と速度から軌道面の法線を出し、黄道面との交線の向きを取る。
 * 平均交点のまわりを ±1.5 度ほど揺れる。
 */
export function trueNode(time: Astronomy.AstroTime): number {
  const state = Astronomy.RotateState(
    Astronomy.Rotation_EQJ_ECT(time),
    Astronomy.GeoMoonState(time)
  );
  // 軌道面の法線（角運動量の向き）
  const hx = state.y * state.vz - state.z * state.vy;
  const hy = state.z * state.vx - state.x * state.vz;
  // 昇交点の向きは (黄道の極) × (法線) なので、成分はこの 2 つだけで決まる
  return norm360(atan2(hx, -hy));
}

/** ある瞬間の黄経・黄緯。 */
export function eclipticPosition(id: BodyId, time: Astronomy.AstroTime, nodeKind: NodeKind): EclipticPosition {
  if (id === 'moon') {
    const m = Astronomy.EclipticGeoMoon(time);
    return { lon: norm360(m.lon), lat: m.lat };
  }
  if (id === 'northNode') {
    return { lon: nodeKind === 'mean' ? meanNode(time) : trueNode(time), lat: 0 };
  }
  if (id === 'lilith') {
    return { lon: meanLilith(time), lat: 0 };
  }

  const body = ASTRONOMY_BODY[id];
  if (!body) throw new Error(`未対応の天体です: ${id}`);
  // aberration を有効にして、光行差と光の到達時間を織り込んだ「見かけの位置」を取る
  const ecl = Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true));
  return { lon: norm360(ecl.elon), lat: ecl.elat };
}

export interface BodyState extends EclipticPosition {
  /** 1 日あたりの黄経の動き（度）。負なら逆行 */
  speed: number;
}

/**
 * 黄経・黄緯と、1 日あたりの動き。
 * 速度は前後 0.25 日の黄経の差から出す（軌道要素を解かずに済み、どの天体でも同じ扱いにできる）。
 */
export function bodyState(id: BodyId, time: Astronomy.AstroTime, nodeKind: NodeKind): BodyState {
  const here = eclipticPosition(id, time, nodeKind);
  const before = eclipticPosition(id, time.AddDays(-DT), nodeKind);
  const after = eclipticPosition(id, time.AddDays(DT), nodeKind);

  // 0 度をまたぐと 359 度ぶんの差が出てしまうので、−180〜180 に畳んでから割る
  const delta = ((after.lon - before.lon + 540) % 360) - 180;
  return { ...here, speed: delta / (2 * DT) };
}

/**
 * ある地点から見た太陽の高度（度）。昼の図か夜の図かの判定に使う。
 *
 * 大気差を入れると地平線ぎりぎりで判定が揺れるので、幾何学的な高度で見る。
 * astronomy-engine の型では refraction が string になっているが、
 * 補正なしを指す null を渡せる（実装とドキュメントはどちらも null を受ける）。
 */
export const NO_REFRACTION = null as unknown as string;

export function sunAltitude(
  time: Astronomy.AstroTime,
  latitude: number,
  longitude: number
): number {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  return Astronomy.Horizon(time, observer, eq.ra, eq.dec, NO_REFRACTION).altitude;
}
