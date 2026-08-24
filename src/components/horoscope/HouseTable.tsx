import {
  BODY_LABEL,
  BODY_SYMBOL,
  HOUSE_NOTE,
  SIGN_LABEL,
  SIGN_SYMBOL,
} from '../../core/horoscope/constants';
import { signPosition } from '../../core/horoscope/math';
import { HOUSE_SYSTEM_LABEL, type Horoscope } from '../../core/horoscope/types';
import { Note, Section } from '../ui';
import { signClass } from './style';

export default function HouseTable({ horoscope }: { horoscope: Horoscope }) {
  const { houses, placements } = horoscope;
  if (!houses) return null;

  return (
    <Section
      title="ハウス"
      subtitle={`${HOUSE_SYSTEM_LABEL[houses.system]}。カスプ（各室の始まり）の度数`}
    >
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {houses.cusps.map((cusp, i) => {
          const pos = signPosition(cusp);
          const inside = placements.filter((p) => p.house === i + 1);
          return (
            <div key={i} className="flex items-baseline gap-2 border-t py-1 text-sm hairline">
              <span className="w-8 shrink-0 tabular-nums" style={{ color: 'var(--ink-faint)' }}>
                {i + 1}室
              </span>
              <span className={`${signClass(pos.sign)} w-28 shrink-0`}>
                <span className="el-text mr-1">{SIGN_SYMBOL[pos.sign]}</span>
                <span className="tabular-nums text-xs">
                  {pos.deg}°{String(pos.min).padStart(2, '0')}′
                </span>
                <span className="ml-1 text-[10px]" style={{ color: 'var(--ink-faint)' }}>
                  {SIGN_LABEL[pos.sign]}
                </span>
              </span>
              <span className="flex-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                {inside.length > 0 ? (
                  inside.map((p) => (
                    <span key={p.id} className="mr-1 text-base" title={BODY_LABEL[p.id]}>
                      {BODY_SYMBOL[p.id]}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--ink-faint)' }}>{HOUSE_NOTE[i]}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {houses.note && <Note>{houses.note}</Note>}
    </Section>
  );
}
