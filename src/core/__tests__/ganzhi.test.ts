import { describe, expect, it } from 'vitest';

import { GAN, NA_YIN, ZHI, ZHI_HIDDEN } from '../constants';
import {
  ganZhiIndex,
  hourGan,
  mingGong,
  naYin,
  taiYuan,
  tenGod,
  twelveStage,
  xunKong,
  zhiFromHour,
} from '../ganzhi';
import { findRelations } from '../relations';
import { equationOfTime, meridianOf } from '../solarTime';

describe('干支の基本演算', () => {
  it('六十干支の通し番号が一巡する', () => {
    expect(ganZhiIndex('甲', '子')).toBe(0);
    expect(ganZhiIndex('乙', '丑')).toBe(1);
    expect(ganZhiIndex('癸', '亥')).toBe(59);
    expect(ganZhiIndex('癸', '未')).toBe(19);
    // 陽干は陽支としか、陰干は陰支としか組まない
    expect(() => ganZhiIndex('甲', '丑')).toThrow();
  });

  it('蔵干の日数の合計はどの地支でも30になる', () => {
    for (const z of ZHI) {
      const total = ZHI_HIDDEN[z].reduce((s, h) => s + h.days, 0);
      expect(total, `${z}の蔵干`).toBe(30);
    }
  });

  it('納音は30種で、干支2つずつが同じ名前になる', () => {
    expect(NA_YIN).toHaveLength(30);
    expect(naYin('甲', '子')).toBe(naYin('乙', '丑'));
    expect(naYin('壬', '午')).toBe('楊柳木');
    expect(naYin('庚', '申')).toBe('石榴木');
    expect(naYin('壬', '戌')).toBe('大海水');
  });

  it('空亡は旬ごとに2支ずつ、10種すべての旬で正しい', () => {
    expect(xunKong('甲', '子').join('')).toBe('戌亥');
    expect(xunKong('甲', '戌').join('')).toBe('申酉');
    expect(xunKong('癸', '未').join('')).toBe('申酉');
    expect(xunKong('甲', '申').join('')).toBe('午未');
    expect(xunKong('甲', '寅').join('')).toBe('子丑');
    expect(xunKong('甲', '辰').join('')).toBe('寅卯');
  });

  it('十神は日干と同じ天干で比肩になり、全10種がそろう', () => {
    for (const g of GAN) {
      expect(tenGod(g, g)).toBe('比肩');
    }
    const all = new Set(GAN.map((g) => tenGod('癸', g)));
    expect(all.size).toBe(10);
  });

  it('十二運は日干ごとに12支で12種すべてを一巡する', () => {
    for (const g of GAN) {
      const stages = new Set(ZHI.map((z) => twelveStage(g, z)));
      expect(stages.size, `${g}日の十二運`).toBe(12);
    }
    // 建禄は日干と同じ五行の旺地に来る
    expect(twelveStage('甲', '寅')).toBe('建禄');
    expect(twelveStage('癸', '子')).toBe('建禄');
    expect(twelveStage('庚', '申')).toBe('建禄');
  });

  it('五鼠遁で時干が決まる', () => {
    expect(hourGan('甲', '子')).toBe('甲');
    expect(hourGan('己', '子')).toBe('甲');
    expect(hourGan('癸', '子')).toBe('壬');
    expect(hourGan('癸', '酉')).toBe('辛');
    expect(hourGan('丁', '亥')).toBe('辛');
  });

  it('時支は23時台と0時台がともに子になる', () => {
    expect(zhiFromHour(23)).toBe('子');
    expect(zhiFromHour(0)).toBe('子');
    expect(zhiFromHour(1)).toBe('丑');
    expect(zhiFromHour(11)).toBe('午');
    expect(zhiFromHour(12)).toBe('午');
    expect(zhiFromHour(13)).toBe('未');
  });

  it('胎元・命宮が求まる', () => {
    expect(taiYuan('癸', '丑')).toBe('甲辰');
    expect(mingGong('壬', '丑', '酉')).toBe('丁未');
  });
});

describe('干支の関係', () => {
  const p = (slot: 'year' | 'month' | 'day' | 'hour', gz: string) => ({
    slot,
    gan: gz.charAt(0) as never,
    zhi: gz.charAt(1) as never,
  });

  it('六合・六沖・六害・六破をそれぞれ拾う', () => {
    const kinds = (a: string, b: string) =>
      findRelations([p('year', a), p('day', b)]).map((r) => r.kind);

    expect(kinds('甲子', '己丑')).toContain('支合'); // 子丑
    expect(kinds('甲子', '庚午')).toContain('沖'); // 子午
    expect(kinds('甲子', '辛未')).toContain('害'); // 子未
    expect(kinds('甲子', '癸酉')).toContain('破'); // 子酉
  });

  it('天干五合と天干沖を拾う', () => {
    const rels = findRelations([p('year', '甲子'), p('day', '己丑')]);
    const he = rels.find((r) => r.kind === '天干合');
    expect(he?.producedElement).toBe('earth');

    const chong = findRelations([p('year', '甲子'), p('day', '庚午')]);
    expect(chong.some((r) => r.kind === '天干沖')).toBe(true);
    // 戊・己は中央の土なので沖の相手を持たない
    const wuji = findRelations([p('year', '戊子'), p('day', '己丑')]);
    expect(wuji.some((r) => r.kind === '天干沖')).toBe(false);
  });

  it('三合が揃うと三合になり、そのぶんの半合は重複して出さない', () => {
    const rels = findRelations([p('year', '甲申'), p('month', '丙子'), p('day', '戊辰')]);
    const sanHe = rels.find((r) => r.kind === '三合');
    expect(sanHe?.producedElement).toBe('water');
    expect(rels.some((r) => r.kind === '半合')).toBe(false);
  });

  it('二支だけなら半合になる', () => {
    const rels = findRelations([p('year', '甲申'), p('day', '丙子')]);
    const half = rels.find((r) => r.kind === '半合');
    expect(half?.producedElement).toBe('water');
  });

  it('方合を拾う', () => {
    const rels = findRelations([p('year', '甲寅'), p('month', '丁卯'), p('day', '戊辰')]);
    const fang = rels.find((r) => r.kind === '方合');
    expect(fang?.producedElement).toBe('wood');
  });

  it('三刑は三支そろったときだけ、子卯と自刑は二支で成立する', () => {
    const two = findRelations([p('year', '甲寅'), p('day', '己巳')]);
    expect(two.some((r) => r.kind === '刑')).toBe(false);

    const three = findRelations([p('year', '甲寅'), p('month', '己巳'), p('day', '庚申')]);
    expect(three.some((r) => r.kind === '刑')).toBe(true);

    const ziMao = findRelations([p('year', '甲子'), p('day', '丁卯')]);
    expect(ziMao.some((r) => r.kind === '刑')).toBe(true);

    const ziXing = findRelations([p('year', '甲辰'), p('day', '丙辰')]);
    expect(ziXing.some((r) => r.kind === '自刑')).toBe(true);
    // 自刑を持つのは辰午酉亥だけ
    expect(findRelations([p('year', '甲子'), p('day', '丙子')]).some((r) => r.kind === '自刑')).toBe(
      false
    );
  });
});

describe('真太陽時の補正', () => {
  it('標準時子午線がタイムゾーンから求まる', () => {
    expect(meridianOf(540)).toBe(135);
    expect(meridianOf(480)).toBe(120);
    expect(meridianOf(0)).toBe(0);
    expect(meridianOf(-300)).toBe(-75);
  });

  it('均時差は年間で概ね −14分〜+16分に収まる', () => {
    const values: number[] = [];
    for (let month = 1; month <= 12; month++) {
      for (const day of [1, 15]) values.push(equationOfTime(2003, month, day));
    }
    expect(Math.min(...values)).toBeGreaterThan(-15);
    expect(Math.max(...values)).toBeLessThan(17);
  });

  it('均時差は2月中旬に最小、11月初旬に最大へ向かう', () => {
    expect(equationOfTime(2003, 2, 11)).toBeLessThan(-13);
    expect(equationOfTime(2003, 11, 3)).toBeGreaterThan(15);
    // 4月中旬と9月初旬はほぼゼロ
    expect(Math.abs(equationOfTime(2003, 4, 16))).toBeLessThan(1.5);
  });
});
