import { describe, expect, it } from 'vitest';

import { TOKYO } from '../../../data/cities';
import type { BirthInput } from '../../types';
import { buildHoroscope } from '../chart';
import { houseOf } from '../houses';
import { separation } from '../math';
import {
  DEFAULT_TRANSIT_ORBS,
  defaultTransitOptions,
  progressedOn,
  solarReturnOf,
  transitLogSummary,
  transitsOn,
} from '../transit';
import { defaultHoroscopeOptions } from '../types';

const INPUT: BirthInput = {
  name: 'テスト',
  gender: 'male',
  calendar: 'solar',
  year: 1990,
  month: 1,
  day: 1,
  time: { kind: 'hm', hour: 12, minute: 0 },
  place: TOKYO,
  dst: false,
  options: { trueSolarTime: true, equationOfTime: true, sect: 2, lateZi: false },
};

const options = defaultHoroscopeOptions();
const natal = buildHoroscope(INPUT, options);

describe('トランジット', () => {
  it('出生の日そのものを見ると、すべての天体が自分自身と重なる', () => {
    // 出生も正午、トランジットも正午なので、同じ瞬間の空になる。
    // 日付から世界時に直すところまでが噛み合っていないと、ここがずれる
    const t = transitsOn(natal, '1990-01-01', options);
    for (const p of t.placements) {
      const same = natal.placements.find((n) => n.id === p.id)!;
      expect(p.lon).toBeCloseTo(same.lon, 9);
    }
    const conjunctions = t.aspects.filter((a) => a.a === a.b && a.kind === 'conjunction');
    // 月を外しているので 11 天体
    expect(conjunctions).toHaveLength(11);
    expect(Math.max(...conjunctions.map((c) => c.orb))).toBeLessThan(0.0001);
  });

  it('ハウスは、その日の空ではなく出生図のハウスで読む', () => {
    const t = transitsOn(natal, '2026-08-24', options);
    for (const p of t.placements) {
      expect(p.house).toBe(houseOf(p.lon, natal.houses!.cusps));
    }
    // その日の空を単体で組んだときのハウスとは違う
    const sky = buildHoroscope({ ...INPUT, year: 2026, month: 8, day: 24 }, options);
    const saturn = (h: typeof natal) => h.placements.find((p) => p.id === 'saturn')!.house;
    expect(t.placements.find((p) => p.id === 'saturn')!.house).not.toBe(saturn(sky));
  });

  it('アスペクトは、トランジット側が a・出生図側が b になる', () => {
    const t = transitsOn(natal, '2026-08-24', options);
    expect(t.aspects.length).toBeGreaterThan(0);
    // 出生図の感受点に掛かるものも拾う
    expect(t.aspects.some((a) => a.b === 'asc' || a.b === 'mc')).toBe(true);
    // トランジット側に感受点は入らない（動きが速すぎて日付だけでは決まらない）
    expect(t.aspects.every((a) => a.a !== 'asc' && a.a !== 'mc')).toBe(true);
  });

  it('月は既定では見ない。入れると本数が増える', () => {
    const without = transitsOn(natal, '2026-08-24', options);
    const withMoon = transitsOn(natal, '2026-08-24', options, {
      ...defaultTransitOptions(),
      includeMoon: true,
    });
    expect(without.placements.some((p) => p.id === 'moon')).toBe(false);
    expect(withMoon.placements.some((p) => p.id === 'moon')).toBe(true);
    expect(withMoon.notes.join()).toContain('13 度');
  });

  it('オーブは出生図の中どうしより狭い', () => {
    const narrow = transitsOn(natal, '2026-08-24', options);
    const wide = transitsOn(natal, '2026-08-24', options, {
      ...defaultTransitOptions(),
      orbs: options.orbs,
    });
    expect(DEFAULT_TRANSIT_ORBS.conjunction).toBeLessThan(options.orbs.conjunction);
    expect(narrow.aspects.length).toBeLessThan(wide.aspects.length);
  });

  it('日付の形が違えば断る', () => {
    expect(() => transitsOn(natal, '2026/08/24', options)).toThrow(/YYYY-MM-DD/);
  });
});

describe('二次進行', () => {
  it('出生の日には、出生図とほぼ同じ図になる', () => {
    const { horoscope, years } = progressedOn(natal, '1990-01-01', options);
    expect(years).toBeCloseTo(0, 3);
    expect(horoscope.placements.find((p) => p.id === 'sun')!.lon).toBeCloseTo(
      natal.placements.find((p) => p.id === 'sun')!.lon,
      3
    );
  });

  it('1 年後は、生後 1 日ぶんだけ進んだ図になる', () => {
    // 1 太陽年 = 365.242189 日
    const oneYearLater = new Date(Date.UTC(1990, 0, 1) + 365.242189 * 86_400_000);
    const date = oneYearLater.toISOString().slice(0, 10);
    const { horoscope, years } = progressedOn(natal, date, options);
    expect(years).toBeCloseTo(1, 2);

    // 太陽は 1 日でおよそ 1 度進む
    const moved =
      horoscope.placements.find((p) => p.id === 'sun')!.lon -
      natal.placements.find((p) => p.id === 'sun')!.lon;
    expect(moved).toBeGreaterThan(1.0);
    expect(moved).toBeLessThan(1.05);

    // 月は 1 日で 13 度あまり進む
    const moon =
      horoscope.placements.find((p) => p.id === 'moon')!.lon -
      natal.placements.find((p) => p.id === 'moon')!.lon;
    expect(moon).toBeGreaterThan(12);
    expect(moon).toBeLessThan(15);
  });

  it('36 年後でも、進んでいるのは 36 日ぶん', () => {
    const { horoscope, years } = progressedOn(natal, '2026-01-01', options);
    expect(years).toBeCloseTo(36, 1);
    // 太陽は 36 日ぶん進む。冬は 1 日 1.02 度ほど動くので、36 度より少し大きくなる
    const sun = horoscope.placements.find((p) => p.id === 'sun')!;
    const moved = sun.lon - natal.placements.find((p) => p.id === 'sun')!.lon;
    expect(moved).toBeGreaterThan(36);
    expect(moved).toBeLessThan(37.5);
    expect(sun.position.sign).not.toBe(natal.placements.find((p) => p.id === 'sun')!.position.sign);
  });
});

describe('ソーラーリターン', () => {
  it('太陽が出生時と同じ黄経に戻る瞬間の図になる', () => {
    for (const year of [1990, 2010, 2026]) {
      const { horoscope } = solarReturnOf(natal, year, options);
      expect(
        separation(
          horoscope.placements.find((p) => p.id === 'sun')!.lon,
          natal.placements.find((p) => p.id === 'sun')!.lon
        )
      ).toBeLessThan(0.001);
    }
  });

  it('回帰の瞬間は、誕生日の前後 2 日に収まる', () => {
    const { moment } = solarReturnOf(natal, 2026, options);
    expect(moment).toMatch(/^2025年12月3[01]日|^2026年01月0[123]日/);
  });

  it('生まれた年の回帰は、出生の瞬間そのものになる', () => {
    const { horoscope } = solarReturnOf(natal, 1990, options);
    // 出生の瞬間に太陽はそこにあるので、同じ日時が返る
    expect(horoscope.meta.standardDateTime).toBe('1990年01月01日 12:00');
  });
});

describe('人生ログへの書き出し', () => {
  const events = [
    { date: '2015-04-01', title: '転職した' },
    { date: '2021-09-15', title: '引っ越した' },
  ];

  it('出来事ごとに、その日のめぐりが並ぶ', () => {
    const text = transitLogSummary(natal, events, options);
    expect(text).toContain('## 同じ出来事に、天体がどう掛かっていたか');
    expect(text).toContain('### 2015-04-01 転職した');
    expect(text).toContain('### 2021-09-15 引っ越した');
    expect(text).toMatch(/めぐる.+が出生の.+に(コンジャンクション|オポジション|トライン|スクエア|セクスタイル)/);
  });

  it('日付順に並ぶ', () => {
    const text = transitLogSummary(natal, [...events].reverse(), options);
    expect(text.indexOf('2015-04-01')).toBeLessThan(text.indexOf('2021-09-15'));
  });

  it('速い天体は入らない', () => {
    const text = transitLogSummary(natal, events, options);
    for (const fast of ['めぐる月', 'めぐる太陽', 'めぐる水星', 'めぐる金星', 'めぐる火星']) {
      expect(text).not.toContain(fast);
    }
  });

  it('当てさせるためではないことを、依頼の文に書く', () => {
    const text = transitLogSummary(natal, events, options);
    expect(text).toContain('言い当てる必要はありません');
    expect(text).toContain('四柱推命の側と同じことを指している箇所');
  });

  it('天体暦の範囲外の日付があっても、そこだけ断って続ける', () => {
    const text = transitLogSummary(natal, [{ date: '1500-01-01', title: '昔' }, ...events], options);
    expect(text).toContain('天体暦の範囲外');
    expect(text).toContain('転職した');
  });
});
