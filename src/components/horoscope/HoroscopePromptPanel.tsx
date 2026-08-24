import { useMemo } from 'react';

import { buildHoroscope } from '../../core/horoscope/chart';
import {
  HOROSCOPE_PROMPT_TEMPLATES,
  buildCombinedPrompt,
  buildHoroscopePrompt,
  horoscopeStyleRules,
} from '../../core/horoscope/prompt';
import type {
  HoroscopeOptions,
  HoroscopePromptConfig,
  HoroscopePromptSections,
} from '../../core/horoscope/types';
import type { PromptConfig, PromptFormat } from '../../core/prompt';
import type { BirthInput, Chart } from '../../core/types';
import PromptOutput from '../PromptOutput';
import { Field, LabeledGroup, Note, Section, Segmented, Toggle } from '../ui';

const SECTION_LABELS: { key: keyof HoroscopePromptSections; label: string; hint?: string }[] = [
  { key: 'angles', label: '感受点（ASC・MC・DSC・IC・バーテックス）' },
  { key: 'houses', label: 'ハウスのカスプ' },
  { key: 'aspects', label: 'アスペクト（オーブ・接近／分離つき）' },
  { key: 'elements', label: 'エレメントとクオリティ' },
  { key: 'patterns', label: '全体の傾き（支配星・集まり・半球）' },
  { key: 'nodes', label: 'ドラゴンヘッド・リリス' },
  { key: 'speed', label: '天体の日々の動き', hint: '逆行の勢いまで見せたいとき' },
  { key: 'timeDetail', label: '世界時と出生地の座標' },
  { key: 'glossary', label: '天体とハウスの用語説明', hint: '占星術に馴染みのないモデルに渡すとき' },
];

/**
 * ホロスコープを LLM に渡すためのプロンプトを組み立てるパネル。
 *
 * 出生図の算出はここで行う（App から遅延読み込みされるので、天体暦は
 * 四柱推命だけを使う人には読み込まれない）。四柱推命の命式を渡されているときは、
 * 二つを併記した統合プロンプトも選べる。
 */
export default function HoroscopePromptPanel({
  input,
  options,
  chart,
  config,
  onConfigChange,
  chartConfig,
}: {
  input: BirthInput;
  options: HoroscopeOptions;
  /** 併記する四柱推命の命式。ホロスコープだけを見ているときは null */
  chart: Chart | null;
  config: HoroscopePromptConfig;
  onConfigChange: (patch: Partial<HoroscopePromptConfig>) => void;
  /** 併記するときに、命式の側の「含める項目」として使う設定 */
  chartConfig: PromptConfig;
}) {
  const { horoscope, error } = useMemo(() => {
    try {
      return { horoscope: buildHoroscope(input, options), error: null };
    } catch (e) {
      return { horoscope: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, options]);

  const templates = HOROSCOPE_PROMPT_TEMPLATES.filter((t) => !t.needsChart || chart);
  const template = templates.find((t) => t.id === config.templateId) ?? templates[0];

  const text = useMemo(() => {
    if (!horoscope) return '';
    if (template.needsChart && chart) {
      return buildCombinedPrompt(chart, horoscope, config, chartConfig);
    }
    return buildHoroscopePrompt(horoscope, config);
  }, [horoscope, config, chart, chartConfig, template]);

  if (error || !horoscope) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          background: 'var(--fire-bg)',
          color: 'var(--fire-fg)',
          border: '1px solid var(--fire-line)',
        }}
      >
        出生図を組めませんでした: {error}
      </div>
    );
  }

  const toggleSection = (key: keyof HoroscopePromptSections) =>
    onConfigChange({ sections: { ...config.sections, [key]: !config.sections[key] } });

  const toggleRule = (id: string) =>
    onConfigChange({
      styleRuleIds: config.styleRuleIds.includes(id)
        ? config.styleRuleIds.filter((r) => r !== id)
        : [...config.styleRuleIds, id],
    });

  return (
    <div className="flex flex-col gap-4">
      <Section title="何を聞くか" subtitle={template.description}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t) => {
            const active = t.id === template.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onConfigChange({ templateId: t.id })}
                aria-pressed={active}
                className="rounded-lg px-3 py-2 text-left text-sm transition-colors"
                style={{
                  border: active ? '2px solid var(--accent)' : '1px solid var(--line)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface-raised)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {template.id === 'free' && (
          <div className="mt-3">
            <Field label="聞きたいこと">
              <textarea
                className="field min-h-24 resize-y"
                placeholder="例）人前に出る仕事に興味があります。出生図から見て、どんな出方が向いていそうでしょうか。"
                value={config.freeText ?? ''}
                onChange={(e) => onConfigChange({ freeText: e.target.value })}
              />
            </Field>
          </div>
        )}

        {template.needsChart && (
          <Note>
            四柱推命の命式と出生図を並べて渡します。二つの体系は前提が別なので、
            片方の言葉でもう片方を言い換えさせず、一致する点と食い違う点を分けて述べるよう頼みます。
            命式の側でどこまで含めるかは「プロンプト」の四柱推命の画面の設定に従います。
          </Note>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <LabeledGroup label="出力の形式">
            <Segmented
              ariaLabel="出力の形式"
              size="sm"
              value={config.format}
              onChange={(format: PromptFormat) => onConfigChange({ format })}
              options={[
                { value: 'markdown', label: 'Markdown', title: '人が読んでも分かる表形式' },
                { value: 'json', label: 'JSON', title: '構造化データとして渡す' },
                { value: 'compact', label: '圧縮', title: 'トークンを節約した短い形式' },
              ]}
            />
          </LabeledGroup>
          <div className="flex items-end">
            <Toggle
              checked={config.anonymize}
              onChange={(anonymize) => onConfigChange({ anonymize })}
              label="名前を伏せる"
              hint="名前を「本人」に置き換えて渡します"
            />
          </div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="含める項目">
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-1">
            {SECTION_LABELS.map((s) => (
              <Toggle
                key={s.key}
                checked={config.sections[s.key]}
                onChange={() => toggleSection(s.key)}
                label={s.label}
                hint={s.hint}
              />
            ))}
          </div>
        </Section>

        <Section title="回答の作法" subtitle="プロンプトの末尾に指示として付きます">
          {horoscopeStyleRules(template.needsChart ? 'combined' : 'horoscope').map((r) => (
            <Toggle
              key={r.id}
              checked={config.styleRuleIds.includes(r.id)}
              onChange={() => toggleRule(r.id)}
              label={r.label}
              hint={r.text}
            />
          ))}
        </Section>
      </div>

      <PromptOutput
        text={text}
        format={config.format}
        fileName={`${input.name.trim() || 'horoscope'}-${template.id}`}
      />
    </div>
  );
}
