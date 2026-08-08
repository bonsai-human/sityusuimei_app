import { ELEMENT_LABEL } from '../../core/constants';
import { formatMinutes } from '../../core/solarTime';
import type { Chart } from '../../core/types';
import type { PillarOrder } from '../../store/appStore';
import { Section, elementClass } from '../ui';
import ElementBalance from './ElementBalance';
import LuckTimeline from './LuckTimeline';
import PillarCard from './PillarCard';
import RelationList from './RelationList';

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <dt className="w-24 shrink-0 text-xs" style={{ color: 'var(--ink-faint)' }}>
        {label}
      </dt>
      <dd className="text-xs" style={{ color: 'var(--ink-muted)' }}>
        {value}
      </dd>
    </div>
  );
}

export default function ChartView({
  chart,
  pillarOrder,
}: {
  chart: Chart;
  pillarOrder: PillarOrder;
}) {
  const pillars = pillarOrder === 'rtl' ? [...chart.pillars].reverse() : chart.pillars;
  const c = chart.meta.correction;

  return (
    <div className="flex flex-col gap-4">
      <Section title={chart.input.name.trim() || '名前なし'}>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`${elementClass(chart.dayMasterElement)} el-chip rounded px-2 py-1`}>
            <span className="font-kanji text-lg">{chart.dayMaster}</span>
            <span className="ml-1 text-xs">
              {ELEMENT_LABEL[chart.dayMasterElement]}の日干
            </span>
          </span>
          <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {chart.input.gender === 'male' ? '男性' : '女性'}・満{chart.age.actual}歳
            <span style={{ color: 'var(--ink-faint)' }}>（数え{chart.age.traditional}歳）</span>
          </span>
        </div>

        <dl>
          <MetaRow label="新暦" value={chart.meta.solarDate} />
          <MetaRow label="旧暦" value={chart.meta.lunarDate} />
          {chart.meta.standardDateTime ? (
            <>
              <MetaRow
                label="時計の時刻"
                value={`${chart.meta.standardDateTime}（${chart.input.place.label}${
                  chart.input.dst ? '・サマータイム' : ''
                }）`}
              />
              <MetaRow
                label="真太陽時"
                value={
                  <>
                    {chart.meta.trueSolarDateTime}
                    {c && (
                      <span style={{ color: 'var(--ink-faint)' }}>
                        {' '}
                        ／ 経度 {formatMinutes(c.longitudeMinutes)}・均時差{' '}
                        {formatMinutes(c.equationOfTimeMinutes)} → 適用{' '}
                        {formatMinutes(c.totalMinutes)}
                      </span>
                    )}
                  </>
                }
              />
            </>
          ) : (
            <MetaRow label="出生時刻" value="不明（時柱なしの三柱）" />
          )}
          <MetaRow
            label="節入り"
            value={`${chart.meta.prevJie.name} ${chart.meta.prevJie.localDateTime}（経過 ${chart.meta.daysFromJie}日）→ 次節 ${chart.meta.nextJie.name} ${chart.meta.nextJie.localDateTime}`}
          />
          <MetaRow label="月令" value={`${chart.meta.monthRuler}（月支の蔵干のうち生日に司令していたもの）`} />
          <MetaRow
            label="そのほか"
            value={`胎元 ${chart.meta.taiYuan}${
              chart.meta.mingGong ? ` ／ 命宮 ${chart.meta.mingGong}` : ''
            } ／ 大運 ${chart.luck.forward ? '順行' : '逆行'}`}
          />
        </dl>
      </Section>

      <Section
        title="四柱"
        subtitle="上段が天干、下段が地支。十神はすべて日干（青枠の柱）から見た関係です"
      >
        <div className={`grid gap-2 ${pillars.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {pillars.map((p) => (
            <PillarCard key={p.slot} pillar={p} isDayMaster={p.slot === 'day'} />
          ))}
        </div>
      </Section>

      <ElementBalance chart={chart} />
      <RelationList chart={chart} />
      <LuckTimeline chart={chart} />
    </div>
  );
}
