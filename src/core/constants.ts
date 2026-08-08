/**
 * 四柱推命の基礎テーブル。
 *
 * lunar-typescript は干支・節気・大運の算出には使うが、蔵干／十神／十二運／納音／
 * 干支関係については戻り値が簡体字だったり流派が異なったりするため、ここで日本で
 * 一般的な表を自前で持ち、算出も自前で行う（`chart.ts` 参照）。
 */

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export const ELEMENT_LABEL: Record<Element, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
};

export const ELEMENT_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

/** 相生の順（木→火→土→金→水→木）。ELEMENT_ORDER がそのまま相生順になっている。 */
export function generates(a: Element): Element {
  return ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(a) + 1) % 5];
}

/** 相剋（木→土→水→火→金→木）。 */
export function controls(a: Element): Element {
  return ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(a) + 2) % 5];
}

export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const ZHI = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
] as const;

export type Gan = (typeof GAN)[number];
export type Zhi = (typeof ZHI)[number];

export const GAN_ELEMENT: Record<Gan, Element> = {
  甲: 'wood',
  乙: 'wood',
  丙: 'fire',
  丁: 'fire',
  戊: 'earth',
  己: 'earth',
  庚: 'metal',
  辛: 'metal',
  壬: 'water',
  癸: 'water',
};

export const ZHI_ELEMENT: Record<Zhi, Element> = {
  子: 'water',
  丑: 'earth',
  寅: 'wood',
  卯: 'wood',
  辰: 'earth',
  巳: 'fire',
  午: 'fire',
  未: 'earth',
  申: 'metal',
  酉: 'metal',
  戌: 'earth',
  亥: 'water',
};

/** 陽=true / 陰=false。天干は甲から交互、地支は子から交互。 */
export function isGanYang(g: Gan): boolean {
  return GAN.indexOf(g) % 2 === 0;
}

export function isZhiYang(z: Zhi): boolean {
  return ZHI.indexOf(z) % 2 === 0;
}

export const ZHI_ANIMAL: Record<Zhi, string> = {
  子: '鼠',
  丑: '牛',
  寅: '虎',
  卯: '兎',
  辰: '龍',
  巳: '蛇',
  午: '馬',
  未: '羊',
  申: '猿',
  酉: '鶏',
  戌: '犬',
  亥: '猪',
};

/**
 * 蔵干（人元）と月律分野の日数。余気 → 中気 → 本気 の順で、日数の合計は 30。
 * 配列の最後が本気（その地支を代表する天干）で、地支の十神はこの本気から算出する。
 */
export interface HiddenStem {
  gan: Gan;
  days: number;
  /** 余気 / 中気 / 本気 */
  role: '余気' | '中気' | '本気';
}

function hs(spec: [Gan, number][]): HiddenStem[] {
  const roles: HiddenStem['role'][] =
    spec.length === 3 ? ['余気', '中気', '本気'] : ['余気', '本気'];
  return spec.map(([gan, days], i) => ({ gan, days, role: roles[i] }));
}

export const ZHI_HIDDEN: Record<Zhi, HiddenStem[]> = {
  子: hs([
    ['壬', 10],
    ['癸', 20],
  ]),
  丑: hs([
    ['癸', 9],
    ['辛', 3],
    ['己', 18],
  ]),
  寅: hs([
    ['戊', 7],
    ['丙', 7],
    ['甲', 16],
  ]),
  卯: hs([
    ['甲', 10],
    ['乙', 20],
  ]),
  辰: hs([
    ['乙', 9],
    ['癸', 3],
    ['戊', 18],
  ]),
  巳: hs([
    ['戊', 7],
    ['庚', 7],
    ['丙', 16],
  ]),
  午: hs([
    ['丙', 10],
    ['己', 9],
    ['丁', 11],
  ]),
  未: hs([
    ['丁', 9],
    ['乙', 3],
    ['己', 18],
  ]),
  申: hs([
    ['戊', 7],
    ['壬', 7],
    ['庚', 16],
  ]),
  酉: hs([
    ['庚', 10],
    ['辛', 20],
  ]),
  戌: hs([
    ['辛', 9],
    ['丁', 3],
    ['戊', 18],
  ]),
  亥: hs([
    ['戊', 7],
    ['甲', 7],
    ['壬', 16],
  ]),
};

/** 十神。日干から見た相手の天干の関係。 */
export type TenGod =
  | '比肩'
  | '劫財'
  | '食神'
  | '傷官'
  | '偏財'
  | '正財'
  | '偏官'
  | '正官'
  | '偏印'
  | '正印'
  | '日元';

export const TEN_GOD_NOTE: Record<TenGod, string> = {
  日元: '自分自身。命式の主体となる天干',
  比肩: '自分と同じ五行・同じ陰陽。自立・対等な仲間・競争',
  劫財: '自分と同じ五行で陰陽が逆。協力と奪い合いの両面',
  食神: '自分が生じる五行で陰陽が同じ。表現・楽しみ・衣食',
  傷官: '自分が生じる五行で陰陽が逆。才気・批評・型破り',
  偏財: '自分が剋す五行で陰陽が同じ。流動的な財・社交',
  正財: '自分が剋す五行で陰陽が逆。堅実な財・実務',
  偏官: '自分を剋す五行で陰陽が同じ。行動力・重圧・決断（七殺）',
  正官: '自分を剋す五行で陰陽が逆。規範・責任・地位',
  偏印: '自分を生じる五行で陰陽が同じ。独自の学び・直感（梟神）',
  正印: '自分を生じる五行で陰陽が逆。庇護・学問・母性',
};

/** 十二運星（長生訣）。長生から順に 12 個。 */
export const TWELVE_STAGES = [
  '長生',
  '沐浴',
  '冠帯',
  '建禄',
  '帝旺',
  '衰',
  '病',
  '死',
  '墓',
  '絶',
  '胎',
  '養',
] as const;

export type TwelveStage = (typeof TWELVE_STAGES)[number];

/** 日干ごとの「長生」の地支と、そこからの巡り方向（陽干は順行・陰干は逆行）。 */
export const CHANG_SHENG_START: Record<Gan, { zhi: Zhi; forward: boolean }> = {
  甲: { zhi: '亥', forward: true },
  乙: { zhi: '午', forward: false },
  丙: { zhi: '寅', forward: true },
  丁: { zhi: '酉', forward: false },
  戊: { zhi: '寅', forward: true },
  己: { zhi: '酉', forward: false },
  庚: { zhi: '巳', forward: true },
  辛: { zhi: '子', forward: false },
  壬: { zhi: '申', forward: true },
  癸: { zhi: '卯', forward: false },
};

/**
 * 納音。六十干支を 2 つずつまとめた 30 種。index = 干支番号 (甲子=0) を 2 で割った商。
 */
export const NA_YIN = [
  '海中金',
  '炉中火',
  '大林木',
  '路傍土',
  '剣鋒金',
  '山頭火',
  '澗下水',
  '城頭土',
  '白鑞金',
  '楊柳木',
  '泉中水',
  '屋上土',
  '霹靂火',
  '松柏木',
  '長流水',
  '沙中金',
  '山下火',
  '平地木',
  '壁上土',
  '金箔金',
  '覆灯火',
  '天河水',
  '大駅土',
  '釵釧金',
  '桑柘木',
  '大渓水',
  '沙中土',
  '天上火',
  '石榴木',
  '大海水',
] as const;

/** 二十四節気のうち、月柱の境目になる「節」12 個（中気は含まない）。 */
export const JIE_NAMES = [
  '立春',
  '驚蟄',
  '清明',
  '立夏',
  '芒種',
  '小暑',
  '立秋',
  '白露',
  '寒露',
  '立冬',
  '大雪',
  '小寒',
] as const;

/** lunar-typescript が返す簡体字の節気名を日本語表記に直す。 */
export const JIE_QI_JA: Record<string, string> = {
  惊蛰: '驚蟄',
  谷雨: '穀雨',
  小满: '小満',
  处暑: '処暑',
  芒种: '芒種',
  夏至: '夏至',
  冬至: '冬至',
  春分: '春分',
  秋分: '秋分',
  雨水: '雨水',
  霜降: '霜降',
  小雪: '小雪',
  大雪: '大雪',
  小寒: '小寒',
  大寒: '大寒',
  立春: '立春',
  立夏: '立夏',
  立秋: '立秋',
  立冬: '立冬',
  清明: '清明',
  小暑: '小暑',
  大暑: '大暑',
  白露: '白露',
  寒露: '寒露',
};

export function jieQiJa(name: string): string {
  return JIE_QI_JA[name] ?? name;
}
