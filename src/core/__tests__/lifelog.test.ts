import { describe, expect, it } from 'vitest';

import { buildChart } from '../chart';
import { eventContext, lifeLogSummary, parseDate, toneCount } from '../lifelog';
import type { BirthInput } from '../types';
import { TOKYO } from '../../data/cities';

const INPUT: BirthInput = {
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

// 命式 壬午 / 癸丑 / 癸未 / 辛酉、大運は順行で 8.3歳から 甲寅 → 乙卯(2021) → 丙辰(2031)
const chart = buildChart(INPUT, new Date('2026-08-08T00:00:00Z'));

describe('parseDate', () => {
  it('YYYY-MM-DD だけを受け付ける', () => {
    expect(parseDate('2026-08-08')).toEqual({ y: 2026, m: 8, d: 8 });
    expect(parseDate('2026-8-8')).toBeNull();
    expect(parseDate('2026/08/08')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('2026-08-32')).toBeNull();
  });
});

describe('eventContext', () => {
  it('その年の流年と、それを含む大運を引き当てる', () => {
    const ctx = eventContext(chart, '2026-08-08')!;
    expect(ctx.liuNian?.gan + '' + ctx.liuNian?.zhi).toBe('丙午');
    expect(ctx.liuNian?.year).toBe(2026);
    expect(ctx.daYun?.gan + '' + ctx.daYun?.zhi).toBe('乙卯');
    expect(ctx.age).toBe(23);
    expect(ctx.note).toBeNull();
  });

  it('立春より前の日付は前年の流年になる', () => {
    // 立春 2024-02-04。その前は 2023年（癸卯）、後は 2024年（甲辰）
    const before = eventContext(chart, '2024-01-20')!;
    const after = eventContext(chart, '2024-03-01')!;
    expect(before.liuNian?.gan + '' + before.liuNian?.zhi).toBe('癸卯');
    expect(before.liuNian?.year).toBe(2023);
    expect(after.liuNian?.gan + '' + after.liuNian?.zhi).toBe('甲辰');
    expect(after.liuNian?.year).toBe(2024);
    // どちらも同じ大運（乙卯）の中
    expect(before.daYun?.gan).toBe('乙');
    expect(after.daYun?.gan).toBe('乙');
  });

  it('満年齢は誕生日の前後で変わる', () => {
    expect(eventContext(chart, '2026-01-09')!.age).toBe(22);
    expect(eventContext(chart, '2026-01-10')!.age).toBe(23);
  });

  it('その日の月柱と日柱を出す', () => {
    // 2026-08-08 は丙申月・甲寅日（参考にした万年暦と一致）
    const ctx = eventContext(chart, '2026-08-08')!;
    expect(ctx.month.gan + ctx.month.zhi).toBe('丙申');
    expect(ctx.day.gan + ctx.day.zhi).toBe('甲寅');
  });

  it('流年が命式に掛ける関係を拾う', () => {
    // 2026 は丙午。命式の午（年支）と自刑、未（日支）と支合、丑（月支）と害、壬（年干）と天干沖
    const ctx = eventContext(chart, '2026-08-08')!;
    const kinds = ctx.liuNianRelations.map((r) => `${r.kind}:${r.selfSlot}`);
    expect(kinds).toContain('自刑:year');
    expect(kinds).toContain('支合:day');
    expect(kinds).toContain('害:month');
    expect(kinds).toContain('天干沖:year');
    // 相手側はすべて流年になっている
    expect(ctx.liuNianRelations.every((r) => r.otherSlot === 'liuNian')).toBe(true);
  });

  it('大運が命式に掛ける関係も拾う', () => {
    // 乙卯大運。卯は命式の酉（時支）と沖
    const ctx = eventContext(chart, '2026-08-08')!;
    expect(ctx.daYunRelations.some((r) => r.kind === '沖' && r.selfSlot === 'hour')).toBe(true);
    expect(ctx.daYunRelations.every((r) => r.otherSlot === 'daYun')).toBe(true);
  });

  it('大運と流年のあいだの関係も見る', () => {
    // 乙卯 と 丙午 → 卯午は破
    const ctx = eventContext(chart, '2026-08-08')!;
    expect(ctx.luckRelations.some((r) => r.kind === '破')).toBe(true);
  });

  it('起運前の日付には断りが付き、大運は空になる', () => {
    // 起運は 8.3歳（2011年5月）。2005年はまだ大運に入っていない
    const ctx = eventContext(chart, '2005-06-01')!;
    expect(ctx.daYun).toBeNull();
    expect(ctx.note).toContain('起運');
    expect(ctx.daYunRelations).toEqual([]);
    // 流年もこの範囲では引けないが、月柱・日柱は出る
    expect(ctx.month.gan).not.toBe('');
    expect(ctx.day.gan).not.toBe('');
  });

  it('生まれる前の日付には断りが付く', () => {
    const ctx = eventContext(chart, '2000-01-01')!;
    expect(ctx.note).toContain('生まれる前');
  });

  it('読めない日付は null になる', () => {
    expect(eventContext(chart, 'あした')).toBeNull();
  });

  it('時刻不明の命式でも引き当てられる', () => {
    const noTime = buildChart({ ...INPUT, time: { kind: 'unknown' } });
    const ctx = eventContext(noTime, '2026-08-08')!;
    expect(ctx.liuNian?.gan + '' + ctx.liuNian?.zhi).toBe('丙午');
    // 時柱が無いので時柱に掛かる関係は出ない
    expect(ctx.liuNianRelations.every((r) => r.selfSlot !== 'hour')).toBe(true);
  });
});

describe('toneCount', () => {
  it('結びつきと揺さぶりを数える', () => {
    const ctx = eventContext(chart, '2026-08-08')!;
    const t = toneCount(ctx);
    expect(t.bond).toBeGreaterThan(0);
    expect(t.clash).toBeGreaterThan(0);
    expect(t.bond + t.clash).toBe(
      ctx.daYunRelations.length + ctx.liuNianRelations.length + ctx.luckRelations.length
    );
  });
});

describe('lifeLogSummary', () => {
  const events = [
    { date: '2024-04-01', title: '転職した', category: '仕事' as const, note: '前職は3年' },
    { date: '2021-03-15', title: '引っ越した', category: '住まい' as const, note: '' },
  ];

  it('日付順に並べ直して出す', () => {
    const text = lifeLogSummary(chart, events);
    expect(text.indexOf('2021-03-15')).toBeLessThan(text.indexOf('2024-04-01'));
  });

  it('出来事ごとに大運と流年が付く', () => {
    const text = lifeLogSummary(chart, events);
    expect(text).toContain('転職した');
    expect(text).toContain('引っ越した');
    expect(text).toContain('- 大運:');
    expect(text).toContain('- 流年:');
    expect(text).toContain('甲辰'); // 2024年の流年
    expect(text).toContain('辛丑'); // 2021年の流年
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('当てさせるのではなく対応を読ませる依頼になっている', () => {
    const text = lifeLogSummary(chart, events);
    expect(text).toContain('言い当てる必要はありません');
    expect(text).toContain('無理に合わせず');
  });

  it('記録が無くても破綻しない', () => {
    const text = lifeLogSummary(chart, []);
    expect(text).toContain('まだありません');
    expect(text).not.toContain('undefined');
  });
});
