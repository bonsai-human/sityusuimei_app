import { useEffect, useMemo, useState } from 'react';

import BirthForm from './components/BirthForm';
import PromptPanel from './components/PromptPanel';
import ChartView from './components/chart/ChartView';
import SaveBar from './components/chart/SaveBar';
import CompareView from './components/compare/CompareView';
import ChartLibrary from './components/db/ChartLibrary';
import LifeLogView from './components/lifelog/LifeLogView';
import { Segmented } from './components/ui';
import { buildChart } from './core/chart';
import type { BirthInput, Chart } from './core/types';
import type { SavedChart } from './db/database';
import { useAppStore, type Theme } from './store/appStore';

type Tab = 'input' | 'chart' | 'prompt' | 'library' | 'compare' | 'lifelog';

const TABS: { value: Tab; label: string }[] = [
  { value: 'input', label: '入力' },
  { value: 'chart', label: '命式' },
  { value: 'prompt', label: 'プロンプト' },
  { value: 'library', label: '保存済み' },
  { value: 'compare', label: '比較' },
  { value: 'lifelog', label: '人生ログ' },
];

/** 入力が不正でもアプリごと落ちないよう、命式の算出は必ず包む。 */
function safeChart(input: BirthInput): { chart: Chart | null; error: string | null } {
  try {
    return { chart: buildChart(input), error: null };
  } catch (e) {
    return { chart: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function App() {
  const {
    input,
    setInput,
    replaceInput,
    theme,
    setTheme,
    pillarOrder,
    setPillarOrder,
    promptConfig,
    setPromptConfig,
  } = useAppStore();

  const [tab, setTab] = useState<Tab>('input');
  /** 表示中の命式が保存済みならその id。新しく入力し直したら切れる */
  const [savedId, setSavedId] = useState<number | null>(null);
  /** 比較の相手として選んだ命式の入力 */
  const [compareWith, setCompareWith] = useState<BirthInput | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const { chart, error } = useMemo(() => safeChart(input), [input]);
  const otherChart = useMemo(
    () => (compareWith ? safeChart(compareWith).chart : null),
    [compareWith]
  );

  const openSaved = (row: SavedChart) => {
    replaceInput(row.input);
    setSavedId(row.id ?? null);
    setTab('chart');
  };

  const putIntoCompare = (row: SavedChart) => {
    setCompareWith(row.input);
    setTab('compare');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-3 pb-10 pt-3 sm:px-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">命式ノート</h1>
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            四柱推命の命式を組み、AI に渡すプロンプトを書き出す
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="四柱を並べる向き"
            size="sm"
            value={pillarOrder}
            onChange={setPillarOrder}
            options={[
              { value: 'rtl' as const, label: '時→年', title: '時柱を左に置く（万年暦の並び）' },
              { value: 'ltr' as const, label: '年→時', title: '年柱を左に置く' },
            ]}
          />
          <Segmented
            ariaLabel="配色"
            size="sm"
            value={theme}
            onChange={(t: Theme) => setTheme(t)}
            options={[
              { value: 'system' as const, label: '自動' },
              { value: 'light' as const, label: '淡' },
              { value: 'dark' as const, label: '濃' },
            ]}
          />
        </div>
      </header>

      {/* 画面が増えたので、狭いときは横に流して全部に手が届くようにする */}
      <nav className="scroll-x mb-4 -mx-1 px-1">
        <div className="flex min-w-max gap-1.5" role="group" aria-label="画面の切り替え">
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(t.value)}
                className="whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors"
                style={{
                  background: active ? 'var(--accent)' : 'var(--surface-raised)',
                  color: active ? 'var(--surface-raised)' : 'var(--ink-muted)',
                  border: `1px solid ${active ? 'transparent' : 'var(--line-strong)'}`,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t.label}
                {t.value === 'compare' && compareWith && (
                  <span className="ml-1 text-[10px]">●</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {error && (
        <div
          className="mb-4 rounded-lg px-3 py-2 text-sm"
          style={{
            background: 'var(--fire-bg)',
            color: 'var(--fire-fg)',
            border: '1px solid var(--fire-line)',
          }}
        >
          命式を組めませんでした: {error}
          <span className="mt-1 block text-xs">入力した日付が正しいか確かめてください。</span>
        </div>
      )}

      <main className="flex-1">
        {tab === 'input' && (
          <BirthForm
            input={input}
            onChange={(patch) => {
              // 生年月日や時刻を変えたら別人なので、保存先との結びつきを切る
              const identityChanged = ['year', 'month', 'day', 'time', 'gender', 'calendar'].some(
                (k) => k in patch
              );
              if (identityChanged) setSavedId(null);
              setInput(patch);
            }}
            onSubmit={() => setTab(chart ? 'chart' : 'input')}
          />
        )}

        {tab === 'chart' &&
          (chart ? (
            <div className="flex flex-col gap-4">
              <ChartView chart={chart} pillarOrder={pillarOrder} />
              <SaveBar input={input} savedId={savedId} onSaved={setSavedId} />
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              先に入力を済ませてください。
            </p>
          ))}

        {tab === 'prompt' &&
          (chart ? (
            <PromptPanel chart={chart} config={promptConfig} onConfigChange={setPromptConfig} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              先に入力を済ませてください。
            </p>
          ))}

        {tab === 'library' && (
          <ChartLibrary
            onOpen={openSaved}
            onCompare={putIntoCompare}
            currentName={input.name}
          />
        )}

        {tab === 'compare' &&
          (chart ? (
            <CompareView
              self={chart}
              other={otherChart}
              onClearOther={() => setCompareWith(null)}
            />
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              先に入力を済ませてください。
            </p>
          ))}

        {tab === 'lifelog' &&
          (chart ? (
            <LifeLogView
              chart={chart}
              chartId={savedId}
              onGoToChart={() => setTab('chart')}
            />
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              先に入力を済ませてください。
            </p>
          ))}
      </main>

      <footer
        className="mt-8 border-t pt-4 text-xs leading-relaxed hairline"
        style={{ color: 'var(--ink-faint)' }}
      >
        <p>
          入力した内容と保存した命式は、このブラウザの中だけに残ります。外部に送信されることはありません。
        </p>
        <p className="mt-1">
          四柱推命は自己理解と娯楽のためのものです。医療・法律・投資などの判断には用いないでください。
        </p>
      </footer>
    </div>
  );
}
