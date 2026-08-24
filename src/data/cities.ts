import type { BirthPlace } from '../core/types';

/**
 * 出生地のプリセット。
 *
 * 四柱推命の真太陽時補正に要るのは経度と標準時のオフセットだけだが、
 * ホロスコープのアセンダントとハウスには緯度が要るので、緯度も併せて持たせている。
 * 一覧に無い土地は経度と緯度を直接入力できる。
 */

export const TOKYO: BirthPlace = {
  label: '東京',
  longitude: 139.7671,
  latitude: 35.6812,
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
      { label: '札幌', longitude: 141.3544, latitude: 43.0618, tzOffsetMinutes: 540 },
      { label: '仙台', longitude: 140.8694, latitude: 38.2682, tzOffsetMinutes: 540 },
      TOKYO,
      { label: '横浜', longitude: 139.6425, latitude: 35.4437, tzOffsetMinutes: 540 },
      { label: '新潟', longitude: 139.0364, latitude: 37.9026, tzOffsetMinutes: 540 },
      { label: '名古屋', longitude: 136.9066, latitude: 35.1815, tzOffsetMinutes: 540 },
      { label: '金沢', longitude: 136.6256, latitude: 36.5613, tzOffsetMinutes: 540 },
      { label: '京都', longitude: 135.7681, latitude: 35.0116, tzOffsetMinutes: 540 },
      { label: '大阪', longitude: 135.5023, latitude: 34.6937, tzOffsetMinutes: 540 },
      { label: '神戸', longitude: 135.1955, latitude: 34.6901, tzOffsetMinutes: 540 },
      { label: '広島', longitude: 132.4553, latitude: 34.3853, tzOffsetMinutes: 540 },
      { label: '高松', longitude: 134.0434, latitude: 34.3401, tzOffsetMinutes: 540 },
      { label: '福岡', longitude: 130.4017, latitude: 33.5904, tzOffsetMinutes: 540 },
      { label: '鹿児島', longitude: 130.5581, latitude: 31.5966, tzOffsetMinutes: 540 },
      { label: '那覇', longitude: 127.6809, latitude: 26.2124, tzOffsetMinutes: 540 },
    ],
  },
  {
    region: 'アジア',
    cities: [
      { label: 'ソウル', longitude: 126.978, latitude: 37.5665, tzOffsetMinutes: 540 },
      { label: '釜山', longitude: 129.0756, latitude: 35.1796, tzOffsetMinutes: 540 },
      { label: '北京', longitude: 116.4074, latitude: 39.9042, tzOffsetMinutes: 480 },
      { label: '上海', longitude: 121.4737, latitude: 31.2304, tzOffsetMinutes: 480 },
      { label: '台北', longitude: 121.5654, latitude: 25.033, tzOffsetMinutes: 480 },
      { label: '香港', longitude: 114.1694, latitude: 22.3193, tzOffsetMinutes: 480 },
      { label: 'シンガポール', longitude: 103.8198, latitude: 1.3521, tzOffsetMinutes: 480 },
      { label: 'バンコク', longitude: 100.5018, latitude: 13.7563, tzOffsetMinutes: 420 },
    ],
  },
  {
    region: 'その他',
    cities: [
      { label: 'ホノルル', longitude: -157.8583, latitude: 21.3069, tzOffsetMinutes: -600 },
      { label: 'ロサンゼルス', longitude: -118.2437, latitude: 34.0522, tzOffsetMinutes: -480 },
      { label: 'ニューヨーク', longitude: -74.006, latitude: 40.7128, tzOffsetMinutes: -300 },
      { label: 'ロンドン', longitude: -0.1276, latitude: 51.5074, tzOffsetMinutes: 0 },
      { label: 'パリ', longitude: 2.3522, latitude: 48.8566, tzOffsetMinutes: 60 },
      { label: 'シドニー', longitude: 151.2093, latitude: -33.8688, tzOffsetMinutes: 600 },
    ],
  },
];

export const ALL_CITIES: BirthPlace[] = CITY_GROUPS.flatMap((g) => g.cities);

export function findCity(label: string): BirthPlace | undefined {
  return ALL_CITIES.find((c) => c.label === label);
}

/**
 * 緯度を持たない時代に保存した出生地に、緯度を補う。
 *
 * 都市名が一覧にあれば経度も突き合わせて（同名の別地点を取り違えないように）緯度を入れる。
 * 自分で経度を打った土地は補いようがないので null のままにし、
 * ホロスコープを出すときに入力してもらう。
 */
export function withLatitude(place: BirthPlace): BirthPlace {
  if (place == null || typeof place !== 'object') return place;
  if (place.latitude != null) return place;

  const city = findCity(place.label);
  if (city && Math.abs(city.longitude - place.longitude) < 0.001) {
    return { ...place, latitude: city.latitude };
  }
  return { ...place, latitude: null };
}
