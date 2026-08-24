import { describe, expect, it } from 'vitest';

import { TOKYO } from '../../../data/cities';
import type { BirthInput } from '../../types';
import { buildHoroscope } from '../chart';
import { houseOf } from '../houses';
import { separation } from '../math';
import { DEFAULT_SYNASTRY_ORBS, compareHoroscopes, synastrySummary } from '../synastry';
import { defaultHoroscopeOptions } from '../types';

const options = defaultHoroscopeOptions();

const SELF: BirthInput = {
  name: '甲野',
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

const OTHER: BirthInput = {
  ...SELF,
  name: '乙山',
  gender: 'female',
  year: 1988,
  month: 7,
  day: 20,
  time: { kind: 'hm', hour: 6, minute: 30 },
};

const self = buildHoroscope(SELF, options);
const other = buildHoroscope(OTHER, options);
const synastry = compareHoroscopes(self, other, options);

describe('シナストリー', () => {
  it('自分側が a、相手側が b になる', () => {
    expect(synastry.aspects.length).toBeGreaterThan(0);
    for (const a of synastry.aspects) {
      const selfPoint =
        self.placements.find((p) => p.id === a.a) ??
        (a.a === 'asc' ? { lon: self.angles!.asc.lon } : null) ??
        (a.a === 'mc' ? { lon: self.angles!.mc.lon } : null);
      const otherPoint =
        other.placements.find((p) => p.id === a.b) ??
        (a.b === 'asc' ? { lon: other.angles!.asc.lon } : null) ??
        (a.b === 'mc' ? { lon: other.angles!.mc.lon } : null);
      expect(selfPoint).not.toBeNull();
      expect(otherPoint).not.toBeNull();
      // 実際にその角度が成立している
      expect(Math.abs(separation(selfPoint!.lon, otherPoint!.lon) - a.exact)).toBeCloseTo(a.orb, 9);
    }
  });

  it('同じ天体どうしも見る（太陽と太陽など）', () => {
    const same = compareHoroscopes(self, self, options);
    const sunSun = same.aspects.find((a) => a.a === 'sun' && a.b === 'sun');
    expect(sunSun).toMatchObject({ kind: 'conjunction' });
    expect(sunSun!.orb).toBeCloseTo(0, 9);
  });

  it('二人の図はどちらも止まっているので、接近・分離は出さない', () => {
    expect(synastry.aspects.every((a) => a.applying === null)).toBe(true);
  });

  it('感受点どうしも見る（自分のASCと相手の太陽など）', () => {
    // 出生図の中と違い、二人のあいだでは ASC どうしにも意味がある
    const angles = compareHoroscopes(self, other, options).aspects.filter(
      (a) => a.a === 'asc' || a.b === 'asc'
    );
    expect(angles.length).toBeGreaterThan(0);
  });

  it('相手の天体が、自分のハウスのどこに落ちるかを出す', () => {
    expect(synastry.otherInSelfHouses).toHaveLength(other.placements.length);
    for (const o of synastry.otherInSelfHouses!) {
      const lon = other.placements.find((p) => p.id === o.body)!.lon;
      expect(o.house).toBe(houseOf(lon, self.houses!.cusps));
    }
    // 逆向きも出す
    expect(synastry.selfInOtherHouses).toHaveLength(self.placements.length);
  });

  it('出生時刻が分からない相手なら、その向きのハウスは出さない', () => {
    const noTime = buildHoroscope({ ...OTHER, time: { kind: 'unknown' } }, options);
    const s = compareHoroscopes(self, noTime, options);
    // 自分のハウスはあるので、相手の天体は落とせる
    expect(s.otherInSelfHouses).not.toBeNull();
    // 相手にハウスが無いので、自分の天体は落とせない
    expect(s.selfInOtherHouses).toBeNull();
  });

  it('読み所は、太陽・月・ASC・金星・火星どうしに絞る', () => {
    const keys = ['太陽', '月', 'アセンダント', '金星', '火星'];
    for (const h of synastry.highlights) {
      if (h.title.includes('室に落ちる')) continue;
      expect(keys.some((k) => h.title.includes(k))).toBe(true);
    }
  });

  it('オーブは出生図の中どうしより狭い', () => {
    // 14 × 14 の組み合わせを見るので、出生図と同じ幅で取ると本数が多すぎて読めなくなる
    expect(DEFAULT_SYNASTRY_ORBS.conjunction).toBeLessThan(options.orbs.conjunction);
    expect(synastry.aspects.length).toBeLessThan(
      compareHoroscopes(self, other, { ...options, orbs: DEFAULT_SYNASTRY_ORBS }).aspects.length + 1
    );
    // 成立しているものは、すべて狭いほうのオーブに収まっている
    for (const a of synastry.aspects) {
      const luminary = ['sun', 'moon'].includes(a.a) || ['sun', 'moon'].includes(a.b);
      const allowed =
        DEFAULT_SYNASTRY_ORBS[a.kind] + (luminary ? options.luminaryOrbBonus : 0);
      expect(a.orb).toBeLessThanOrEqual(allowed);
    }
  });

  it('読み所の文に、同じ語が二重に出ない', () => {
    for (const h of synastry.highlights) {
      expect(h.body).not.toContain('アセンダントはアセンダントは');
      expect(h.body).not.toContain('MCはMCは');
      // 同じ点どうしは、同じ説明を二度書かない
      expect(h.body).not.toContain('外から見えるかたち、アセンダントは外から見えるかたち');
      // 語彙集の 2 文目まで引き込まない
      expect(h.body).not.toContain('何をもって自分とするか');
    }
  });

  it('同じ点どうしの読み所は、ひとまとめに書く', () => {
    const same = compareHoroscopes(self, self, options).highlights.find((h) =>
      h.title.includes('の太陽 × ')
    );
    expect(same?.body).toContain('どちらも太陽で、意志と目的を担う');
  });

  it('調和と緊張を分けて数えるが、点数にはしない', () => {
    expect(synastry.soft.length + synastry.hard.length).toBeLessThanOrEqual(
      synastry.aspects.length
    );
    // コンジャンクションはどちらでもない
    expect(synastry.aspects.some((a) => a.tone === 'neutral')).toBe(true);
  });
});

describe('シナストリーの書き出し', () => {
  const text = synastrySummary(synastry);

  it('二人の名前と、太陽・月・ASC が頭に出る', () => {
    expect(text).toContain('## 甲野と乙山の、出生図どうしの角度');
    expect(text).toContain('- 甲野: 太陽 山羊座 10°25′');
    expect(text).toContain('- 乙山: 太陽');
  });

  it('角度と、天体の落ちる室が両方向とも並ぶ', () => {
    expect(text).toContain('### 成立している角度');
    expect(text).toContain('乙山の天体が、甲野のどの室に落ちるか');
    expect(text).toContain('甲野の天体が、乙山のどの室に落ちるか');
  });

  it('点数にしないよう頼む', () => {
    expect(text).toContain('相性を点数にしたり');
    expect(text).toContain('調和の角度が多いことが良い関係を意味するわけではない');
  });

  it('名前が無ければ「自分」「相手」で通す', () => {
    const anonymous = compareHoroscopes(
      buildHoroscope({ ...SELF, name: '' }, options),
      buildHoroscope({ ...OTHER, name: '  ' }, options),
      options
    );
    expect(synastrySummary(anonymous)).toContain('## 自分と相手の、出生図どうしの角度');
  });
});
