import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';

import { ascendant, localSiderealDegrees, midheaven, vertex } from '../angles';
import { findAspects, pairAspects, type AspectPoint } from '../aspects';
import {
  NO_REFRACTION,
  bodyState,
  meanLilith,
  meanNode,
  trueNode,
  trueObliquity,
} from '../bodies';
import { buildHouses, houseOf } from '../houses';
import { norm180, norm360, separation, signPosition } from '../math';
import { defaultHoroscopeOptions } from '../chart';

/**
 * 検算の当て。
 *
 * アセンダントもハウスも、自前の三角関数で閉じた式から出している。同じ式で検算しても
 * 意味が無いので、ここでは astronomy-engine の座標変換だけを使って
 * 「その黄経の点は、ほんとうに東の地平線にあるか」を幾何で確かめる。
 *
 * 天体の位置そのものは astronomy-engine が JPL の暦と突き合わせて検証しているので、
 * こちらでは「取り出し方を間違えていないか」を、独立に求まる瞬間（分点・朔）で確かめる。
 */
function horizontalOf(lon: number, time: Astronomy.AstroTime, lat: number, lng: number) {
  const observer = new Astronomy.Observer(lat, lng, 0);
  // 黄緯 0、その日の真の黄道 → その日の赤道 → 地平座標
  const ect = Astronomy.VectorFromSphere(new Astronomy.Spherical(0, lon, 1), time);
  const eqd = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(time), ect);
  const hor = Astronomy.RotateVector(Astronomy.Rotation_EQD_HOR(time, observer), eqd);
  // 大気差を入れると地平線が 0.48 度ほど持ち上がり、アセンダントと合わなくなる
  const s = Astronomy.HorizonFromVector(hor, NO_REFRACTION);
  return { altitude: s.lat, azimuth: s.lon, eqd };
}

/** その黄経の点の、赤経・赤緯・時角。 */
function equatorialOf(lon: number, time: Astronomy.AstroTime, lng: number) {
  const ect = Astronomy.VectorFromSphere(new Astronomy.Spherical(0, lon, 1), time);
  const eqd = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(time), ect);
  const sph = Astronomy.SphereFromVector(eqd);
  const ra = norm360(sph.lon);
  return { ra, dec: sph.lat, hourAngle: norm180(localSiderealDegrees(time, lng) - ra) };
}

const PLACES = [
  { name: '東京', lat: 35.6812, lng: 139.7671 },
  { name: 'ロンドン', lat: 51.5074, lng: -0.1276 },
  { name: 'シドニー（南半球）', lat: -33.8688, lng: 151.2093 },
  { name: 'シンガポール（赤道近く）', lat: 1.3521, lng: 103.8198 },
  { name: 'ホノルル（西経）', lat: 21.3069, lng: -157.8583 },
];

const MOMENTS = [
  new Date(Date.UTC(1990, 0, 1, 3, 0)),
  new Date(Date.UTC(1985, 5, 15, 18, 30)),
  new Date(Date.UTC(2003, 10, 7, 6, 45)),
  new Date(Date.UTC(2024, 2, 20, 12, 0)),
];

describe('黄道傾斜角', () => {
  it('いまの時代はおよそ 23.44 度で、少しずつ小さくなっている', () => {
    const now = trueObliquity(Astronomy.MakeTime(new Date(Date.UTC(2000, 0, 1))));
    const past = trueObliquity(Astronomy.MakeTime(new Date(Date.UTC(1900, 0, 1))));
    expect(now).toBeGreaterThan(23.4);
    expect(now).toBeLessThan(23.5);
    expect(past).toBeGreaterThan(now);
  });
});

describe('アセンダント', () => {
  for (const place of PLACES) {
    for (const moment of MOMENTS) {
      it(`${place.name} / ${moment.toISOString()} は東の地平線に来る`, () => {
        const time = Astronomy.MakeTime(moment);
        const obl = trueObliquity(time);
        const lst = localSiderealDegrees(time, place.lng);
        const asc = ascendant(lst, place.lat, obl);

        const { altitude, azimuth } = horizontalOf(asc, time, place.lat, place.lng);
        // 地平線の上にある（高度 0）
        expect(Math.abs(altitude)).toBeLessThan(0.02);
        // 東半分（方位 0〜180 度）にある。西の交点を掴んでいたらここで落ちる
        expect(azimuth).toBeGreaterThan(0);
        expect(azimuth).toBeLessThan(180);
      });
    }
  }
});

describe('MC', () => {
  for (const place of PLACES) {
    for (const moment of MOMENTS) {
      it(`${place.name} / ${moment.toISOString()} は子午線の上側に来る`, () => {
        const time = Astronomy.MakeTime(moment);
        const obl = trueObliquity(time);
        const lst = localSiderealDegrees(time, place.lng);
        const mc = midheaven(lst, obl);

        // 時角 0（南中）
        expect(Math.abs(equatorialOf(mc, time, place.lng).hourAngle)).toBeLessThan(0.01);
        // IC より高い位置にある
        const up = horizontalOf(mc, time, place.lat, place.lng).altitude;
        const down = horizontalOf(norm360(mc + 180), time, place.lat, place.lng).altitude;
        expect(up).toBeGreaterThan(down);
      });
    }
  }
});

describe('バーテックス', () => {
  // 赤道の近くでは黄道と東西の大円がほとんど重なり、交点が定まらないので外す
  for (const place of PLACES.filter((p) => Math.abs(p.lat) > 10)) {
    for (const moment of MOMENTS) {
      it(`${place.name} / ${moment.toISOString()} は真西を通る大円の上に来る`, () => {
        const time = Astronomy.MakeTime(moment);
        const obl = trueObliquity(time);
        const lst = localSiderealDegrees(time, place.lng);
        const vx = vertex(lst, place.lat, obl);

        // 東西と天頂を通る大円（プライムバーティカル）の、西側
        const { azimuth } = horizontalOf(vx, time, place.lat, place.lng);
        expect(Math.abs(azimuth - 270)).toBeLessThan(0.05);
      });
    }
  }
});

describe('プラシーダスのハウス', () => {
  const time = Astronomy.MakeTime(MOMENTS[0]);
  const obl = trueObliquity(time);
  const place = PLACES[0];
  const lst = localSiderealDegrees(time, place.lng);
  const asc = ascendant(lst, place.lat, obl);
  const mc = midheaven(lst, obl);
  const houses = buildHouses(
    'placidus',
    { ramc: lst, asc, mc, latitude: place.lat, obliquity: obl },
    280
  );

  it('1 室はアセンダント、10 室は MC、向かい合う室は 180 度違う', () => {
    expect(houses.cusps[0]).toBeCloseTo(asc, 9);
    expect(houses.cusps[9]).toBeCloseTo(mc, 9);
    for (let i = 0; i < 6; i++) {
      expect(separation(houses.cusps[i], houses.cusps[i + 6])).toBeCloseTo(180, 9);
    }
  });

  it('11 室・12 室は、半昼弧をちょうど 3 等分した位置に来る', () => {
    // 「MC から半昼弧の 1/3・2/3 だけ手前」という定義そのものを、
    // astronomy-engine で出した赤緯と時角から確かめる
    for (const [index, fraction] of [
      [10, 1 / 3],
      [11, 2 / 3],
    ] as const) {
      const { dec, hourAngle } = equatorialOf(houses.cusps[index], time, place.lng);
      const ad =
        (Math.asin(Math.tan((place.lat * Math.PI) / 180) * Math.tan((dec * Math.PI) / 180)) *
          180) /
        Math.PI;
      const semiDiurnalArc = 90 + ad;
      // カスプは MC より東（まだ南中していない）ので、時角は負
      expect(-hourAngle / semiDiurnalArc).toBeCloseTo(fraction, 6);
    }
  });

  it('2 室・3 室は、半夜弧を 3 等分した位置に来る', () => {
    for (const [index, fraction] of [
      [1, 2 / 3],
      [2, 1 / 3],
    ] as const) {
      const { dec, hourAngle } = equatorialOf(houses.cusps[index], time, place.lng);
      const ad =
        (Math.asin(Math.tan((place.lat * Math.PI) / 180) * Math.tan((dec * Math.PI) / 180)) *
          180) /
        Math.PI;
      const semiNocturnalArc = 90 - ad;
      // IC（時角 180 度）から東へ、半夜弧の何割ぶんか
      expect((180 - -hourAngle) / semiNocturnalArc).toBeCloseTo(fraction, 6);
    }
  });

  it('赤道の真上では、赤経を 30 度ずつ割ったものと一致する', () => {
    const equator = { ramc: lst, asc: 0, mc, latitude: 0, obliquity: obl };
    const ascEq = ascendant(lst, 0, obl);
    const h = buildHouses('placidus', { ...equator, asc: ascEq }, 280);
    for (const [index, expected] of [
      [10, 30],
      [11, 60],
      [0, 90],
      [1, 120],
      [2, 150],
    ] as const) {
      expect(norm360(equatorialOf(h.cusps[index], time, place.lng).ra - lst)).toBeCloseTo(
        expected,
        6
      );
    }
  });

  it('高緯度では組めないので、ホールサインに落として断りを返す', () => {
    const lat = 70;
    const ascHigh = ascendant(lst, lat, obl);
    const h = buildHouses(
      'placidus',
      { ramc: lst, asc: ascHigh, mc, latitude: lat, obliquity: obl },
      280
    );
    expect(h.requested).toBe('placidus');
    expect(h.system).toBe('whole');
    expect(h.note).toContain('プラシーダス');
    expect(h.cusps[0] % 30).toBeCloseTo(0, 9);
  });

  it('ホールサインは 1 室がアセンダントのサインまるごとになる', () => {
    const h = buildHouses(
      'whole',
      { ramc: lst, asc, mc, latitude: place.lat, obliquity: obl },
      280
    );
    expect(h.cusps[0]).toBe(Math.floor(asc / 30) * 30);
    expect(houseOf(asc, h.cusps)).toBe(1);
  });

  it('イコールはアセンダントから 30 度ずつ', () => {
    const h = buildHouses(
      'equal',
      { ramc: lst, asc, mc, latitude: place.lat, obliquity: obl },
      280
    );
    expect(h.cusps[3]).toBeCloseTo(norm360(asc + 90), 9);
  });
});

describe('ハウスの割り当て', () => {
  it('0 度をまたぐカスプでも取り違えない', () => {
    const cusps = Array.from({ length: 12 }, (_, i) => norm360(350 + i * 30));
    expect(houseOf(350, cusps)).toBe(1);
    expect(houseOf(0, cusps)).toBe(1);
    expect(houseOf(19.99, cusps)).toBe(1);
    expect(houseOf(20, cusps)).toBe(2);
    expect(houseOf(349.99, cusps)).toBe(12);
  });

  it('幅の違うカスプでも、そのあいだに入る', () => {
    // プラシーダスでは室の幅がそろわない
    const cusps = [0, 20, 45, 90, 140, 175, 180, 200, 225, 270, 320, 355];
    expect(houseOf(10, cusps)).toBe(1);
    expect(houseOf(44, cusps)).toBe(2);
    expect(houseOf(179, cusps)).toBe(6);
    expect(houseOf(357, cusps)).toBe(12);
  });
});

describe('天体の位置', () => {
  const options = defaultHoroscopeOptions();

  it('春分の瞬間、太陽の黄経は 0 度になる', () => {
    // 分点の時刻は astronomy-engine が別の経路で求めているので、突き合わせになる
    for (const year of [1950, 1990, 2024]) {
      const equinox = Astronomy.Seasons(year).mar_equinox;
      const sun = bodyState('sun', equinox, 'mean');
      expect(Math.abs(norm180(sun.lon))).toBeLessThan(0.001);
    }
  });

  it('夏至の瞬間、太陽の黄経は 90 度になる', () => {
    const solstice = Astronomy.Seasons(2000).jun_solstice;
    expect(bodyState('sun', solstice, 'mean').lon).toBeCloseTo(90, 3);
  });

  it('朔の瞬間、太陽と月の黄経は、光行差のぶんだけ離れて重なる', () => {
    // 朔の時刻は astronomy-engine が幾何学的な位置で求めている。
    // こちらは占星術の慣習どおり光行差を入れた「見かけの位置」を使うので、
    // 太陽が 20 秒角ほど後ろにずれる。この差が出ることまで含めて固定しておく
    const newMoon = Astronomy.SearchMoonPhase(0, new Date(Date.UTC(1990, 0, 1)), 40);
    expect(newMoon).not.toBeNull();
    const moon = bodyState('moon', newMoon!, 'mean');

    const apparent = bodyState('sun', newMoon!, 'mean');
    expect(separation(apparent.lon, moon.lon) * 3600).toBeGreaterThan(19);
    expect(separation(apparent.lon, moon.lon) * 3600).toBeLessThan(22);

    const geometric = Astronomy.Ecliptic(
      Astronomy.GeoVector(Astronomy.Body.Sun, newMoon!, false)
    ).elon;
    expect(separation(geometric, moon.lon)).toBeLessThan(0.0001);
  });

  it('太陽と月の 1 日の動きは、天文の値に収まる', () => {
    const time = Astronomy.MakeTime(MOMENTS[1]);
    expect(bodyState('sun', time, 'mean').speed).toBeGreaterThan(0.95);
    expect(bodyState('sun', time, 'mean').speed).toBeLessThan(1.02);
    const moon = bodyState('moon', time, 'mean').speed;
    expect(moon).toBeGreaterThan(11);
    expect(moon).toBeLessThan(15.5);
  });

  it('平均交点は常に逆行し、18.6 年でひとまわりする', () => {
    const time = Astronomy.MakeTime(MOMENTS[0]);
    const state = bodyState('northNode', time, 'mean');
    expect(state.speed).toBeLessThan(0);
    // 360 度 / 6798 日 ≒ 0.053 度/日
    expect(state.speed).toBeCloseTo(-0.0529, 3);

    const later = meanNode(time.AddDays(6798.4));
    expect(separation(meanNode(time), later)).toBeLessThan(0.5);
  });

  it('真の交点は、平均交点のまわり 1.6 度ほどに収まる', () => {
    for (const moment of MOMENTS) {
      const time = Astronomy.MakeTime(moment);
      expect(separation(trueNode(time), meanNode(time))).toBeLessThan(1.8);
    }
  });

  it('リリス（平均遠地点）は、月の平均近地点の反対側にある', () => {
    const time = Astronomy.MakeTime(MOMENTS[0]);
    // 近地点は約 8.85 年で一周する。遠地点も同じ速さで順行する
    const state = bodyState('lilith', time, 'mean');
    expect(state.speed).toBeGreaterThan(0);
    expect(state.speed).toBeCloseTo(0.111, 2);
    expect(separation(meanLilith(time), meanLilith(time.AddDays(3232.6)))).toBeLessThan(1);
  });

  it('逆行の判定は、実際に黄経が戻っているかと一致する', () => {
    // 前後 5 日の黄経の変化を直に見て、速度の符号と突き合わせる
    for (const moment of MOMENTS) {
      const time = Astronomy.MakeTime(moment);
      for (const id of ['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const) {
        const state = bodyState(id, time, options.nodeKind);
        const moved = norm180(
          bodyState(id, time.AddDays(2), options.nodeKind).lon -
            bodyState(id, time.AddDays(-2), options.nodeKind).lon
        );
        // 留の前後（速度がほぼ 0）は符号が揺れて当然なので、そこは見ない
        if (Math.abs(state.speed) < 0.02) continue;
        expect(Math.sign(state.speed)).toBe(Math.sign(moved));
      }
    }
  });
});

describe('サインと度数', () => {
  it('黄経をサインと度分に割る', () => {
    expect(signPosition(0)).toMatchObject({ sign: 0, deg: 0, min: 0 });
    expect(signPosition(29.999)).toMatchObject({ sign: 0, deg: 29, min: 59 });
    expect(signPosition(30)).toMatchObject({ sign: 1, deg: 0, min: 0 });
    expect(signPosition(280.43)).toMatchObject({ sign: 9, deg: 10, min: 25 });
    expect(signPosition(-1)).toMatchObject({ sign: 11, deg: 29, min: 0 });
  });
});

describe('アスペクト', () => {
  const options = defaultHoroscopeOptions();
  const point = (id: string, lon: number, speed: number | null = 1): AspectPoint =>
    ({ id, lon, speed }) as AspectPoint;

  it('オーブの内側なら成立し、外側なら成立しない', () => {
    // 太陽が絡むので 8 + 2 = 10 度まで
    expect(findAspects([point('sun', 0), point('mars', 189)], options)).toHaveLength(1);
    expect(findAspects([point('sun', 0), point('mars', 191)], options)).toHaveLength(0);
    // 天体どうしなら 8 度まで
    expect(findAspects([point('venus', 0), point('mars', 187)], options)).toHaveLength(1);
    expect(findAspects([point('venus', 0), point('mars', 189)], options)).toHaveLength(0);
  });

  it('0 度をまたいでも角度を取り違えない', () => {
    const found = findAspects([point('venus', 355), point('mars', 85)], options);
    expect(found[0]).toMatchObject({ kind: 'square', exact: 90 });
    expect(found[0].orb).toBeCloseTo(0, 9);
  });

  it('マイナーアスペクトは既定では拾わない', () => {
    const pts = [point('venus', 0), point('mars', 150)];
    expect(findAspects(pts, options)).toHaveLength(0);
    expect(findAspects(pts, { ...options, minorAspects: true })).toHaveLength(1);
  });

  it('速い側が追いつく前なら接近、通り過ぎたあとなら分離', () => {
    // 火星（速い）が木星（遅い）の 89 度手前 → まだスクエアちょうどに達していない
    const applying = findAspects([point('jupiter', 0, 0.1), point('mars', 89, 0.5)], options);
    expect(applying[0].applying).toBe(true);
    const separating = findAspects([point('jupiter', 0, 0.1), point('mars', 91, 0.5)], options);
    expect(separating[0].applying).toBe(false);
  });

  it('逆行していても接近・分離を取り違えない', () => {
    // 火星が逆行して 91 度から 90 度へ戻ってくる
    const found = findAspects([point('jupiter', 0, 0.1), point('mars', 91, -0.5)], options);
    expect(found[0].applying).toBe(true);
  });

  it('感受点が絡むアスペクトでは、接近・分離を出さない', () => {
    const found = findAspects([point('sun', 0), point('asc', 1, null)], options);
    expect(found[0].applying).toBeNull();
  });

  it('感受点どうしは見ない', () => {
    expect(findAspects([point('asc', 0, null), point('mc', 90, null)], options)).toHaveLength(0);
  });

  it('同じ組み合わせで二つの角度を返さない', () => {
    // 30 度は、セミセクスタイルにだけ当たる
    const found = findAspects([point('venus', 0), point('mars', 30)], {
      ...options,
      minorAspects: true,
    });
    expect(found).toHaveLength(1);
  });

  it('二つの集まりのあいだ（シナストリー）では、同じ天体どうしも見る', () => {
    const self = [point('sun', 10)];
    const other = [point('sun', 12), point('moon', 100)];
    const found = pairAspects(self, other, options);
    expect(found.map((a) => [a.a, a.b, a.kind])).toEqual([
      // ちょうどに近い順に並ぶので、オーブ 0 度のスクエアが先に来る
      ['sun', 'moon', 'square'],
      ['sun', 'sun', 'conjunction'],
    ]);
  });

  it('ちょうどに近い順に並ぶ', () => {
    const found = findAspects(
      [point('venus', 0), point('mars', 95), point('jupiter', 181)],
      options
    );
    // 金星-木星が 1 度、火星-木星が 4 度、金星-火星が 5 度
    expect(found.map((a) => Math.round(a.orb))).toEqual([1, 4, 5]);
  });
});
