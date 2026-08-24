import { useMemo } from 'react';

import { buildHoroscope } from '../../core/horoscope/chart';
import { ASPECT_BY_KIND, POINT_LABEL, type BodyId } from '../../core/horoscope/constants';
import { formatOrb } from '../../core/horoscope/aspects';
import { SLOW_BODIES, transitsOn } from '../../core/horoscope/transit';
import type { Horoscope, HoroscopeOptions } from '../../core/horoscope/types';
import type { BirthInput } from '../../core/types';
import { toneChip } from './style';

/**
 * 出来事のあった日に、天体がどこへ掛かっていたか。
 *
 * 人生ログの各行に、四柱推命の大運・流年と並べて出す。
 * 同じ出来事を二つの体系から見るための場所なので、どちらかを当てにいく形にはしない。
 *
 * 動きの速い天体（月・太陽・水星・金星・火星）は数日で通り過ぎてしまい、
 * どの日にも何かしら当たってしまうので、ここでは木星から先だけを見る。
 */

/**
 * 出生図は行ごとに組み直すと無駄が多いので、直前のものを 1 つだけ覚えておく。
 * 人生ログでは同じ人の同じ設定で何行も並ぶため、これで足りる。
 */
let cached: { key: string; horoscope: Horoscope } | null = null;

function natalOf(input: BirthInput, options: HoroscopeOptions): Horoscope {
  const key = JSON.stringify([input, options]);
  if (cached?.key !== key) cached = { key, horoscope: buildHoroscope(input, options) };
  return cached.horoscope;
}

export default function EventTransits({
  input,
  options,
  date,
  limit = 4,
}: {
  input: BirthInput;
  options: HoroscopeOptions;
  /** 'YYYY-MM-DD' */
  date: string;
  limit?: number;
}) {
  const aspects = useMemo(() => {
    try {
      const natal = natalOf(input, options);
      return transitsOn(natal, date, options)
        .aspects.filter((a) => SLOW_BODIES.includes(a.a as BodyId))
        .slice(0, limit);
    } catch {
      // 天体暦の範囲外の日付など。人生ログ全体を落とすほどのことではない
      return [];
    }
  }, [input, options, date, limit]);

  if (aspects.length === 0) {
    return (
      <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
        木星から先の天体が掛かっているものはありません
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {aspects.map((a, i) => (
        <span
          key={`${a.a}-${a.b}-${i}`}
          className="rounded px-1.5 py-0.5 text-[11px]"
          style={toneChip(a.tone)}
          title={`${ASPECT_BY_KIND[a.kind].label}・オーブ ${formatOrb(a.orb)}${
            a.applying === null ? '' : a.applying ? '・接近' : '・分離'
          }`}
        >
          経{POINT_LABEL[a.a]} {ASPECT_BY_KIND[a.kind].symbol} 生{POINT_LABEL[a.b]}
          <span className="ml-1 opacity-70">{formatOrb(a.orb)}</span>
        </span>
      ))}
    </span>
  );
}
