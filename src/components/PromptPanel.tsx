import { useMemo } from 'react';

import {
  PROMPT_TEMPLATES,
  STYLE_RULES,
  buildPrompt,
  type PromptConfig,
  type PromptFormat,
  type PromptSections,
} from '../core/prompt';
import type { Chart } from '../core/types';
import PromptOutput from './PromptOutput';
import { Field, LabeledGroup, NumberInput, Section, Segmented, Toggle } from './ui';

const SECTION_LABELS: { key: keyof PromptSections; label: string; hint?: string }[] = [
  { key: 'hidden', label: '蔵干（十神つき）' },
  { key: 'stage', label: '十二運星' },
  { key: 'xunKong', label: '空亡' },
  { key: 'naYin', label: '納音' },
  { key: 'relations', label: '干支の関係（合・沖・刑・害・破）' },
  { key: 'elements', label: '五行のバランス' },
  { key: 'strength', label: '日干の強弱の見立て' },
  { key: 'daYun', label: '大運の一覧' },
  { key: 'liuNian', label: '現在の大運の流年10年' },
  { key: 'extras', label: '胎元・命宮' },
  { key: 'timeDetail', label: '真太陽時の補正内訳' },
  { key: 'tenGodGlossary', label: '十神の用語説明', hint: '十神に馴染みのないモデルに渡すとき' },
];

/**
 * 命式を LLM に渡すためのプロンプトを組み立てるパネル。
 * 生成物をそのまま見せて、何を渡すことになるのかが分かる状態でコピーさせる。
 */
export default function PromptPanel({
  chart,
  config,
  onConfigChange,
}: {
  chart: Chart;
  config: PromptConfig;
  onConfigChange: (patch: Partial<PromptConfig>) => void;
}) {
  const template = PROMPT_TEMPLATES.find((t) => t.id === config.templateId)!;
  const text = useMemo(() => buildPrompt(chart, config), [chart, config]);

  const toggleSection = (key: keyof PromptSections) =>
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
          {PROMPT_TEMPLATES.map((t) => {
            const active = t.id === config.templateId;
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

        {config.templateId === 'free' && (
          <div className="mt-3">
            <Field label="聞きたいこと">
              <textarea
                className="field min-h-24 resize-y"
                placeholder="例）来年の転職を考えています。命式と大運から見て、どんな点に注意すべきでしょうか。"
                value={config.freeText ?? ''}
                onChange={(e) => onConfigChange({ freeText: e.target.value })}
              />
            </Field>
          </div>
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
          <Field label="基準にする年" hint="大運・流年のどこを「現在」として渡すか">
            <NumberInput
              min={1900}
              max={2100}
              value={config.focusYear}
              onChange={(focusYear) => onConfigChange({ focusYear })}
            />
          </Field>
        </div>

        <div className="mt-3">
          <Toggle
            checked={config.anonymize}
            onChange={(anonymize) => onConfigChange({ anonymize })}
            label="名前を伏せる"
            hint="名前を「本人」に置き換えて渡します"
          />
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
          {STYLE_RULES.map((r) => (
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
        fileName={`${chart.input.name.trim() || 'meishiki'}-${config.templateId}`}
      />
    </div>
  );
}
