import { ELEMENT_LABEL } from '../../core/constants';
import { SLOT_LABEL } from '../../core/relations';
import type { Pillar } from '../../core/types';
import { elementClass } from '../ui';

const SLOT_MEANING: Record<Pillar['slot'], string> = {
  year: '先祖・幼少',
  month: '親・社会',
  day: '自分・配偶',
  hour: '子・晩年',
};

/**
 * 1 本の柱を 1 枚のカードにまとめる。
 * 上から 十神(干) → 天干 → 地支 → 十神(支) → 蔵干 → 十二運・納音・空亡 と、
 * 「日干から見た関係」が天干・地支のすぐ隣に来るように積んでいる。
 */
export default function PillarCard({
  pillar,
  isDayMaster,
}: {
  pillar: Pillar;
  isDayMaster: boolean;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{
        border: isDayMaster ? '2px solid var(--accent)' : '1px solid var(--line)',
        background: 'var(--surface-raised)',
      }}
    >
      <div
        className="px-2 py-1.5 text-center"
        style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="text-xs font-semibold">{SLOT_LABEL[pillar.slot]}</div>
        <div className="text-[10px] leading-tight" style={{ color: 'var(--ink-faint)' }}>
          {SLOT_MEANING[pillar.slot]}
        </div>
      </div>

      <div className="px-1.5 pt-2 text-center text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        {pillar.ganTenGod}
      </div>
      <div className={`${elementClass(pillar.ganElement)} mx-1.5 mt-1`}>
        <div className="el-chip flex flex-col items-center rounded-lg py-2">
          <span className="font-kanji text-4xl leading-none sm:text-5xl">{pillar.gan}</span>
          <span className="mt-1 text-[10px] opacity-80">
            {ELEMENT_LABEL[pillar.ganElement]}
            {pillar.ganYang ? '＋' : '−'}
          </span>
        </div>
      </div>

      <div className={`${elementClass(pillar.zhiElement)} mx-1.5 mt-1.5`}>
        <div className="el-chip flex flex-col items-center rounded-lg py-2">
          <span className="font-kanji text-4xl leading-none sm:text-5xl">{pillar.zhi}</span>
          <span className="mt-1 text-[10px] opacity-80">
            {ELEMENT_LABEL[pillar.zhiElement]}
            {pillar.zhiYang ? '＋' : '−'}・{pillar.animal}
          </span>
        </div>
      </div>
      <div className="px-1.5 pb-1 pt-1 text-center text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        {pillar.zhiTenGod}
      </div>

      <div className="mx-1.5 border-t pt-1.5 hairline">
        <div className="mb-1 text-center text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          蔵干
        </div>
        {/* 蔵干は2つの地支と3つの地支があるので、高さを揃えて下の行が横並びになるようにする */}
        <div className="flex min-h-[4.1rem] flex-col gap-0.5">
          {pillar.hidden.map((h) => (
            <div
              key={h.gan + h.role}
              className={`${elementClass(h.element)} flex items-center justify-between rounded px-1.5 py-0.5 text-[11px]`}
              style={{
                background: h.isMonthRuler ? 'var(--el-bg)' : 'transparent',
                fontWeight: h.isMonthRuler ? 600 : 400,
              }}
              title={`${h.role}${h.isMonthRuler ? '・月令（司令）' : ''}`}
            >
              <span className="el-text font-kanji text-sm">{h.gan}</span>
              <span style={{ color: 'var(--ink-faint)' }}>{h.tenGod}</span>
            </div>
          ))}
        </div>
      </div>

      <dl
        className="mx-1.5 mb-1.5 mt-1.5 border-t pt-1.5 text-[11px] hairline"
        style={{ color: 'var(--ink-muted)' }}
      >
        {(
          [
            ['十二運', pillar.stage],
            ['空亡', pillar.xunKong.join('')],
            ['納音', pillar.naYin],
          ] as const
        ).map(([label, value]) => (
          // 狭い画面では折り返さずに縦積みにする
          <div key={label} className="flex flex-col sm:flex-row sm:justify-between sm:gap-1">
            <dt style={{ color: 'var(--ink-faint)' }}>{label}</dt>
            <dd className="sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
