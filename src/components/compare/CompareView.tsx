import { useMemo, useState } from 'react';

import { compareCharts, comparisonSummary } from '../../core/compare';
import { ELEMENT_LABEL } from '../../core/constants';
import { SLOT_LABEL } from '../../core/relations';
import type { Chart, Pillar } from '../../core/types';
import { Button, Note, Section, elementClass } from '../ui';
import RelationLines from './RelationLines';

/** 比較のときは 1 柱を小さく組む。天干・地支と十神だけに絞って縦に並べる。 */
function MiniPillar({ pillar, isDay }: { pillar: Pillar; isDay: boolean }) {
  return (
    <div
      className="flex flex-col items-center rounded-lg px-1 py-1.5"
      style={{
        border: isDay ? '2px solid var(--accent)' : '1px solid var(--line)',
        background: 'var(--surface-raised)',
      }}
    >
      <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
        {SLOT_LABEL[pillar.slot].charAt(0)}
      </span>
      <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>
        {pillar.ganTenGod}
      </span>
      <span className={`${elementClass(pillar.ganElement)} el-chip font-kanji mt-0.5 w-full rounded py-1 text-center text-2xl leading-none`}>
        {pillar.gan}
      </span>
      <span className={`${elementClass(pillar.zhiElement)} el-chip font-kanji mt-0.5 w-full rounded py-1 text-center text-2xl leading-none`}>
        {pillar.zhi}
      </span>
      <span className="mt-0.5 text-[10px]" style={{ color: 'var(--ink-muted)' }}>
        {pillar.zhiTenGod}
      </span>
    </div>
  );
}

function ChartRow({ chart, label }: { chart: Chart; label: string }) {
  // 万年暦と同じ 時・日・月・年 の並び
  const pillars = [...chart.pillars].reverse();
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: 'var(--surface-sunken)', color: 'var(--ink-muted)' }}
        >
          {label}
        </span>
        <span className="text-sm font-semibold">
          {chart.input.name.trim() || '名前なし'}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          {chart.input.gender === 'male' ? '男性' : '女性'}・{chart.meta.solarDate}・日干{' '}
          {chart.dayMaster}（{ELEMENT_LABEL[chart.dayMasterElement]}）
        </span>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${pillars.length}, minmax(0, 1fr))` }}
      >
        {pillars.map((p) => (
          <MiniPillar key={p.slot} pillar={p} isDay={p.slot === 'day'} />
        ))}
      </div>
    </div>
  );
}

export default function CompareView({
  self,
  other,
  onClearOther,
}: {
  self: Chart;
  other: Chart | null;
  onClearOther: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const comparison = useMemo(
    () => (other ? compareCharts(self, other) : null),
    [self, other]
  );

  if (!other || !comparison) {
    return (
      <Section title="命式を並べる">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          比べる相手が選ばれていません。「保存済み」の画面で、比べたい命式の
          <span className="mx-1 font-medium">比較に入れる</span>
          を押してください。
        </p>
        <Note>
          今「命式」に出ている人が上、選んだ相手が下に並びます。相手を入れ替えるときは、
          保存済みの一覧から別の人を選び直してください。
        </Note>
      </Section>
    );
  }

  const selfName = self.input.name.trim() || '自分';
  const otherName = other.input.name.trim() || '相手';

  const copySummary = async () => {
    const text = comparisonSummary(comparison);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="二つの命式"
        subtitle="上が「命式」に出ている人、下が選んだ相手。柱を結ぶ線が成立している関係で、破線は天干どうし、実線は地支どうし"
        actions={
          <Button variant="ghost" onClick={onClearOther}>
            相手を外す
          </Button>
        }
      >
        <ChartRow chart={self} label="表示中" />
        <div className="my-1">
          <RelationLines self={self} other={other} relations={comparison.relations} />
        </div>
        <ChartRow chart={other} label="比べる相手" />

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs hairline">
          <span style={{ color: 'var(--wood-fg)' }}>
            結びつき {comparison.bonds.length} 件
          </span>
          <span style={{ color: 'var(--fire-fg)' }}>
            揺さぶり {comparison.clashes.length} 件
          </span>
          <span style={{ color: 'var(--ink-faint)' }}>
            合・沖などは良し悪しではなく、作用の向きの違いです
          </span>
        </div>
      </Section>

      <Section title="読み所">
        <ul className="flex flex-col gap-2.5">
          {comparison.highlights.map((h) => (
            <li key={h.title}>
              <span className="text-sm font-semibold">{h.title}</span>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {h.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {comparison.relations.length > 0 && (
        <Section title="関係の一覧">
          <div className="scroll-x">
            <table className="w-full text-xs" style={{ minWidth: 360 }}>
              <thead>
                <tr style={{ color: 'var(--ink-faint)' }}>
                  <th className="border-b py-1.5 pr-2 text-left font-medium hairline">
                    {selfName}
                  </th>
                  <th className="border-b py-1.5 pr-2 text-left font-medium hairline">
                    {otherName}
                  </th>
                  <th className="border-b py-1.5 pr-2 text-left font-medium hairline">関係</th>
                  <th className="border-b py-1.5 text-left font-medium hairline">干支</th>
                </tr>
              </thead>
              <tbody>
                {comparison.relations.map((r, i) => (
                  <tr key={`${r.kind}-${r.selfSlot}-${r.otherSlot}-${i}`}>
                    <td className="border-b py-1.5 pr-2 hairline">{SLOT_LABEL[r.selfSlot]}</td>
                    <td className="border-b py-1.5 pr-2 hairline">{SLOT_LABEL[r.otherSlot]}</td>
                    <td className="border-b py-1.5 pr-2 hairline">{r.kind}</td>
                    <td className="border-b py-1.5 hairline">
                      {r.label}
                      {r.producedElement && (
                        <span style={{ color: 'var(--ink-faint)' }}>
                          {' '}
                          → {ELEMENT_LABEL[r.producedElement]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section
        title="五行の補い合い"
        subtitle="単純カウント（天干4＋地支4）で見た、二人の五行の持ち分"
      >
        <div className="flex flex-col gap-2">
          {comparison.elementSupport.map((e) => (
            <div key={e.element} className={`${elementClass(e.element)} flex items-center gap-3`}>
              <span className="el-text font-kanji w-6 shrink-0 text-lg leading-none">
                {ELEMENT_LABEL[e.element]}
              </span>
              <span className="w-24 shrink-0 text-xs tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                {selfName} {e.selfCount} / {otherName} {e.otherCount}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                {e.note}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="AI に渡す"
        subtitle="二人の関係の部分だけを書き出します。命式そのものは「プロンプト」の画面から"
        actions={
          <Button variant="primary" onClick={copySummary}>
            {copied ? 'コピーしました' : 'コピー'}
          </Button>
        }
      >
        <textarea
          readOnly
          spellCheck={false}
          value={comparisonSummary(comparison)}
          className="field min-h-56 w-full resize-y font-mono text-xs leading-relaxed"
          style={{ background: 'var(--surface-sunken)' }}
        />
      </Section>
    </div>
  );
}
