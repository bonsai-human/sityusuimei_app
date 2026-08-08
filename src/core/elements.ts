/**
 * 五行のバランスと、日干の強弱（身強・身弱）の判定。
 *
 * 強弱の判定は流派によって重みの置き方が違うので、ここでは
 * 「何をどう数えたか」を notes に残して根拠が追えるようにしている。
 */

import {
  ELEMENT_LABEL,
  ELEMENT_ORDER,
  ZHI_HIDDEN,
  generates,
  type Element,
  type Gan,
  type Zhi,
} from './constants';
import { elementOfGan } from './ganzhi';
import type { ElementCount, Pillar, StrengthAssessment } from './types';

/**
 * 五行カウントを 2 通りで出す。
 * - simple  : 天干 4 ＋ 地支 4 をそのまま 1 個ずつ数えた、市販アプリでよく見る数え方
 * - weighted: 地支の 1 を蔵干の日数比で配分した、実勢に近い数え方（合計は同じ）
 */
export function countElements(pillars: Pillar[]): ElementCount[] {
  const simple = new Map<Element, number>(ELEMENT_ORDER.map((e) => [e, 0]));
  const weighted = new Map<Element, number>(ELEMENT_ORDER.map((e) => [e, 0]));

  for (const p of pillars) {
    simple.set(p.ganElement, simple.get(p.ganElement)! + 1);
    simple.set(p.zhiElement, simple.get(p.zhiElement)! + 1);

    weighted.set(p.ganElement, weighted.get(p.ganElement)! + 1);
    for (const h of ZHI_HIDDEN[p.zhi]) {
      const el = elementOfGan(h.gan);
      weighted.set(el, weighted.get(el)! + h.days / 30);
    }
  }

  return ELEMENT_ORDER.map((element) => ({
    element,
    simple: simple.get(element)!,
    weighted: Math.round(weighted.get(element)! * 100) / 100,
  }));
}

/**
 * 日干の強弱。日干自身は数に入れず、残り 7 つ（＋蔵干）のうち
 * 日干を助けるもの（同じ五行＝比劫／日干を生じる五行＝印）の割合で判定する。
 */
export function assessStrength(
  pillars: Pillar[],
  dayMaster: Gan,
  monthRuler: Gan
): StrengthAssessment {
  const me = elementOfGan(dayMaster);
  const resource = ELEMENT_ORDER.find((e) => generates(e) === me)!;
  const notes: string[] = [];

  let support = 0;
  let total = 0;

  for (const p of pillars) {
    // 日干そのものは「自分」なので勢力の勘定には入れない
    if (p.slot !== 'day') {
      total += 1;
      if (p.ganElement === me || p.ganElement === resource) support += 1;
    }
    for (const h of ZHI_HIDDEN[p.zhi]) {
      const w = h.days / 30;
      const el = elementOfGan(h.gan);
      total += w;
      if (el === me || el === resource) support += w;
    }
  }

  const supportRatio = total > 0 ? support / total : 0;

  const rulerElement = elementOfGan(monthRuler);
  const hasMonthSupport = rulerElement === me || rulerElement === resource;
  const hasRoot = pillars.some((p) =>
    ZHI_HIDDEN[p.zhi].some((h) => elementOfGan(h.gan) === me)
  );

  notes.push(
    `日干は${ELEMENT_LABEL[me]}。助けるのは同じ${ELEMENT_LABEL[me]}（比肩・劫財）と、` +
      `${ELEMENT_LABEL[me]}を生じる${ELEMENT_LABEL[resource]}（偏印・正印）。`
  );
  notes.push(
    `日干を除く勢力のうち ${(supportRatio * 100).toFixed(0)}% が日干を助ける側（蔵干は日数比で加算）。`
  );
  notes.push(
    hasMonthSupport
      ? `月令は${monthRuler}（${ELEMENT_LABEL[rulerElement]}）で、日干は月の気を得ている（得令）。`
      : `月令は${monthRuler}（${ELEMENT_LABEL[rulerElement]}）で、日干は月の気を得ていない（失令）。`
  );
  notes.push(
    hasRoot
      ? '地支の蔵干に日干と同じ五行があり、根がある（通根）。'
      : '地支の蔵干に日干と同じ五行がなく、根がない（無根）。'
  );

  let verdict: StrengthAssessment['verdict'];
  if (supportRatio >= 0.66) verdict = '極身強';
  else if (supportRatio >= 0.52) verdict = '身強';
  else if (supportRatio >= 0.4) verdict = '中和';
  else if (supportRatio >= 0.26) verdict = '身弱';
  else verdict = '極身弱';

  return { supportRatio, verdict, hasMonthSupport, hasRoot, notes };
}

/** 月支の蔵干のうち、節入りからの経過日数で「司令」しているもの（月令）。 */
export function monthRulerOf(monthZhi: Zhi, daysFromJie: number): Gan {
  const hidden = ZHI_HIDDEN[monthZhi];
  let acc = 0;
  for (const h of hidden) {
    acc += h.days;
    if (daysFromJie < acc) return h.gan;
  }
  return hidden[hidden.length - 1].gan;
}
