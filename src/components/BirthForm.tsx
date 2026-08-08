import { useMemo } from 'react';

import { ZHI, type Zhi } from '../core/constants';
import { computeCorrection, formatMinutes, meridianOf } from '../core/solarTime';
import type { BirthInput, CalendarKind, TimeInput } from '../core/types';
import { CITY_GROUPS, findCity } from '../data/cities';
import { Button, Field, LabeledGroup, Note, Section, Segmented, Toggle } from './ui';

const CUSTOM_PLACE = '__custom__';

export default function BirthForm({
  input,
  onChange,
  onSubmit,
}: {
  input: BirthInput;
  onChange: (patch: Partial<BirthInput>) => void;
  onSubmit: () => void;
}) {
  // ローカルに取り出しておくと、コールバックの中でも kind による絞り込みが効く
  const time = input.time;
  const timeKind = time.kind;

  // 出生地と生年月日が決まった時点で、補正の内訳をその場に出す。
  // 「日本 (23分)」のように結果だけ出されても検算できないので、内訳を見せる。
  const preview = useMemo(() => {
    if (time.kind !== 'hm') return null;
    return computeCorrection(
      {
        year: input.year,
        month: input.month,
        day: input.day,
        hour: time.hour,
        longitude: input.place.longitude,
        tzOffsetMinutes: input.place.tzOffsetMinutes,
      },
      { longitude: input.options.trueSolarTime, equationOfTime: input.options.equationOfTime }
    );
  }, [input, time]);

  const setTime = (time: TimeInput) => onChange({ time });
  const setOptions = (patch: Partial<BirthInput['options']>) =>
    onChange({ options: { ...input.options, ...patch } });

  const selectedCity = findCity(input.place.label) ? input.place.label : CUSTOM_PLACE;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Section title="生まれた人">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="名前" hint="空欄でも構いません。ブラウザの中だけに保存されます">
            <input
              className="field"
              value={input.name}
              placeholder="自分"
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
          <LabeledGroup label="性別" hint="大運が順行するか逆行するかの判定に使います">
            <Segmented
              ariaLabel="性別"
              value={input.gender}
              onChange={(gender) => onChange({ gender })}
              options={[
                { value: 'male' as const, label: '男性' },
                { value: 'female' as const, label: '女性' },
              ]}
            />
          </LabeledGroup>
        </div>
      </Section>

      <Section title="生年月日">
        <LabeledGroup label="暦">
          <Segmented
            ariaLabel="暦の種類"
            value={input.calendar}
            onChange={(calendar: CalendarKind) => onChange({ calendar })}
            options={[
              { value: 'solar', label: '新暦' },
              { value: 'lunar', label: '旧暦' },
              { value: 'lunar-leap', label: '旧暦(閏月)' },
            ]}
          />
        </LabeledGroup>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Field label="年">
            <input
              className="field"
              type="number"
              inputMode="numeric"
              min={1900}
              max={2100}
              value={input.year}
              onChange={(e) => onChange({ year: Number(e.target.value) })}
            />
          </Field>
          <Field label="月">
            <input
              className="field"
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={input.month}
              onChange={(e) => onChange({ month: Number(e.target.value) })}
            />
          </Field>
          <Field label="日">
            <input
              className="field"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={input.day}
              onChange={(e) => onChange({ day: Number(e.target.value) })}
            />
          </Field>
        </div>
        {input.calendar !== 'solar' && (
          <Note>
            旧暦で入力すると新暦に変換してから命式を組みます。閏月は「旧暦(閏月)」を選んでください。
          </Note>
        )}
      </Section>

      <Section
        title="生まれた時刻"
        subtitle="時柱と、時刻から決まる項目（十二運の一部・命宮）に効きます"
      >
        <Segmented
          ariaLabel="出生時刻の指定方法"
          value={timeKind}
          onChange={(kind) => {
            if (kind === 'hm') setTime({ kind: 'hm', hour: 12, minute: 0 });
            else if (kind === 'zhi') setTime({ kind: 'zhi', zhi: '午' });
            else setTime({ kind: 'unknown' });
          }}
          options={[
            { value: 'hm' as const, label: '時分で入力' },
            { value: 'zhi' as const, label: '時支で入力' },
            { value: 'unknown' as const, label: '不明' },
          ]}
        />

        {time.kind === 'hm' && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="時">
              <input
                className="field"
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={time.hour}
                onChange={(e) =>
                  setTime({ kind: 'hm', hour: Number(e.target.value), minute: time.minute })
                }
              />
            </Field>
            <Field label="分">
              <input
                className="field"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={time.minute}
                onChange={(e) =>
                  setTime({ kind: 'hm', hour: time.hour, minute: Number(e.target.value) })
                }
              />
            </Field>
          </div>
        )}

        {time.kind === 'zhi' && (
          <div className="mt-4">
            <Field label="時支" hint="すでに干支で分かっている場合。真太陽時の補正は掛けません">
              <select
                className="field"
                value={time.zhi}
                onChange={(e) => setTime({ kind: 'zhi', zhi: e.target.value as Zhi })}
              >
                {ZHI.map((z, i) => (
                  <option key={z} value={z}>
                    {z}刻（{String((i * 2 + 23) % 24).padStart(2, '0')}:00〜
                    {String((i * 2 + 1) % 24).padStart(2, '0')}:00）
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {time.kind === 'unknown' && (
          <Note>
            時柱を出さずに三柱で組みます。年柱・月柱・日柱と大運はそのまま算出できます。
          </Note>
        )}
      </Section>

      <Section title="生まれた場所">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="都市">
            <select
              className="field"
              value={selectedCity}
              onChange={(e) => {
                if (e.target.value === CUSTOM_PLACE) {
                  onChange({ place: { ...input.place, label: '経度を指定' } });
                  return;
                }
                const city = findCity(e.target.value);
                if (city) onChange({ place: city });
              }}
            >
              {CITY_GROUPS.map((g) => (
                <optgroup key={g.region} label={g.region}>
                  {g.cities.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM_PLACE}>そのほか（経度を直接入力）</option>
            </select>
          </Field>
          <Field label="東経（西経はマイナス）">
            <input
              className="field"
              type="number"
              inputMode="decimal"
              step="0.0001"
              min={-180}
              max={180}
              value={input.place.longitude}
              onChange={(e) =>
                onChange({
                  place: {
                    ...input.place,
                    label: findCity(input.place.label) ? '経度を指定' : input.place.label,
                    longitude: Number(e.target.value),
                  },
                })
              }
            />
          </Field>
        </div>

        <div className="mt-3">
          <Toggle
            checked={input.dst}
            onChange={(dst) => onChange({ dst })}
            label="サマータイム中に生まれた"
            hint="日本では 1948〜1951 年の夏に実施されていました。時計が1時間進んでいた分を戻します"
          />
        </div>
      </Section>

      <Section
        title="計算の設定"
        subtitle="流派によって扱いが分かれる箇所です。判断がつかなければ既定のままで構いません"
      >
        <Toggle
          checked={input.options.trueSolarTime}
          onChange={(trueSolarTime) => setOptions({ trueSolarTime })}
          label="真太陽時に直す（経度補正）"
          hint={`標準時子午線 東経${meridianOf(input.place.tzOffsetMinutes)}度 との差を、1度あたり4分で換算します`}
        />
        <Toggle
          checked={input.options.equationOfTime}
          onChange={(equationOfTime) => setOptions({ equationOfTime })}
          label="均時差も加える"
          hint="地球の公転軌道と地軸の傾きによる、日ごとのずれ（年間で ±16分ほど）"
        />
        <Toggle
          checked={input.options.lateZi}
          onChange={(lateZi) => setOptions({ lateZi })}
          label="夜子時説を採る"
          hint="23時台を当日の日柱のままにします。切ると早子時説（23時から翌日の日柱）になります"
        />

        <div className="mt-3">
          <LabeledGroup label="大運の起算方法">
            <Segmented
              ariaLabel="大運の起算方法"
              size="sm"
              value={input.options.sect}
              onChange={(sect) => setOptions({ sect: sect as 1 | 2 })}
              options={[
                { value: 2 as const, label: '分単位で厳密に', title: '4320分＝1年として換算' },
                { value: 1 as const, label: '日と時辰で', title: '3日＝1年、1時辰＝5日として換算' },
              ]}
            />
          </LabeledGroup>
        </div>

        {preview && (
          <div
            className="mt-4 rounded-lg p-3 text-xs leading-relaxed"
            style={{ background: 'var(--surface-sunken)' }}
          >
            <div className="mb-1 font-medium" style={{ color: 'var(--ink-muted)' }}>
              時刻の補正内訳
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>経度補正 {formatMinutes(preview.longitudeMinutes)}</span>
              <span>均時差 {formatMinutes(preview.equationOfTimeMinutes)}</span>
              <span className="font-semibold">適用 {formatMinutes(preview.totalMinutes)}</span>
            </div>
          </div>
        )}
      </Section>

      <div className="sticky bottom-3 z-10">
        <Button type="submit" variant="primary" full>
          命式を組む
        </Button>
      </div>
    </form>
  );
}
