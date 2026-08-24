import { describe, expect, it } from 'vitest';

import { TOKYO } from '../../../data/cities';
import { buildChart } from '../../chart';
import { defaultPromptConfig } from '../../prompt';
import type { BirthInput } from '../../types';
import { buildHoroscope } from '../chart';
import {
  HOROSCOPE_PROMPT_TEMPLATES,
  buildCombinedPrompt,
  buildHoroscopePrompt,
  horoscopeStyleRules,
} from '../prompt';
import { defaultHoroscopePromptConfig } from '../types';

const INPUT: BirthInput = {
  name: 'テスト太郎',
  gender: 'male',
  calendar: 'solar',
  year: 1990,
  month: 1,
  day: 1,
  time: { kind: 'hm', hour: 12, minute: 0 },
  place: TOKYO,
  dst: false,
  options: { trueSolarTime: true, equationOfTime: true, sect: 2, lateZi: false },
};

const horoscope = buildHoroscope(INPUT);
const chart = buildChart(INPUT, new Date('2026-01-01'));
const base = defaultHoroscopePromptConfig(['cite', 'hedge']);

describe('ホロスコープのプロンプト', () => {
  it('依頼文・本体・作法・断りが並ぶ', () => {
    const text = buildHoroscopePrompt(horoscope, base);
    expect(text.startsWith('以下の西洋占星術の出生図を読み解いて')).toBe(true);
    expect(text).toContain('## ホロスコープ（出生図）');
    expect(text).toContain('## 回答の作法');
    expect(text).toContain('※ 出生図は「命式ノート」で算出したものです');
    // 真太陽時を掛けていないことは、渡す側にも書いておく
    expect(text).toContain('真太陽時の補正は掛けていません');
  });

  it('度数にはサインとハウスが必ず添う', () => {
    const text = buildHoroscopePrompt(horoscope, base);
    expect(text).toContain('太陽 山羊座 10°25′');
    expect(text).toContain('| 太陽 | 山羊座 10°25′ | 9 |');
    // 裸の数字だけで渡さない
    expect(text).not.toMatch(/太陽 280\.4/);
  });

  it('アセンダントと MC も渡す', () => {
    const text = buildHoroscopePrompt(horoscope, base);
    expect(text).toContain('アセンダント: 牡羊座 23°43′');
    expect(text).toContain('MC: 山羊座 14°04′');
  });

  it('アスペクトはオーブと接近／分離まで出す', () => {
    const text = buildHoroscopePrompt(horoscope, base);
    expect(text).toMatch(/\| 太陽 \| コンジャンクション（0度） \| 海王星 \| 1°3[45]′ \| 接近 \|/);
  });

  it('含める項目を切ると、その節が消える', () => {
    const full = buildHoroscopePrompt(horoscope, base);
    const trimmed = buildHoroscopePrompt(horoscope, {
      ...base,
      sections: {
        ...base.sections,
        houses: false,
        aspects: false,
        elements: false,
        patterns: false,
        nodes: false,
      },
    });
    expect(full).toContain('### ハウスのカスプ');
    expect(trimmed).not.toContain('### ハウスのカスプ');
    expect(trimmed).not.toContain('### アスペクト');
    // 末尾の断りには「ドラゴンヘッドは平均の交点」と残るので、表の行で見る
    expect(trimmed).not.toContain('| ドラゴンヘッド |');
    expect(trimmed.length).toBeLessThan(full.length / 2);
  });

  it('名前を伏せられる', () => {
    expect(buildHoroscopePrompt(horoscope, base)).toContain('テスト太郎');
    const hidden = buildHoroscopePrompt(horoscope, { ...base, anonymize: true });
    expect(hidden).not.toContain('テスト太郎');
    expect(hidden).toContain('名前: 本人');
  });

  it('自由記述は書いた文がそのまま依頼文になる', () => {
    const text = buildHoroscopePrompt(horoscope, {
      ...base,
      templateId: 'free',
      freeText: '  人前に出る仕事は向いていますか。  ',
    });
    expect(text.startsWith('人前に出る仕事は向いていますか。')).toBe(true);
  });

  it('自由記述が空なら、当たり障りのない依頼文にする', () => {
    const text = buildHoroscopePrompt(horoscope, { ...base, templateId: 'free', freeText: '  ' });
    expect(text.startsWith('以下の西洋占星術の出生図について、気づいたことを')).toBe(true);
  });

  it('JSON 形式は読み取れる形になっている', () => {
    const text = buildHoroscopePrompt(horoscope, { ...base, format: 'json' });
    const body = text.slice(text.indexOf('```json') + 7, text.lastIndexOf('```'));
    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect(parsed['名前']).toBe('テスト太郎');
    expect(parsed['座標系']).toBe('トロピカル');
    const bodies = parsed['天体'] as { 天体: string; サイン: string; 室: number }[];
    expect(bodies[0]).toMatchObject({ 天体: '太陽', サイン: '山羊座', 室: 9 });
    expect(parsed['感受点']).toHaveProperty('アセンダント');
    expect(parsed['アスペクト']).toBeInstanceOf(Array);
  });

  it('圧縮形式は Markdown より短い', () => {
    const compact = buildHoroscopePrompt(horoscope, { ...base, format: 'compact' });
    const markdown = buildHoroscopePrompt(horoscope, base);
    expect(compact.length).toBeLessThan(markdown.length);
    expect(compact).toContain('太陽山羊10.25H9');
  });

  it('時刻が分からないときは、その旨と幅がプロンプトにも出る', () => {
    const unknown = buildHoroscope({ ...INPUT, time: { kind: 'unknown' } });
    const text = buildHoroscopePrompt(unknown, base);
    expect(text).toContain('### 読むときの断り');
    expect(text).toContain('アセンダント・MC・ハウスは出していません');
    expect(text).toContain('時刻不明のため');
    expect(text).not.toContain('### 感受点');
  });

  it('回答の作法は、四柱推命の語ではなく出生図の語で書かれる', () => {
    const cite = horoscopeStyleRules('horoscope').find((r) => r.id === 'cite')!;
    expect(cite.text).toContain('天体・サイン・ハウス・アスペクト');
    expect(cite.text).not.toContain('干支');
    // 体系によらない作法はそのまま
    expect(horoscopeStyleRules('horoscope').find((r) => r.id === 'hedge')!.text).toContain(
      '断定は避け'
    );
  });
});

describe('四柱推命と併記するプロンプト', () => {
  const config = { ...base, templateId: 'combined' as const };

  it('命式と出生図の両方が入り、読み方の頼み方も変わる', () => {
    const text = buildCombinedPrompt(chart, horoscope, config, defaultPromptConfig(2026));
    expect(text).toContain('## 命式');
    expect(text).toContain('## ホロスコープ（出生図）');
    expect(text).toContain('同じことを指している点');
    expect(text).toContain('食い違って見える点');
    // 両方の断りが末尾に付く
    expect(text).toContain('※ 命式は「命式ノート」で算出したものです');
    expect(text).toContain('※ 出生図は「命式ノート」で算出したものです');
  });

  it('根拠を明示させる作法は、どちらの体系の何かを言わせる形になる', () => {
    const text = buildCombinedPrompt(chart, horoscope, config, defaultPromptConfig(2026));
    expect(text).toContain('その根拠が四柱推命の何');
    expect(text).toContain('出生図の何');
  });

  it('JSON 形式では、2 つに分かれず 1 つのオブジェクトになる', () => {
    const text = buildCombinedPrompt(
      chart,
      horoscope,
      { ...config, format: 'json' },
      defaultPromptConfig(2026)
    );
    expect(text.match(/```json/g)).toHaveLength(1);
    const body = text.slice(text.indexOf('```json') + 7, text.lastIndexOf('```'));
    const parsed = JSON.parse(body) as Record<string, Record<string, unknown>>;
    expect(Object.keys(parsed)).toEqual(['四柱推命', 'ホロスコープ']);
    expect(parsed['四柱推命']['日干']).toBe('丙');
    expect(parsed['ホロスコープ']['座標系']).toBe('トロピカル');
  });

  it('命式の形式は、ホロスコープ側で選んだ形式に揃う', () => {
    // 命式の設定が Markdown でも、ホロスコープ側が圧縮なら両方とも圧縮になる
    const text = buildCombinedPrompt(
      chart,
      horoscope,
      { ...config, format: 'compact' },
      { ...defaultPromptConfig(2026), format: 'markdown' }
    );
    expect(text).not.toContain('## 命式');
    expect(text.match(/```/g)).toHaveLength(4);
  });

  it('併記のテンプレートだけが命式を必要とする', () => {
    const needs = HOROSCOPE_PROMPT_TEMPLATES.filter((t) => t.needsChart).map((t) => t.id);
    expect(needs).toEqual(['combined']);
  });
});
