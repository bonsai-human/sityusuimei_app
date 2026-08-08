import { useEffect, useState } from 'react';

import type { BirthInput } from '../../core/types';
import { getChart, saveChart, updateChart } from '../../db/database';
import { Button, Field, Section } from '../ui';

/**
 * いま見ている命式をこのブラウザに保存する帯。
 *
 * 一度保存したものは、同じ命式を見ているあいだ「上書き」になる。
 * 生年月日を変えたら別人なので、保存先の結びつきは呼び出し側で切ってもらう。
 */
export default function SaveBar({
  input,
  savedId,
  onSaved,
}: {
  input: BirthInput;
  savedId: number | null;
  onSaved: (id: number | null) => void;
}) {
  const [memo, setMemo] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // 保存済みのものを開いたときは、そのメモを引き継ぐ
  useEffect(() => {
    let cancelled = false;
    if (savedId === null) {
      setMemo('');
      return;
    }
    void getChart(savedId).then((row) => {
      if (!cancelled && row) setMemo(row.memo);
    });
    return () => {
      cancelled = true;
    };
  }, [savedId]);

  const save = async () => {
    if (savedId !== null) {
      await updateChart(savedId, input, memo, []);
      setStatus('上書きしました');
    } else {
      const id = await saveChart(input, memo);
      onSaved(id);
      setStatus('保存しました');
    }
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <Section
      title={savedId !== null ? '保存済みの命式' : 'この命式を保存する'}
      subtitle="このブラウザの中だけに残ります。外へ送られることはありません"
      actions={
        <div className="flex items-center gap-2">
          {status && (
            <span className="text-xs" style={{ color: 'var(--accent)' }}>
              {status}
            </span>
          )}
          <Button onClick={() => setOpen((v) => !v)} variant="ghost">
            {open ? 'メモを閉じる' : 'メモ'}
          </Button>
          <Button onClick={() => void save()} variant="primary">
            {savedId !== null ? '上書き' : '保存'}
          </Button>
          {savedId !== null && (
            <Button onClick={() => onSaved(null)} variant="ghost">
              別に保存
            </Button>
          )}
        </div>
      }
    >
      {open && (
        <Field label="メモ" hint="出会った経緯、確かめたいことなど。あとから検索で引けます">
          <textarea
            className="field min-h-20 resize-y"
            value={memo}
            placeholder="例）2024年に転職。この年は乙巳で食神が回っていた。"
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>
      )}
    </Section>
  );
}
