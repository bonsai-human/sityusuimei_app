/**
 * ホロスコープを LLM に渡すためのプロンプトを組み立てる。
 *
 * 度数だけを裸で渡すと読み違えられるので、サインとハウスを必ず添える。
 * アスペクトも「どの天体とどの天体が、どれだけのずれで」まで出す。
 *
 * 四柱推命と併記する統合テンプレートもここに置く。二つの体系を機械的に足し算させても
 * 意味が無いので、依頼文は「同じことを言っている点と、食い違う点を分けて述べる」形にしてある。
 */

import {
  STYLE_RULES,
  chartFootnote,
  renderChartBody,
  type PromptConfig,
  type PromptFormat,
} from '../prompt';
import type { Chart } from '../types';
import { formatOrb } from './aspects';
import {
  ANGLE_LABEL,
  ASPECT_BY_KIND,
  BODY_LABEL,
  BODY_NOTE,
  ELEMENT4_LABEL,
  HOUSE_NOTE,
  POINT_LABEL,
  QUALITY_LABEL,
  SIGN_LABEL,
  type AngleId,
} from './constants';
import { formatSignPosition, signPosition } from './math';
import {
  HOUSE_SYSTEM_LABEL,
  type Horoscope,
  type HoroscopePromptConfig,
  type HoroscopePromptSections,
  type HoroscopePromptTemplateId,
} from './types';

export interface HoroscopePromptTemplate {
  id: HoroscopePromptTemplateId;
  label: string;
  description: string;
  ask: string;
  /** 四柱推命の命式も必要か */
  needsChart?: boolean;
}

export const HOROSCOPE_PROMPT_TEMPLATES: HoroscopePromptTemplate[] = [
  {
    id: 'overview',
    label: '総合鑑定',
    description: '出生図全体から性質・強み・課題を読む',
    ask:
      '以下の西洋占星術の出生図を読み解いてください。まず太陽・月・アセンダントの三点を押さえ、' +
      'エレメントとクオリティの偏り、天体の集まっている場所を踏まえたうえで、' +
      'この人の基本的な性質、伸ばしやすい強み、つまずきやすい傾向を整理してください。' +
      '最後に、緊張のアスペクトのうち、意識して扱うとよいものを挙げてください。',
  },
  {
    id: 'work',
    label: '仕事・適職',
    description: '10室・MC・土星の配置から働き方を見る',
    ask:
      '以下の出生図から、この人に向いた働き方を読み解いてください。' +
      'MC と 10 室、その支配星の居場所、土星・火星の配置とアスペクトを踏まえ、' +
      '組織で力を発揮する型か独立向きか、どんな分野・役割が噛み合いやすいか、' +
      '逆に消耗しやすい環境はどんなものかを述べてください。',
  },
  {
    id: 'relationship',
    label: '恋愛・結婚',
    description: '金星・火星・7室と、そこに掛かるアスペクトを見る',
    ask:
      '以下の出生図から、対人関係と結婚について読み解いてください。' +
      '金星と火星のサイン・ハウス、7 室とその支配星、月の状態、' +
      'そこに掛かるアスペクトを踏まえて、関係の築き方の傾向と気をつけたい点を述べてください。',
  },
  {
    id: 'inner',
    label: '月と内面',
    description: '月・4室・海王星から、感情の動き方を見る',
    ask:
      '以下の出生図から、表に出にくい内面を読み解いてください。' +
      '月のサイン・ハウスとアスペクト、4 室と IC、12 室に入っている天体を踏まえて、' +
      '何に安心し、何に揺さぶられるのか、どうすると落ち着きを取り戻せるのかを述べてください。',
  },
  {
    id: 'health',
    label: '体質・傾向',
    description: 'エレメントの偏りと6室から体の傾向を見る',
    ask:
      '以下の出生図から、エレメントの偏りに現れる体質の傾向を読み解いてください。' +
      '不足しているエレメント、6 室とその支配星、土星の配置が体のどの側面に対応するかを述べ、' +
      '生活面で補いやすい工夫を挙げてください。医療的な診断ではなく、あくまで傾向として述べてください。',
  },
  {
    id: 'free',
    label: '自由記述',
    description: '聞きたいことを自分で書く',
    ask: '',
  },
  {
    id: 'combined',
    label: '四柱推命と併せて',
    description: '二つの体系を並べ、噛み合う点と食い違う点を読ませる',
    needsChart: true,
    ask:
      '同じ人物について、四柱推命の命式と西洋占星術の出生図を並べます。' +
      'まずそれぞれを個別に読み解いたうえで、**二つが同じことを指している点**と、' +
      '**食い違って見える点**を分けて述べてください。' +
      '食い違いを無理に一つの結論へまとめようとせず、どちらの体系の、どの要素がそう言わせているのかを' +
      '明示したまま並べてください。二つの体系は成り立ちも前提も別のものなので、' +
      '一致しない箇所があること自体は不自然ではありません。',
  },
];

/* ------------------------------------------------------------------ 補助 */

function subjectName(h: Horoscope, config: HoroscopePromptConfig): string {
  if (config.anonymize) return '本人';
  return h.input.name.trim() || '本人';
}

function position(lon: number): string {
  return formatSignPosition(signPosition(lon), SIGN_LABEL);
}

/** 「太陽 山羊座 10°25′（9室）逆行」の形。 */
function placementLine(
  h: Horoscope,
  id: Horoscope['placements'][number]['id'],
  sections: HoroscopePromptSections
): string | null {
  const p = h.placements.find((x) => x.id === id);
  if (!p) return null;
  const parts = [`${BODY_LABEL[p.id]} ${position(p.lon)}`];
  if (p.house != null) parts.push(`${p.house}室`);
  if (p.retrograde) parts.push('逆行');
  if (sections.speed) parts.push(`日々の動き ${p.speed >= 0 ? '+' : '−'}${Math.abs(p.speed).toFixed(2)}°`);
  if (p.range) parts.push(`時刻不明のため ${position(p.range.from)}〜${position(p.range.to)} の幅`);
  // 天体どうしの区切りに「／」を使うので、天体の中は「・」で分ける
  return parts.join('・');
}

const ANGLE_ORDER: AngleId[] = ['asc', 'mc', 'dsc', 'ic', 'vertex'];

/* -------------------------------------------------------------- Markdown */

function renderMarkdown(h: Horoscope, config: HoroscopePromptConfig): string {
  const s = config.sections;
  const lines: string[] = [];
  const push = (...xs: string[]) => lines.push(...xs);

  push('## ホロスコープ（出生図）');
  push('');
  push(`- 名前: ${subjectName(h, config)}`);
  push(`- 性別: ${h.input.gender === 'male' ? '男性' : '女性'}`);
  push(`- 出生: ${h.meta.standardDateTime}（${h.input.place.label}）`);
  if (s.timeDetail) {
    push(`- 世界時: ${h.meta.utc}`);
    push(
      `- 出生地の座標: 東経 ${h.input.place.longitude.toFixed(4)}°` +
        (h.input.place.latitude != null ? ` / 北緯 ${h.input.place.latitude.toFixed(4)}°` : '')
    );
  }
  push(`- 座標系: トロピカル（春分点を牡羊座 0 度とする）`);
  if (h.houses) push(`- ハウス: ${HOUSE_SYSTEM_LABEL[h.houses.system]}`);
  if (h.dayChart !== null) push(`- 昼夜: ${h.dayChart ? '昼の図（太陽が地平線の上）' : '夜の図（太陽が地平線の下）'}`);
  push('');

  push('### 天体');
  push('');
  push('| 天体 | サイン・度数 | 室 | 逆行 |');
  push('| --- | --- | --- | --- |');
  for (const p of h.placements) {
    if (!s.nodes && (p.id === 'northNode' || p.id === 'lilith')) continue;
    push(
      `| ${BODY_LABEL[p.id]} | ${position(p.lon)} | ${p.house ?? '—'} | ${p.retrograde ? 'R' : ''} |`
    );
  }
  push('');
  // 表だけだと対応を読み違えられることがあるので、一行でも並べておく
  push(
    h.placements
      .filter((p) => s.nodes || (p.id !== 'northNode' && p.id !== 'lilith'))
      .map((p) => placementLine(h, p.id, s))
      .filter((x): x is string => x !== null)
      .join(' ／ ')
  );
  push('');

  if (s.angles && h.angles) {
    push('### 感受点');
    push('');
    for (const id of ANGLE_ORDER) {
      push(`- ${ANGLE_LABEL[id]}: ${position(h.angles[id].lon)}`);
    }
    push('');
  }

  if (s.houses && h.houses) {
    push(`### ハウスのカスプ（${HOUSE_SYSTEM_LABEL[h.houses.system]}）`);
    push('');
    for (const [i, cusp] of h.houses.cusps.entries()) {
      const inside = h.placements.filter((p) => p.house === i + 1).map((p) => BODY_LABEL[p.id]);
      push(`- ${i + 1}室 ${position(cusp)}${inside.length > 0 ? ` — ${inside.join('・')}` : ''}`);
    }
    push('');
  }

  if (s.aspects) {
    push('### アスペクト');
    push('');
    if (h.aspects.length === 0) {
      push('（このオーブの範囲では成立していません）');
    } else {
      push('| 天体 | 角度 | 天体 | オーブ | 接近／分離 |');
      push('| --- | --- | --- | --- | --- |');
      for (const a of h.aspects) {
        const def = ASPECT_BY_KIND[a.kind];
        const phase = a.applying === null ? '—' : a.applying ? '接近' : '分離';
        push(
          `| ${POINT_LABEL[a.a]} | ${def.label}（${def.angle}度） | ${POINT_LABEL[a.b]} | ${formatOrb(
            a.orb
          )} | ${phase} |`
        );
      }
    }
    push('');
  }

  if (s.elements) {
    push('### エレメントとクオリティ');
    push('');
    push(
      '- エレメント: ' +
        h.elements.map((e) => `${ELEMENT4_LABEL[e.key]} ${e.count}`).join(' / ') +
        '（10 天体の数）'
    );
    push(
      '- クオリティ: ' + h.qualities.map((q) => `${QUALITY_LABEL[q.key]} ${q.count}`).join(' / ')
    );
    push('');
  }

  if (s.patterns) {
    const notes: string[] = [];
    if (h.ascRuler) {
      notes.push(
        `アセンダントの支配星は${BODY_LABEL[h.ascRuler.body]}で、${position(
          h.ascRuler.placement.lon
        )}${h.ascRuler.placement.house != null ? `（${h.ascRuler.placement.house}室）` : ''}にある`
      );
    }
    for (const st of h.stelliums) {
      notes.push(
        `${st.kind === 'sign' ? SIGN_LABEL[st.index] : `${st.index}室`}に${st.bodies
          .map((b) => BODY_LABEL[b])
          .join('・')}が集まっている`
      );
    }
    if (h.hemispheres) {
      notes.push(
        `天体は東（アセンダント側）に${h.hemispheres.east}・西に${h.hemispheres.west}、` +
          `地平線の上に${h.hemispheres.south}・下に${h.hemispheres.north}`
      );
    }
    if (notes.length > 0) {
      push('### 全体の傾き');
      push('');
      for (const n of notes) push(`- ${n}`);
      push('');
    }
  }

  if (s.glossary) {
    push('### 天体とハウスの対応');
    push('');
    for (const p of h.placements) {
      if (!s.nodes && (p.id === 'northNode' || p.id === 'lilith')) continue;
      push(`- ${BODY_LABEL[p.id]}: ${BODY_NOTE[p.id]}`);
    }
    push('');
    for (const [i, note] of HOUSE_NOTE.entries()) push(`- ${i + 1}室: ${note}`);
    push('');
  }

  if (h.meta.notes.length > 0) {
    push('### 読むときの断り');
    push('');
    for (const n of h.meta.notes) push(`- ${n}`);
    push('');
  }

  return lines.join('\n').trimEnd();
}

/* ------------------------------------------------------------------ JSON */

export function horoscopeJson(
  h: Horoscope,
  config: HoroscopePromptConfig
): Record<string, unknown> {
  const s = config.sections;
  const bodies = h.placements.filter(
    (p) => s.nodes || (p.id !== 'northNode' && p.id !== 'lilith')
  );

  const payload: Record<string, unknown> = {
    名前: subjectName(h, config),
    性別: h.input.gender === 'male' ? '男性' : '女性',
    出生: h.meta.standardDateTime,
    出生地: h.input.place.label,
    座標系: 'トロピカル',
    天体: bodies.map((p) => ({
      天体: BODY_LABEL[p.id],
      サイン: SIGN_LABEL[p.position.sign],
      度: Number(p.position.degree.toFixed(4)),
      黄経: Number(p.lon.toFixed(4)),
      ...(p.house != null ? { 室: p.house } : {}),
      ...(p.retrograde ? { 逆行: true } : {}),
      ...(s.speed ? { 日々の動き: Number(p.speed.toFixed(4)) } : {}),
      ...(p.range
        ? { 時刻不明の幅: [Number(p.range.from.toFixed(4)), Number(p.range.to.toFixed(4))] }
        : {}),
    })),
  };

  if (s.timeDetail) {
    payload['世界時'] = h.meta.utc;
    payload['経度'] = h.input.place.longitude;
    if (h.input.place.latitude != null) payload['緯度'] = h.input.place.latitude;
  }

  if (s.angles && h.angles) {
    payload['感受点'] = Object.fromEntries(
      ANGLE_ORDER.map((id) => [
        ANGLE_LABEL[id],
        {
          サイン: SIGN_LABEL[h.angles![id].position.sign],
          度: Number(h.angles![id].position.degree.toFixed(4)),
          黄経: Number(h.angles![id].lon.toFixed(4)),
        },
      ])
    );
  }

  if (s.houses && h.houses) {
    payload['ハウス'] = {
      方式: HOUSE_SYSTEM_LABEL[h.houses.system],
      カスプ: h.houses.cusps.map((c, i) => ({
        室: i + 1,
        サイン: SIGN_LABEL[signPosition(c).sign],
        度: Number(signPosition(c).degree.toFixed(4)),
        天体: h.placements.filter((p) => p.house === i + 1).map((p) => BODY_LABEL[p.id]),
      })),
    };
  }

  if (s.aspects) {
    payload['アスペクト'] = h.aspects.map((a) => ({
      A: POINT_LABEL[a.a],
      種類: ASPECT_BY_KIND[a.kind].label,
      角度: a.exact,
      B: POINT_LABEL[a.b],
      オーブ: Number(a.orb.toFixed(2)),
      ...(a.applying === null ? {} : { 接近: a.applying }),
    }));
  }

  if (s.elements) {
    payload['エレメント'] = Object.fromEntries(
      h.elements.map((e) => [ELEMENT4_LABEL[e.key], e.count])
    );
    payload['クオリティ'] = Object.fromEntries(
      h.qualities.map((q) => [QUALITY_LABEL[q.key], q.count])
    );
  }

  if (s.patterns) {
    payload['全体の傾き'] = {
      ...(h.dayChart !== null ? { 昼の図: h.dayChart } : {}),
      ...(h.ascRuler
        ? {
            ASCの支配星: {
              天体: BODY_LABEL[h.ascRuler.body],
              サイン: SIGN_LABEL[h.ascRuler.placement.position.sign],
              ...(h.ascRuler.placement.house != null ? { 室: h.ascRuler.placement.house } : {}),
            },
          }
        : {}),
      ...(h.stelliums.length > 0
        ? {
            集まり: h.stelliums.map((st) => ({
              場所: st.kind === 'sign' ? SIGN_LABEL[st.index] : `${st.index}室`,
              天体: st.bodies.map((b) => BODY_LABEL[b]),
            })),
          }
        : {}),
      ...(h.hemispheres ? { 半球: h.hemispheres } : {}),
    };
  }

  if (h.meta.notes.length > 0) payload['断り'] = h.meta.notes;

  return payload;
}

/* --------------------------------------------------------------- Compact */

function renderCompact(h: Horoscope, config: HoroscopePromptConfig): string {
  const s = config.sections;
  const lines: string[] = [];

  lines.push(
    `${subjectName(h, config)}／${h.input.gender === 'male' ? '男' : '女'}／${
      h.meta.standardDateTime
    }／${h.input.place.label}`
  );

  const short = (lon: number) => {
    const p = signPosition(lon);
    return `${SIGN_LABEL[p.sign].replace('座', '')}${p.deg}.${String(p.min).padStart(2, '0')}`;
  };

  lines.push(
    h.placements
      .filter((p) => s.nodes || (p.id !== 'northNode' && p.id !== 'lilith'))
      .map(
        (p) =>
          `${BODY_LABEL[p.id]}${short(p.lon)}${p.house != null ? `H${p.house}` : ''}${
            p.retrograde ? 'R' : ''
          }`
      )
      .join(' ')
  );

  if (s.angles && h.angles) {
    lines.push(ANGLE_ORDER.map((id) => `${ANGLE_LABEL[id]}${short(h.angles![id].lon)}`).join(' '));
  }
  if (s.houses && h.houses) {
    lines.push('カスプ ' + h.houses.cusps.map((c, i) => `${i + 1}:${short(c)}`).join(' '));
  }
  if (s.aspects) {
    lines.push(
      'アスペクト ' +
        h.aspects
          .map(
            (a) =>
              `${POINT_LABEL[a.a]}${ASPECT_BY_KIND[a.kind].symbol}${POINT_LABEL[a.b]}(${a.orb.toFixed(
                1
              )})`
          )
          .join(' ')
    );
  }
  if (s.elements) {
    lines.push(
      '元素 ' +
        h.elements.map((e) => `${ELEMENT4_LABEL[e.key]}${e.count}`).join('') +
        ' 区分 ' +
        h.qualities.map((q) => `${QUALITY_LABEL[q.key]}${q.count}`).join('')
    );
  }
  if (h.meta.notes.length > 0) lines.push('断り: ' + h.meta.notes.join(' '));

  return lines.join('\n');
}

/* ------------------------------------------------------------------ 本体 */

export function renderHoroscopeBody(h: Horoscope, config: HoroscopePromptConfig): string {
  if (config.format === 'json') return JSON.stringify(horoscopeJson(h, config), null, 2);
  if (config.format === 'compact') return renderCompact(h, config);
  return renderMarkdown(h, config);
}

export function horoscopeFootnote(h: Horoscope): string {
  return (
    `※ 出生図は「命式ノート」で算出したものです。トロピカル、${
      h.houses ? HOUSE_SYSTEM_LABEL[h.houses.system] : 'ハウスなし'
    }、ドラゴンヘッドは${h.options.nodeKind === 'mean' ? '平均' : '真'}の交点です。` +
    '天体の位置は世界時から求めており、四柱推命で使う真太陽時の補正は掛けていません。'
  );
}

/**
 * 回答の作法のうち、四柱推命の語で書かれているものを言い換える。
 *
 * 「根拠となる干支・十神を明示せよ」はホロスコープには通じないので、
 * 天体・サイン・ハウスの語に置き換える。それ以外の作法は体系によらないので共有する。
 */
export const HOROSCOPE_STYLE_OVERRIDES: Record<string, { label: string; text: string }> = {
  cite: {
    label: '根拠となる出生図の要素を明示させる',
    text: '判断のたびに、その根拠となる天体・サイン・ハウス・アスペクトを明示してください。',
  },
};

export const COMBINED_STYLE_OVERRIDES: Record<string, { label: string; text: string }> = {
  cite: {
    label: '根拠がどちらの体系の何なのかを明示させる',
    text:
      '判断のたびに、その根拠が四柱推命の何（どの柱の干支・十神・蔵干）なのか、' +
      '出生図の何（天体・サイン・ハウス・アスペクト）なのかを明示してください。',
  },
};

export function horoscopeStyleRules(kind: 'horoscope' | 'combined') {
  const overrides = kind === 'combined' ? COMBINED_STYLE_OVERRIDES : HOROSCOPE_STYLE_OVERRIDES;
  return STYLE_RULES.map((r) => ({ ...r, ...(overrides[r.id] ?? {}) }));
}

function styleSection(styleRuleIds: string[], kind: 'horoscope' | 'combined'): string[] {
  const rules = horoscopeStyleRules(kind).filter((r) => styleRuleIds.includes(r.id));
  if (rules.length === 0) return [];
  return ['', '## 回答の作法', '', ...rules.map((r) => `- ${r.text}`)];
}

function wrap(body: string, format: PromptFormat): string[] {
  if (format === 'json') return ['```json', body, '```'];
  if (format === 'compact') return ['```', body, '```'];
  return [body];
}

function askOf(config: HoroscopePromptConfig, fallback: string): string {
  const template = HOROSCOPE_PROMPT_TEMPLATES.find((t) => t.id === config.templateId)!;
  if (template.id !== 'free') return template.ask;
  return (config.freeText ?? '').trim() || fallback;
}

export function buildHoroscopePrompt(h: Horoscope, config: HoroscopePromptConfig): string {
  const ask = askOf(config, '以下の西洋占星術の出生図について、気づいたことを述べてください。');

  return [
    ask,
    '',
    ...wrap(renderHoroscopeBody(h, config), config.format),
    ...styleSection(config.styleRuleIds, 'horoscope'),
    '',
    '---',
    '',
    horoscopeFootnote(h),
  ].join('\n');
}

/**
 * 四柱推命の命式とホロスコープを並べたプロンプト。
 *
 * 二つの体系は前提が別なので、片方の言葉でもう片方を言い換えさせない。
 * それぞれを個別に読ませたうえで、一致する点と食い違う点を分けさせる。
 */
export function buildCombinedPrompt(
  chart: Chart,
  h: Horoscope,
  config: HoroscopePromptConfig,
  chartConfig: PromptConfig
): string {
  const ask = askOf(
    config,
    '以下の四柱推命の命式と西洋占星術の出生図について、気づいたことを述べてください。'
  );

  // 形式は片方に揃える。JSON のときは 1 つのオブジェクトにまとめないと、
  // 2 つのコードブロックがどうつながっているのかが読み取れない
  const chartAligned: PromptConfig = { ...chartConfig, format: config.format };

  const parts: string[] = [ask, ''];

  if (config.format === 'json') {
    parts.push(
      '```json',
      JSON.stringify(
        {
          四柱推命: JSON.parse(renderChartBody(chart, chartAligned)),
          ホロスコープ: horoscopeJson(h, config),
        },
        null,
        2
      ),
      '```'
    );
  } else {
    parts.push(...wrap(renderChartBody(chart, chartAligned), config.format));
    parts.push('');
    parts.push(...wrap(renderHoroscopeBody(h, config), config.format));
  }

  parts.push(...styleSection(config.styleRuleIds, 'combined'));
  parts.push('', '---', '', chartFootnote(chart), horoscopeFootnote(h));

  return parts.join('\n');
}
