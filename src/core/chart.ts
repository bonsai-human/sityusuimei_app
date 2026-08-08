/**
 * 生年月日時から命式（Chart）を組み立てる。
 *
 * ■ 時間の扱いについて
 *
 * lunar-typescript が持つ節気の時刻は「北京時間（UTC+8）」で表されている。一方、
 * 時柱は生まれた土地の太陽の位置で決まる。この 2 つは性質の違う境界なので、
 * 次のように使い分けている。
 *
 *   年柱・月柱・大運 … 節入りは地球上のどこでも同時に起きる「瞬間」なので、
 *                      出生の瞬間を北京時間に直してから節と比べる
 *   日柱・時柱       … その土地の太陽が基準なので、真太陽時に直した現地の
 *                      日付と時刻から求める
 *
 * 経度補正を掛けた時刻で節入りを判定する実装も世の中にはあるが、節入りは天文的な
 * 瞬間なので、補正するなら節入り側も同じだけ動かさなければ辻褄が合わない。
 * ここでは補正の影響を時柱・日柱に限定している（差が出るのは節入り前後 30 分程度）。
 */

import { Lunar, Solar } from 'lunar-typescript';

import {
  ZHI_ANIMAL,
  ZHI_HIDDEN,
  isGanYang,
  isZhiYang,
  jieQiJa,
  type Gan,
  type Zhi,
} from './constants';
import { assessStrength, countElements, monthRulerOf } from './elements';
import {
  elementOfGan,
  elementOfZhi,
  hourFromZhi,
  hourGan,
  mingGong,
  naYin,
  taiYuan,
  tenGod,
  twelveStage,
  xunKong,
  zhiFromHour,
  zhiTenGod,
} from './ganzhi';
import { findRelations, splitGanZhi, type PillarSlot } from './relations';
import { computeCorrection } from './solarTime';
import type {
  BirthInput,
  Chart,
  DaYunEntry,
  HiddenStemView,
  LiuNianEntry,
  Pillar,
} from './types';

const MINUTE = 60_000;
const DAY = 86_400_000;
/** lunar-typescript が節気の計算に用いている基準（北京時間 UTC+8）。 */
const LIBRARY_TZ_MINUTES = 480;

interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
}

/** 壁掛け時計の時刻をタイムゾーンなしの通し数値に直す（比較と加減算のため）。 */
function wallToMs(w: Wall): number {
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi);
}

function msToWall(ms: number): Wall {
  const d = new Date(ms);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatWall(w: Wall, withTime = true): string {
  const date = `${w.y}年${pad(w.m)}月${pad(w.d)}日`;
  return withTime ? `${date} ${pad(w.h)}:${pad(w.mi)}` : date;
}

function solarOf(w: Wall) {
  return Solar.fromYmdHms(w.y, w.m, w.d, w.h, w.mi, 0);
}

/** Solar オブジェクトを Wall に戻す。 */
function wallOfSolar(s: {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
}): Wall {
  return {
    y: s.getYear(),
    m: s.getMonth(),
    d: s.getDay(),
    h: s.getHour(),
    mi: s.getMinute(),
  };
}

/** 入力された暦の日付を、グレゴリオ暦の年月日に正規化する。 */
function resolveSolarDate(input: BirthInput): { y: number; m: number; d: number } {
  if (input.calendar === 'solar') {
    return { y: input.year, m: input.month, d: input.day };
  }
  // 旧暦の閏月は月をマイナスで表す（lunar-typescript の約束）
  const month = input.calendar === 'lunar-leap' ? -input.month : input.month;
  const lunar = Lunar.fromYmdHms(input.year, month, input.day, 12, 0, 0);
  const s = lunar.getSolar();
  return { y: s.getYear(), m: s.getMonth(), d: s.getDay() };
}

function buildPillar(
  slot: PillarSlot,
  gan: Gan,
  zhi: Zhi,
  dayMaster: Gan,
  monthRuler?: Gan
): Pillar {
  const hidden: HiddenStemView[] = ZHI_HIDDEN[zhi].map((h) => ({
    gan: h.gan,
    element: elementOfGan(h.gan),
    role: h.role,
    tenGod: tenGod(dayMaster, h.gan),
    ...(slot === 'month' && monthRuler ? { isMonthRuler: h.gan === monthRuler } : {}),
  }));

  return {
    slot,
    gan,
    zhi,
    ganElement: elementOfGan(gan),
    zhiElement: elementOfZhi(zhi),
    ganYang: isGanYang(gan),
    zhiYang: isZhiYang(zhi),
    ganTenGod: slot === 'day' ? '日元' : tenGod(dayMaster, gan),
    zhiTenGod: zhiTenGod(dayMaster, zhi),
    hidden,
    stage: twelveStage(dayMaster, zhi),
    naYin: naYin(gan, zhi),
    xunKong: xunKong(gan, zhi),
    animal: ZHI_ANIMAL[zhi],
  };
}

export function buildChart(input: BirthInput, asOf: Date = new Date()): Chart {
  const { y, m, d } = resolveSolarDate(input);
  const timeKnown = input.time.kind !== 'unknown';

  // --- 時計の時刻を現地標準時に直す -------------------------------------
  let clockHour = 12;
  let clockMinute = 0;
  if (input.time.kind === 'hm') {
    clockHour = input.time.hour;
    clockMinute = input.time.minute;
  } else if (input.time.kind === 'zhi') {
    clockHour = hourFromZhi(input.time.zhi);
  }

  const clockWallMs = wallToMs({ y, m, d, h: clockHour, mi: clockMinute });
  // サマータイム中は時計が 1 時間進んでいるので、標準時に戻す
  const standardMs = clockWallMs - (input.dst ? 60 * MINUTE : 0);
  const standardWall = msToWall(standardMs);

  // --- 真太陽時（時柱・日柱の基準） -------------------------------------
  // 時支を直接指定された場合と時刻不明の場合は、補正を掛ける意味がないので行わない
  const applyCorrection = input.time.kind === 'hm';
  const correction = applyCorrection
    ? computeCorrection(
        {
          year: standardWall.y,
          month: standardWall.m,
          day: standardWall.d,
          hour: standardWall.h,
          longitude: input.place.longitude,
          tzOffsetMinutes: input.place.tzOffsetMinutes,
        },
        { longitude: input.options.trueSolarTime, equationOfTime: input.options.equationOfTime }
      )
    : null;

  const apparentMs = standardMs + Math.round((correction?.totalMinutes ?? 0) * MINUTE);
  const apparentWall = msToWall(apparentMs);

  // --- 年柱・月柱・大運は「瞬間」で判定するため北京時間に直す -----------
  const utcMs = standardMs - input.place.tzOffsetMinutes * MINUTE;
  const beijingWall = msToWall(utcMs + LIBRARY_TZ_MINUTES * MINUTE);
  const beijingLunar = solarOf(beijingWall).getLunar();
  const beijingEightChar = beijingLunar.getEightChar();

  const yearGZ = splitGanZhi(beijingEightChar.getYear());
  const monthGZ = splitGanZhi(beijingEightChar.getMonth());
  if (!yearGZ || !monthGZ) throw new Error('年柱・月柱を算出できませんでした');

  // --- 日柱は現地の暦日から。23時台の扱いは早子時説・夜子時説で分かれる ---
  const rollsToNextDay = timeKnown && apparentWall.h >= 23 && !input.options.lateZi;
  const dayWall = msToWall(wallToMs({ ...apparentWall, h: 12, mi: 0 }) + (rollsToNextDay ? DAY : 0));
  const dayGZ = splitGanZhi(solarOf(dayWall).getLunar().getDayInGanZhi());
  if (!dayGZ) throw new Error('日柱を算出できませんでした');

  const dayMaster = dayGZ.gan;

  // --- 節入りと月令 -----------------------------------------------------
  const prevJie = beijingLunar.getPrevJie();
  const nextJie = beijingLunar.getNextJie();
  const toLocal = (ms: number) => ms + (input.place.tzOffsetMinutes - LIBRARY_TZ_MINUTES) * MINUTE;
  const prevJieMs = wallToMs(wallOfSolar(prevJie.getSolar()));
  const daysFromJie = (wallToMs(beijingWall) - prevJieMs) / DAY;
  const monthRuler = monthRulerOf(monthGZ.zhi, daysFromJie);

  // --- 四柱 -------------------------------------------------------------
  const year = buildPillar('year', yearGZ.gan, yearGZ.zhi, dayMaster);
  const month = buildPillar('month', monthGZ.gan, monthGZ.zhi, dayMaster, monthRuler);
  const day = buildPillar('day', dayGZ.gan, dayGZ.zhi, dayMaster);

  let hour: Pillar | null = null;
  if (timeKnown) {
    const hz = input.time.kind === 'zhi' ? input.time.zhi : zhiFromHour(apparentWall.h);
    hour = buildPillar('hour', hourGan(dayMaster, hz), hz, dayMaster);
  }

  const pillars = hour ? [year, month, day, hour] : [year, month, day];

  // --- 大運・流年 -------------------------------------------------------
  const yun = beijingEightChar.getYun(
    input.gender === 'male' ? 1 : 0,
    input.options.sect
  );
  const startSolarMs = wallToMs(wallOfSolar(yun.getStartSolar()));
  const startAge = Math.round(((startSolarMs - wallToMs(beijingWall)) / (DAY * 365.2425)) * 10) / 10;

  const entries: DaYunEntry[] = [];
  // index 0 は起運前の期間なので飛ばし、実際に巡る大運だけを取る
  for (const dy of yun.getDaYun(10).slice(1)) {
    const gz = splitGanZhi(dy.getGanZhi());
    if (!gz) continue;
    const liuNian: LiuNianEntry[] = dy.getLiuNian().map((ln) => {
      const lgz = splitGanZhi(ln.getGanZhi())!;
      return {
        year: ln.getYear(),
        age: ln.getAge() - 1, // ライブラリは数え年を返すので満年齢に直す
        gan: lgz.gan,
        zhi: lgz.zhi,
        ganTenGod: tenGod(dayMaster, lgz.gan),
        zhiTenGod: zhiTenGod(dayMaster, lgz.zhi),
        stage: twelveStage(dayMaster, lgz.zhi),
      };
    });
    entries.push({
      index: dy.getIndex(),
      gan: gz.gan,
      zhi: gz.zhi,
      ganTenGod: tenGod(dayMaster, gz.gan),
      zhiTenGod: zhiTenGod(dayMaster, gz.zhi),
      stage: twelveStage(dayMaster, gz.zhi),
      startYear: dy.getStartYear(),
      endYear: dy.getEndYear(),
      startAge: Math.round((startAge + (dy.getIndex() - 1) * 10) * 10) / 10,
      liuNian,
    });
  }

  // --- 年齢 -------------------------------------------------------------
  const birthDate = new Date(Date.UTC(y, m - 1, d));
  const asOfUtc = new Date(Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()));
  let actualAge = asOfUtc.getUTCFullYear() - birthDate.getUTCFullYear();
  const hadBirthday =
    asOfUtc.getUTCMonth() > birthDate.getUTCMonth() ||
    (asOfUtc.getUTCMonth() === birthDate.getUTCMonth() &&
      asOfUtc.getUTCDate() >= birthDate.getUTCDate());
  if (!hadBirthday) actualAge -= 1;

  const lunarForDisplay = solarOf({ y, m, d, h: 12, mi: 0 }).getLunar();

  const elements = countElements(pillars);
  const strength = assessStrength(pillars, dayMaster, monthRuler);
  const relations = findRelations(
    pillars.map((p) => ({ slot: p.slot, gan: p.gan, zhi: p.zhi }))
  );

  return {
    input,
    pillars,
    year,
    month,
    day,
    hour,
    dayMaster,
    dayMasterElement: elementOfGan(dayMaster),
    elements,
    strength,
    relations,
    luck: {
      forward: yun.isForward(),
      startAge,
      startDate: formatWall(msToWall(toLocal(startSolarMs)), false),
      entries,
      beforeFirstNote: `${startAge}歳までは大運に入らず、年柱・月柱の影響下にある期間。`,
    },
    meta: {
      solarDate: formatWall({ y, m, d, h: 0, mi: 0 }, false),
      lunarDate: `${lunarForDisplay.getYear()}年${
        lunarForDisplay.getMonth() < 0 ? '閏' : ''
      }${Math.abs(lunarForDisplay.getMonth())}月${lunarForDisplay.getDay()}日`,
      trueSolarDateTime: timeKnown ? formatWall(apparentWall) : null,
      standardDateTime: timeKnown ? formatWall(standardWall) : null,
      correction,
      prevJie: {
        name: jieQiJa(prevJie.getName()),
        localDateTime: formatWall(msToWall(toLocal(prevJieMs))),
      },
      nextJie: {
        name: jieQiJa(nextJie.getName()),
        localDateTime: formatWall(
          msToWall(toLocal(wallToMs(wallOfSolar(nextJie.getSolar()))))
        ),
      },
      monthRuler,
      daysFromJie: Math.round(daysFromJie * 10) / 10,
      taiYuan: taiYuan(monthGZ.gan, monthGZ.zhi),
      mingGong: hour ? mingGong(yearGZ.gan, monthGZ.zhi, hour.zhi) : null,
    },
    age: {
      actual: actualAge,
      traditional: asOfUtc.getUTCFullYear() - y + 1,
      asOf: `${asOfUtc.getUTCFullYear()}年${pad(asOfUtc.getUTCMonth() + 1)}月${pad(
        asOfUtc.getUTCDate()
      )}日`,
    },
  };
}
