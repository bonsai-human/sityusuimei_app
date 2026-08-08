/**
 * 真太陽時（地方視太陽時）への補正。
 *
 * 参考にした市販アプリは「日本 (23分)」のように補正値を 1 つ出すだけで内訳が見えないため、
 * ここでは経度差による補正と均時差を分けて算出し、UI でも内訳を表示できるようにしている。
 *
 * - 経度補正: 標準時子午線から東に 1 度ずれるごとに、太陽は 4 分早く南中する
 * - 均時差  : 地球の公転軌道の離心率と地軸の傾きによる、平均太陽時と視太陽時のずれ
 *             （NOAA の近似式。年間を通して概ね ±20 秒の精度）
 */

export interface TimeCorrection {
  /** 経度差による補正（分） */
  longitudeMinutes: number;
  /** 均時差（分） */
  equationOfTimeMinutes: number;
  /** 実際に適用された合計（分）。オプションで無効化された項は 0 として扱う */
  totalMinutes: number;
}

/** 1 月 1 日を 1 とした通日。 */
export function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const target = Date.UTC(year, month - 1, day);
  return Math.round((target - start) / 86400000) + 1;
}

/**
 * 均時差（分）。正のとき視太陽時が平均太陽時より進んでいる。
 * NOAA General Solar Position Calculations の近似式。
 */
export function equationOfTime(year: number, month: number, day: number, hour = 12): number {
  const n = dayOfYear(year, month, day);
  const gamma = ((2 * Math.PI) / 365) * (n - 1 + (hour - 12) / 24);
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  );
}

/** 標準時子午線の経度（度）。タイムゾーンのオフセット（分）から求める。 */
export function meridianOf(tzOffsetMinutes: number): number {
  return (tzOffsetMinutes / 60) * 15;
}

export interface CorrectionOptions {
  /** 経度差による補正を行うか */
  longitude: boolean;
  /** 均時差を加えるか（longitude が false のときは無視される） */
  equationOfTime: boolean;
}

/**
 * 補正量を算出する。longitude が false なら合計は 0（＝時計の時刻をそのまま使う）。
 */
export function computeCorrection(
  params: {
    year: number;
    month: number;
    day: number;
    hour: number;
    longitude: number;
    tzOffsetMinutes: number;
  },
  options: CorrectionOptions
): TimeCorrection {
  const longitudeMinutes = (params.longitude - meridianOf(params.tzOffsetMinutes)) * 4;
  const eot = equationOfTime(params.year, params.month, params.day, params.hour);

  let total = 0;
  if (options.longitude) {
    total += longitudeMinutes;
    if (options.equationOfTime) total += eot;
  }

  return {
    longitudeMinutes,
    equationOfTimeMinutes: eot,
    totalMinutes: total,
  };
}

/** 「+12分」「−7分」のような表示用文字列。 */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const m = Math.floor(abs);
  const s = Math.round((abs - m) * 60);
  return s === 0 ? `${sign}${m}分` : `${sign}${m}分${s}秒`;
}
