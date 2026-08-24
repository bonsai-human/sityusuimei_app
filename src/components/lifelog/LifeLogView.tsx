import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, lazy, useMemo, useState } from 'react';

import { elementOfGan, elementOfZhi } from '../../core/ganzhi';
import {
  EVENT_CATEGORIES,
  eventContext,
  lifeLogSummary,
  parseDate,
  toneCount,
  todayString,
  type EventCategory,
  type EventContext,
} from '../../core/lifelog';
import type { HoroscopeOptions } from '../../core/horoscope/types';
import { RELATION_TONE, SLOT_LABEL, type CrossRelation } from '../../core/relations';
import type { BirthInput, Chart, DaYunEntry } from '../../core/types';
import {
  addEvent,
  deleteEvent,
  listEvents,
  type LifeEventRow,
} from '../../db/database';
import { Button, Field, LabeledGroup, Note, Section, Segmented, Toggle, elementClass } from '../ui';

/** ホロスコープ側は天体暦を要するので、必要になったときだけ読み込む。 */
const EventTransits = lazy(() => import('../horoscope/EventTransits'));

function GanZhiChip({ gan, zhi }: { gan: string; zhi: string }) {
  if (!gan || !zhi) return null;
  return (
    <span className="inline-flex gap-px">
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

function RelationChips({ relations }: { relations: CrossRelation[] }) {
  if (relations.length === 0) {
    return (
      <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
        命式に掛かる関係なし
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {relations.map((r, i) => {
        const clash = RELATION_TONE[r.kind] === 'clash';
        return (
          <span
            key={`${r.kind}-${r.selfSlot}-${r.otherSlot}-${i}`}
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{
              background: clash ? 'var(--fire-bg)' : 'var(--wood-bg)',
              color: clash ? 'var(--fire-fg)' : 'var(--wood-fg)',
              border: `1px solid ${clash ? 'var(--fire-line)' : 'var(--wood-line)'}`,
            }}
          >
            {SLOT_LABEL[r.otherSlot]}×{SLOT_LABEL[r.selfSlot]} {r.kind} {r.label}
          </span>
        );
      })}
    </span>
  );
}

function EventCard({
  event,
  context,
  onDelete,
  showDaYun,
  transits,
}: {
  event: LifeEventRow;
  context: EventContext | null;
  onDelete: () => void;
  /** 大運ごとにまとめて見せているときは、大運の行が重複するので出さない */
  showDaYun: boolean;
  /** ホロスコープのめぐりも並べるとき、その算出に要るもの */
  transits: { input: BirthInput; options: HoroscopeOptions } | null;
}) {
  const tone = context ? toneCount(context) : { bond: 0, clash: 0 };

  return (
    <li
      className="rounded-xl p-3"
      style={{ border: '1px solid var(--line)', background: 'var(--surface-raised)' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold">{event.title || '（無題）'}</span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={{ background: 'var(--surface-sunken)', color: 'var(--ink-muted)' }}
          >
            {event.category}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {event.date}
            {context && `・満${context.age}歳`}
          </span>
          <Button variant="ghost" onClick={onDelete}>
            削除
          </Button>
        </span>
      </div>

      {event.note.trim() && (
        <p className="mt-1.5 whitespace-pre-wrap text-xs" style={{ color: 'var(--ink-muted)' }}>
          {event.note}
        </p>
      )}

      {context && (
        <div className="mt-2.5 border-t pt-2.5 hairline">
          {context.note && (
            <p className="mb-2 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              {context.note}
            </p>
          )}

          <dl className="flex flex-col gap-1.5">
            {context.liuNian && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="w-10 shrink-0 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                  流年
                </dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <GanZhiChip gan={context.liuNian.gan} zhi={context.liuNian.zhi} />
                  <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    {context.liuNian.ganTenGod}／{context.liuNian.zhiTenGod}・
                    {context.liuNian.stage}
                  </span>
                  <RelationChips relations={context.liuNianRelations} />
                </dd>
              </div>
            )}
            {showDaYun && context.daYun && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="w-10 shrink-0 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                  大運
                </dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <GanZhiChip gan={context.daYun.gan} zhi={context.daYun.zhi} />
                  <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    {context.daYun.ganTenGod}／{context.daYun.zhiTenGod}・{context.daYun.stage}
                  </span>
                  <RelationChips relations={context.daYunRelations} />
                </dd>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <dt className="w-10 shrink-0 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                月日
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <GanZhiChip gan={context.month.gan} zhi={context.month.zhi} />
                <GanZhiChip gan={context.day.gan} zhi={context.day.zhi} />
                <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                  その月の柱と、その日の柱
                </span>
              </dd>
            </div>
            {transits && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="w-10 shrink-0 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                  めぐり
                </dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <Suspense
                    fallback={
                      <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                        …
                      </span>
                    }
                  >
                    <EventTransits
                      input={transits.input}
                      options={transits.options}
                      date={event.date}
                    />
                  </Suspense>
                </dd>
              </div>
            )}
          </dl>

          {(tone.bond > 0 || tone.clash > 0) && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              この時期に掛かっていたもの: 結びつき {tone.bond}・揺さぶり {tone.clash}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * 人生ログ。
 *
 * 実際に起きたことを日付で残し、その時期に巡っていた大運・流年と並べる。
 * 命式から出来事を当てにいくのではなく、起きたことと運の対応を後から確かめるための画面。
 */
export default function LifeLogView({
  chart,
  chartId,
  onGoToChart,
  horoscopeOptions,
}: {
  chart: Chart;
  chartId: number | null;
  onGoToChart: () => void;
  /** ホロスコープも見ているときだけ渡る。null なら四柱推命だけで並べる */
  horoscopeOptions: HoroscopeOptions | null;
}) {
  const [date, setDate] = useState(todayString());
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('仕事');
  const [note, setNote] = useState('');
  const [groupBy, setGroupBy] = useState<'daYun' | 'flat'>('daYun');
  const [withTransits, setWithTransits] = useState(true);
  const [copied, setCopied] = useState(false);

  const events = useLiveQuery(
    () => (chartId === null ? Promise.resolve([]) : listEvents(chartId)),
    [chartId]
  );

  const withContext = useMemo(
    () =>
      (events ?? []).map((e) => ({ event: e, context: eventContext(chart, e.date) })),
    [events, chart]
  );

  /** ホロスコープも見ていて、めぐりを並べる設定のときだけ渡す */
  const transitProps = useMemo(
    () => (horoscopeOptions && withTransits ? { input: chart.input, options: horoscopeOptions } : null),
    [horoscopeOptions, withTransits, chart.input]
  );

  const dateValid = parseDate(date) !== null;

  if (chartId === null) {
    return (
      <Section title="人生ログ">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          出来事は命式ごとに残すので、先にこの命式を保存してください。
        </p>
        <div className="mt-3">
          <Button variant="primary" onClick={onGoToChart}>
            命式の画面へ
          </Button>
        </div>
        <Note>
          「命式」の画面のいちばん下に保存の帯があります。保存すると、この画面で出来事を
          書き足せるようになります。
        </Note>
      </Section>
    );
  }

  const add = async () => {
    if (!dateValid) return;
    await addEvent({ chartId, date, title: title.trim(), category, note: note.trim() });
    setTitle('');
    setNote('');
  };

  const copySummary = async () => {
    const rows = (events ?? []).map((e) => ({
      date: e.date,
      title: e.title,
      category: e.category,
      note: e.note,
    }));
    let text = lifeLogSummary(chart, rows);

    if (transitProps) {
      // 天体暦はここでだけ要るので、押されたときに読み込む
      const [{ buildHoroscope }, { transitLogSummary }] = await Promise.all([
        import('../../core/horoscope/chart'),
        import('../../core/horoscope/transit'),
      ]);
      try {
        const natal = buildHoroscope(transitProps.input, transitProps.options);
        text += `\n\n${transitLogSummary(natal, rows, transitProps.options)}`;
      } catch {
        // 出生図を組めない入力（緯度なしなど）では、四柱推命の側だけを渡す
      }
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // 大運ごとにまとめる。出来事のある大運だけを、古い順に並べる
  const groups: { daYun: DaYunEntry | null; items: typeof withContext }[] = [];
  if (groupBy === 'daYun') {
    for (const item of withContext) {
      const key = item.context?.daYun ?? null;
      const last = groups[groups.length - 1];
      if (last && last.daYun === key) last.items.push(item);
      else groups.push({ daYun: key, items: [item] });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="出来事を残す"
        subtitle={`${chart.input.name.trim() || '名前なし'}の記録。転職・引越し・体調など、日付のはっきりしたことを書き留めます`}
      >
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <Field label="日付" hint={dateValid ? undefined : 'YYYY-MM-DD で入れてください'}>
            <input
              className="field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="出来事">
            <input
              className="field"
              value={title}
              placeholder="例）転職した"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3">
          <LabeledGroup label="分野">
            <Segmented
              ariaLabel="出来事の分野"
              size="sm"
              wrap
              value={category}
              onChange={setCategory}
              options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </LabeledGroup>
        </div>

        <div className="mt-3">
          <Field label="覚え書き（任意）">
            <textarea
              className="field min-h-16 resize-y"
              value={note}
              placeholder="そのとき何を感じたか、前後に何があったか"
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3">
          <Button variant="primary" onClick={() => void add()} disabled={!dateValid} full>
            書き留める
          </Button>
        </div>
      </Section>

      <Section
        title={`記録（${withContext.length}件）`}
        subtitle={
          horoscopeOptions
            ? 'それぞれの出来事に、その時期に巡っていた大運・流年と、天体のめぐりを添えます'
            : 'それぞれの出来事に、その時期に巡っていた大運・流年と、命式のどこに掛かっていたかを添えます'
        }
        actions={
          <div className="flex items-center gap-2">
            <Segmented
              ariaLabel="並べ方"
              size="sm"
              value={groupBy}
              onChange={setGroupBy}
              options={[
                { value: 'daYun' as const, label: '大運ごと' },
                { value: 'flat' as const, label: '日付順' },
              ]}
            />
            <Button onClick={() => void copySummary()} disabled={withContext.length === 0}>
              {copied ? 'コピーしました' : 'AI に渡す'}
            </Button>
          </div>
        }
      >
        {horoscopeOptions && (
          <div className="mb-3">
            <Toggle
              checked={withTransits}
              onChange={setWithTransits}
              label="天体のめぐりも並べる"
              hint="木星から先の天体が、その日に出生図のどこへ掛かっていたか。数日で通り過ぎる天体は外しています"
            />
          </div>
        )}
        {events === undefined ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            読み込んでいます…
          </p>
        ) : withContext.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            まだ記録がありません。覚えている出来事から書き留めてみてください。
          </p>
        ) : groupBy === 'flat' ? (
          <ul className="flex flex-col gap-2">
            {withContext.map(({ event, context }) => (
              <EventCard
                transits={transitProps}
                key={event.id}
                event={event}
                context={context}
                showDaYun
                onDelete={() => void deleteEvent(event.id!)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((g, i) => (
              <div key={g.daYun ? g.daYun.startYear : `none-${i}`}>
                {/* 大運はこの10年ぶん共通なので、まとまりの見出しに一度だけ出す */}
                <div
                  className="mb-2 rounded-lg px-2.5 py-2"
                  style={{ background: 'var(--surface-sunken)' }}
                >
                  {g.daYun ? (
                    <>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <GanZhiChip gan={g.daYun.gan} zhi={g.daYun.zhi} />
                        <span className="text-xs font-semibold">
                          {g.daYun.startYear}〜{g.daYun.endYear}年
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                          {g.daYun.startAge}歳〜・{g.daYun.ganTenGod}／{g.daYun.zhiTenGod}・
                          {g.daYun.stage}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <RelationChips relations={g.items[0].context?.daYunRelations ?? []} />
                      </div>
                    </>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>
                      大運の外
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-2">
                  {g.items.map(({ event, context }) => (
                    <EventCard
                      transits={transitProps}
                      key={event.id}
                      event={event}
                      context={context}
                      showDaYun={g.daYun === null}
                      onDelete={() => void deleteEvent(event.id!)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <Note>
          「AI に渡す」は、出来事と巡っていた運の対応をまとめて書き出します。当てさせるための
          ものではなく、噛み合って見えるところと、そうでないところを読んでもらうための形にしてあります。
        </Note>
      </Section>
    </div>
  );
}
