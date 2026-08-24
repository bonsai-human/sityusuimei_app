/**
 * ホロスコープの表。サイン（星座）・天体・アスペクトの、名前と属性をここにまとめる。
 *
 * 四柱推命側の `core/constants.ts` と同じ役割で、計算そのものは持たない。
 */

/* ------------------------------------------------------------ サイン */

export const SIGNS = [
  '牡羊',
  '牡牛',
  '双子',
  '蟹',
  '獅子',
  '乙女',
  '天秤',
  '蠍',
  '射手',
  '山羊',
  '水瓶',
  '魚',
] as const;

export type SignName = (typeof SIGNS)[number];

/** 0（牡羊）から 11（魚）。黄経 0 度から 30 度きざみ。 */
export type SignIndex = number;

export const SIGN_LABEL: string[] = SIGNS.map((s) => `${s}座`);

export const SIGN_SYMBOL = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

/** 四大元素。四柱推命の五行とは別物なので、型も名前も分けておく。 */
export type Element4 = 'fire' | 'earth' | 'air' | 'water';

export const ELEMENT4_LABEL: Record<Element4, string> = {
  fire: '火',
  earth: '地',
  air: '風',
  water: '水',
};

export const ELEMENT4_NOTE: Record<Element4, string> = {
  fire: '直観と衝動。先に動く',
  earth: '感覚と実務。形にする',
  air: '思考と言葉。つなぐ',
  water: '感情と共感。染み込む',
};

/** 三区分（クオリティ）。 */
export type Quality = 'cardinal' | 'fixed' | 'mutable';

export const QUALITY_LABEL: Record<Quality, string> = {
  cardinal: '活動',
  fixed: '不動',
  mutable: '柔軟',
};

export const QUALITY_NOTE: Record<Quality, string> = {
  cardinal: '始める。動き出しが早い',
  fixed: '保つ。決めたら動かない',
  mutable: '変える。合わせて形を変える',
};

/** 牡羊から順に、火・地・風・水の繰り返し。 */
export const SIGN_ELEMENT: Element4[] = Array.from(
  { length: 12 },
  (_, i) => (['fire', 'earth', 'air', 'water'] as const)[i % 4]
);

/** 牡羊から順に、活動・不動・柔軟の繰り返し。 */
export const SIGN_QUALITY: Quality[] = Array.from(
  { length: 12 },
  (_, i) => (['cardinal', 'fixed', 'mutable'] as const)[i % 3]
);

/* ------------------------------------------------------------ 天体 */

export const BODY_IDS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'northNode',
  'lilith',
] as const;

export type BodyId = (typeof BODY_IDS)[number];

/** 感受点。天体と同じようにアスペクトを取るが、位置は天体暦ではなく出生地から決まる。 */
export const ANGLE_IDS = ['asc', 'mc', 'dsc', 'ic', 'vertex'] as const;

export type AngleId = (typeof ANGLE_IDS)[number];

export type PointId = BodyId | AngleId;

export const BODY_LABEL: Record<BodyId, string> = {
  sun: '太陽',
  moon: '月',
  mercury: '水星',
  venus: '金星',
  mars: '火星',
  jupiter: '木星',
  saturn: '土星',
  uranus: '天王星',
  neptune: '海王星',
  pluto: '冥王星',
  northNode: 'ドラゴンヘッド',
  lilith: 'リリス',
};

export const ANGLE_LABEL: Record<AngleId, string> = {
  asc: 'アセンダント',
  mc: 'MC',
  dsc: 'ディセンダント',
  ic: 'IC',
  vertex: 'バーテックス',
};

export const POINT_LABEL: Record<PointId, string> = { ...BODY_LABEL, ...ANGLE_LABEL };

export const BODY_SYMBOL: Record<BodyId, string> = {
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
  northNode: '☊',
  lilith: '⚸',
};

/** 天体が担うもの。プロンプトに語彙集として添えるときに使う。 */
export const BODY_NOTE: Record<BodyId, string> = {
  sun: '意志と目的。何をもって自分とするか',
  moon: '感情と習慣。安心のありか',
  mercury: '思考と伝達。情報の扱い方',
  venus: '好みと親愛。何を心地よしとするか',
  mars: '行動と競争。どう押すか',
  jupiter: '拡大と信条。どこまで広げるか',
  saturn: '制限と責任。どこで踏みとどまるか',
  uranus: '変革と離脱。何を壊すか',
  neptune: '融解と憧れ。どこで境界を失うか',
  pluto: '徹底と再生。何を手放して生まれ直すか',
  northNode: '月の軌道が黄道と交わる点。進む方向として読まれる',
  lilith: '月の平均遠地点。抑えの利かない領域として読まれる',
};

export const ANGLE_NOTE: Record<AngleId, string> = {
  asc: '東の地平線と黄道の交点。外から見えるかたち',
  mc: '天頂方向と黄道の交点。社会での立ち位置',
  dsc: 'アセンダントの反対側。他者との接し方',
  ic: 'MC の反対側。私生活の土台',
  vertex: '黄道と東西を通る大円の交点。出会いの点として読まれる',
};

/**
 * サインの支配星。
 *
 * 天王星・海王星・冥王星が見つかる前は、蠍＝火星／水瓶＝土星／魚＝木星だった。
 * どちらで読むかは流派が分かれるので、両方を持たせて切り替えられるようにする。
 */
export const SIGN_RULER_MODERN: BodyId[] = [
  'mars',
  'venus',
  'mercury',
  'moon',
  'sun',
  'mercury',
  'venus',
  'pluto',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
];

export const SIGN_RULER_CLASSIC: BodyId[] = [
  'mars',
  'venus',
  'mercury',
  'moon',
  'sun',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'saturn',
  'jupiter',
];

/* ------------------------------------------------------------ ハウス */

/** 1 室から 12 室まで。プロンプトに語彙集として添えるときに使う。 */
export const HOUSE_NOTE: string[] = [
  '自分自身、体、第一印象',
  '所有、収入、価値観',
  '学習、移動、身近な伝達',
  '家庭、基盤、ルーツ',
  '創造、恋愛、遊び',
  '勤務、健康、日々の務め',
  '対人、結婚、契約',
  '共有、継承、深い関わり',
  '探究、遠方、思想',
  '社会的立場、達成',
  '仲間、希望、所属',
  '内密、手放し、無意識',
];

/* -------------------------------------------------------- アスペクト */

export type AspectKind =
  | 'conjunction'
  | 'opposition'
  | 'trine'
  | 'square'
  | 'sextile'
  | 'quincunx'
  | 'semisextile'
  | 'semisquare'
  | 'sesquiquadrate';

/**
 * アスペクトの調子。
 *
 * 四柱推命の合・沖を良し悪しにしなかったのと同じで、これも「効き方の向き」であって
 * 点数ではない。soft がよい、hard が悪い、という意味では使わない。
 */
export type AspectTone = 'soft' | 'hard' | 'neutral';

export interface AspectDef {
  kind: AspectKind;
  label: string;
  /** ちょうどの角度 */
  angle: number;
  tone: AspectTone;
  /** メジャーアスペクトか */
  major: boolean;
  symbol: string;
  note: string;
}

export const ASPECTS: AspectDef[] = [
  {
    kind: 'conjunction',
    label: 'コンジャンクション',
    angle: 0,
    tone: 'neutral',
    major: true,
    symbol: '☌',
    note: '重なる。二つの働きが混ざって一つに見える',
  },
  {
    kind: 'opposition',
    label: 'オポジション',
    angle: 180,
    tone: 'hard',
    major: true,
    symbol: '☍',
    note: '向かい合う。引っ張り合いになり、どちらかに寄せると反動が出る',
  },
  {
    kind: 'trine',
    label: 'トライン',
    angle: 120,
    tone: 'soft',
    major: true,
    symbol: '△',
    note: '通じ合う。労せず流れる代わりに、意識に上りにくい',
  },
  {
    kind: 'square',
    label: 'スクエア',
    angle: 90,
    tone: 'hard',
    major: true,
    symbol: '□',
    note: 'ぶつかる。摩擦が起きるぶん、いちばん自覚しやすい',
  },
  {
    kind: 'sextile',
    label: 'セクスタイル',
    angle: 60,
    tone: 'soft',
    major: true,
    symbol: '⚹',
    note: '助け合う。使おうとしたときに働く',
  },
  {
    kind: 'quincunx',
    label: 'クインカンクス',
    angle: 150,
    tone: 'hard',
    major: false,
    symbol: '⚻',
    note: '噛み合わない。共通点が無く、調整が要る',
  },
  {
    kind: 'semisextile',
    label: 'セミセクスタイル',
    angle: 30,
    tone: 'neutral',
    major: false,
    symbol: '⚺',
    note: '隣り合う。地続きだが視野が違う',
  },
  {
    kind: 'semisquare',
    label: 'セミスクエア',
    angle: 45,
    tone: 'hard',
    major: false,
    symbol: '∠',
    note: '小さくぶつかる',
  },
  {
    kind: 'sesquiquadrate',
    label: 'セスキコードレート',
    angle: 135,
    tone: 'hard',
    major: false,
    symbol: '⚼',
    note: '小さくぶつかる。オポジションの手前で軋む',
  },
];

export const ASPECT_BY_KIND: Record<AspectKind, AspectDef> = Object.fromEntries(
  ASPECTS.map((a) => [a.kind, a])
) as Record<AspectKind, AspectDef>;

/**
 * オーブ（ちょうどの角度からどれだけずれていても成立と見るか）の既定値。
 *
 * 流派によって幅があるところなので、設定から動かせるようにしてある。
 * 太陽と月は他より強く働くと見て、`luminaryBonus` のぶんだけ広く取る。
 */
export const DEFAULT_ORBS: Record<AspectKind, number> = {
  conjunction: 8,
  opposition: 8,
  trine: 8,
  square: 8,
  sextile: 6,
  quincunx: 2,
  semisextile: 2,
  semisquare: 2,
  sesquiquadrate: 2,
};

export const DEFAULT_LUMINARY_BONUS = 2;
