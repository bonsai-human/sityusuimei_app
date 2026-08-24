import {
  ANGLE_LABEL,
  BODY_LABEL,
  BODY_SYMBOL,
  SIGN_LABEL,
  SIGN_SYMBOL,
} from '../../core/horoscope/constants';
import { formatSignPosition, signPosition } from '../../core/horoscope/math';
import type { Horoscope } from '../../core/horoscope/types';
import { Section } from '../ui';
import { signClass } from './style';

/** 度数の表示。度と分まで。 */
function Degrees({ sign, deg, min }: { sign: number; deg: number; min: number }) {
  return (
    <span className={`${signClass(sign)} inline-flex items-baseline gap-1`}>
      <span className="el-text">{SIGN_SYMBOL[sign]}</span>
      <span className="tabular-nums">
        {deg}°{String(min).padStart(2, '0')}′
      </span>
      <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
        {SIGN_LABEL[sign]}
      </span>
    </span>
  );
}

export default function PlacementTable({ horoscope }: { horoscope: Horoscope }) {
  const { placements, angles } = horoscope;

  return (
    <Section
      title="天体の配置"
      subtitle="度数はトロピカル（春分点を牡羊座 0 度とする）。R は逆行"
    >
      <div className="scroll-x -mx-1 px-1">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr style={{ color: 'var(--ink-faint)' }}>
              <th className="py-1 pr-3 text-left text-xs font-normal">天体</th>
              <th className="py-1 pr-3 text-left text-xs font-normal">サイン・度数</th>
              <th className="py-1 pr-3 text-right text-xs font-normal">室</th>
              <th className="py-1 pr-3 text-right text-xs font-normal">日々の動き</th>
            </tr>
          </thead>
          <tbody>
            {placements.map((p) => (
              <tr key={p.id} className="border-t hairline">
                <td className="whitespace-nowrap py-1.5 pr-3">
                  <span className="mr-1.5 text-base">{BODY_SYMBOL[p.id]}</span>
                  {BODY_LABEL[p.id]}
                  {p.retrograde && (
                    <span className="ml-1 text-xs font-semibold" style={{ color: 'var(--fire-fg)' }}>
                      R
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3">
                  <Degrees {...p.position} />
                  {p.range && (
                    <span className="ml-2 text-[10px]" style={{ color: 'var(--ink-faint)' }}>
                      その日のうちに {formatSignPosition(signPosition(p.range.from), SIGN_LABEL)}〜
                      {formatSignPosition(signPosition(p.range.to), SIGN_LABEL)}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {p.house ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                </td>
                <td
                  className="py-1.5 pr-3 text-right tabular-nums text-xs"
                  style={{ color: p.speed < 0 ? 'var(--fire-fg)' : 'var(--ink-muted)' }}
                >
                  {p.speed >= 0 ? '+' : '−'}
                  {Math.abs(p.speed).toFixed(2)}°
                </td>
              </tr>
            ))}

            {angles &&
              (['asc', 'mc', 'vertex'] as const).map((id) => (
                <tr key={id} className="border-t hairline">
                  <td
                    className="whitespace-nowrap py-1.5 pr-3 text-xs"
                    style={{ color: 'var(--accent)' }}
                  >
                    {ANGLE_LABEL[id]}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <Degrees {...angles[id].position} />
                  </td>
                  <td className="py-1.5 pr-3" />
                  <td className="py-1.5 pr-3" />
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
