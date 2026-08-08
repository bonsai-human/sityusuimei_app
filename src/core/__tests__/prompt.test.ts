import { describe, expect, it } from 'vitest';

import { buildChart } from '../chart';
import {
  PROMPT_TEMPLATES,
  buildPrompt,
  defaultPromptConfig,
  estimateTokens,
  type PromptFormat,
} from '../prompt';
import type { BirthInput } from '../types';
import { TOKYO } from '../../data/cities';

const INPUT: BirthInput = {
  name: '自分',
  gender: 'male',
  calendar: 'solar',
  year: 2003,
  month: 1,
  day: 10,
  time: { kind: 'hm', hour: 16, minute: 59 },
  place: TOKYO,
  dst: false,
  options: { trueSolarTime: true, equationOfTime: true, sect: 2, lateZi: false },
};

const chart = buildChart(INPUT, new Date('2026-08-08T00:00:00Z'));
const FORMATS: PromptFormat[] = ['markdown', 'json', 'compact'];

describe('buildPrompt', () => {
  it('7つのテンプレート × 3つの形式がすべて出力できる', () => {
    for (const t of PROMPT_TEMPLATES) {
      for (const format of FORMATS) {
        const text = buildPrompt(chart, {
          ...defaultPromptConfig(2026),
          templateId: t.id,
          format,
          freeText: t.id === 'free' ? '転職を考えています。' : undefined,
        });
        expect(text.length, `${t.id}/${format}`).toBeGreaterThan(200);
        // どの形式でも四柱は必ず含まれる
        for (const gz of ['壬午', '癸丑', '癸未', '辛酉']) {
          expect(text, `${t.id}/${format} に ${gz}`).toContain(gz);
        }
      }
    }
  });

  it('Markdown には十神・大運・流年が表として入る', () => {
    const text = buildPrompt(chart, defaultPromptConfig(2026));
    expect(text).toContain('| 天干の十神 |');
    expect(text).toContain('◀ 現在');
    expect(text).toContain('◀ 基準年');
    expect(text).toContain('乙卯');
    expect(text).toContain('丙午');
  });

  it('JSON 形式は素の JSON としてパースできる', () => {
    const text = buildPrompt(chart, { ...defaultPromptConfig(2026), format: 'json' });
    const json = text.slice(text.indexOf('```json') + 7, text.lastIndexOf('```')).trim();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['日干']).toBe('癸');
    expect(parsed['月令']).toBe('癸');
    expect((parsed['四柱'] as unknown[]).length).toBe(4);
  });

  it('セクションを切ると本文からその項目が消える', () => {
    const config = defaultPromptConfig(2026);
    const full = buildPrompt(chart, config);
    const trimmed = buildPrompt(chart, {
      ...config,
      sections: { ...config.sections, daYun: false, liuNian: false, relations: false },
    });
    expect(full).toContain('### 大運');
    expect(trimmed).not.toContain('### 大運');
    expect(trimmed).not.toContain('### 干支の関係');
    expect(trimmed.length).toBeLessThan(full.length);
  });

  it('回答の作法は選んだぶんだけ付く', () => {
    const none = buildPrompt(chart, { ...defaultPromptConfig(2026), styleRuleIds: [] });
    expect(none).not.toContain('## 回答の作法');

    const some = buildPrompt(chart, { ...defaultPromptConfig(2026), styleRuleIds: ['cite'] });
    expect(some).toContain('## 回答の作法');
    expect(some).toContain('根拠となる干支');
  });

  it('匿名化すると名前が本人に置き換わる', () => {
    const text = buildPrompt(chart, { ...defaultPromptConfig(2026), anonymize: true });
    expect(text).toContain('本人');
    expect(text).not.toContain('名前: 自分');
  });

  it('自由記述テンプレは入力した質問がそのまま冒頭に来る', () => {
    const text = buildPrompt(chart, {
      ...defaultPromptConfig(2026),
      templateId: 'free',
      freeText: '来年の引っ越しについて見てください。',
    });
    expect(text.startsWith('来年の引っ越しについて見てください。')).toBe(true);
  });

  it('圧縮形式は Markdown よりずっと短い', () => {
    const md = buildPrompt(chart, defaultPromptConfig(2026));
    const compact = buildPrompt(chart, { ...defaultPromptConfig(2026), format: 'compact' });
    expect(estimateTokens(compact)).toBeLessThan(estimateTokens(md) * 0.6);
  });

  it('時刻不明の命式でも破綻せず出力できる', () => {
    const noTime = buildChart({ ...INPUT, time: { kind: 'unknown' } });
    for (const format of FORMATS) {
      const text = buildPrompt(noTime, { ...defaultPromptConfig(2026), format });
      expect(text).toContain('癸未');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NaN');
    }
  });
});
