import { useId, useState } from 'react';

import { estimateTokens, type PromptFormat } from '../core/prompt';
import { Button, Note, Section } from './ui';

/**
 * できあがったプロンプトの表示とコピー。
 * 四柱推命の画面とホロスコープの画面で同じものを使う。
 */
export default function PromptOutput({
  text,
  format,
  fileName,
}: {
  text: string;
  format: PromptFormat;
  /** 保存するときのファイル名（拡張子なし） */
  fileName: string;
}) {
  const [copied, setCopied] = useState(false);
  // 画面に 2 つ並ぶことがあるので、id は取り違えないよう毎回作る
  const outputId = useId();
  const tokens = estimateTokens(text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードが使えない環境（http や権限なし）では選択してもらう
      const area = document.getElementById(outputId) as HTMLTextAreaElement | null;
      area?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const download = () => {
    const extension = format === 'json' ? 'json' : format === 'compact' ? 'txt' : 'md';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/[^\w一-龯ぁ-んァ-ヶー-]/g, '')}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      title="できあがったプロンプト"
      subtitle={`${text.length.toLocaleString()}文字・およそ ${tokens.toLocaleString()} トークン`}
      actions={
        <div className="flex gap-2">
          <Button onClick={copy} variant="primary">
            {copied ? 'コピーしました' : 'コピー'}
          </Button>
          <Button onClick={download}>保存</Button>
        </div>
      }
    >
      <textarea
        id={outputId}
        readOnly
        value={text}
        spellCheck={false}
        className="field min-h-96 w-full resize-y font-mono text-xs leading-relaxed"
        style={{ background: 'var(--surface-sunken)' }}
      />
      <Note>
        このテキストは ChatGPT・Claude・Gemini など、どのチャットにもそのまま貼れます。
        外部に送信されるのは、あなたが貼り付けたときだけです。
      </Note>
    </Section>
  );
}
