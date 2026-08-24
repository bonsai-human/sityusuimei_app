import * as Astronomy from 'astronomy-engine';
import { Solar } from 'lunar-typescript';
import { describe, expect, it } from 'vitest';

import { TOKYO } from '../../../data/cities';
import { equationOfTime, meridianOf } from '../../solarTime';
import type { BirthInput, BirthPlace } from '../../types';
import { localSiderealDegrees } from '../angles';
import { buildHoroscope } from '../chart';
import { defaultHoroscopeOptions } from '../types';
import { norm180, norm360, separation } from '../math';
import type { BodyId } from '../constants';

const BASE: BirthInput = {
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

const SYDNEY: BirthPlace = {
  label: 'シドニー',
  longitude: 151.2093,
  latitude: -33.8688,
  tzOffsetMinutes: 600,
};

function lonOf(h: ReturnType<typeof buildHoroscope>, id: BodyId): number {
  return h.placements.find((p) => p.id === id)!.lon;
}

/**
 * ゴールデンケース。
 *
 * 外部の天体暦と突き合わせられる環境が無いので、値そのものは
 * 「astronomy-engine から取り出したもの」を固定している。取り出し方が正しいことは
 * `horoscope.test.ts` の側で、分点・朔・地平座標といった独立に求まる量で確かめてある。
 * ここで固定しているのは、そこから先の組み立てが変わっていないこと。
 */
describe('1990年1月1日 12:00 東京', () => {
  const h = buildHoroscope(BASE);

  it('10 天体とドラゴンヘッド・リリスの黄経', () => {
    const expected: Record<string, number> = {
      sun: 280.432,
      moon: 328.2302,
      mercury: 295.7679,
      venus: 306.2671,
      mars: 249.7362,
      jupiter: 95.1992,
      saturn: 285.613,
      uranus: 275.7618,
      neptune: 282.0234,
      pluto: 227.0835,
      northNode: 318.4515,
      lilith: 216.4656,
    };
    for (const [id, lon] of Object.entries(expected)) {
      expect(lonOf(h, id as BodyId)).toBeCloseTo(lon, 2);
    }
  });

  it('サインと度数', () => {
    const sun = h.placements.find((p) => p.id === 'sun')!;
    expect(sun.position).toMatchObject({ sign: 9, deg: 10, min: 25 });
    // 1989〜1990 年の山羊座は、土星・天王星・海王星が集まっていた
    expect(h.stelliums[0]).toMatchObject({
      kind: 'sign',
      index: 9,
      bodies: ['sun', 'mercury', 'saturn', 'uranus', 'neptune'],
    });
  });

  it('逆行している天体', () => {
    const retro = h.placements.filter((p) => p.retrograde).map((p) => p.id);
    expect(retro).toEqual(['mercury', 'venus', 'jupiter']);
  });

  it('感受点とハウスのカスプ', () => {
    expect(h.angles!.asc.lon).toBeCloseTo(23.7304, 2);
    expect(h.angles!.mc.lon).toBeCloseTo(284.0682, 2);
    expect(h.angles!.vertex.lon).toBeCloseTo(190.3757, 2);
    expect(h.angles!.dsc.lon).toBeCloseTo(203.7304, 2);
    expect(h.angles!.ic.lon).toBeCloseTo(104.0682, 2);
    expect(h.houses!.cusps.map((c) => Number(c.toFixed(2)))).toEqual([
      23.73, 57.42, 81.96, 104.07, 128.31, 159.96, 203.73, 237.42, 261.96, 284.07, 308.31,
      339.96,
    ]);
  });

  /**
   * 感受点は時刻と経度に敏感で、他の資料と数値が合わないときの原因はたいていここにある。
   * どちらも地方恒星時を通して効くので、動く量の比は必ず一定になる。
   * その比を固定しておくと、ずれの出どころが時刻・経度なのか、それ以外なのかを切り分けられる。
   */
  it('感受点は時刻と経度に敏感で、どちらも同じ比で効く', () => {
    const perMinute = h.meta.anglesPerMinute!;
    expect(perMinute.asc).toBeCloseTo(0.375, 2);
    expect(perMinute.mc).toBeCloseTo(0.233, 2);

    // 経度を 0.25 度ずらすのは、時刻を 1 分ずらすのとほぼ同じ（地球は 1 分で 0.2507 度回る）
    const east = buildHoroscope({
      ...BASE,
      place: { ...TOKYO, longitude: TOKYO.longitude + 0.25 },
    });
    expect(east.angles!.asc.lon - h.angles!.asc.lon).toBeCloseTo(perMinute.asc, 2);
    expect(east.angles!.mc.lon - h.angles!.mc.lon).toBeCloseTo(perMinute.mc, 2);

    // 緯度はアセンダントにだけ効き、MC には効かない
    const north = buildHoroscope({
      ...BASE,
      place: { ...TOKYO, latitude: TOKYO.latitude! + 0.25 },
    });
    expect(north.angles!.mc.lon).toBeCloseTo(h.angles!.mc.lon, 9);
    expect(north.angles!.asc.lon).not.toBeCloseTo(h.angles!.asc.lon, 3);
  });

  it('全体の傾き', () => {
    expect(h.dayChart).toBe(true);
    // アセンダントが牡羊座なので、その支配星は火星
    expect(h.ascRuler!.body).toBe('mars');
    expect(h.elements.map((e) => `${e.key}:${e.count}`)).toEqual([
      'fire:1',
      'earth:5',
      'air:2',
      'water:2',
    ]);
    // 10 天体をもれなく数えている
    expect(h.elements.reduce((n, e) => n + e.count, 0)).toBe(10);
    expect(h.qualities.reduce((n, e) => n + e.count, 0)).toBe(10);
    // 太陽・月・アセンダントを 2 つぶんに数えるので、重みつきは 13
    expect(h.elements.reduce((n, e) => n + e.weighted, 0)).toBe(14);
  });

  it('半球の偏りは、東西と南北でそれぞれ 10 天体に分かれる', () => {
    const { east, west, south, north } = h.hemispheres!;
    expect(east + west).toBe(10);
    expect(south + north).toBe(10);
  });
});

describe('時刻の扱い', () => {
  /**
   * 正午に生まれた人の太陽は、ほぼ南中している。
   *
   * ずれは「経度差 ＋ 均時差」ぶんだけのはずで、その 2 つは四柱推命側の
   * `solarTime.ts`（NOAA の近似式）が別に持っている。世界時への直し方、恒星時、
   * 黄経の取り出しのどれかを間違えていれば、ここが合わなくなる。
   */
  it('正午生まれの太陽の時角は、経度差と均時差のぶんだけずれる', () => {
    for (const place of [TOKYO, SYDNEY, { ...TOKYO, label: '那覇', longitude: 127.6809, latitude: 26.2124 }]) {
      const h = buildHoroscope({ ...BASE, place });
      const time = Astronomy.MakeTime(
        new Date(Date.UTC(1990, 0, 1, 12, 0) - place.tzOffsetMinutes * 60_000)
      );

      // 太陽の赤経と地方恒星時の差が、太陽の時角
      const sunEquatorial = Astronomy.Equator(
        Astronomy.Body.Sun,
        time,
        new Astronomy.Observer(place.latitude!, place.longitude, 0),
        true,
        true
      );
      const lst = localSiderealDegrees(time, place.longitude);
      const hourAngle = norm180(lst - sunEquatorial.ra * 15);

      // 図の側も、同じ瞬間から同じ恒星時を出している
      expect(h.meta.localSiderealTime!).toBeCloseTo(lst, 9);

      // 時計の正午に対して、視太陽時がどれだけ進んでいるか（分）
      const ahead =
        (place.longitude - meridianOf(place.tzOffsetMinutes)) * 4 +
        equationOfTime(1990, 1, 1, 12);
      // 4 分で 1 度。均時差の近似式（NOAA）の精度が 20〜30 秒あるので、
      // 突き合わせの許容もそのぶん（0.15 度）取る。1 時間の取り違えなら 15 度ずれる
      expect(Math.abs(hourAngle - ahead / 4)).toBeLessThan(0.15);
    }
  });

  it('サマータイムの 1 時間を戻すので、同じ瞬間なら同じ図になる', () => {
    const normal = buildHoroscope(BASE);
    const summer = buildHoroscope({
      ...BASE,
      time: { kind: 'hm', hour: 13, minute: 0 },
      dst: true,
    });
    expect(summer.placements.map((p) => p.lon)).toEqual(normal.placements.map((p) => p.lon));
    expect(summer.angles!.asc.lon).toEqual(normal.angles!.asc.lon);
  });

  it('別の標準時の土地でも、同じ瞬間なら天体の位置は変わらない', () => {
    // 東京の 12:00（UT 03:00）と、ロンドンの 03:00（UT 03:00）
    const tokyo = buildHoroscope(BASE);
    const london = buildHoroscope({
      ...BASE,
      time: { kind: 'hm', hour: 3, minute: 0 },
      place: { label: 'ロンドン', longitude: -0.1276, latitude: 51.5074, tzOffsetMinutes: 0 },
    });
    for (const p of tokyo.placements) {
      expect(lonOf(london, p.id)).toBeCloseTo(p.lon, 9);
    }
    // 見上げる向きは違うので、アセンダントは別物になる
    expect(separation(london.angles!.asc.lon, tokyo.angles!.asc.lon)).toBeGreaterThan(10);
  });

  it('真太陽時の設定は、ホロスコープには効かない', () => {
    // 経度補正も均時差も、四柱推命の日柱・時柱のためのもの。天体の位置には掛けない
    const off = buildHoroscope({
      ...BASE,
      options: { ...BASE.options, trueSolarTime: false, equationOfTime: false },
    });
    const on = buildHoroscope(BASE);
    expect(off.placements.map((p) => p.lon)).toEqual(on.placements.map((p) => p.lon));
    expect(off.angles!.asc.lon).toEqual(on.angles!.asc.lon);
  });

  it('時支だけの指定では、その刻のまん中で組み、ずれを断る', () => {
    const h = buildHoroscope({ ...BASE, time: { kind: 'zhi', zhi: '午' } });
    expect(h.meta.timePrecision).toBe('zhi');
    expect(h.meta.standardDateTime).toContain('12:00');
    expect(h.meta.notes.join()).toContain('15 度');
    expect(h.angles).not.toBeNull();
  });

  it('時刻が分からないときは、感受点とハウスを出さない', () => {
    const h = buildHoroscope({ ...BASE, time: { kind: 'unknown' } });
    expect(h.angles).toBeNull();
    expect(h.houses).toBeNull();
    expect(h.dayChart).toBeNull();
    expect(h.hemispheres).toBeNull();
    expect(h.ascRuler).toBeNull();
    expect(h.placements.every((p) => p.house === null)).toBe(true);
    expect(h.meta.notes.join()).toContain('アセンダント');
  });

  it('時刻が分からないときは、その日のうちに動く幅を添える', () => {
    const h = buildHoroscope({ ...BASE, time: { kind: 'unknown' } });
    const moon = h.placements.find((p) => p.id === 'moon')!;
    expect(moon.range!.from).toBeCloseTo(321.5566, 2);
    expect(moon.range!.to).toBeCloseTo(334.9529, 2);
    // 月は 1 日で 13 度あまり動くので、サインをまたぐこともある
    expect(norm360(moon.range!.to - moon.range!.from)).toBeGreaterThan(12);

    // 太陽は 1 日で 1 度ほどしか動かない
    const sun = h.placements.find((p) => p.id === 'sun')!;
    expect(norm360(sun.range!.to - sun.range!.from)).toBeLessThan(1.1);
  });

  it('旧暦で入れても、新暦に直した同じ日の図になる', () => {
    const lunar = Solar.fromYmd(1990, 1, 1).getLunar();
    const h = buildHoroscope({
      ...BASE,
      calendar: 'lunar',
      year: lunar.getYear(),
      month: lunar.getMonth(),
      day: lunar.getDay(),
    });
    expect(h.meta.standardDateTime).toBe('1990年01月01日 12:00');
    expect(lonOf(h, 'sun')).toBeCloseTo(lonOf(buildHoroscope(BASE), 'sun'), 9);
    expect(h.meta.notes.join()).toContain('新暦に直して');
  });

  it('天体暦の範囲外の年は、その旨のエラーにする', () => {
    expect(() => buildHoroscope({ ...BASE, year: 1600 })).toThrow(/1700/);
    expect(() => buildHoroscope({ ...BASE, year: 2300 })).toThrow(/2200/);
  });
});

describe('出生地', () => {
  it('緯度が無ければ、天体だけ出して感受点は出さない', () => {
    const h = buildHoroscope({
      ...BASE,
      place: { ...TOKYO, label: '座標を指定', latitude: null },
    });
    expect(h.angles).toBeNull();
    expect(h.houses).toBeNull();
    expect(h.placements).toHaveLength(12);
    expect(lonOf(h, 'sun')).toBeCloseTo(280.432, 3);
    expect(h.meta.notes.join()).toContain('緯度');
  });

  it('南半球でも組める', () => {
    const h = buildHoroscope({ ...BASE, place: SYDNEY });
    expect(h.angles!.asc.lon).toBeCloseTo(9.8524, 2);
    expect(h.angles!.mc.lon).toBeCloseTo(280.7376, 2);
    expect(h.houses!.system).toBe('placidus');
    // 12 本のカスプは黄道上を一周する（同じところに戻らない）
    const spans = h.houses!.cusps.map((c, i) =>
      norm360(h.houses!.cusps[(i + 1) % 12] - c)
    );
    expect(spans.reduce((a, b) => a + b, 0)).toBeCloseTo(360, 6);
    expect(Math.min(...spans)).toBeGreaterThan(0);
  });

  it('高緯度ではプラシーダスが組めないので、ホールサインに落とす', () => {
    const h = buildHoroscope({
      ...BASE,
      place: { label: 'トロムソ', longitude: 18.9553, latitude: 69.6492, tzOffsetMinutes: 60 },
    });
    expect(h.houses!.requested).toBe('placidus');
    expect(h.houses!.system).toBe('whole');
    expect(h.meta.notes.join()).toContain('プラシーダス');
  });

  it('赤道の近くでは、バーテックスを読まないよう断る', () => {
    const h = buildHoroscope({
      ...BASE,
      place: { label: 'シンガポール', longitude: 103.8198, latitude: 1.3521, tzOffsetMinutes: 480 },
    });
    expect(h.meta.notes.join()).toContain('バーテックス');
  });
});

describe('ハウスの方式', () => {
  it('ホールサインは 1 室がサインの頭から始まる', () => {
    const h = buildHoroscope(BASE, { ...defaultHoroscopeOptions(), houseSystem: 'whole' });
    expect(h.houses!.cusps[0]).toBe(0);
    expect(h.houses!.system).toBe('whole');
    // アセンダント（牡羊座 23 度）は 1 室に入る
    expect(h.placements.find((p) => p.id === 'sun')!.house).toBe(10);
  });

  it('イコールはアセンダントから 30 度ずつ', () => {
    const h = buildHoroscope(BASE, { ...defaultHoroscopeOptions(), houseSystem: 'equal' });
    expect(h.houses!.cusps[0]).toBeCloseTo(23.7304, 2);
    expect(h.houses!.cusps[6]).toBeCloseTo(203.7304, 2);
  });

  it('方式を変えると、天体の入るハウスも変わりうる', () => {
    const placidus = buildHoroscope(BASE);
    const whole = buildHoroscope(BASE, { ...defaultHoroscopeOptions(), houseSystem: 'whole' });
    const houses = (h: typeof placidus) => h.placements.map((p) => p.house).join();
    expect(houses(placidus)).not.toBe(houses(whole));
  });
});

describe('ドラゴンヘッド', () => {
  it('平均と真の交点を切り替えられる', () => {
    const mean = buildHoroscope(BASE);
    const t = buildHoroscope(BASE, { ...defaultHoroscopeOptions(), nodeKind: 'true' });
    expect(separation(lonOf(mean, 'northNode'), lonOf(t, 'northNode'))).toBeGreaterThan(0.01);
    expect(separation(lonOf(mean, 'northNode'), lonOf(t, 'northNode'))).toBeLessThan(1.8);
  });

  it('逆行の印は付けない（常に逆行しているため）', () => {
    const h = buildHoroscope(BASE);
    expect(h.placements.find((p) => p.id === 'northNode')!.retrograde).toBe(false);
    expect(h.placements.find((p) => p.id === 'northNode')!.speed).toBeLessThan(0);
  });
});

describe('アスペクト', () => {
  const h = buildHoroscope(BASE);

  it('感受点にかかるアスペクトも拾う', () => {
    expect(h.aspects.some((a) => a.a === 'asc' || a.b === 'asc')).toBe(true);
    expect(h.aspects.some((a) => a.a === 'mc' || a.b === 'mc')).toBe(true);
  });

  it('感受点どうしは見ない', () => {
    const angles = ['asc', 'mc'];
    expect(h.aspects.some((a) => angles.includes(a.a) && angles.includes(a.b))).toBe(false);
  });

  it('同じ組み合わせが二度出てこない', () => {
    const keys = h.aspects.map((a) => [a.a, a.b].sort().join('-'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('マイナーアスペクトを足すと本数が増える', () => {
    const more = buildHoroscope(BASE, { ...defaultHoroscopeOptions(), minorAspects: true });
    expect(more.aspects.length).toBeGreaterThan(h.aspects.length);
  });
});
