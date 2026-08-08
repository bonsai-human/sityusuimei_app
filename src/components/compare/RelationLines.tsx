import { ELEMENT_LABEL } from '../../core/constants';
import { RELATION_TONE, isGanRelation, type CrossRelation } from '../../core/relations';
import type { Chart } from '../../core/types';

/**
 * 2 つの命式のあいだに成立している関係を線で結ぶ。
 *
 * 上下の柱はどちらも等幅で並ぶので、柱の中心の x 座標は「(番号 + 0.5) / 柱数」で出せる。
 * つまり要素の位置を測らなくても比率だけで描ける。画面幅が変わっても線がずれない。
 *
 * 天干どうしの関係は破線、地支どうしは実線。同じ組に複数の関係が掛かることがあるので、
 * 見出しの札は縦にずらして重ならないようにしている。
 */
export default function RelationLines({
  self,
  other,
  relations,
  height = 132,
}: {
  self: Chart;
  other: Chart;
  relations: CrossRelation[];
  height?: number;
}) {
  const selfCount = self.pillars.length;
  const otherCount = other.pillars.length;

  // 表示は「時・日・月・年」の並びなので、柱の並び順もそれに合わせて左からの位置を出す
  const xOf = (slot: string, pillars: Chart['pillars'], count: number) => {
    const reversed = [...pillars].reverse();
    const index = reversed.findIndex((p) => p.slot === slot);
    return ((index + 0.5) / count) * 100;
  };

  if (relations.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg text-xs"
        style={{ height: 56, background: 'var(--surface-sunken)', color: 'var(--ink-faint)' }}
      >
        柱どうしで成立している関係はありません
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {relations.map((r, i) => {
          const x1 = xOf(r.selfSlot, self.pillars, selfCount);
          const x2 = xOf(r.otherSlot, other.pillars, otherCount);
          const clash = RELATION_TONE[r.kind] === 'clash';
          return (
            <line
              key={`${r.kind}-${r.selfSlot}-${r.otherSlot}-${i}`}
              x1={x1}
              y1={0}
              x2={x2}
              y2={height}
              stroke={clash ? 'var(--fire-line)' : 'var(--wood-line)'}
              strokeWidth={0.4}
              strokeDasharray={isGanRelation(r.kind) ? '1.4 1.2' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* 札は SVG の外に出して、拡大で文字が歪まないようにする */}
      {relations.map((r, i) => {
        const x1 = xOf(r.selfSlot, self.pillars, selfCount);
        const x2 = xOf(r.otherSlot, other.pillars, otherCount);
        const clash = RELATION_TONE[r.kind] === 'clash';
        // 同じあたりに集まっても読めるよう、順番に少しずつ下げる
        const top = 14 + ((i * 26) % Math.max(height - 40, 26));
        const ratio = top / height;
        return (
          <span
            key={`label-${r.kind}-${r.selfSlot}-${r.otherSlot}-${i}`}
            className="absolute -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              left: `${x1 + (x2 - x1) * ratio}%`,
              top,
              background: clash ? 'var(--fire-bg)' : 'var(--wood-bg)',
              color: clash ? 'var(--fire-fg)' : 'var(--wood-fg)',
              border: `1px solid ${clash ? 'var(--fire-line)' : 'var(--wood-line)'}`,
            }}
          >
            {r.kind} {r.label}
            {r.producedElement && ` →${ELEMENT_LABEL[r.producedElement]}`}
          </span>
        );
      })}
    </div>
  );
}
