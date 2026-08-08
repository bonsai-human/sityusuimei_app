import { useEffect, useMemo, useState } from 'react';

import BirthForm from './components/BirthForm';
import PromptPanel from './components/PromptPanel';
import ChartView from './components/chart/ChartView';
import { Segmented } from './components/ui';
import { buildChart } from './core/chart';
import type { Chart } from './core/types';
import { useAppStore, type Theme } from './store/appStore';

type Tab = 'input' | 'chart' | 'prompt';

export default function App() {
  const {
    input,
    setInput,
    theme,
    setTheme,
    pillarOrder,
    setPillarOrder,
    promptConfig,
    setPromptConfig,
  } = useAppStore();

  const [tab, setTab] = useState<Tab>('input');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  // 入力が不正でもアプリごと落ちないよう、命式の算出は必ず包んでおく
  const { chart, error } = useMemo((): { chart: Chart | null; error: string | null } => {
    try {
      return { chart: buildChart(input), error: null };
    } catch (e) {
      return { chart: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [input]);

  const goToChart = () => setTab(chart ? 'chart' : 'input');

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
              { value: 'ltr' as const, label: '年→時', title: '年柱を左に置く' },
              { value: 'rtl' as const, label: '時→年', title: '時柱を左に置く（万年暦の並び）' },
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

      <nav className="mb-4">
        <Segmented
          ariaLabel="画面の切り替え"
          value={tab}
          onChange={(t: Tab) => setTab(t)}
          options={[
            { value: 'input', label: '入力' },
            { value: 'chart', label: '命式' },
            { value: 'prompt', label: 'プロンプト' },
          ]}
        />
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
          <BirthForm input={input} onChange={setInput} onSubmit={goToChart} />
        )}
        {tab === 'chart' &&
          (chart ? (
            <ChartView chart={chart} pillarOrder={pillarOrder} />
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
      </main>

      <footer
        className="mt-8 border-t pt-4 text-xs leading-relaxed hairline"
        style={{ color: 'var(--ink-faint)' }}
      >
        <p>
          入力した内容はこのブラウザの中だけに保存され、外部に送信されることはありません。
        </p>
        <p className="mt-1">
          四柱推命は自己理解と娯楽のためのものです。医療・法律・投資などの判断には用いないでください。
        </p>
      </footer>
    </div>
  );
}
