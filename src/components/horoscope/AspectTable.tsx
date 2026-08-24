import {
  ASPECT_BY_KIND,
  BODY_SYMBOL,
  POINT_LABEL,
  type PointId,
} from '../../core/horoscope/constants';
import { formatOrb } from '../../core/horoscope/aspects';
import type { Aspect, Horoscope } from '../../core/horoscope/types';
import { Note, Section } from '../ui';
import { toneChip } from './style';

function pointMark(id: PointId): string {
  return id in BODY_SYMBOL ? BODY_SYMBOL[id as keyof typeof BODY_SYMBOL] : '';
}

function Row({ aspect }: { aspect: Aspect }) {
  const def = ASPECT_BY_KIND[aspect.kind];
  return (
    <tr className="border-t hairline">
      <td className="whitespace-nowrap py-1.5 pr-3">
        <span className="mr-1 text-base">{pointMark(aspect.a)}</span>
        {POINT_LABEL[aspect.a]}
      </td>
      <td className="whitespace-nowrap py-1.5 pr-3">
        <span
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
          style={toneChip(aspect.tone)}
        >
          <span>{def.symbol}</span>
          {def.label}
        </span>
      </td>
      <td className="whitespace-nowrap py-1.5 pr-3">
        <span className="mr-1 text-base">{pointMark(aspect.b)}</span>
        {POINT_LABEL[aspect.b]}
      </td>
      <td className="py-1.5 pr-3 text-right tabular-nums text-xs" style={{ color: 'var(--ink-muted)' }}>
        {formatOrb(aspect.orb)}
      </td>
      <td className="whitespace-nowrap py-1.5 text-right text-xs" style={{ color: 'var(--ink-faint)' }}>
        {aspect.applying === null ? '' : aspect.applying ? '接近' : '分離'}
      </td>
    </tr>
  );
}

export default function AspectTable({ horoscope }: { horoscope: Horoscope }) {
  const { aspects } = horoscope;

  return (
    <Section
      title="アスペクト"
      subtitle="ちょうどの角度に近い順。オーブはちょうどからのずれ"
    >
      {aspects.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          このオーブの範囲で成立しているアスペクトはありません。
        </p>
      ) : (
        <div className="scroll-x -mx-1 px-1">
          <table className="w-full min-w-max text-sm">
            <tbody>
              {aspects.map((a, i) => (
                <Row key={`${a.a}-${a.b}-${i}`} aspect={a} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Note>
        緑は調和、赤は緊張とされる角度ですが、良し悪しではなく効き方の向きです。
        「接近」はこれからちょうどに近づく途中、「分離」は通り過ぎたあとを指します
        （感受点は動きが速すぎるので、この区別を出していません）。
      </Note>
    </Section>
  );
}
