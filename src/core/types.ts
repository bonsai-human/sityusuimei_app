import type { Element, Gan, TenGod, TwelveStage, Zhi } from './constants';
import type { Relation, PillarSlot } from './relations';
import type { TimeCorrection } from './solarTime';

export type Gender = 'male' | 'female';

export type CalendarKind = 'solar' | 'lunar' | 'lunar-leap';

/** 出生時刻の指定方法。時分・時支のみ・不明の 3 通り。 */
export type TimeInput =
  | { kind: 'hm'; hour: number; minute: number }
  | { kind: 'zhi'; zhi: Zhi }
  | { kind: 'unknown' };

export interface BirthPlace {
  label: string;
  /** 東経を正とする経度（度） */
  longitude: number;
  /** 標準時のUTCオフセット（分）。日本なら 540 */
  tzOffsetMinutes: number;
}

export interface ChartOptions {
  /** 経度差による真太陽時補正を行うか */
  trueSolarTime: boolean;
  /** 均時差も加えるか */
  equationOfTime: boolean;
  /**
   * 大運の起算流派。
   * 1: 節入りまでを日と時辰で数える（3日＝1年、1時辰＝5日）
   * 2: 分単位で厳密に換算する（4320分＝1年）
   */
  sect: 1 | 2;
  /** 夜子時説を採る（23時台を当日の日柱のままにする）か。false なら早子時説 */
  lateZi: boolean;
}

export interface BirthInput {
  name: string;
  gender: Gender;
  calendar: CalendarKind;
  year: number;
  month: number;
  day: number;
  time: TimeInput;
  place: BirthPlace;
  /** サマータイム適用中に生まれたか（時計が1時間進んでいた） */
  dst: boolean;
  options: ChartOptions;
  memo?: string;
}

export interface HiddenStemView {
  gan: Gan;
  element: Element;
  role: '余気' | '中気' | '本気';
  tenGod: TenGod;
  /** 月柱でのみ意味を持つ。この蔵干が月令（司令）かどうか */
  isMonthRuler?: boolean;
}

export interface Pillar {
  slot: PillarSlot;
  gan: Gan;
  zhi: Zhi;
  ganElement: Element;
  zhiElement: Element;
  ganYang: boolean;
  zhiYang: boolean;
  /** 天干の十神。日柱は '日元' */
  ganTenGod: TenGod;
  /** 地支の十神（本気から算出） */
  zhiTenGod: TenGod;
  hidden: HiddenStemView[];
  /** 十二運星（日干から見たこの地支） */
  stage: TwelveStage;
  naYin: string;
  /** この柱の干支が属する旬の空亡 2 支 */
  xunKong: [Zhi, Zhi];
  animal: string;
}

export interface ElementCount {
  element: Element;
  /** 天干4＋地支4 の単純カウント */
  simple: number;
  /** 蔵干を日数比で重み付けしたカウント */
  weighted: number;
}

export interface StrengthAssessment {
  /** 日干を助ける勢力（比劫＋印）の割合 0..1 */
  supportRatio: number;
  verdict: '極身強' | '身強' | '中和' | '身弱' | '極身弱';
  /** 日干が月令を得ているか */
  hasMonthSupport: boolean;
  /** 日干と同じ五行が地支に根を張っているか */
  hasRoot: boolean;
  notes: string[];
}

export interface LiuNianEntry {
  year: number;
  /** その年の満年齢（誕生日到来後） */
  age: number;
  gan: Gan;
  zhi: Zhi;
  ganTenGod: TenGod;
  zhiTenGod: TenGod;
  stage: TwelveStage;
}

export interface DaYunEntry {
  index: number;
  gan: Gan;
  zhi: Zhi;
  ganTenGod: TenGod;
  zhiTenGod: TenGod;
  stage: TwelveStage;
  startYear: number;
  endYear: number;
  /** 大運が切り替わる満年齢（小数第1位まで） */
  startAge: number;
  liuNian: LiuNianEntry[];
}

export interface LuckCycle {
  /** 順行か逆行か */
  forward: boolean;
  /** 起運の年齢（小数第1位まで）。参考アプリの「大運数」に相当 */
  startAge: number;
  /** 起運日（現地標準時） */
  startDate: string;
  entries: DaYunEntry[];
  /** 起運前の期間の説明 */
  beforeFirstNote: string;
}

export interface JieQiInfo {
  name: string;
  /** 現地標準時での日時 */
  localDateTime: string;
}

export interface ChartMeta {
  /** 入力された暦での日付表示 */
  solarDate: string;
  lunarDate: string;
  /** 補正後の真太陽時（時柱の根拠になった時刻）。時刻不明なら null */
  trueSolarDateTime: string | null;
  /** 時計の時刻（サマータイム調整後の現地標準時）。時刻不明なら null */
  standardDateTime: string | null;
  correction: TimeCorrection | null;
  /** 直前の節と次の節 */
  prevJie: JieQiInfo;
  nextJie: JieQiInfo;
  /** 月令（月支の蔵干のうち、生まれた日に司令していたもの） */
  monthRuler: Gan;
  /** 節入りからの経過日数 */
  daysFromJie: number;
  /** 胎元（月柱の干支を一つずつ進めた干支） */
  taiYuan: string;
  /** 命宮（月支と時支から求める。時刻不明なら null） */
  mingGong: string | null;
}

export interface Chart {
  input: BirthInput;
  /** 年・月・日・時の順。時刻不明の場合は 3 要素 */
  pillars: Pillar[];
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null;
  dayMaster: Gan;
  dayMasterElement: Element;
  elements: ElementCount[];
  strength: StrengthAssessment;
  relations: Relation[];
  luck: LuckCycle;
  meta: ChartMeta;
  /** 命式を組んだ時点での満年齢と数え年 */
  age: { actual: number; traditional: number; asOf: string };
}
