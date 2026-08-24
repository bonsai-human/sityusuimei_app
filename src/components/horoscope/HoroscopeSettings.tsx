import { HOUSE_SYSTEM_LABEL, type HoroscopeOptions, type HouseSystem } from '../../core/horoscope/types';
import { LabeledGroup, Section, Segmented, Toggle } from '../ui';

/**
 * ホロスコープの読み方の設定。
 *
 * 四柱推命の流派の設定が「その人の命式の性質」として入力側にあるのに対して、
 * こちらは読み手の好みなので、人ではなくアプリの設定として持つ。
 */
export default function HoroscopeSettings({
  options,
  onChange,
}: {
  options: HoroscopeOptions;
  onChange: (patch: Partial<HoroscopeOptions>) => void;
}) {
  return (
    <Section
      title="読み方の設定"
      subtitle="流派によって分かれる箇所です。判断がつかなければ既定のままで構いません"
    >
      <div className="flex flex-col gap-4">
        <LabeledGroup
          label="ハウスの分割"
          hint="プラシーダスは日本の書籍でいちばん見かける方式。ホールサインはサインを丸ごと1室にする古典寄りの方式"
        >
          <Segmented
            ariaLabel="ハウスの分割"
            value={options.houseSystem}
            onChange={(houseSystem: HouseSystem) => onChange({ houseSystem })}
            options={(['placidus', 'whole', 'equal'] as const).map((v) => ({
              value: v,
              label: HOUSE_SYSTEM_LABEL[v],
            }))}
          />
        </LabeledGroup>

        <LabeledGroup
          label="ドラゴンヘッド"
          hint="平均は滑らかに動く平均値、真はその瞬間の実際の交点。±1.6 度ほど違います"
        >
          <Segmented
            ariaLabel="ドラゴンヘッドの取り方"
            value={options.nodeKind}
            onChange={(nodeKind: 'mean' | 'true') => onChange({ nodeKind })}
            options={[
              { value: 'mean' as const, label: '平均' },
              { value: 'true' as const, label: '真' },
            ]}
          />
        </LabeledGroup>

        <Toggle
          checked={options.minorAspects}
          onChange={(minorAspects) => onChange({ minorAspects })}
          label="マイナーアスペクトも拾う"
          hint="30度・45度・135度・150度。オーブは 2 度で見ます"
        />

        <Toggle
          checked={options.modernRulers}
          onChange={(modernRulers) => onChange({ modernRulers })}
          label="サインの支配星を現代式で取る"
          hint="蠍を冥王星・水瓶を天王星・魚を海王星とします。切ると古典式（それぞれ火星・土星・木星）になります"
        />
      </div>
    </Section>
  );
}
