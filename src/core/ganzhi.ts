/**
 * 干支まわりの基本演算。十神・十二運・納音・空亡・時柱の導出など、
 * lunar-typescript に頼らず自前で計算する部分をまとめている。
 */

import {
  CHANG_SHENG_START,
  GAN,
  GAN_ELEMENT,
  NA_YIN,
  TWELVE_STAGES,
  ZHI,
  ZHI_ELEMENT,
  ZHI_HIDDEN,
  controls,
  generates,
  isGanYang,
  type Gan,
  type TenGod,
  type TwelveStage,
  type Zhi,
} from './constants';

export function ganIndex(g: Gan): number {
  return GAN.indexOf(g);
}

export function zhiIndex(z: Zhi): number {
  return ZHI.indexOf(z);
}

/** 六十干支の通し番号（甲子 = 0）。 */
export function ganZhiIndex(gan: Gan, zhi: Zhi): number {
  const gi = ganIndex(gan);
  const zi = zhiIndex(zhi);
  // 干は10周期・支は12周期。両方に合致する 0..59 の番号は一意に決まる。
  for (let n = 0; n < 60; n++) {
    if (n % 10 === gi && n % 12 === zi) return n;
  }
  throw new Error(`不正な干支の組み合わせです: ${gan}${zhi}`);
}

/**
 * 日干から見た相手の天干の十神。
 * 五行の関係（同じ／生じる／剋す／剋される／生じられる）と陰陽の一致で 10 種に分かれる。
 */
export function tenGod(dayMaster: Gan, other: Gan): TenGod {
  const me = GAN_ELEMENT[dayMaster];
  const it = GAN_ELEMENT[other];
  const samePolarity = isGanYang(dayMaster) === isGanYang(other);

  if (me === it) return samePolarity ? '比肩' : '劫財';
  if (generates(me) === it) return samePolarity ? '食神' : '傷官';
  if (controls(me) === it) return samePolarity ? '偏財' : '正財';
  if (controls(it) === me) return samePolarity ? '偏官' : '正官';
  if (generates(it) === me) return samePolarity ? '偏印' : '正印';
  throw new Error(`十神を判定できません: ${dayMaster} / ${other}`);
}

/** 地支の十神は、その地支の本気（蔵干の最後）から求める。 */
export function zhiTenGod(dayMaster: Gan, zhi: Zhi): TenGod {
  const hidden = ZHI_HIDDEN[zhi];
  return tenGod(dayMaster, hidden[hidden.length - 1].gan);
}

/** 十二運星。陽干は長生から順行、陰干は逆行して 12 支をめぐる。 */
export function twelveStage(dayMaster: Gan, zhi: Zhi): TwelveStage {
  const { zhi: start, forward } = CHANG_SHENG_START[dayMaster];
  const diff = zhiIndex(zhi) - zhiIndex(start);
  const step = forward ? diff : -diff;
  return TWELVE_STAGES[((step % 12) + 12) % 12];
}

/** 納音。六十干支を 2 つずつまとめた 30 種から引く。 */
export function naYin(gan: Gan, zhi: Zhi): string {
  return NA_YIN[Math.floor(ganZhiIndex(gan, zhi) / 2)];
}

/**
 * 空亡（旬空）。干支が属する十干十二支の「旬」で、天干が回りきらずに余る 2 支。
 */
export function xunKong(gan: Gan, zhi: Zhi): [Zhi, Zhi] {
  const n = ganZhiIndex(gan, zhi);
  const xunStart = Math.floor(n / 10) * 10; // その旬の先頭（甲◯）の通し番号
  const startZhi = xunStart % 12;
  return [ZHI[(startZhi + 10) % 12], ZHI[(startZhi + 11) % 12]];
}

/** 旬の名前（例: 甲戌旬）。 */
export function xunName(gan: Gan, zhi: Zhi): string {
  const n = ganZhiIndex(gan, zhi);
  const xunStart = Math.floor(n / 10) * 10;
  return `甲${ZHI[xunStart % 12]}旬`;
}

/**
 * 五鼠遁。日干から子刻の天干が決まり、そこから時支ぶん進めて時干を得る。
 * 甲己日は甲子から、乙庚日は丙子から…という並び。
 */
export function hourGan(dayGan: Gan, hourZhi: Zhi): Gan {
  const base = (ganIndex(dayGan) % 5) * 2;
  return GAN[(base + zhiIndex(hourZhi)) % 10];
}

/**
 * 五虎遁。年干から寅月の天干が決まる。月柱の天干や命宮の天干を求めるのに使う。
 * 寅を起点とした通し番号（寅=0）を渡す。
 */
export function ganFromYearGan(yearGan: Gan, stepsFromYin: number): Gan {
  const base = ((ganIndex(yearGan) % 5) * 2 + 2) % 10;
  return GAN[(base + stepsFromYin) % 10];
}

/** 時刻（0-23時）から時支を求める。23時台と0時台がともに子刻になる。 */
export function zhiFromHour(hour: number): Zhi {
  return ZHI[Math.floor(((hour + 1) % 24) / 2)];
}

/** 時支の代表時刻（その刻のまん中）。時支だけを指定して入力されたときに使う。 */
export function hourFromZhi(zhi: Zhi): number {
  return (zhiIndex(zhi) * 2) % 24;
}

/** 胎元。月柱の天干を 1 つ、地支を 3 つ進めた干支。 */
export function taiYuan(monthGan: Gan, monthZhi: Zhi): string {
  return `${GAN[(ganIndex(monthGan) + 1) % 10]}${ZHI[(zhiIndex(monthZhi) + 3) % 12]}`;
}

/**
 * 命宮。寅を 1 とした月支・時支の番号を足し、14（超えるなら 26）から引いて求める。
 * 天干は年干からの五虎遁で決める。
 */
export function mingGong(yearGan: Gan, monthZhi: Zhi, hourZhi: Zhi): string {
  const num = (z: Zhi) => ((zhiIndex(z) - zhiIndex('寅') + 12) % 12) + 1;
  const sum = num(monthZhi) + num(hourZhi);
  const target = sum <= 14 ? 14 - sum : 26 - sum;
  const stepsFromYin = target - 1;
  return `${ganFromYearGan(yearGan, stepsFromYin)}${ZHI[(zhiIndex('寅') + stepsFromYin) % 12]}`;
}

export function elementOfGan(g: Gan) {
  return GAN_ELEMENT[g];
}

export function elementOfZhi(z: Zhi) {
  return ZHI_ELEMENT[z];
}
