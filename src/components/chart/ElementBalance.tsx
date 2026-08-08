import { ELEMENT_LABEL } from '../../core/constants';
import type { Chart } from '../../core/types';
import { Note, Section } from '../ui';
import { elementClass } from '../ui';

/**
 * 五行のバランス。単純カウント（市販アプリと同じ数え方）と、蔵干を日数比で
 * 配分した加重カウントを重ねて描き、「見かけの数」と「実勢」のずれが分かるようにする。
 */
export default function ElementBalance({ chart }: { chart: Chart }) {
  const max = Math.max(
    ...chart.elements.map((e) => Math.max(e.simple, e.weighted)),
    3
  );

  return (
    <Section
      title="五行のバランス"
      subtitle="細い帯は天干4＋地支4の単純カウント、太い帯は地支を蔵干の日数比で割り振った加重カウント"
    >
      <div className="flex flex-col gap-2.5">
        {chart.elements.map((e) => {
          const isDayMaster = e.element === chart.dayMasterElement;
          return (
            <div key={e.element} className={`${elementClass(e.element)} flex items-center gap-3`}>
              <div className="flex w-14 shrink-0 items-baseline gap-1">
                <span className="el-text font-kanji text-lg leading-none">
                  {ELEMENT_LABEL[e.element]}
                </span>
                {isDayMaster && (
                  <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
                    日干
                  </span>
                )}
              </div>

              <div className="relative h-6 flex-1 overflow-hidden rounded" style={{ background: 'var(--surface-sunken)' }}>
                <div
                  className="el-fill absolute inset-y-0 left-0 rounded opacity-30"
                  style={{ width: `${(e.weighted / max) * 100}%` }}
                />
                <div
                  className="el-fill absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                  style={{ width: `${(e.simple / max) * 100}%` }}
                />
              </div>

              <div className="w-20 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                <span className="font-semibold">{e.simple}</span>
                <span style={{ color: 'var(--ink-faint)' }}> / {e.weighted.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-3 hairline">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-semibold">{chart.strength.verdict}</span>
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            日干を助ける勢力 {(chart.strength.supportRatio * 100).toFixed(0)}%
          </span>
          <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            {chart.strength.hasMonthSupport ? '得令' : '失令'}・
            {chart.strength.hasRoot ? '通根' : '無根'}
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1">
          {chart.strength.notes.map((n) => (
            <li key={n} className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              ・{n}
            </li>
          ))}
        </ul>
        <Note>
          強弱の重みの置き方は流派によって差があります。ここでの判定は根拠を添えた機械的な目安です。
        </Note>
      </div>
    </Section>
  );
}
