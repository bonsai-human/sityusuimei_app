import { useEffect, useState } from 'react';

import { elementOfGan, elementOfZhi } from '../../core/ganzhi';
import type { Chart, DaYunEntry } from '../../core/types';
import { Section, elementClass } from '../ui';

function GanZhiStack({
  gan,
  zhi,
  size = 'md',
}: {
  gan: string;
  zhi: string;
  size?: 'sm' | 'md';
}) {
  const text = size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`${elementClass(elementOfGan(gan as never))} el-chip font-kanji ${text} rounded px-1.5 py-0.5 text-center leading-tight`}>
        {gan}
      </span>
      <span className={`${elementClass(elementOfZhi(zhi as never))} el-chip font-kanji ${text} rounded px-1.5 py-0.5 text-center leading-tight`}>
        {zhi}
      </span>
    </div>
  );
}

/**
 * 大運と流年。参考にしたアプリは 2 段の表を右から左に並べていたが、ここでは
 * 左から右に流れる横スクロールのタイムラインにし、大運を選ぶとその 10 年の
 * 流年が下段に開く形にした。今どこにいるかが一目で分かるのを優先している。
 */
export default function LuckTimeline({ chart }: { chart: Chart }) {
  const thisYear = new Date().getFullYear();
  const currentIndex = chart.luck.entries.findIndex(
    (e) => thisYear >= e.startYear && thisYear <= e.endYear
  );
  const [selected, setSelected] = useState<number>(currentIndex >= 0 ? currentIndex : 0);

  // 命式を組み直したら、選択も現在の大運に戻す
  useEffect(() => {
    setSelected(currentIndex >= 0 ? currentIndex : 0);
  }, [currentIndex, chart]);

  const active: DaYunEntry | undefined = chart.luck.entries[selected];

  return (
    <Section
      title="大運と流年"
      subtitle={`${chart.luck.forward ? '順行' : '逆行'}・${chart.luck.startAge}歳（${chart.luck.startDate}）から起運。大運を選ぶとその10年の流年が下に出ます`}
    >
      <div className="scroll-x -mx-1 px-1 pb-2">
        <div className="flex gap-2">
          {chart.luck.entries.map((e, i) => {
            const isNow = i === currentIndex;
            const isSelected = i === selected;
            return (
              <button
                key={e.startYear}
                type="button"
                onClick={() => setSelected(i)}
                className="w-[4.75rem] shrink-0 rounded-lg p-1.5 text-center transition-colors"
                style={{
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                  background: isSelected ? 'var(--accent-soft)' : 'var(--surface-raised)',
                }}
                aria-pressed={isSelected}
              >
                <div className="text-[10px] leading-tight" style={{ color: 'var(--ink-faint)' }}>
                  {e.startAge}歳
                </div>
                <div className="my-1">
                  <GanZhiStack gan={e.gan} zhi={e.zhi} size="sm" />
                </div>
                <div
                  className="text-[10px] leading-tight"
                  style={{
                    color: isNow ? 'var(--accent)' : 'var(--ink-faint)',
                    fontWeight: isNow ? 700 : 400,
                  }}
                >
                  {isNow ? `今 ${e.startYear}` : e.startYear}
                </div>
                <div className="text-[10px] leading-tight" style={{ color: 'var(--ink-muted)' }}>
                  {e.ganTenGod}
                </div>
                <div className="text-[10px] leading-tight" style={{ color: 'var(--ink-faint)' }}>
                  {e.stage}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {active && (
        <div className="mt-3 border-t pt-3 hairline">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-kanji text-lg">
              {active.gan}
              {active.zhi}
            </span>
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {active.startYear}〜{active.endYear}年 ／ {active.startAge}歳〜
            </span>
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
              天干 {active.ganTenGod}・地支 {active.zhiTenGod}・{active.stage}
            </span>
          </div>

          <div className="scroll-x -mx-1 px-1 pb-1">
            <div className="flex gap-1.5">
              {active.liuNian.map((n) => {
                const isNow = n.year === thisYear;
                return (
                  <div
                    key={n.year}
                    className="w-[3.9rem] shrink-0 rounded-lg p-1 text-center"
                    style={{
                      border: isNow ? '2px solid var(--accent)' : '1px solid var(--line)',
                      background: isNow ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <div
                      className="text-[10px] leading-tight"
                      style={{ color: isNow ? 'var(--accent)' : 'var(--ink-faint)', fontWeight: isNow ? 700 : 400 }}
                    >
                      {n.year}
                    </div>
                    <div className="my-0.5">
                      <GanZhiStack gan={n.gan} zhi={n.zhi} size="sm" />
                    </div>
                    <div className="text-[10px] leading-tight" style={{ color: 'var(--ink-faint)' }}>
                      {n.age}歳
                    </div>
                    <div className="text-[10px] leading-tight" style={{ color: 'var(--ink-muted)' }}>
                      {n.ganTenGod}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
