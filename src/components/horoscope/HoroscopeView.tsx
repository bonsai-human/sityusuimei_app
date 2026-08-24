import { useMemo } from 'react';

import { buildHoroscope } from '../../core/horoscope/chart';
import { SIGN_LABEL } from '../../core/horoscope/constants';
import { formatSignPosition } from '../../core/horoscope/math';
import type { HoroscopeOptions } from '../../core/horoscope/types';
import type { BirthInput } from '../../core/types';
import { Note, Section } from '../ui';
import AspectTable from './AspectTable';
import BalanceBars from './BalanceBars';
import ChartWheel from './ChartWheel';
import HoroscopeSettings from './HoroscopeSettings';
import HouseTable from './HouseTable';
import PlacementTable from './PlacementTable';
import TransitPanel from './TransitPanel';
import { signClass } from './style';

/**
 * ホロスコープの画面。
 *
 * 出生図の算出はここで行う。App から遅延読み込みされるので、四柱推命だけを使う人は
 * 天体暦（astronomy-engine）を読み込まずに済む。
 */
export default function HoroscopeView({
  input,
  options,
  onOptionsChange,
}: {
  input: BirthInput;
  options: HoroscopeOptions;
  onOptionsChange: (patch: Partial<HoroscopeOptions>) => void;
}) {
  const { horoscope, error } = useMemo(() => {
    try {
      return { horoscope: buildHoroscope(input, options), error: null };
    } catch (e) {
      return { horoscope: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, options]);

  if (error || !horoscope) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          background: 'var(--fire-bg)',
          color: 'var(--fire-fg)',
          border: '1px solid var(--fire-line)',
        }}
      >
        出生図を組めませんでした: {error}
      </div>
    );
  }

  const sun = horoscope.placements.find((p) => p.id === 'sun')!;
  const moon = horoscope.placements.find((p) => p.id === 'moon')!;
  const asc = horoscope.angles?.asc;

  return (
    <div className="flex flex-col gap-4">
      <Section title={input.name.trim() || '名前なし'}>
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          {[
            { label: '太陽', pos: sun.position },
            { label: '月', pos: moon.position },
            ...(asc ? [{ label: 'ASC', pos: asc.position }] : []),
          ].map(({ label, pos }) => (
            <span key={label} className={`${signClass(pos.sign)} el-chip rounded px-2 py-1`}>
              <span className="text-xs">{label}</span>
              <span className="ml-1.5 text-sm font-semibold">{SIGN_LABEL[pos.sign]}</span>
              <span className="ml-1 text-xs tabular-nums">
                {pos.deg}°{String(pos.min).padStart(2, '0')}′
              </span>
            </span>
          ))}
        </div>

        <dl className="text-xs">
          <div className="flex gap-2 py-0.5">
            <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              時計の時刻
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              {horoscope.meta.standardDateTime}（{input.place.label}
              {input.dst ? '・サマータイム' : ''}）
            </dd>
          </div>
          <div className="flex gap-2 py-0.5">
            <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              世界時
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>{horoscope.meta.utc}</dd>
          </div>
          <div className="flex gap-2 py-0.5">
            <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              座標
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              東経 {input.place.longitude.toFixed(4)}°
              {input.place.latitude != null && ` / 北緯 ${input.place.latitude.toFixed(4)}°`}
            </dd>
          </div>
          {horoscope.meta.localSiderealTime != null && (
            <div className="flex gap-2 py-0.5">
              <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
                地方恒星時
              </dt>
              <dd style={{ color: 'var(--ink-muted)' }}>
                {(horoscope.meta.localSiderealTime / 15).toFixed(3)} 時
              </dd>
            </div>
          )}
          {asc && (
            <div className="flex gap-2 py-0.5">
              <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
                MC
              </dt>
              <dd style={{ color: 'var(--ink-muted)' }}>
                {formatSignPosition(horoscope.angles!.mc.position, SIGN_LABEL)}
              </dd>
            </div>
          )}
          {horoscope.meta.anglesPerMinute && (
            <div className="flex gap-2 py-0.5">
              <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
                時刻 1 分で
              </dt>
              <dd style={{ color: 'var(--ink-muted)' }}>
                ASC が {horoscope.meta.anglesPerMinute.asc.toFixed(2)}° / MC が{' '}
                {horoscope.meta.anglesPerMinute.mc.toFixed(2)}° 動く
                <span className="ml-1" style={{ color: 'var(--ink-faint)' }}>
                  （出生地の経度が 0.25° 違うのも、時刻が 1 分違うのと同じだけ効きます）
                </span>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-3">
          <ChartWheel horoscope={horoscope} />
        </div>

        {horoscope.meta.notes.map((note) => (
          <Note key={note}>{note}</Note>
        ))}
      </Section>

      <PlacementTable horoscope={horoscope} />
      {horoscope.houses && <HouseTable horoscope={horoscope} />}
      <AspectTable horoscope={horoscope} />
      <BalanceBars horoscope={horoscope} />
      <TransitPanel natal={horoscope} options={options} />
      <HoroscopeSettings options={options} onChange={onOptionsChange} />
    </div>
  );
}
