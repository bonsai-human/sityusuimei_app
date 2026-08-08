import type { BirthPlace } from '../core/types';

/**
 * 出生地のプリセット。真太陽時の補正に必要なのは経度と標準時のオフセットだけなので、
 * その 2 つだけを持たせている。一覧に無い土地は経度を直接入力できる。
 */

export const TOKYO: BirthPlace = {
  label: '東京',
  longitude: 139.7671,
  tzOffsetMinutes: 540,
};

export interface CityGroup {
  region: string;
  cities: BirthPlace[];
}

export const CITY_GROUPS: CityGroup[] = [
  {
    region: '日本',
    cities: [
      { label: '札幌', longitude: 141.3544, tzOffsetMinutes: 540 },
      { label: '仙台', longitude: 140.8694, tzOffsetMinutes: 540 },
      TOKYO,
      { label: '横浜', longitude: 139.6425, tzOffsetMinutes: 540 },
      { label: '新潟', longitude: 139.0364, tzOffsetMinutes: 540 },
      { label: '名古屋', longitude: 136.9066, tzOffsetMinutes: 540 },
      { label: '金沢', longitude: 136.6256, tzOffsetMinutes: 540 },
      { label: '京都', longitude: 135.7681, tzOffsetMinutes: 540 },
      { label: '大阪', longitude: 135.5023, tzOffsetMinutes: 540 },
      { label: '神戸', longitude: 135.1955, tzOffsetMinutes: 540 },
      { label: '広島', longitude: 132.4553, tzOffsetMinutes: 540 },
      { label: '高松', longitude: 134.0434, tzOffsetMinutes: 540 },
      { label: '福岡', longitude: 130.4017, tzOffsetMinutes: 540 },
      { label: '鹿児島', longitude: 130.5581, tzOffsetMinutes: 540 },
      { label: '那覇', longitude: 127.6809, tzOffsetMinutes: 540 },
    ],
  },
  {
    region: 'アジア',
    cities: [
      { label: 'ソウル', longitude: 126.978, tzOffsetMinutes: 540 },
      { label: '釜山', longitude: 129.0756, tzOffsetMinutes: 540 },
      { label: '北京', longitude: 116.4074, tzOffsetMinutes: 480 },
      { label: '上海', longitude: 121.4737, tzOffsetMinutes: 480 },
      { label: '台北', longitude: 121.5654, tzOffsetMinutes: 480 },
      { label: '香港', longitude: 114.1694, tzOffsetMinutes: 480 },
      { label: 'シンガポール', longitude: 103.8198, tzOffsetMinutes: 480 },
      { label: 'バンコク', longitude: 100.5018, tzOffsetMinutes: 420 },
    ],
  },
  {
    region: 'その他',
    cities: [
      { label: 'ホノルル', longitude: -157.8583, tzOffsetMinutes: -600 },
      { label: 'ロサンゼルス', longitude: -118.2437, tzOffsetMinutes: -480 },
      { label: 'ニューヨーク', longitude: -74.006, tzOffsetMinutes: -300 },
      { label: 'ロンドン', longitude: -0.1276, tzOffsetMinutes: 0 },
      { label: 'パリ', longitude: 2.3522, tzOffsetMinutes: 60 },
      { label: 'シドニー', longitude: 151.2093, tzOffsetMinutes: 600 },
    ],
  },
];

export const ALL_CITIES: BirthPlace[] = CITY_GROUPS.flatMap((g) => g.cities);

export function findCity(label: string): BirthPlace | undefined {
  return ALL_CITIES.find((c) => c.label === label);
}
