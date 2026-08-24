/**
 * 命式を LLM に渡すためのプロンプトを組み立てる。
 *
 * 命式は表で見ると一目で分かるが、そのまま文章に流し込むと「どの柱の何なのか」が
 * 曖昧になって読み違えられやすい。ここでは柱・十神・蔵干の対応が崩れない形に
 * 整形したうえで、鑑定の目的と出力の作法を添える。
 */

import { ELEMENT_LABEL, TEN_GOD_NOTE } from './constants';
import { RELATION_TONE, SLOT_LABEL } from './relations';
import { formatMinutes } from './solarTime';
import type { Chart, DaYunEntry, Pillar } from './types';

export type PromptFormat = 'markdown' | 'json' | 'compact';

export type PromptTemplateId =
  | 'overview'
  | 'thisYear'
  | 'luckFlow'
  | 'work'
  | 'relationship'
  | 'health'
  | 'free';

export interface PromptTemplate {
  id: PromptTemplateId;
  label: string;
  description: string;
  /** 鑑定の依頼文。命式データの前に置かれる */
  ask: string;
  /** このテンプレでは大運・流年を必ず含める */
  needsLuck?: boolean;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'overview',
    label: '総合鑑定',
    description: '命式全体から性質・強み・課題を読む',
    ask:
      '以下の四柱推命の命式を読み解いてください。日干の強弱と調候（季節と寒暖）をまず押さえたうえで、' +
      'この人の基本的な性質、伸ばしやすい強み、つまずきやすい傾向を整理してください。' +
      '最後に、用神（補うとよい五行）の候補とその理由を挙げてください。',
  },
  {
    id: 'thisYear',
    label: '今年の運勢',
    description: '現在の大運・流年と命式の作用を見る',
    ask:
      '以下の四柱推命の命式について、現在めぐっている大運と今年の流年が、命式にどう作用しているかを読み解いてください。' +
      '干支どうしの合・沖・刑・害がどこに掛かるかを具体的に指摘し、今年に起きやすいこと、' +
      '意識しておくとよいことを述べてください。',
    needsLuck: true,
  },
  {
    id: 'luckFlow',
    label: '大運の流れ',
    description: '人生全体の運の移り変わりを俯瞰する',
    ask:
      '以下の四柱推命の命式について、大運の流れを人生全体の物語として読み解いてください。' +
      'それぞれの大運が命式の何を強め、何を弱めるのかを述べ、時期ごとの転換点がどこに来そうかを示してください。',
    needsLuck: true,
  },
  {
    id: 'work',
    label: '仕事・適職',
    description: '官星・財星・食傷の配置から働き方を見る',
    ask:
      '以下の四柱推命の命式から、この人に向いた働き方を読み解いてください。' +
      '官星・財星・食傷・印星の配置と強弱を踏まえ、組織で力を発揮する型か独立向きか、' +
      'どんな分野・役割が噛み合いやすいか、逆に消耗しやすい環境はどんなものかを述べてください。',
  },
  {
    id: 'relationship',
    label: '恋愛・結婚',
    description: '日支・配偶者星と、それに掛かる関係を見る',
    ask:
      '以下の四柱推命の命式から、対人関係と結婚について読み解いてください。' +
      '配偶者の座である日支の状態、配偶者星（男性なら財星、女性なら官星）の強弱と位置、' +
      'そこに掛かる合・沖・刑・害を踏まえて、関係の築き方の傾向と気をつけたい点を述べてください。',
  },
  {
    id: 'health',
    label: '体質・健康',
    description: '五行の偏りから体の傾向を見る',
    ask:
      '以下の四柱推命の命式から、五行の偏りに現れる体質の傾向を読み解いてください。' +
      '過多な五行と不足している五行がそれぞれ体のどの側面に対応するかを述べ、' +
      '生活面で補いやすい工夫を挙げてください。医療的な診断ではなく、あくまで傾向として述べてください。',
  },
  {
    id: 'free',
    label: '自由記述',
    description: '聞きたいことを自分で書く',
    ask: '',
  },
];

/** プロンプト末尾に足せる出力の作法。 */
export interface StyleRule {
  id: string;
  label: string;
  text: string;
  defaultOn: boolean;
}

export const STYLE_RULES: StyleRule[] = [
  {
    id: 'cite',
    label: '根拠となる命式の要素を明示させる',
    text: '判断のたびに、その根拠となる干支・十神・蔵干がどの柱のものかを明示してください。',
    defaultOn: true,
  },
  {
    id: 'hedge',
    label: '断定を避けさせる',
    text: '断定は避け、「〜の傾向がある」「〜が出やすい」といった書き方をしてください。読み方が分かれる箇所は、その旨を書いてください。',
    defaultOn: true,
  },
  {
    id: 'gloss',
    label: '専門用語に注釈を付けさせる',
    text: '専門用語を使うときは、初出時に短い注釈を括弧で添えてください。',
    defaultOn: true,
  },
  {
    id: 'noFortune',
    label: '断定的な吉凶・予言を避けさせる',
    text: '「必ずこうなる」といった予言や、不安を煽る書き方はしないでください。医療・法律・投資の判断材料としては扱わないでください。',
    defaultOn: true,
  },
  {
    id: 'structure',
    label: '見出しを付けて構造化させる',
    text: '見出しを付けて章立てし、最後に3〜5行の要約を置いてください。',
    defaultOn: false,
  },
  {
    id: 'ask',
    label: '足りない情報があれば質問させる',
    text: '読み解くうえで前提が足りないと感じたら、決めつけずに質問してください。',
    defaultOn: false,
  },
];

/** 命式のどの情報を含めるか。 */
export interface PromptSections {
  hidden: boolean;
  stage: boolean;
  naYin: boolean;
  xunKong: boolean;
  relations: boolean;
  elements: boolean;
  strength: boolean;
  daYun: boolean;
  liuNian: boolean;
  extras: boolean;
  timeDetail: boolean;
  tenGodGlossary: boolean;
}

export const DEFAULT_SECTIONS: PromptSections = {
  hidden: true,
  stage: true,
  naYin: false,
  xunKong: true,
  relations: true,
  elements: true,
  strength: true,
  daYun: true,
  liuNian: true,
  extras: false,
  timeDetail: true,
  tenGodGlossary: false,
};

export interface PromptConfig {
  templateId: PromptTemplateId;
  format: PromptFormat;
  sections: PromptSections;
  styleRuleIds: string[];
  /** 自由記述テンプレのときの質問文 */
  freeText?: string;
  /** 名前を伏せる */
  anonymize: boolean;
  /** 大運・流年の基準年（既定は今年） */
  focusYear: number;
}

export function defaultPromptConfig(focusYear: number): PromptConfig {
  return {
    templateId: 'overview',
    format: 'markdown',
    sections: { ...DEFAULT_SECTIONS },
    styleRuleIds: STYLE_RULES.filter((r) => r.defaultOn).map((r) => r.id),
    anonymize: false,
    focusYear,
  };
}

/* ------------------------------------------------------------------ 補助 */

function pillarLabel(p: Pillar): string {
  return SLOT_LABEL[p.slot];
}

function currentDaYun(chart: Chart, year: number): DaYunEntry | undefined {
  return chart.luck.entries.find((e) => year >= e.startYear && year <= e.endYear);
}

function subjectName(chart: Chart, config: PromptConfig): string {
  if (config.anonymize) return '本人';
  return chart.input.name.trim() || '本人';
}

function genderLabel(chart: Chart): string {
  return chart.input.gender === 'male' ? '男性' : '女性';
}

/* -------------------------------------------------------------- Markdown */

function renderMarkdown(chart: Chart, config: PromptConfig): string {
  const s = config.sections;
  const lines: string[] = [];
  const push = (...xs: string[]) => lines.push(...xs);

  push(`## 命式`);
  push('');
  push(`- 名前: ${subjectName(chart, config)}`);
  push(`- 性別: ${genderLabel(chart)}`);
  push(`- 生年月日: ${chart.meta.solarDate}（旧暦 ${chart.meta.lunarDate}）`);
  if (chart.meta.standardDateTime) {
    push(`- 出生時刻: ${chart.meta.standardDateTime}（${chart.input.place.label}）`);
    if (s.timeDetail && chart.meta.trueSolarDateTime) {
      const c = chart.meta.correction;
      const detail = c
        ? `経度補正 ${formatMinutes(c.longitudeMinutes)} / 均時差 ${formatMinutes(
            c.equationOfTimeMinutes
          )} → 適用 ${formatMinutes(c.totalMinutes)}`
        : '補正なし';
      push(`- 真太陽時: ${chart.meta.trueSolarDateTime}（${detail}）`);
    }
  } else {
    push(`- 出生時刻: 不明（時柱なしの三柱で見ています）`);
  }
  push(`- 年齢: 満${chart.age.actual}歳（${chart.age.asOf}時点）`);
  push(`- 節入り: ${chart.meta.prevJie.name} ${chart.meta.prevJie.localDateTime}（生後は次節 ${chart.meta.nextJie.name} まで）`);
  push(`- 月令（司令の蔵干）: ${chart.meta.monthRuler}（節入りから${chart.meta.daysFromJie}日）`);
  push('');

  push(`### 四柱`);
  push('');
  // 表だけだと天干と地支の対応を読み違えられることがあるので、干支を一行でも並べておく
  push(chart.pillars.map((p) => `${pillarLabel(p)} ${p.gan}${p.zhi}`).join(' ／ '));
  push('');
  const head = ['', ...chart.pillars.map(pillarLabel)];
  const rows: string[][] = [
    ['天干', ...chart.pillars.map((p) => p.gan)],
    ['天干の十神', ...chart.pillars.map((p) => p.ganTenGod)],
    ['地支', ...chart.pillars.map((p) => p.zhi)],
    ['地支の十神', ...chart.pillars.map((p) => p.zhiTenGod)],
  ];
  if (s.hidden) {
    rows.push([
      '蔵干（余気→本気）',
      ...chart.pillars.map((p) =>
        p.hidden.map((h) => `${h.gan}:${h.tenGod}`).join(' / ')
      ),
    ]);
  }
  if (s.stage) rows.push(['十二運', ...chart.pillars.map((p) => p.stage)]);
  if (s.naYin) rows.push(['納音', ...chart.pillars.map((p) => p.naYin)]);
  if (s.xunKong) rows.push(['空亡', ...chart.pillars.map((p) => p.xunKong.join(''))]);

  push(`| ${head.join(' | ')} |`);
  push(`| ${head.map(() => '---').join(' | ')} |`);
  for (const r of rows) push(`| ${r.join(' | ')} |`);
  push('');
  push(`日干（日元）は **${chart.dayMaster}（${ELEMENT_LABEL[chart.dayMasterElement]}）**。十神はすべてこの日干から見た関係です。`);
  push('');

  if (s.elements) {
    push(`### 五行のバランス`);
    push('');
    push('| 五行 | 単純カウント | 蔵干を日数比で加重 |');
    push('| --- | --- | --- |');
    for (const e of chart.elements) {
      push(`| ${ELEMENT_LABEL[e.element]} | ${e.simple} | ${e.weighted.toFixed(2)} |`);
    }
    push('');
    push('※ 単純カウントは天干4＋地支4の8個。加重は地支の1を蔵干の日数比で配分したもの。');
    push('');
  }

  if (s.strength) {
    push(`### 日干の強弱（このアプリでの機械的な見立て）`);
    push('');
    push(`- 判定: **${chart.strength.verdict}**（日干を助ける勢力が ${(chart.strength.supportRatio * 100).toFixed(0)}%）`);
    for (const n of chart.strength.notes) push(`- ${n}`);
    push('');
    push('※ 強弱の重みの置き方は流派で差があります。上は機械的な目安なので、必要なら読み替えてください。');
    push('');
  }

  if (s.relations) {
    push(`### 干支の関係`);
    push('');
    if (chart.relations.length === 0) {
      push('成立している合・沖・刑・害・破はありません。');
    } else {
      const bonds = chart.relations.filter((r) => RELATION_TONE[r.kind] === 'bond');
      const clashes = chart.relations.filter((r) => RELATION_TONE[r.kind] === 'clash');
      const fmt = (label: string, list: typeof chart.relations) => {
        if (list.length === 0) return;
        push(`**${label}**`);
        push('');
        for (const r of list) {
          const slots = r.slots.map((x) => SLOT_LABEL[x]).join('・');
          const produced = r.producedElement ? ` → ${ELEMENT_LABEL[r.producedElement]}に化す` : '';
          push(`- ${r.kind}: ${r.label}（${slots}）${produced}`);
        }
        push('');
      };
      fmt('結びつき', bonds);
      fmt('揺さぶり', clashes);
    }
    push('');
  }

  if (s.daYun) {
    const current = currentDaYun(chart, config.focusYear);
    push(`### 大運`);
    push('');
    push(
      `${chart.luck.forward ? '順行' : '逆行'}。${chart.luck.startAge}歳（${chart.luck.startDate}）から巡り始めます。`
    );
    push('');
    push('| 期間 | 年齢 | 干支 | 天干の十神 | 地支の十神 | 十二運 |');
    push('| --- | --- | --- | --- | --- | --- |');
    for (const e of chart.luck.entries) {
      const mark = e === current ? ' ◀ 現在' : '';
      push(
        `| ${e.startYear}〜${e.endYear}${mark} | ${e.startAge}歳〜 | ${e.gan}${e.zhi} | ${e.ganTenGod} | ${e.zhiTenGod} | ${e.stage} |`
      );
    }
    push('');

    if (s.liuNian && current) {
      push(`### 流年（${current.gan}${current.zhi}大運の10年）`);
      push('');
      push('| 年 | 満年齢 | 干支 | 天干の十神 | 地支の十神 | 十二運 |');
      push('| --- | --- | --- | --- | --- | --- |');
      for (const n of current.liuNian) {
        const mark = n.year === config.focusYear ? ' ◀ 基準年' : '';
        push(
          `| ${n.year}${mark} | ${n.age}歳 | ${n.gan}${n.zhi} | ${n.ganTenGod} | ${n.zhiTenGod} | ${n.stage} |`
        );
      }
      push('');
    }
  }

  if (s.extras) {
    push(`### そのほか`);
    push('');
    push(`- 胎元: ${chart.meta.taiYuan}`);
    if (chart.meta.mingGong) push(`- 命宮: ${chart.meta.mingGong}`);
    push(`- 各柱の納音: ${chart.pillars.map((p) => `${pillarLabel(p)} ${p.naYin}`).join(' / ')}`);
    push('');
  }

  if (s.tenGodGlossary) {
    push(`### 十神の対応`);
    push('');
    const used = new Set<string>();
    for (const p of chart.pillars) {
      used.add(p.ganTenGod);
      used.add(p.zhiTenGod);
      for (const h of p.hidden) used.add(h.tenGod);
    }
    for (const [god, note] of Object.entries(TEN_GOD_NOTE)) {
      if (used.has(god)) push(`- ${god}: ${note}`);
    }
    push('');
  }

  return lines.join('\n').trim();
}

/* ------------------------------------------------------------------ JSON */

/**
 * JSON 形式の中身。
 * ホロスコープと並べて 1 つの JSON にするときにも使うので、文字列にする前で返す。
 */
export function chartJson(chart: Chart, config: PromptConfig): Record<string, unknown> {
  const s = config.sections;
  const current = currentDaYun(chart, config.focusYear);

  const payload: Record<string, unknown> = {
    名前: subjectName(chart, config),
    性別: genderLabel(chart),
    生年月日: chart.meta.solarDate,
    旧暦: chart.meta.lunarDate,
    出生時刻: chart.meta.standardDateTime ?? '不明',
    出生地: chart.input.place.label,
    満年齢: chart.age.actual,
    基準日: chart.age.asOf,
    日干: chart.dayMaster,
    日干の五行: ELEMENT_LABEL[chart.dayMasterElement],
    月令: chart.meta.monthRuler,
    節入り: `${chart.meta.prevJie.name} ${chart.meta.prevJie.localDateTime}`,
    四柱: chart.pillars.map((p) => ({
      柱: pillarLabel(p),
      干支: `${p.gan}${p.zhi}`,
      天干: p.gan,
      天干の十神: p.ganTenGod,
      地支: p.zhi,
      地支の十神: p.zhiTenGod,
      ...(s.hidden
        ? { 蔵干: p.hidden.map((h) => ({ 干: h.gan, 位: h.role, 十神: h.tenGod })) }
        : {}),
      ...(s.stage ? { 十二運: p.stage } : {}),
      ...(s.naYin ? { 納音: p.naYin } : {}),
      ...(s.xunKong ? { 空亡: p.xunKong.join('') } : {}),
    })),
  };

  if (s.timeDetail && chart.meta.trueSolarDateTime && chart.meta.correction) {
    payload['真太陽時'] = {
      補正後: chart.meta.trueSolarDateTime,
      経度補正分: Math.round(chart.meta.correction.longitudeMinutes * 10) / 10,
      均時差分: Math.round(chart.meta.correction.equationOfTimeMinutes * 10) / 10,
      合計分: Math.round(chart.meta.correction.totalMinutes * 10) / 10,
    };
  }

  if (s.elements) {
    payload['五行'] = Object.fromEntries(
      chart.elements.map((e) => [
        ELEMENT_LABEL[e.element],
        { 単純: e.simple, 加重: e.weighted },
      ])
    );
  }

  if (s.strength) {
    payload['日干の強弱'] = {
      判定: chart.strength.verdict,
      日干を助ける割合: Math.round(chart.strength.supportRatio * 100) / 100,
      得令: chart.strength.hasMonthSupport,
      通根: chart.strength.hasRoot,
    };
  }

  if (s.relations) {
    payload['干支の関係'] = chart.relations.map((r) => ({
      種類: r.kind,
      対象: r.label,
      柱: r.slots.map((x) => SLOT_LABEL[x]),
      ...(r.producedElement ? { 化す五行: ELEMENT_LABEL[r.producedElement] } : {}),
    }));
  }

  if (s.daYun) {
    payload['大運'] = {
      方向: chart.luck.forward ? '順行' : '逆行',
      起運年齢: chart.luck.startAge,
      一覧: chart.luck.entries.map((e) => ({
        期間: `${e.startYear}-${e.endYear}`,
        開始年齢: e.startAge,
        干支: `${e.gan}${e.zhi}`,
        天干の十神: e.ganTenGod,
        地支の十神: e.zhiTenGod,
        十二運: e.stage,
        現在: e === current,
      })),
    };
  }

  if (s.liuNian && current) {
    payload['流年'] = current.liuNian.map((n) => ({
      年: n.year,
      満年齢: n.age,
      干支: `${n.gan}${n.zhi}`,
      天干の十神: n.ganTenGod,
      地支の十神: n.zhiTenGod,
      十二運: n.stage,
      基準年: n.year === config.focusYear,
    }));
  }

  if (s.extras) {
    payload['そのほか'] = {
      胎元: chart.meta.taiYuan,
      ...(chart.meta.mingGong ? { 命宮: chart.meta.mingGong } : {}),
    };
  }

  return payload;
}

function renderJson(chart: Chart, config: PromptConfig): string {
  return JSON.stringify(chartJson(chart, config), null, 2);
}

/* --------------------------------------------------------------- Compact */

function renderCompact(chart: Chart, config: PromptConfig): string {
  const s = config.sections;
  const current = currentDaYun(chart, config.focusYear);
  const lines: string[] = [];

  lines.push(
    `${subjectName(chart, config)}／${genderLabel(chart)}／${chart.meta.solarDate}${
      chart.meta.standardDateTime ? ` ${chart.meta.standardDateTime.slice(-5)}` : '（時刻不明）'
    }／${chart.input.place.label}／満${chart.age.actual}歳`
  );
  lines.push(
    `四柱 ${chart.pillars.map((p) => `${pillarLabel(p).charAt(0)}:${p.gan}${p.zhi}`).join(' ')}`
  );
  lines.push(
    `十神 ${chart.pillars.map((p) => `${p.ganTenGod}/${p.zhiTenGod}`).join(' ')}`
  );
  if (s.hidden) {
    lines.push(
      `蔵干 ${chart.pillars.map((p) => p.hidden.map((h) => h.gan).join('')).join(' ')}`
    );
  }
  if (s.stage) lines.push(`十二運 ${chart.pillars.map((p) => p.stage).join(' ')}`);
  if (s.xunKong) {
    lines.push(`空亡 ${chart.pillars.map((p) => p.xunKong.join('')).join(' ')}`);
  }
  lines.push(`日干 ${chart.dayMaster}（${ELEMENT_LABEL[chart.dayMasterElement]}）／月令 ${chart.meta.monthRuler}`);
  if (s.elements) {
    lines.push(
      `五行 ${chart.elements.map((e) => `${ELEMENT_LABEL[e.element]}${e.simple}`).join(' ')}`
    );
  }
  if (s.strength) lines.push(`強弱 ${chart.strength.verdict}`);
  if (s.relations && chart.relations.length > 0) {
    lines.push(
      `関係 ${chart.relations.map((r) => `${r.kind}(${r.label})`).join(' ')}`
    );
  }
  if (s.daYun) {
    lines.push(
      `大運${chart.luck.forward ? '順' : '逆'}行 起運${chart.luck.startAge}歳 ` +
        chart.luck.entries
          .map((e) => `${e.startYear}${e.gan}${e.zhi}${e === current ? '*' : ''}`)
          .join(' ')
    );
  }
  if (s.liuNian && current) {
    lines.push(
      `流年 ` +
        current.liuNian
          .map((n) => `${n.year}${n.gan}${n.zhi}${n.year === config.focusYear ? '*' : ''}`)
          .join(' ')
    );
  }
  lines.push('（大運・流年の * は基準時点。十神はすべて日干から見た関係）');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ 本体 */

/**
 * 命式の本体だけを、指定の形式で組み立てる。依頼文も回答の作法も付かない。
 * ホロスコープと並べた統合プロンプトから、命式の側として呼ぶ。
 */
export function renderChartBody(chart: Chart, config: PromptConfig): string {
  if (config.format === 'json') return renderJson(chart, config);
  if (config.format === 'compact') return renderCompact(chart, config);
  return renderMarkdown(chart, config);
}

/** 命式をどう算出したかの断り。プロンプトの末尾に付ける。 */
export function chartFootnote(chart: Chart): string {
  return (
    `※ 命式は「命式ノート」で算出したものです。真太陽時の補正${
      chart.input.options.trueSolarTime ? 'あり' : 'なし'
    }、23時台は${chart.input.options.lateZi ? '夜子時説' : '早子時説'}で扱っています。`
  );
}

export function buildPrompt(chart: Chart, config: PromptConfig): string {
  const template = PROMPT_TEMPLATES.find((t) => t.id === config.templateId)!;
  const ask =
    template.id === 'free'
      ? (config.freeText ?? '').trim() ||
        '以下の四柱推命の命式について、気づいたことを述べてください。'
      : template.ask;

  const body = renderChartBody(chart, config);

  const rules = STYLE_RULES.filter((r) => config.styleRuleIds.includes(r.id));

  const parts: string[] = [ask, ''];

  if (config.format === 'json') {
    parts.push('```json', body, '```');
  } else if (config.format === 'compact') {
    parts.push('```', body, '```');
  } else {
    parts.push(body);
  }

  if (rules.length > 0) {
    parts.push('', '## 回答の作法', '');
    for (const r of rules) parts.push(`- ${r.text}`);
  }

  parts.push('', '---', '', chartFootnote(chart));

  return parts.join('\n');
}

/** おおよそのトークン数。日本語は1文字≒1トークンとして見積もる。 */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[　-ヿ㐀-鿿＀-￯]/g) ?? []).length;
  const rest = text.length - cjk;
  return Math.round(cjk + rest / 3.5);
}
