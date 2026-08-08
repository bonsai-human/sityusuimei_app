import { describe, expect, it } from 'vitest';

import { buildChart } from '../chart';
import type { BirthInput } from '../types';
import { TOKYO } from '../../data/cities';

/**
 * ゴールデンケース。
 * 1983 年から使われている市販の万年暦アプリで出した命式と突き合わせた結果を、
 * 回帰テストとして固定してある。1 か所でもずれたら計算層のどこかが壊れている。
 *
 *   男性 / 1 2003年01月10日 16時59分 / 日本
 *   → 年 壬午 ・ 月 癸丑 ・ 日 癸未 ・ 時 辛酉
 */
const GOLDEN: BirthInput = {
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

describe('buildChart — ゴールデンケース', () => {
  const chart = buildChart(GOLDEN, new Date('2026-08-08T00:00:00Z'));

  it('四柱が一致する', () => {
    expect(chart.year.gan + chart.year.zhi).toBe('壬午');
    expect(chart.month.gan + chart.month.zhi).toBe('癸丑');
    expect(chart.day.gan + chart.day.zhi).toBe('癸未');
    expect(chart.hour!.gan + chart.hour!.zhi).toBe('辛酉');
  });

  it('天干の十神が一致する', () => {
    expect(chart.year.ganTenGod).toBe('劫財');
    expect(chart.month.ganTenGod).toBe('比肩');
    expect(chart.day.ganTenGod).toBe('日元');
    expect(chart.hour!.ganTenGod).toBe('偏印');
  });

  it('地支の十神が一致する', () => {
    expect(chart.year.zhiTenGod).toBe('偏財');
    expect(chart.month.zhiTenGod).toBe('偏官');
    expect(chart.day.zhiTenGod).toBe('偏官');
    expect(chart.hour!.zhiTenGod).toBe('偏印');
  });

  it('蔵干が余気→中気→本気の順で並ぶ', () => {
    expect(chart.year.hidden.map((h) => h.gan).join('')).toBe('丙己丁');
    expect(chart.month.hidden.map((h) => h.gan).join('')).toBe('癸辛己');
    expect(chart.day.hidden.map((h) => h.gan).join('')).toBe('丁乙己');
    expect(chart.hour!.hidden.map((h) => h.gan).join('')).toBe('庚辛');
  });

  it('五行の単純カウントが 木0 火1 土2 金2 水3 になる', () => {
    const counts = Object.fromEntries(chart.elements.map((e) => [e.element, e.simple]));
    expect(counts).toEqual({ wood: 0, fire: 1, earth: 2, metal: 2, water: 3 });
  });

  it('五行の加重カウントの合計が 8 になる', () => {
    const total = chart.elements.reduce((s, e) => s + e.weighted, 0);
    expect(total).toBeCloseTo(8, 1);
  });

  it('十二運星が一致する', () => {
    expect(chart.year.stage).toBe('絶');
    expect(chart.month.stage).toBe('冠帯');
    expect(chart.day.stage).toBe('墓');
    expect(chart.hour!.stage).toBe('病');
  });

  it('納音が一致する', () => {
    expect(chart.year.naYin).toBe('楊柳木');
    expect(chart.month.naYin).toBe('桑柘木');
    expect(chart.day.naYin).toBe('楊柳木');
    expect(chart.hour!.naYin).toBe('石榴木');
  });

  it('空亡が一致する（年柱・日柱ともに申酉）', () => {
    expect(chart.year.xunKong.join('')).toBe('申酉');
    expect(chart.day.xunKong.join('')).toBe('申酉');
    expect(chart.month.xunKong.join('')).toBe('寅卯');
    expect(chart.hour!.xunKong.join('')).toBe('子丑');
  });

  it('月令が癸になる（小寒から4.5日で、丑の余気 癸 が司令）', () => {
    expect(chart.meta.monthRuler).toBe('癸');
    expect(chart.meta.daysFromJie).toBeGreaterThan(4);
    expect(chart.meta.daysFromJie).toBeLessThan(5);
  });

  it('直前の節が小寒で、日本時間で 2003年01月06日 03:27 になる', () => {
    expect(chart.meta.prevJie.name).toBe('小寒');
    expect(chart.meta.prevJie.localDateTime).toBe('2003年01月06日 03:27');
    expect(chart.meta.nextJie.name).toBe('立春');
  });

  it('沖(丑未) と 害(午丑) が検出される', () => {
    const chong = chart.relations.find((r) => r.kind === '沖');
    expect(chong?.chars.sort().join('')).toBe(['丑', '未'].sort().join(''));
    expect(chong?.slots.sort()).toEqual(['day', 'month']);

    const hai = chart.relations.find((r) => r.kind === '害');
    expect(hai?.chars.sort().join('')).toBe(['午', '丑'].sort().join(''));
    expect(hai?.slots.sort()).toEqual(['month', 'year']);
  });

  it('午未の支合と、酉丑の半合も検出される', () => {
    expect(chart.relations.some((r) => r.kind === '支合' && r.label === '午未')).toBe(true);
    expect(chart.relations.some((r) => r.kind === '半合')).toBe(true);
  });

  it('刑・破・天干の合沖は成立しない', () => {
    expect(chart.relations.some((r) => r.kind === '刑' || r.kind === '自刑')).toBe(false);
    expect(chart.relations.some((r) => r.kind === '破')).toBe(false);
    expect(chart.relations.some((r) => r.kind === '天干合' || r.kind === '天干沖')).toBe(false);
  });

  it('大運が順行で、起運は 8.3 歳', () => {
    expect(chart.luck.forward).toBe(true);
    expect(chart.luck.startAge).toBeCloseTo(8.3, 1);
  });

  it('大運が 甲寅(2011) → 乙卯(2021) → 丙辰(2031) と巡る', () => {
    const first3 = chart.luck.entries.slice(0, 3);
    expect(first3.map((e) => e.gan + e.zhi)).toEqual(['甲寅', '乙卯', '丙辰']);
    expect(first3.map((e) => e.startYear)).toEqual([2011, 2021, 2031]);
  });

  it('乙卯大運の流年が 2021 辛丑 から始まり 2026 は丙午', () => {
    const yiMao = chart.luck.entries.find((e) => e.gan + e.zhi === '乙卯')!;
    expect(yiMao.liuNian[0].year).toBe(2021);
    expect(yiMao.liuNian[0].gan + yiMao.liuNian[0].zhi).toBe('辛丑');
    const y2026 = yiMao.liuNian.find((n) => n.year === 2026)!;
    expect(y2026.gan + y2026.zhi).toBe('丙午');
  });

  it('胎元・命宮が一致する', () => {
    expect(chart.meta.taiYuan).toBe('甲辰');
    expect(chart.meta.mingGong).toBe('丁未');
  });

  it('真太陽時が 17時台になり、時支が酉に入る', () => {
    expect(chart.meta.standardDateTime).toBe('2003年01月10日 16:59');
    expect(chart.meta.trueSolarDateTime).toMatch(/^2003年01月10日 17:1\d$/);
    // 経度補正は +19分ほど、均時差は −7分ほど
    expect(chart.meta.correction!.longitudeMinutes).toBeCloseTo(19.1, 0);
    expect(chart.meta.correction!.equationOfTimeMinutes).toBeLessThan(-5);
  });

  it('満年齢と数え年が出る', () => {
    expect(chart.age.actual).toBe(23);
    expect(chart.age.traditional).toBe(24);
  });

  it('日干は身強寄りと判定される（水が3・金が2で日干を支える）', () => {
    expect(chart.strength.hasMonthSupport).toBe(true);
    expect(chart.strength.hasRoot).toBe(true);
    expect(['身強', '極身強']).toContain(chart.strength.verdict);
  });
});

describe('buildChart — 入力のバリエーション', () => {
  it('旧暦 2002年12月08日 で入力しても同じ命式になる', () => {
    const lunar = buildChart(
      { ...GOLDEN, calendar: 'lunar', year: 2002, month: 12, day: 8 },
      new Date('2026-08-08T00:00:00Z')
    );
    expect(lunar.year.gan + lunar.year.zhi).toBe('壬午');
    expect(lunar.month.gan + lunar.month.zhi).toBe('癸丑');
    expect(lunar.day.gan + lunar.day.zhi).toBe('癸未');
    expect(lunar.hour!.gan + lunar.hour!.zhi).toBe('辛酉');
  });

  it('真太陽時補正を切ると 16:59 のままとなり、時柱が庚申に変わる', () => {
    const raw = buildChart({
      ...GOLDEN,
      options: { ...GOLDEN.options, trueSolarTime: false },
    });
    expect(raw.meta.trueSolarDateTime).toBe('2003年01月10日 16:59');
    expect(raw.hour!.gan + raw.hour!.zhi).toBe('庚申');
    // 時柱以外は補正の有無に左右されない
    expect(raw.day.gan + raw.day.zhi).toBe('癸未');
    expect(raw.month.gan + raw.month.zhi).toBe('癸丑');
  });

  it('時刻不明なら時柱が出ず、他の三柱は変わらない', () => {
    const noTime = buildChart({ ...GOLDEN, time: { kind: 'unknown' } });
    expect(noTime.hour).toBeNull();
    expect(noTime.pillars).toHaveLength(3);
    expect(noTime.meta.mingGong).toBeNull();
    expect(noTime.meta.trueSolarDateTime).toBeNull();
    expect(noTime.day.gan + noTime.day.zhi).toBe('癸未');
  });

  it('時支だけを指定した場合は補正を掛けずにその時支を使う', () => {
    const byZhi = buildChart({ ...GOLDEN, time: { kind: 'zhi', zhi: '酉' } });
    expect(byZhi.hour!.gan + byZhi.hour!.zhi).toBe('辛酉');
    expect(byZhi.meta.correction).toBeNull();
  });

  it('女性は逆行の大運になる（陽年生まれ）', () => {
    const female = buildChart({ ...GOLDEN, gender: 'female' });
    expect(female.luck.forward).toBe(false);
    expect(female.luck.entries[0].gan + female.luck.entries[0].zhi).toBe('壬子');
  });
});

describe('buildChart — 境界のケース', () => {
  it('立春の直前に生まれると前年の年柱になる', () => {
    // 立春 2003-02-04 14:05（北京時間）＝ 日本時間 15:05
    const before = buildChart({
      ...GOLDEN,
      month: 2,
      day: 4,
      time: { kind: 'hm', hour: 14, minute: 0 },
    });
    const after = buildChart({
      ...GOLDEN,
      month: 2,
      day: 4,
      time: { kind: 'hm', hour: 16, minute: 0 },
    });
    expect(before.year.gan + before.year.zhi).toBe('壬午');
    expect(after.year.gan + after.year.zhi).toBe('癸未');
    expect(before.month.zhi).toBe('丑');
    expect(after.month.zhi).toBe('寅');
  });

  it('早子時説では23時台が翌日の日柱になり、夜子時説では当日のまま', () => {
    const base = {
      ...GOLDEN,
      time: { kind: 'hm' as const, hour: 23, minute: 30 },
      // 23時台の判定を補正でぶらさないよう、補正は切っておく
      options: { ...GOLDEN.options, trueSolarTime: false },
    };
    const early = buildChart({ ...base, options: { ...base.options, lateZi: false } });
    const late = buildChart({ ...base, options: { ...base.options, lateZi: true } });

    expect(early.day.gan + early.day.zhi).toBe('甲申');
    expect(early.hour!.gan + early.hour!.zhi).toBe('甲子');

    expect(late.day.gan + late.day.zhi).toBe('癸未');
    expect(late.hour!.gan + late.hour!.zhi).toBe('壬子');
  });

  it('閏月の入力を受け付ける（2020年 閏4月）', () => {
    const leap = buildChart({
      ...GOLDEN,
      calendar: 'lunar-leap',
      year: 2020,
      month: 4,
      day: 1,
    });
    expect(leap.meta.solarDate).toBe('2020年05月23日');
  });
});
