import { ELEMENT_LABEL } from '../../core/constants';
import { RELATION_NOTE, RELATION_TONE, SLOT_LABEL, type Relation } from '../../core/relations';
import type { Chart } from '../../core/types';
import { Section, elementClass } from '../ui';

function RelationRow({ relation }: { relation: Relation }) {
  const clash = RELATION_TONE[relation.kind] === 'clash';
  return (
    <li
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg px-2.5 py-2"
      style={{ background: 'var(--surface-sunken)' }}
      title={RELATION_NOTE[relation.kind]}
    >
      <span
        className="rounded px-1.5 py-0.5 text-xs font-semibold"
        style={{
          background: clash ? 'var(--fire-bg)' : 'var(--wood-bg)',
          color: clash ? 'var(--fire-fg)' : 'var(--wood-fg)',
          border: `1px solid ${clash ? 'var(--fire-line)' : 'var(--wood-line)'}`,
        }}
      >
        {relation.kind}
      </span>
      <span className="font-kanji text-lg leading-none">{relation.label}</span>
      <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
        {relation.slots.map((s) => SLOT_LABEL[s]).join(' × ')}
      </span>
      {relation.producedElement && (
        <span className={`${elementClass(relation.producedElement)} text-xs`}>
          <span className="el-text">→ {ELEMENT_LABEL[relation.producedElement]}に化す</span>
        </span>
      )}
    </li>
  );
}

/**
 * 干支の関係。吉凶で分けるのではなく「結びつき」と「揺さぶり」で分けて並べる。
 * どちらも良し悪しではなく作用の向きなので、色も暖色・寒色の対比にはしていない。
 */
export default function RelationList({ chart }: { chart: Chart }) {
  const bonds = chart.relations.filter((r) => RELATION_TONE[r.kind] === 'bond');
  const clashes = chart.relations.filter((r) => RELATION_TONE[r.kind] === 'clash');

  return (
    <Section
      title="干支の関係"
      subtitle="四柱のあいだで成立している合・沖・刑・害・破。項目にカーソルを合わせると意味が出ます"
    >
      {chart.relations.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          成立している関係はありません。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>
              結びつき（{bonds.length}）
            </h3>
            {bonds.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                なし
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {bonds.map((r, i) => (
                  <RelationRow key={`${r.kind}-${r.label}-${i}`} relation={r} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>
              揺さぶり（{clashes.length}）
            </h3>
            {clashes.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                なし
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {clashes.map((r, i) => (
                  <RelationRow key={`${r.kind}-${r.label}-${i}`} relation={r} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
