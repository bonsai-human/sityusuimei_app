/**
 * 二つの出生図を突き合わせる（シナストリー）。
 *
 * 四柱推命の `compare.ts` と同じ立場で、相性を点数では出さない。
 * 角度は良し悪しではなく効き方の向きで、何が良いかは当人が何を望むかで変わるからだ。
 * ここでは成立している角度と、相手の天体が自分のどのハウスに落ちるかという
 * 事実だけを拾い、読み取りの手がかりを添える。
 */

import { pairAspects, formatOrb, type AspectPoint } from './aspects';
import {
  ASPECT_BY_KIND,
  BODY_LABEL,
  BODY_NOTE,
  HOUSE_NOTE,
  POINT_LABEL,
  SIGN_LABEL,
  type AspectKind,
  type BodyId,
  type PointId,
} from './constants';
import { houseOf } from './houses';
import { formatSignPosition } from './math';
import type { Aspect, Horoscope, HoroscopeOptions } from './types';

/**
 * 二人のあいだのオーブ。出生図の中どうしより狭く取る。
 *
 * 見る組み合わせが 14 × 14 と多いので、出生図と同じ幅で取ると
 * 80 本近く並んでしまい、どれが効いているのか分からなくなる。
 */
export const DEFAULT_SYNASTRY_ORBS: Record<AspectKind, number> = {
  conjunction: 6,
  opposition: 6,
  trine: 6,
  square: 6,
  sextile: 4,
  quincunx: 1.5,
  semisextile: 1.5,
  semisquare: 1.5,
  sesquiquadrate: 1.5,
};

/** 読み所として言葉を添える点。ここどうしが噛んだときだけ、文で書き出す。 */
const KEY_POINTS: PointId[] = ['sun', 'moon', 'asc', 'venus', 'mars'];

/** 相手の天体が落ちる先として、特に読まれる室。 */
const KEY_HOUSES = [1, 4, 7, 10];

export interface HouseOverlay {
  body: BodyId;
  /** 1〜12 */
  house: number;
}

export interface SynastryHighlight {
  title: string;
  body: string;
}

export interface Synastry {
  self: Horoscope;
  other: Horoscope;
  /** a が自分側、b が相手側 */
  aspects: Aspect[];
  soft: Aspect[];
  hard: Aspect[];
  /** 相手の天体が、自分のハウスのどこに落ちるか。自分のハウスが無ければ null */
  otherInSelfHouses: HouseOverlay[] | null;
  /** 自分の天体が、相手のハウスのどこに落ちるか */
  selfInOtherHouses: HouseOverlay[] | null;
  highlights: SynastryHighlight[];
}

export function nameOf(h: Horoscope, fallback: string): string {
  return h.input.name.trim() || fallback;
}

/** 出生図から、角度を見る点の一覧を作る。感受点は速度を持たせない。 */
function pointsOf(h: Horoscope): AspectPoint[] {
  const points: AspectPoint[] = h.placements.map((p) => ({
    id: p.id,
    lon: p.lon,
    // 二人の図はどちらも止まっているので、接近・分離は意味を持たない
    speed: null,
  }));
  if (h.angles) {
    points.push({ id: 'asc', lon: h.angles.asc.lon, speed: null });
    points.push({ id: 'mc', lon: h.angles.mc.lon, speed: null });
  }
  return points;
}

function overlay(bodies: Horoscope['placements'], houses: Horoscope['houses']): HouseOverlay[] | null {
  if (!houses) return null;
  return bodies.map((p) => ({ body: p.id, house: houseOf(p.lon, houses.cusps) }));
}

/**
 * その点が何を担うかを、ひと息で言える長さに切る。
 * 語彙集の文は「意志と目的。何をもって自分とするか」のように 2 文あるので、前半だけ使う。
 */
function pointNote(id: PointId): string {
  if (id === 'asc') return '外から見えるかたち';
  if (id === 'mc') return '社会での立ち位置';
  if (id in BODY_NOTE) return BODY_NOTE[id as BodyId].split('。')[0];
  return '';
}

function buildHighlights(
  aspects: Aspect[],
  otherInSelf: HouseOverlay[] | null,
  selfName: string,
  otherName: string
): SynastryHighlight[] {
  const out: SynastryHighlight[] = [];

  for (const a of aspects) {
    if (!KEY_POINTS.includes(a.a) || !KEY_POINTS.includes(a.b)) continue;
    const def = ASPECT_BY_KIND[a.kind];
    // 同じ点どうし（太陽と太陽など）は、同じ説明を二度書かない
    const what =
      a.a === a.b
        ? `どちらも${POINT_LABEL[a.a]}で、${pointNote(a.a)}を担う。`
        : `${POINT_LABEL[a.a]}は${pointNote(a.a)}、${POINT_LABEL[a.b]}は${pointNote(a.b)}。`;
    out.push({
      title: `${selfName}の${POINT_LABEL[a.a]} × ${otherName}の${POINT_LABEL[a.b]}`,
      body: `${def.label}（${def.angle}度・オーブ ${formatOrb(a.orb)}）。${def.note}。${what}`,
    });
  }

  if (otherInSelf) {
    for (const o of otherInSelf) {
      if (!KEY_HOUSES.includes(o.house)) continue;
      if (!['sun', 'moon', 'venus', 'mars', 'saturn'].includes(o.body)) continue;
      out.push({
        title: `${otherName}の${BODY_LABEL[o.body]}が、${selfName}の${o.house}室に落ちる`,
        body:
          `${selfName}にとっての${o.house}室は「${HOUSE_NOTE[o.house - 1]}」の場所。` +
          `そこに${otherName}の${BODY_LABEL[o.body]}（${pointNote(o.body)}）が重なる。`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      title: '読み所として挙がるものはありません',
      body:
        '太陽・月・アセンダント・金星・火星どうしが、このオーブの範囲で噛み合っていません。' +
        '関係が薄いという意味ではなく、下の一覧にある角度のほうを読むことになります。',
    });
  }
  return out;
}

export function compareHoroscopes(
  self: Horoscope,
  other: Horoscope,
  options: HoroscopeOptions
): Synastry {
  // 二人ぶんの点を突き合わせる。同じ天体どうし（太陽と太陽など）も見る。
  // 出生図の中と違い、二人のあいだでは感受点どうしにも意味がある
  const aspects = pairAspects(
    pointsOf(self),
    pointsOf(other),
    { ...options, orbs: DEFAULT_SYNASTRY_ORBS },
    { betweenAngles: true }
  );

  const otherInSelfHouses = overlay(other.placements, self.houses);
  const selfInOtherHouses = overlay(self.placements, other.houses);

  return {
    self,
    other,
    aspects,
    soft: aspects.filter((a) => a.tone === 'soft'),
    hard: aspects.filter((a) => a.tone === 'hard'),
    otherInSelfHouses,
    selfInOtherHouses,
    highlights: buildHighlights(
      aspects,
      otherInSelfHouses,
      nameOf(self, '自分'),
      nameOf(other, '相手')
    ),
  };
}

/** 二人の関係の部分だけを書き出す。出生図そのものはプロンプトの画面から渡す。 */
export function synastrySummary(s: Synastry): string {
  const selfName = nameOf(s.self, '自分');
  const otherName = nameOf(s.other, '相手');
  const lines: string[] = [];

  lines.push(`## ${selfName}と${otherName}の、出生図どうしの角度`);
  lines.push('');
  for (const [label, h] of [
    [selfName, s.self],
    [otherName, s.other],
  ] as const) {
    const sun = h.placements.find((p) => p.id === 'sun')!;
    const moon = h.placements.find((p) => p.id === 'moon')!;
    lines.push(
      `- ${label}: 太陽 ${formatSignPosition(sun.position, SIGN_LABEL)}／` +
        `月 ${formatSignPosition(moon.position, SIGN_LABEL)}` +
        (h.angles
          ? `／アセンダント ${formatSignPosition(h.angles.asc.position, SIGN_LABEL)}`
          : '（出生時刻が不明なので、アセンダントとハウスはありません）')
    );
  }
  lines.push('');

  lines.push('### 成立している角度');
  lines.push('');
  if (s.aspects.length === 0) {
    lines.push('このオーブの範囲では成立していません。');
  } else {
    for (const a of s.aspects) {
      lines.push(
        `- ${selfName}の${POINT_LABEL[a.a]} と ${otherName}の${POINT_LABEL[a.b]}が` +
          `${ASPECT_BY_KIND[a.kind].label}（${a.exact}度・オーブ ${formatOrb(a.orb)}）`
      );
    }
  }
  lines.push('');

  if (s.otherInSelfHouses) {
    lines.push(`### ${otherName}の天体が、${selfName}のどの室に落ちるか`);
    lines.push('');
    for (const o of s.otherInSelfHouses) {
      lines.push(`- ${BODY_LABEL[o.body]} → ${o.house}室（${HOUSE_NOTE[o.house - 1]}）`);
    }
    lines.push('');
  }
  if (s.selfInOtherHouses) {
    lines.push(`### ${selfName}の天体が、${otherName}のどの室に落ちるか`);
    lines.push('');
    for (const o of s.selfInOtherHouses) {
      lines.push(`- ${BODY_LABEL[o.body]} → ${o.house}室（${HOUSE_NOTE[o.house - 1]}）`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '上は二人の出生図のあいだに成立している角度と、天体の落ちる室です。' +
      '相性を点数にしたり、続く続かないを判じたりはしないでください。' +
      'それぞれの角度が二人のあいだで何を起こしやすいのか、どこに気を配ると噛み合いやすいのかを、' +
      '根拠となる天体とハウスを示しながら述べてください。' +
      '調和の角度が多いことが良い関係を意味するわけではない、という前提で読んでください。'
  );

  return lines.join('\n');
}
