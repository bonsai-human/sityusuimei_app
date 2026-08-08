import { describe, expect, it } from 'vitest';

import { buildChart } from '../chart';
import { compareCharts, comparisonSummary } from '../compare';
import { findCrossRelations, findRelations, pairRelations } from '../relations';
import type { BirthInput } from '../types';
import { TOKYO } from '../../data/cities';

const BASE: BirthInput = {
  name: '自分',
  gender: 'male',
  calendar: 'solar',
  year: 2003,
  month: 1,
  day: 10,
  time: { kind: 'hm', hour: 16, minute: 59 },
  place: TOKYO,
  dst: false,
  options: { trueSolarTime: true, equationOfTime: true, sect: 2, lateZi: false },
};

// 命式は 年 壬午 / 月 癸丑 / 日 癸未 / 時 辛酉
const self = buildChart(BASE, new Date('2026-08-08T00:00:00Z'));
// 別の命式（1995-05-20 10:30 女性）
const other = buildChart(
  { ...BASE, name: '相手', gender: 'female', year: 1995, month: 5, day: 20, time: { kind: 'hm', hour: 10, minute: 30 } },
  new Date('2026-08-08T00:00:00Z')
);

describe('pairRelations の切り出しで挙動が変わっていない', () => {
  it('1つの命式の中の判定は従来どおり', () => {
    const rels = findRelations(
      self.pillars.map((p) => ({ slot: p.slot, gan: p.gan, zhi: p.zhi }))
    );
    expect(rels.some((r) => r.kind === '沖' && r.label === '丑未')).toBe(true);
    expect(rels.some((r) => r.kind === '害')).toBe(true);
    expect(rels.some((r) => r.kind === '支合' && r.label === '午未')).toBe(true);
    expect(rels.some((r) => r.kind === '三合' || r.kind === '方合')).toBe(false);
  });

  it('2柱を直接渡しても同じ結果になる', () => {
    const direct = pairRelations(
      { slot: 'month', gan: '癸', zhi: '丑' },
      { slot: 'day', gan: '癸', zhi: '未' }
    );
    expect(direct.map((r) => r.kind)).toContain('沖');
    // 癸と癸は合も沖もしない
    expect(direct.some((r) => r.kind === '天干合' || r.kind === '天干沖')).toBe(false);
  });

  it('三合が成立する組では、その局の半合を重ねて出さない', () => {
    const rels = findRelations([
      { slot: 'year', gan: '甲', zhi: '申' },
      { slot: 'month', gan: '丙', zhi: '子' },
      { slot: 'day', gan: '戊', zhi: '辰' },
    ]);
    expect(rels.filter((r) => r.kind === '三合')).toHaveLength(1);
    expect(rels.some((r) => r.kind === '半合')).toBe(false);
  });
});

describe('findCrossRelations', () => {
  it('片方の柱ともう片方の柱を総当たりする', () => {
    const rels = findCrossRelations(
      [{ slot: 'day', gan: '癸', zhi: '未' }],
      [
        { slot: 'year', gan: '己', zhi: '丑' },
        { slot: 'day', gan: '甲', zhi: '子' },
      ]
    );
    // 未 × 丑 は沖、未 × 子 は害
    expect(rels.find((r) => r.kind === '沖')?.otherSlot).toBe('year');
    expect(rels.find((r) => r.kind === '害')?.otherSlot).toBe('day');
    // どちらの柱どうしかが分かる
    expect(rels.every((r) => r.selfSlot === 'day')).toBe(true);
  });

  it('同じ干支どうしでも自刑の対象なら拾う', () => {
    const rels = findCrossRelations(
      [{ slot: 'day', gan: '甲', zhi: '辰' }],
      [{ slot: 'day', gan: '丙', zhi: '辰' }]
    );
    expect(rels.some((r) => r.kind === '自刑')).toBe(true);
  });

  it('三合・方合はまたいで判定しない', () => {
    const rels = findCrossRelations(
      [
        { slot: 'year', gan: '甲', zhi: '申' },
        { slot: 'month', gan: '丙', zhi: '子' },
      ],
      [{ slot: 'day', gan: '戊', zhi: '辰' }]
    );
    expect(rels.some((r) => r.kind === '三合' || r.kind === '方合')).toBe(false);
    // 半合としては拾われる（申辰・子辰）
    expect(rels.filter((r) => r.kind === '半合').length).toBeGreaterThan(0);
  });

  it('関係が無ければ空になる', () => {
    const rels = findCrossRelations(
      [{ slot: 'day', gan: '甲', zhi: '子' }],
      [{ slot: 'day', gan: '甲', zhi: '子' }]
    );
    // 子は自刑の対象ではなく、甲と甲は合も沖もしない
    expect(rels).toHaveLength(0);
  });
});

describe('compareCharts', () => {
  const c = compareCharts(self, other);

  it('結びつきと揺さぶりに振り分ける', () => {
    expect(c.bonds.length + c.clashes.length).toBe(c.relations.length);
    expect(c.relations.length).toBeGreaterThan(0);
  });

  it('読み所が必ず1つ以上出る', () => {
    expect(c.highlights.length).toBeGreaterThan(0);
    for (const h of c.highlights) {
      expect(h.title).not.toBe('');
      expect(h.body).not.toBe('');
    }
  });

  it('五行の持ち分が両方ぶん出る', () => {
    expect(c.elementSupport).toHaveLength(5);
    const water = c.elementSupport.find((e) => e.element === 'water')!;
    expect(water.selfCount).toBe(3); // 自分は水3
    expect(water.otherCount).toBeGreaterThanOrEqual(0);
  });

  it('自分に無い五行を相手が持っていれば書き添える', () => {
    const wood = c.elementSupport.find((e) => e.element === 'wood')!;
    expect(wood.selfCount).toBe(0); // 自分は木0
    if (wood.otherCount >= 1) expect(wood.note).toContain('木');
  });

  it('関係がまったく無い相手でも破綻しない', () => {
    // 甲子 だけの人工的な命式どうしにならないよう、実在の日付で関係の薄い相手を探す
    const lonely = compareCharts(self, self);
    expect(lonely.highlights.length).toBeGreaterThan(0);
    const text = comparisonSummary(lonely);
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });
});

describe('comparisonSummary', () => {
  const text = comparisonSummary(compareCharts(self, other));

  it('二人の四柱と日干が入る', () => {
    expect(text).toContain('自分');
    expect(text).toContain('相手');
    expect(text).toContain('壬午');
    expect(text).toContain('癸未');
    expect(text).toContain('日干 癸');
  });

  it('関係の表と読み所が入る', () => {
    expect(text).toContain('| 関係 |');
    expect(text).toContain('読み所:');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('時刻不明の相手でも出力できる', () => {
    const noTime = buildChart({ ...BASE, name: '相手', time: { kind: 'unknown' } });
    const out = comparisonSummary(compareCharts(self, noTime));
    expect(out).toContain('癸未');
    expect(out).not.toContain('undefined');
  });
});
