import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';

import { elementOfGan, elementOfZhi } from '../../core/ganzhi';
import {
  deleteChart,
  exportAll,
  importAll,
  queryCharts,
  type ChartQuery,
  type SavedChart,
  type SortKey,
} from '../../db/database';
import { Button, Field, LabeledGroup, Note, Section, Segmented, elementClass } from '../ui';

function GanZhi({ value }: { value: string }) {
  if (!value) return <span style={{ color: 'var(--ink-faint)' }}>—</span>;
  const gan = value.charAt(0);
  const zhi = value.charAt(1);
  return (
    <span className="inline-flex flex-col gap-px text-center">
      <span
        className={`${elementClass(elementOfGan(gan as never))} el-chip font-kanji rounded px-1 text-sm leading-tight`}
      >
        {gan}
      </span>
      <span
        className={`${elementClass(elementOfZhi(zhi as never))} el-chip font-kanji rounded px-1 text-sm leading-tight`}
      >
        {zhi}
      </span>
    </span>
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 保存した命式の一覧。
 *
 * 参考にしたアプリは名前・干支・大運数を詰めた行だったが、ここは 1 件を 1 枚のカードにして
 * 四柱を干支のまま並べる。並んだ命式を上から眺めて「同じ日柱の人」を探せるようにしたい。
 */
export default function ChartLibrary({
  onOpen,
  onCompare,
  currentName,
}: {
  onOpen: (row: SavedChart) => void;
  onCompare: (row: SavedChart) => void;
  currentName: string;
}) {
  const [text, setText] = useState('');
  const [ganZhi, setGanZhi] = useState('');
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');
  const [sort, setSort] = useState<SortKey>('updatedAt');
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const query: ChartQuery = {
    text,
    ganZhi,
    gender: gender === 'all' ? undefined : gender,
    sort,
  };
  // 保存や削除のたびに Dexie が勝手に引き直してくれる
  const rows = useLiveQuery(() => queryCharts(query), [text, ganZhi, gender, sort]);

  const doExport = async () => {
    const backup = await exportAll();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `命式ノート-バックアップ-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`${backup.charts.length}件を書き出しました。`);
  };

  const doImport = async (file: File) => {
    try {
      const result = await importAll(JSON.parse(await file.text()));
      const events = result.events > 0 ? `、出来事${result.events}件` : '';
      setMessage(
        result.skipped > 0
          ? `${result.added}件${events}を読み込みました（同じ人が${result.skipped}件あったので飛ばしました）。`
          : `${result.added}件${events}を読み込みました。`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '読み込めませんでした。');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="絞り込み"
        subtitle="名前・メモ・生年月日で探せます。生年月日は 2003-01-10 でも 20030110 でも引けます"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="キーワード">
            <input
              className="field"
              value={text}
              placeholder="名前・メモ・生年月日"
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <Field label="干支" hint="「癸未」で日柱まで一致、「癸」や「未」なら含むものすべて">
            <input
              className="field"
              value={ganZhi}
              placeholder="癸未 / 癸 / 未"
              onChange={(e) => setGanZhi(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <LabeledGroup label="性別">
            <Segmented
              ariaLabel="性別で絞り込む"
              size="sm"
              value={gender}
              onChange={setGender}
              options={[
                { value: 'all' as const, label: 'すべて' },
                { value: 'male' as const, label: '男性' },
                { value: 'female' as const, label: '女性' },
              ]}
            />
          </LabeledGroup>
          <LabeledGroup label="並べ替え">
            <Segmented
              ariaLabel="並べ替え"
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'updatedAt' as const, label: '更新順' },
                { value: 'birthDate' as const, label: '生年月日' },
                { value: 'name' as const, label: '名前' },
              ]}
            />
          </LabeledGroup>
        </div>
      </Section>

      <Section
        title={`保存済み（${rows?.length ?? 0}件）`}
        actions={
          <div className="flex gap-2">
            <Button onClick={doExport}>書き出し</Button>
            <Button onClick={() => fileRef.current?.click()}>読み込み</Button>
          </div>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file);
            e.target.value = '';
          }}
        />

        {message && (
          <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-sunken)' }}>
            {message}
          </p>
        )}

        {rows === undefined ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            読み込んでいます…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {text || ganZhi || gender !== 'all'
              ? '条件に合う命式がありません。'
              : 'まだ保存された命式がありません。「命式」の画面から保存できます。'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl p-3"
                style={{ border: '1px solid var(--line)', background: 'var(--surface-raised)' }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold">
                    {row.input.name.trim() || '名前なし'}
                    {row.input.name.trim() === currentName.trim() && currentName.trim() !== '' && (
                      <span className="ml-2 text-[10px]" style={{ color: 'var(--accent)' }}>
                        表示中
                      </span>
                    )}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {row.input.gender === 'male' ? '男性' : '女性'}・{row.birthDate}
                    {row.hourGZ === '' && '（時刻不明）'}
                  </span>
                </div>

                <div className="mt-2 flex items-end justify-between gap-3">
                  {/* 万年暦と同じ 時・日・月・年 の並びで出す */}
                  <div className="flex gap-1.5">
                    {[
                      ['時', row.hourGZ],
                      ['日', row.dayGZ],
                      ['月', row.monthGZ],
                      ['年', row.yearGZ],
                    ].map(([label, gz]) => (
                      <span key={label} className="flex flex-col items-center gap-0.5">
                        <GanZhi value={gz} />
                        <span className="text-[9px]" style={{ color: 'var(--ink-faint)' }}>
                          {label}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button onClick={() => onOpen(row)}>開く</Button>
                    <Button onClick={() => onCompare(row)}>比較に入れる</Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`「${row.input.name.trim() || '名前なし'}」を削除しますか。`)) {
                          void deleteChart(row.id!);
                        }
                      }}
                    >
                      削除
                    </Button>
                  </div>
                </div>

                {row.memo && (
                  <p className="mt-2 whitespace-pre-wrap text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {row.memo}
                  </p>
                )}
                <p className="mt-1.5 text-[10px]" style={{ color: 'var(--ink-faint)' }}>
                  更新 {formatDate(row.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <Note>
          保存先はこのブラウザの中（IndexedDB）です。端末を移るときや、消えて困るときは
          「書き出し」で JSON を保存しておいてください。
        </Note>
      </Section>
    </div>
  );
}
