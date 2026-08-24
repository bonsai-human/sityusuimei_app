import { useMemo, useState } from 'react';

import { buildHoroscope } from '../../core/horoscope/chart';
import {
  ASPECT_BY_KIND,
  BODY_LABEL,
  BODY_SYMBOL,
  HOUSE_NOTE,
  POINT_LABEL,
  SIGN_LABEL,
} from '../../core/horoscope/constants';
import { formatOrb } from '../../core/horoscope/aspects';
import { formatSignPosition } from '../../core/horoscope/math';
import {
  compareHoroscopes,
  nameOf,
  synastrySummary,
  type HouseOverlay,
} from '../../core/horoscope/synastry';
import type { Horoscope, HoroscopeOptions } from '../../core/horoscope/types';
import type { BirthInput } from '../../core/types';
import { Button, Note, Section } from '../ui';
import SynastryWheel from './SynastryWheel';
import { signClass, toneChip } from './style';

/**
 * 二人の出生図を重ねて読む（シナストリー）。
 *
 * 四柱推命の比較画面と同じで、点数は出さない。成立している角度と、
 * 相手の天体が自分のどの室に落ちるかという事実だけを並べる。
 */
export default function SynastryView({
  self,
  other,
  options,
}: {
  self: BirthInput;
  other: BirthInput;
  options: HoroscopeOptions;
}) {
  const [copied, setCopied] = useState(false);

  const built = useMemo(() => {
    try {
      const a = buildHoroscope(self, options);
      const b = buildHoroscope(other, options);
      return { synastry: compareHoroscopes(a, b, options), error: null };
    } catch (e) {
      return { synastry: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [self, other, options]);

  if (!built.synastry) {
    return (
      <Section title="二つの出生図">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          出生図を組めませんでした: {built.error}
        </p>
      </Section>
    );
  }

  const s = built.synastry;
  const selfName = nameOf(s.self, '自分');
  const otherName = nameOf(s.other, '相手');
  const summary = synastrySummary(s);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const Overlay = ({
    rows,
    owner,
    guest,
  }: {
    rows: HouseOverlay[];
    owner: string;
    guest: string;
  }) => (
    <div>
      <h4 className="mb-1.5 text-sm font-semibold">
        {guest}の天体が、{owner}のどの室に落ちるか
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((o) => (
          <span
            key={o.body}
            className="rounded px-1.5 py-0.5 text-xs"
            style={{
              background: 'var(--surface-sunken)',
              color: 'var(--ink-muted)',
              border: '1px solid var(--line)',
            }}
            title={HOUSE_NOTE[o.house - 1]}
          >
            <span className="mr-1">{BODY_SYMBOL[o.body]}</span>
            {BODY_LABEL[o.body]}
            <span className="ml-1 font-semibold">{o.house}室</span>
          </span>
        ))}
      </div>
    </div>
  );

  const Row = ({ h, label }: { h: Horoscope; label: string }) => {
    const sun = h.placements.find((p) => p.id === 'sun')!;
    const moon = h.placements.find((p) => p.id === 'moon')!;
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: 'var(--surface-sunken)', color: 'var(--ink-muted)' }}
        >
          {label}
        </span>
        <span className="text-sm font-semibold">{nameOf(h, label)}</span>
        {[
          { mark: '太陽', pos: sun.position },
          { mark: '月', pos: moon.position },
          ...(h.angles ? [{ mark: 'ASC', pos: h.angles.asc.position }] : []),
        ].map(({ mark, pos }) => (
          <span key={mark} className={`${signClass(pos.sign)} el-chip rounded px-1.5 py-0.5 text-xs`}>
            {mark} {formatSignPosition(pos, SIGN_LABEL)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="二つの出生図"
        subtitle="内側が表示中の人、外側が相手。ハウスは表示中の人のもの。中央の線が二人のあいだの角度"
      >
        <div className="flex flex-col gap-2">
          <Row h={s.self} label="表示中" />
          <Row h={s.other} label="相手" />
        </div>

        <div className="mt-3">
          <SynastryWheel synastry={s} />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs hairline">
          <span style={{ color: 'var(--wood-fg)' }}>調和 {s.soft.length} 件</span>
          <span style={{ color: 'var(--fire-fg)' }}>緊張 {s.hard.length} 件</span>
          <span style={{ color: 'var(--ink-faint)' }}>
            調和が多いことが良い関係を意味するわけではありません
          </span>
        </div>
      </Section>

      <Section title="読み所">
        <ul className="flex flex-col gap-2.5">
          {s.highlights.map((h) => (
            <li key={h.title}>
              <span className="text-sm font-semibold">{h.title}</span>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {h.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {(s.otherInSelfHouses || s.selfInOtherHouses) && (
        <Section
          title="天体の落ちる室"
          subtitle="相手の天体が自分のどの部屋に入るかは、角度と並んで読まれます"
        >
          <div className="flex flex-col gap-4">
            {s.otherInSelfHouses && (
              <Overlay rows={s.otherInSelfHouses} owner={selfName} guest={otherName} />
            )}
            {s.selfInOtherHouses && (
              <Overlay rows={s.selfInOtherHouses} owner={otherName} guest={selfName} />
            )}
          </div>
          {(!s.otherInSelfHouses || !s.selfInOtherHouses) && (
            <Note>
              出生時刻が分からない側はハウスを出せないので、その向きは表示していません。
            </Note>
          )}
        </Section>
      )}

      <Section title={`角度の一覧（${s.aspects.length}件）`}>
        {s.aspects.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            このオーブの範囲で成立しているものはありません。
          </p>
        ) : (
          <div className="scroll-x -mx-1 px-1">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr style={{ color: 'var(--ink-faint)' }}>
                  <th className="py-1 pr-3 text-left text-xs font-normal">{selfName}</th>
                  <th className="py-1 pr-3 text-left text-xs font-normal">角度</th>
                  <th className="py-1 pr-3 text-left text-xs font-normal">{otherName}</th>
                  <th className="py-1 text-right text-xs font-normal">オーブ</th>
                </tr>
              </thead>
              <tbody>
                {s.aspects.map((a, i) => (
                  <tr key={`${a.a}-${a.b}-${i}`} className="border-t hairline">
                    <td className="whitespace-nowrap py-1.5 pr-3">{POINT_LABEL[a.a]}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                        style={toneChip(a.tone)}
                      >
                        {ASPECT_BY_KIND[a.kind].symbol} {ASPECT_BY_KIND[a.kind].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-3">{POINT_LABEL[a.b]}</td>
                    <td className="py-1.5 text-right text-xs tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                      {formatOrb(a.orb)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="AI に渡す"
        subtitle="二人の関係の部分だけを書き出します。出生図そのものは「プロンプト」の画面から"
        actions={
          <Button variant="primary" onClick={copy}>
            {copied ? 'コピーしました' : 'コピー'}
          </Button>
        }
      >
        <textarea
          readOnly
          spellCheck={false}
          value={summary}
          className="field min-h-56 w-full resize-y font-mono text-xs leading-relaxed"
          style={{ background: 'var(--surface-sunken)' }}
        />
      </Section>
    </div>
  );
}
