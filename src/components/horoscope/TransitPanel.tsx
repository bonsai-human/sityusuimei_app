import { useMemo, useState } from 'react';

import {
  ASPECT_BY_KIND,
  BODY_LABEL,
  BODY_SYMBOL,
  POINT_LABEL,
  SIGN_LABEL,
} from '../../core/horoscope/constants';
import { formatOrb } from '../../core/horoscope/aspects';
import { formatSignPosition } from '../../core/horoscope/math';
import {
  defaultTransitOptions,
  progressedOn,
  solarReturnOf,
  transitsOn,
} from '../../core/horoscope/transit';
import type { Horoscope, HoroscopeOptions } from '../../core/horoscope/types';
import { todayString } from '../../core/lifelog';
import { Field, Note, Section, Toggle } from '../ui';
import { signClass, toneChip } from './style';

/**
 * ある日にめぐっているもの。四柱推命の大運・流年に当たる。
 *
 * 出せるのは「その日に何が成立しているか」までで、そこから何が起きるとは言わない。
 * トランジットのオーブは出生図の中どうしより狭く取ってある（広く取ると
 * 常に何かが当たっている状態になり、時期を見る役に立たなくなるため）。
 */
export default function TransitPanel({
  natal,
  options,
}: {
  natal: Horoscope;
  options: HoroscopeOptions;
}) {
  const [date, setDate] = useState(todayString());
  const [includeMoon, setIncludeMoon] = useState(false);

  const result = useMemo(() => {
    try {
      const transitOptions = { ...defaultTransitOptions(), includeMoon };
      const transits = transitsOn(natal, date, options, transitOptions);
      const progressed = progressedOn(natal, date, options);
      const year = Number(date.slice(0, 4));
      const solarReturn = solarReturnOf(natal, year, options);
      return { transits, progressed, solarReturn, error: null };
    } catch (e) {
      return {
        transits: null,
        progressed: null,
        solarReturn: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [natal, date, options, includeMoon]);

  return (
    <Section
      title="めぐっているもの"
      subtitle="指定した日の天体が、出生図のどこに掛かっているか"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="日付" hint="天体の位置はその日の正午（現地）で見ています">
          <input
            className="field"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayString())}
          />
        </Field>
        <div className="flex items-end">
          <Toggle
            checked={includeMoon}
            onChange={setIncludeMoon}
            label="月も見る"
            hint="月は1日で13度あまり動くので、日付だけの指定では当たり方が時刻次第になります"
          />
        </div>
      </div>

      {result.error && (
        <Note>その日のめぐりを出せませんでした: {result.error}</Note>
      )}

      {result.transits && (
        <>
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold">その日の天体</h4>
            <div className="flex flex-wrap gap-1.5">
              {result.transits.placements.map((p) => {
                const pos = p.position;
                return (
                  <span
                    key={p.id}
                    className={`${signClass(pos.sign)} el-chip rounded px-2 py-1 text-xs`}
                    title={`${BODY_LABEL[p.id]} ${formatSignPosition(pos, SIGN_LABEL)}`}
                  >
                    <span className="mr-1">{BODY_SYMBOL[p.id]}</span>
                    {formatSignPosition(pos, SIGN_LABEL)}
                    {p.house != null && (
                      <span className="ml-1 opacity-70">{p.house}室</span>
                    )}
                    {p.retrograde && <span className="ml-1">R</span>}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold">
              出生図に掛かっているもの
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--ink-faint)' }}>
                経＝その日の天体／生＝出生図
              </span>
            </h4>
            {result.transits.aspects.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                このオーブの範囲で掛かっているものはありません。
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {result.transits.aspects.map((a, i) => {
                  const def = ASPECT_BY_KIND[a.kind];
                  return (
                    <li key={`${a.a}-${a.b}-${i}`} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <span>
                        <span style={{ color: 'var(--ink-faint)' }}>経</span>
                        {POINT_LABEL[a.a]}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-xs"
                        style={toneChip(a.tone)}
                      >
                        {def.symbol} {def.label}
                      </span>
                      <span>
                        <span style={{ color: 'var(--ink-faint)' }}>生</span>
                        {POINT_LABEL[a.b]}
                      </span>
                      <span className="text-xs tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                        {formatOrb(a.orb)}
                      </span>
                      {a.applying !== null && (
                        <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                          {a.applying ? '接近' : '分離'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {result.progressed && result.solarReturn && (
        <dl className="mt-4 border-t pt-3 text-xs hairline">
          <div className="flex gap-2 py-0.5">
            <dt className="w-28 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              二次進行
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              {result.progressed.progressedDate} の空として読む（生後1日を1年に読み替え・
              {result.progressed.years.toFixed(1)}年ぶん）
              <span className="ml-2">
                進行の太陽{' '}
                {formatSignPosition(
                  result.progressed.horoscope.placements.find((p) => p.id === 'sun')!.position,
                  SIGN_LABEL
                )}
                ／進行の月{' '}
                {formatSignPosition(
                  result.progressed.horoscope.placements.find((p) => p.id === 'moon')!.position,
                  SIGN_LABEL
                )}
              </span>
            </dd>
          </div>
          <div className="flex gap-2 py-0.5">
            <dt className="w-28 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              ソーラーリターン
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              {result.solarReturn.moment}（太陽が出生時と同じ黄経に戻る瞬間）
              {result.solarReturn.horoscope.angles && (
                <span className="ml-2">
                  そのときの ASC{' '}
                  {formatSignPosition(
                    result.solarReturn.horoscope.angles.asc.position,
                    SIGN_LABEL
                  )}
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}

      {result.transits?.notes.map((n) => <Note key={n}>{n}</Note>)}

      <Note>
        ソーラーリターンは出生地で組んでいます（いま住んでいる土地で組む流派もあります）。
        めぐりは、起きたことと並べて読み方を確かめるためのものです。
        これから起きることを言い当てるものとしては扱わないでください。
      </Note>
    </Section>
  );
}
