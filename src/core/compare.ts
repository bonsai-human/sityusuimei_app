/**
 * 2 つの命式を突き合わせる。
 *
 * 相性を点数で言い切ることはしない。四柱推命の合・沖は良し悪しではなく作用の向きで、
 * 何が良いかは当人が何を望むかで変わるからだ。ここでは「どの柱とどの柱に何が掛かって
 * いるか」を余さず拾い、読み取りの手がかりになる事実だけを添える。
 */

import { ELEMENT_LABEL, type Element } from './constants';
import { elementOfGan } from './ganzhi';
import {
  RELATION_TONE,
  SLOT_LABEL,
  findCrossRelations,
  isGanRelation,
  type CrossRelation,
  type PillarSlot,
} from './relations';
import type { Chart } from './types';

export interface ComparisonHighlight {
  title: string;
  body: string;
}

export interface Comparison {
  self: Chart;
  other: Chart;
  relations: CrossRelation[];
  bonds: CrossRelation[];
  clashes: CrossRelation[];
  /** 日柱どうしなど、特に読み所になる関係 */
  highlights: ComparisonHighlight[];
  /** 相手の五行が自分に何を補うか */
  elementSupport: {
    element: Element;
    selfCount: number;
    otherCount: number;
    note: string;
  }[];
}

const SLOT_MEANING: Record<PillarSlot, string> = {
  year: '育ちや価値観の土台',
  month: '社会での立ち位置や働き方',
  day: '自分自身と、伴侶の座',
  hour: '将来や、こだわりの向かう先',
};

function relationLine(r: CrossRelation, selfName: string, otherName: string): string {
  const produced = r.producedElement ? `、${ELEMENT_LABEL[r.producedElement]}に化す` : '';
  return `${selfName}の${SLOT_LABEL[r.selfSlot]}と${otherName}の${SLOT_LABEL[r.otherSlot]}が${r.kind}（${r.label}）${produced}`;
}

export function compareCharts(self: Chart, other: Chart): Comparison {
  const relations = findCrossRelations(
    self.pillars.map((p) => ({ slot: p.slot, gan: p.gan, zhi: p.zhi })),
    other.pillars.map((p) => ({ slot: p.slot, gan: p.gan, zhi: p.zhi }))
  );

  const bonds = relations.filter((r) => RELATION_TONE[r.kind] === 'bond');
  const clashes = relations.filter((r) => RELATION_TONE[r.kind] === 'clash');

  const selfName = self.input.name.trim() || '自分';
  const otherName = other.input.name.trim() || '相手';

  const highlights: ComparisonHighlight[] = [];

  // 日柱は自分自身と伴侶の座なので、そこに掛かる関係は特に見る
  const dayToDay = relations.filter((r) => r.selfSlot === 'day' && r.otherSlot === 'day');
  if (dayToDay.length > 0) {
    highlights.push({
      title: '日柱どうし',
      body:
        dayToDay.map((r) => `${r.kind}（${r.label}）`).join('、') +
        '。日柱は自分自身と伴侶の座にあたるため、二人の距離感に直接あらわれやすいところ。',
    });
  }

  const dayMasterPair = relations.find(
    (r) => r.selfSlot === 'day' && r.otherSlot === 'day' && isGanRelation(r.kind)
  );
  if (dayMasterPair?.kind === '天干合') {
    highlights.push({
      title: '日干が合する',
      body: `${self.dayMaster}と${other.dayMaster}が天干合。互いの本体どうしが引き合う配置で、惹かれ合いやすい一方、二人の世界に閉じやすい面もある。`,
    });
  }

  const dayBranch = relations.filter(
    (r) => (r.selfSlot === 'day' || r.otherSlot === 'day') && !isGanRelation(r.kind)
  );
  if (dayBranch.length > 0 && dayToDay.length === 0) {
    highlights.push({
      title: '伴侶の座に掛かるもの',
      body: dayBranch.map((r) => relationLine(r, selfName, otherName)).join('。') + '。',
    });
  }

  const monthPair = relations.filter((r) => r.selfSlot === 'month' && r.otherSlot === 'month');
  if (monthPair.length > 0) {
    highlights.push({
      title: '月柱どうし',
      body:
        monthPair.map((r) => `${r.kind}（${r.label}）`).join('、') +
        `。${SLOT_MEANING.month}が重なる場所なので、生活のリズムや働き方の噛み合い方に出やすい。`,
    });
  }

  if (relations.length === 0) {
    highlights.push({
      title: '直接の作用は薄い',
      body: '柱どうしで成立している合・沖・刑・害・破がありません。互いに引きも押しもしにくく、距離感は本人たちの選び方しだいの配置です。',
    });
  } else if (highlights.length === 0) {
    // 関係はあるが日柱にも月柱にも掛からない場合。どこに掛かっているのかだけは必ず示す
    const slots = [...new Set(relations.flatMap((r) => [r.selfSlot, r.otherSlot]))];
    highlights.push({
      title: '年柱・時柱まわりでの作用',
      body:
        `日柱や月柱には掛からず、${slots.map((s) => SLOT_LABEL[s]).join('・')}のあたりで` +
        `${relations.map((r) => `${r.kind}（${r.label}）`).join('、')}が成立しています。` +
        `${SLOT_MEANING.year}や${SLOT_MEANING.hour}といった、日々の距離感より一段外側に出やすい配置です。`,
    });
  }

  // 相手の五行が、自分に足りないものを補っているか
  const selfCounts = new Map(self.elements.map((e) => [e.element, e.simple]));
  const otherCounts = new Map(other.elements.map((e) => [e.element, e.simple]));
  const elementSupport = self.elements.map((e) => {
    const selfCount = selfCounts.get(e.element) ?? 0;
    const otherCount = otherCounts.get(e.element) ?? 0;
    let note: string;
    if (selfCount === 0 && otherCount >= 2) {
      note = `${selfName}に無い${ELEMENT_LABEL[e.element]}を${otherName}が多く持っている`;
    } else if (selfCount === 0 && otherCount >= 1) {
      note = `${selfName}に無い${ELEMENT_LABEL[e.element]}を${otherName}が持っている`;
    } else if (selfCount >= 3 && otherCount >= 3) {
      note = `二人とも${ELEMENT_LABEL[e.element]}が多く、偏りが強まりやすい`;
    } else if (selfCount >= 1 && otherCount === 0) {
      note = `${otherName}に無い${ELEMENT_LABEL[e.element]}を${selfName}が持っている`;
    } else {
      note = '';
    }
    return { element: e.element, selfCount, otherCount, note };
  });

  return { self, other, relations, bonds, clashes, highlights, elementSupport };
}

/**
 * 比較の内容を、そのまま LLM に渡せる文章にする。
 * 命式そのものは `prompt.ts` が出すので、ここは二人の関係の部分だけを受け持つ。
 */
export function comparisonSummary(c: Comparison): string {
  const selfName = c.self.input.name.trim() || '自分';
  const otherName = c.other.input.name.trim() || '相手';
  const lines: string[] = [];

  lines.push(`### ${selfName}と${otherName}の関係`);
  lines.push('');
  lines.push(
    `- ${selfName}: 日干 ${c.self.dayMaster}（${ELEMENT_LABEL[c.self.dayMasterElement]}）／` +
      c.self.pillars.map((p) => `${p.gan}${p.zhi}`).join(' ')
  );
  lines.push(
    `- ${otherName}: 日干 ${c.other.dayMaster}（${ELEMENT_LABEL[c.other.dayMasterElement]}）／` +
      c.other.pillars.map((p) => `${p.gan}${p.zhi}`).join(' ')
  );
  lines.push('');

  if (c.relations.length === 0) {
    lines.push('柱どうしで成立している関係はありません。');
  } else {
    lines.push(`| ${selfName}の柱 | ${otherName}の柱 | 関係 | 干支 |`);
    lines.push('| --- | --- | --- | --- |');
    for (const r of c.relations) {
      const produced = r.producedElement ? `${r.label} → ${ELEMENT_LABEL[r.producedElement]}` : r.label;
      lines.push(
        `| ${SLOT_LABEL[r.selfSlot]} | ${SLOT_LABEL[r.otherSlot]} | ${r.kind} | ${produced} |`
      );
    }
    lines.push('');
    lines.push(`結びつき ${c.bonds.length} 件、揺さぶり ${c.clashes.length} 件。`);
  }

  const support = c.elementSupport.filter((e) => e.note);
  if (support.length > 0) {
    lines.push('');
    lines.push('五行の補い合い:');
    for (const e of support) lines.push(`- ${e.note}`);
  }

  lines.push('');
  lines.push('読み所:');
  for (const h of c.highlights) lines.push(`- ${h.title}: ${h.body}`);

  return lines.join('\n');
}

/** 相手の日干が自分から見て何にあたるか（十神）。呼び方の目安に使う。 */
export function dayMasterRelation(self: Chart, other: Chart): string {
  const selfEl = elementOfGan(self.dayMaster);
  const otherEl = elementOfGan(other.dayMaster);
  if (selfEl === otherEl) return '同じ五行';
  return `${ELEMENT_LABEL[selfEl]}と${ELEMENT_LABEL[otherEl]}`;
}
