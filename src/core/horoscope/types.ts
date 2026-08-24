import type { BirthInput } from '../types';
import { DEFAULT_LUMINARY_BONUS, DEFAULT_ORBS } from './constants';
import type {
  AngleId,
  AspectKind,
  AspectTone,
  BodyId,
  Element4,
  PointId,
  Quality,
  SignIndex,
} from './constants';

/** ハウスの分割方式。 */
export type HouseSystem = 'placidus' | 'whole' | 'equal' | 'solar';

export const HOUSE_SYSTEM_LABEL: Record<HouseSystem, string> = {
  placidus: 'プラシーダス',
  whole: 'ホールサイン',
  equal: 'イコール',
  solar: 'ソーラーサイン',
};

/** ドラゴンヘッドの取り方。平均か、その瞬間の実際の交点か。 */
export type NodeKind = 'mean' | 'true';

export interface HoroscopeOptions {
  houseSystem: HouseSystem;
  nodeKind: NodeKind;
  /** マイナーアスペクト（30/45/135/150 度）も拾うか */
  minorAspects: boolean;
  /** サインの支配星を現代式（天王星・海王星・冥王星を使う）で取るか */
  modernRulers: boolean;
  /** アスペクトのオーブ（度）。ちょうどの角度からこれだけ離れても成立と見る */
  orbs: Record<AspectKind, number>;
  /** 太陽・月が絡むアスペクトで、オーブをこれだけ広げる */
  luminaryOrbBonus: number;
}

/**
 * 設定の既定値。
 *
 * 天体暦（astronomy-engine）を引かない場所に置いてある。設定だけを読む側が
 * 計算層ごと読み込まずに済み、ホロスコープの画面を遅延読み込みできる。
 */
export function defaultHoroscopeOptions(): HoroscopeOptions {
  return {
    houseSystem: 'placidus',
    nodeKind: 'mean',
    minorAspects: false,
    modernRulers: true,
    orbs: { ...DEFAULT_ORBS },
    luminaryOrbBonus: DEFAULT_LUMINARY_BONUS,
  };
}

/** 黄経を、サインと度分に割った表示用の形。 */
export interface SignPosition {
  sign: SignIndex;
  /** サインの中での度数（0 以上 30 未満） */
  degree: number;
  /** 度・分に丸めたもの */
  deg: number;
  min: number;
}

export interface Placement {
  id: BodyId;
  /** 黄経（0 以上 360 未満、トロピカル） */
  lon: number;
  /** 黄緯 */
  lat: number;
  /** 1 日あたりの黄経の動き（度）。負なら逆行 */
  speed: number;
  retrograde: boolean;
  position: SignPosition;
  /** 1 から 12。ハウスを出せないときは null */
  house: number | null;
  /**
   * 出生時刻が分からないときの、その日のうちに取りうる黄経の幅。
   * 月のように 1 日で大きく動くものだけ埋まる。
   */
  range: { from: number; to: number } | null;
}

export interface AnglePlacement {
  id: AngleId;
  lon: number;
  position: SignPosition;
}

export interface Houses {
  /** 実際に使った方式 */
  system: HouseSystem;
  /** 求められた方式。フォールバックしたときだけ system と食い違う */
  requested: HouseSystem;
  /** フォールバックしたときの断り書き */
  note: string | null;
  /** 1 室から 12 室のカスプの黄経 */
  cusps: number[];
}

export interface Aspect {
  a: PointId;
  b: PointId;
  kind: AspectKind;
  tone: AspectTone;
  /** ちょうどの角度 */
  exact: number;
  /** 実際の離角 */
  separation: number;
  /** ちょうどからのずれ（度、常に 0 以上） */
  orb: number;
  /**
   * 接近中なら true、分離中なら false。
   * 感受点（動きが速すぎて意味を持たない）が絡むときは null。
   */
  applying: boolean | null;
}

export interface Tally<T extends string> {
  key: T;
  /** 10 天体のうち、いくつがそこに入っているか */
  count: number;
  /** 太陽・月・アセンダントを二重に数えた重みつきの数 */
  weighted: number;
}

/** 3 天体以上が固まっているところ。 */
export interface Stellium {
  kind: 'sign' | 'house';
  /** kind が 'sign' ならサインの番号、'house' なら 1〜12 */
  index: number;
  bodies: BodyId[];
}

export interface HoroscopeMeta {
  /** 世界時（UT）に直した出生の瞬間 */
  utc: string;
  /** 時計の時刻（サマータイム調整後の現地標準時） */
  standardDateTime: string;
  /** 出生時刻の確からしさ */
  timePrecision: 'exact' | 'zhi' | 'unknown';
  /** 真の黄道傾斜角（度） */
  obliquity: number;
  /** 地方恒星時（度）。時刻不明なら null */
  localSiderealTime: number | null;
  /**
   * 出生時刻が 1 分ずれたときに、アセンダントと MC が動く度数。
   *
   * サインと緯度によって変わる（この図ではいくら動くのか）ので、実際に 1 分先の値との
   * 差から出している。他の資料と数値が合わないときに、時刻・経度どちらの差なのかを
   * 見積もる手がかりになる。
   */
  anglesPerMinute: { asc: number; mc: number } | null;
  /** 読むときに断っておくこと */
  notes: string[];
}

export interface Horoscope {
  input: BirthInput;
  options: HoroscopeOptions;
  placements: Placement[];
  /** 出生時刻が分からないときは null */
  angles: Record<AngleId, AnglePlacement> | null;
  houses: Houses | null;
  aspects: Aspect[];
  elements: Tally<Element4>[];
  qualities: Tally<Quality>[];
  /** 太陽が地平線の上にあるか（昼の図か） */
  dayChart: boolean | null;
  /** アセンダントのサインの支配星が、どこに居るか */
  ascRuler: { body: BodyId; placement: Placement } | null;
  stelliums: Stellium[];
  /** 東（アセンダント側）・西・南（MC 側）・北 に何天体あるか */
  hemispheres: { east: number; west: number; south: number; north: number } | null;
  meta: HoroscopeMeta;
}
