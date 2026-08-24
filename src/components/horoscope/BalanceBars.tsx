import {
  BODY_LABEL,
  ELEMENT4_LABEL,
  ELEMENT4_NOTE,
  QUALITY_LABEL,
  QUALITY_NOTE,
  SIGN_LABEL,
  type Element4,
} from '../../core/horoscope/constants';
import type { Horoscope, Tally } from '../../core/horoscope/types';
import { Note, Section } from '../ui';
import { ELEMENT4_CLASS } from './style';

function Bars<T extends string>({
  tallies,
  label,
  note,
  classOf,
}: {
  tallies: Tally<T>[];
  label: Record<T, string>;
  note: Record<T, string>;
  classOf?: (key: T) => string;
}) {
  const max = Math.max(...tallies.map((t) => Math.max(t.count, t.weighted)), 4);

  return (
    <div className="flex flex-col gap-2">
      {tallies.map((t) => (
        <div key={t.key} className={`${classOf?.(t.key) ?? ''} flex items-center gap-3`}>
          <span className="w-8 shrink-0 text-sm">
            <span className={classOf ? 'el-text' : ''}>{label[t.key]}</span>
          </span>
          <div
            className="relative h-5 flex-1 overflow-hidden rounded"
            style={{ background: 'var(--surface-sunken)' }}
          >
            <div
              className={`absolute inset-y-0 left-0 rounded opacity-30 ${classOf ? 'el-fill' : ''}`}
              style={{
                width: `${(t.weighted / max) * 100}%`,
                background: classOf ? undefined : 'var(--accent)',
              }}
            />
            <div
              className={`absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full ${
                classOf ? 'el-fill' : ''
              }`}
              style={{
                width: `${(t.count / max) * 100}%`,
                background: classOf ? undefined : 'var(--accent)',
              }}
            />
          </div>
          <span
            className="w-10 shrink-0 text-right text-xs tabular-nums"
            style={{ color: 'var(--ink-muted)' }}
          >
            {t.count}
            <span style={{ color: 'var(--ink-faint)' }}> / {t.weighted}</span>
          </span>
          <span
            className="hidden w-40 shrink-0 text-[11px] sm:block"
            style={{ color: 'var(--ink-faint)' }}
          >
            {note[t.key]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BalanceBars({ horoscope }: { horoscope: Horoscope }) {
  const { elements, qualities, stelliums, hemispheres, dayChart, ascRuler } = horoscope;

  return (
    <Section
      title="全体の傾き"
      subtitle="細い帯は 10 天体の単純カウント、太い帯は太陽・月・アセンダントを二重に数えたもの"
    >
      <Bars
        tallies={elements}
        label={ELEMENT4_LABEL}
        note={ELEMENT4_NOTE}
        classOf={(key: Element4) => ELEMENT4_CLASS[key]}
      />
      <div className="mt-4">
        <Bars tallies={qualities} label={QUALITY_LABEL} note={QUALITY_NOTE} />
      </div>

      <dl className="mt-4 flex flex-col gap-1 border-t pt-3 text-xs hairline">
        {dayChart !== null && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              昼夜
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              {dayChart ? '昼の図（太陽が地平線の上）' : '夜の図（太陽が地平線の下）'}
            </dd>
          </div>
        )}
        {ascRuler && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              ASC の支配星
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              {BODY_LABEL[ascRuler.body]} — {SIGN_LABEL[ascRuler.placement.position.sign]}{' '}
              {ascRuler.placement.position.deg}°
              {ascRuler.placement.house != null && `・${ascRuler.placement.house}室`}
            </dd>
          </div>
        )}
        {hemispheres && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              半球
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              東 {hemispheres.east} / 西 {hemispheres.west}・地平線の上{' '}
              {hemispheres.south} / 下 {hemispheres.north}
            </dd>
          </div>
        )}
        {stelliums.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0" style={{ color: 'var(--ink-faint)' }}>
              集まり
            </dt>
            <dd style={{ color: 'var(--ink-muted)' }}>
              {stelliums.map((s) => (
                <span key={`${s.kind}-${s.index}`} className="mr-3 inline-block">
                  {s.kind === 'sign' ? SIGN_LABEL[s.index] : `${s.index}室`}に{' '}
                  {s.bodies.map((b) => BODY_LABEL[b]).join('・')}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <Note>
        数のうえで多い少ないは、そのまま性質の強弱ではありません。
        少ないものほど強く意識される、という読み方もします。
      </Note>
    </Section>
  );
}
