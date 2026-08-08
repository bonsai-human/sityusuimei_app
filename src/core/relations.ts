/**
 * 干支どうしの関係（合・沖・刑・害・破）の判定。
 *
 * lunar-typescript は沖の表しか持たないため、ここで一式を定義して四柱の全ペアを走査する。
 */

import { GAN, ZHI, type Element, type Gan, type Zhi } from './constants';

export type PillarSlot = 'year' | 'month' | 'day' | 'hour';

export const SLOT_LABEL: Record<PillarSlot, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '時柱',
};

export type RelationKind =
  | '天干合'
  | '天干沖'
  | '支合'
  | '三合'
  | '半合'
  | '方合'
  | '沖'
  | '刑'
  | '自刑'
  | '害'
  | '破';

/** 吉凶ではなく「結びつき」か「揺さぶり」かの区分。UI のグルーピングに使う。 */
export type RelationTone = 'bond' | 'clash';

export const RELATION_TONE: Record<RelationKind, RelationTone> = {
  天干合: 'bond',
  天干沖: 'clash',
  支合: 'bond',
  三合: 'bond',
  半合: 'bond',
  方合: 'bond',
  沖: 'clash',
  刑: 'clash',
  自刑: 'clash',
  害: 'clash',
  破: 'clash',
};

export const RELATION_NOTE: Record<RelationKind, string> = {
  天干合: '天干どうしが結びつき、別の五行に変化しようとする',
  天干沖: '天干どうしが正面から剋し合う',
  支合: '地支が一対一で結びつく（六合）',
  三合: '三つの地支が揃って一つの五行の局を作る',
  半合: '三合のうち二つが揃った、弱い結びつき',
  方合: '同じ季節の地支が三つ揃い、その五行が非常に強くなる',
  沖: '地支どうしが正面衝突し、動き・変化をもたらす',
  刑: '地支どうしが噛み合わず、こじれ・停滞を生む',
  自刑: '同じ地支が重なり、自分自身に向かう刑',
  害: '結びつきを横から妨げる関係',
  破: '成り立っているものを崩す関係',
};

export interface Relation {
  kind: RelationKind;
  /** 関係に加わっている柱（2 つ、方合・三合では 3 つ） */
  slots: PillarSlot[];
  /** 関係に加わっている干または支 */
  chars: string[];
  /** 合によって生じる五行（合以外は undefined） */
  producedElement?: Element;
  label: string;
}

/* ------------------------------------------------------------------ 天干 */

/** 天干五合。結びついて生じる五行を持つ。 */
const GAN_HE: [Gan, Gan, Element][] = [
  ['甲', '己', 'earth'],
  ['乙', '庚', 'metal'],
  ['丙', '辛', 'water'],
  ['丁', '壬', 'wood'],
  ['戊', '癸', 'fire'],
];

/** 天干沖（七沖）。戊・己は中央の土なので沖を持たない。 */
const GAN_CHONG: [Gan, Gan][] = [
  ['甲', '庚'],
  ['乙', '辛'],
  ['丙', '壬'],
  ['丁', '癸'],
];

/* ------------------------------------------------------------------ 地支 */

/** 六合（支合）。 */
const ZHI_HE: [Zhi, Zhi, Element][] = [
  ['子', '丑', 'earth'],
  ['寅', '亥', 'wood'],
  ['卯', '戌', 'fire'],
  ['辰', '酉', 'metal'],
  ['巳', '申', 'water'],
  ['午', '未', 'earth'],
];

/** 三合局。[生地, 旺地, 墓地, 五行] の順で持ち、半合の判定にも使う。 */
const SAN_HE: [Zhi, Zhi, Zhi, Element][] = [
  ['申', '子', '辰', 'water'],
  ['亥', '卯', '未', 'wood'],
  ['寅', '午', '戌', 'fire'],
  ['巳', '酉', '丑', 'metal'],
];

/** 方合（三会）。同じ季節の三支。 */
const FANG_HE: [Zhi, Zhi, Zhi, Element][] = [
  ['寅', '卯', '辰', 'wood'],
  ['巳', '午', '未', 'fire'],
  ['申', '酉', '戌', 'metal'],
  ['亥', '子', '丑', 'water'],
];

/** 六沖。向かい合う地支（index の差が 6）。 */
const ZHI_CHONG: [Zhi, Zhi][] = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥'],
];

/** 六害。 */
const ZHI_HAI: [Zhi, Zhi][] = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '巳'],
  ['卯', '辰'],
  ['申', '亥'],
  ['酉', '戌'],
];

/** 六破。 */
const ZHI_PO: [Zhi, Zhi][] = [
  ['子', '酉'],
  ['丑', '辰'],
  ['寅', '亥'],
  ['卯', '午'],
  ['巳', '申'],
  ['未', '戌'],
];

/** 三刑。三支が揃ったときのみ成立とする。 */
const SAN_XING: [Zhi, Zhi, Zhi, string][] = [
  ['寅', '巳', '申', '無恩の刑'],
  ['丑', '戌', '未', '恃勢の刑'],
];

/** 相刑（二支で成立する刑）。 */
const XIANG_XING: [Zhi, Zhi, string][] = [['子', '卯', '無礼の刑']];

/** 自刑。同じ地支が重なると成立する。 */
const ZI_XING: Zhi[] = ['辰', '午', '酉', '亥'];

/* ------------------------------------------------------------ 判定ロジック */

export interface RelationInput {
  slot: PillarSlot;
  gan: Gan;
  zhi: Zhi;
}

function pairMatches<T extends string>(a: T, b: T, x: T, y: T): boolean {
  return (a === x && b === y) || (a === y && b === x);
}

/** すべての 2 要素の組み合わせを取り出す。 */
function pairs<T>(items: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) out.push([items[i], items[j]]);
  }
  return out;
}

function triples<T>(items: T[]): [T, T, T][] {
  const out: [T, T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      for (let k = j + 1; k < items.length; k++) out.push([items[i], items[j], items[k]]);
    }
  }
  return out;
}

/**
 * 四柱（時柱が無い場合は三柱）から成立している関係をすべて洗い出す。
 * 三合・方合が成立しているぶんの半合は重複になるので除外する。
 */
export function findRelations(pillars: RelationInput[]): Relation[] {
  const out: Relation[] = [];

  for (const [a, b] of pairs(pillars)) {
    for (const [x, y, el] of GAN_HE) {
      if (pairMatches(a.gan, b.gan, x, y)) {
        out.push({
          kind: '天干合',
          slots: [a.slot, b.slot],
          chars: [a.gan, b.gan],
          producedElement: el,
          label: `${a.gan}${b.gan}`,
        });
      }
    }
    for (const [x, y] of GAN_CHONG) {
      if (pairMatches(a.gan, b.gan, x, y)) {
        out.push({
          kind: '天干沖',
          slots: [a.slot, b.slot],
          chars: [a.gan, b.gan],
          label: `${a.gan}${b.gan}`,
        });
      }
    }
  }

  // 三合・方合（三支が揃うもの）を先に取り、成立した組を覚えておく
  const consumedBySanHe = new Set<string>();

  for (const [a, b, c] of triples(pillars)) {
    const zs = [a.zhi, b.zhi, c.zhi];
    for (const [x, y, z, el] of SAN_HE) {
      if ([x, y, z].every((t) => zs.includes(t)) && new Set(zs).size === 3) {
        out.push({
          kind: '三合',
          slots: [a.slot, b.slot, c.slot],
          chars: zs,
          producedElement: el,
          label: `${x}${y}${z}`,
        });
        consumedBySanHe.add([x, y, z].sort().join(''));
      }
    }
    for (const [x, y, z, el] of FANG_HE) {
      if ([x, y, z].every((t) => zs.includes(t)) && new Set(zs).size === 3) {
        out.push({
          kind: '方合',
          slots: [a.slot, b.slot, c.slot],
          chars: zs,
          producedElement: el,
          label: `${x}${y}${z}`,
        });
      }
    }
    for (const [x, y, z, note] of SAN_XING) {
      if ([x, y, z].every((t) => zs.includes(t)) && new Set(zs).size === 3) {
        out.push({
          kind: '刑',
          slots: [a.slot, b.slot, c.slot],
          chars: zs,
          label: `${x}${y}${z}（${note}）`,
        });
      }
    }
  }

  for (const [a, b] of pairs(pillars)) {
    for (const [x, y, el] of ZHI_HE) {
      if (pairMatches(a.zhi, b.zhi, x, y)) {
        out.push({
          kind: '支合',
          slots: [a.slot, b.slot],
          chars: [a.zhi, b.zhi],
          producedElement: el,
          label: `${a.zhi}${b.zhi}`,
        });
      }
    }

    // 半合は「生地＋旺地」「旺地＋墓地」の 2 通り。三合が成立済みなら出さない。
    for (const [sheng, wang, mu, el] of SAN_HE) {
      if (consumedBySanHe.has([sheng, wang, mu].sort().join(''))) continue;
      const half =
        pairMatches(a.zhi, b.zhi, sheng, wang) || pairMatches(a.zhi, b.zhi, wang, mu);
      if (half) {
        out.push({
          kind: '半合',
          slots: [a.slot, b.slot],
          chars: [a.zhi, b.zhi],
          producedElement: el,
          label: `${a.zhi}${b.zhi}`,
        });
      }
    }

    for (const [x, y] of ZHI_CHONG) {
      if (pairMatches(a.zhi, b.zhi, x, y)) {
        out.push({
          kind: '沖',
          slots: [a.slot, b.slot],
          chars: [a.zhi, b.zhi],
          label: `${a.zhi}${b.zhi}`,
        });
      }
    }
    for (const [x, y] of ZHI_HAI) {
      if (pairMatches(a.zhi, b.zhi, x, y)) {
        out.push({
          kind: '害',
          slots: [a.slot, b.slot],
          chars: [a.zhi, b.zhi],
          label: `${a.zhi}${b.zhi}`,
        });
      }
    }
    for (const [x, y] of ZHI_PO) {
      if (pairMatches(a.zhi, b.zhi, x, y)) {
        out.push({
          kind: '破',
          slots: [a.slot, b.slot],
          chars: [a.zhi, b.zhi],
          label: `${a.zhi}${b.zhi}`,
        });
      }
    }
    for (const [x, y, note] of XIANG_XING) {
      if (pairMatches(a.zhi, b.zhi, x, y)) {
        out.push({
          kind: '刑',
          slots: [a.slot, b.slot],
          chars: [a.zhi, b.zhi],
          label: `${x}${y}（${note}）`,
        });
      }
    }
    if (a.zhi === b.zhi && ZI_XING.includes(a.zhi)) {
      out.push({
        kind: '自刑',
        slots: [a.slot, b.slot],
        chars: [a.zhi, b.zhi],
        label: `${a.zhi}${b.zhi}`,
      });
    }
  }

  return out;
}

/** 干支文字列（例 '壬午'）を天干・地支に分解する。 */
export function splitGanZhi(ganZhi: string): { gan: Gan; zhi: Zhi } | null {
  const gan = ganZhi.charAt(0) as Gan;
  const zhi = ganZhi.charAt(1) as Zhi;
  if (!GAN.includes(gan) || !ZHI.includes(zhi)) return null;
  return { gan, zhi };
}
