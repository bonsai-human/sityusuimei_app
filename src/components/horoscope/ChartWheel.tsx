import {
  ASPECT_BY_KIND,
  BODY_SYMBOL,
  SIGN_LABEL,
  SIGN_SYMBOL,
  type BodyId,
} from '../../core/horoscope/constants';
import { norm360 } from '../../core/horoscope/math';
import type { Horoscope } from '../../core/horoscope/types';
import { signClass, toneLine } from './style';

/**
 * 出生図の円。
 *
 * 外周にサイン、その内側にハウス、天体は円周上のその黄経の位置に置き、
 * 中央にアスペクトの線を引く。描画ライブラリは入れず、SVG を直に組む
 * （比較画面の関係線と同じ方針。色は CSS 変数から取るので配色の切り替えにも付いてくる）。
 *
 * 向きは慣習どおり、アセンダントを左（9 時の方向）に置き、黄経が増える向きを
 * 反時計回りにする。時刻が分からずアセンダントが無いときは、牡羊座 0 度を左に置く。
 */

const SIZE = 400;
const C = SIZE / 2;
/** 感受点の札は円の外に出すので、その分だけ viewBox を広げる。 */
const PAD = 18;

const R_SIGN_OUT = 196;
const R_SIGN_IN = 166;
const R_BODY = 152;
const R_TICK = 141;
/** ハウスの内側の円と、室番号を置く半径 */
const R_HOUSE_IN = 136;
const R_HOUSE_NUM = 128;
/** アスペクトの線を引く円 */
const R_ASPECT = 120;
/** 感受点の札の位置（円の外側） */
const R_ANGLE_LABEL = R_SIGN_OUT + 9;

/** 天体の札が重ならないように保つ、最小の間隔（度）。 */
const MIN_GAP = 7.5;

interface Point {
  x: number;
  y: number;
}

function polar(angle: number, radius: number): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C - radius * Math.sin(rad) };
}

/** 扇形（ドーナツの一片）のパス。 */
function sectorPath(from: number, to: number, rOut: number, rIn: number): string {
  const a = polar(from, rOut);
  const b = polar(to, rOut);
  const c = polar(to, rIn);
  const d = polar(from, rIn);
  const large = norm360(to - from) > 180 ? 1 : 0;
  return [
    `M ${a.x} ${a.y}`,
    `A ${rOut} ${rOut} 0 ${large} 0 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${rIn} ${rIn} 0 ${large} 1 ${d.x} ${d.y}`,
    'Z',
  ].join(' ');
}

/**
 * 近すぎる天体の札をずらす。
 *
 * 黄経の順に並べ、前の札から MIN_GAP 未満なら押し出す。一周ぶん見たあとに
 * 最後と最初がぶつかっていたら、全体を少し戻して均す。
 */
function spread(angles: { id: BodyId; angle: number }[]): Map<BodyId, number> {
  const sorted = [...angles].sort((a, b) => a.angle - b.angle);
  const placed = new Map<BodyId, number>();
  let previous: number | null = null;

  for (const item of sorted) {
    let angle = item.angle;
    if (previous != null && angle - previous < MIN_GAP) angle = previous + MIN_GAP;
    placed.set(item.id, angle);
    previous = angle;
  }

  // 一周して先頭に食い込んだぶんは、全体をわずかに戻す
  const first = placed.get(sorted[0].id);
  const last = previous;
  if (first != null && last != null && last - first > 360 - MIN_GAP) {
    const overflow = last - first - (360 - MIN_GAP);
    let i = 0;
    for (const item of sorted) {
      placed.set(item.id, placed.get(item.id)! - (overflow * (sorted.length - i)) / sorted.length);
      i++;
    }
  }
  return placed;
}

export default function ChartWheel({ horoscope }: { horoscope: Horoscope }) {
  const { placements, angles, houses, aspects } = horoscope;

  // 左（180 度の向き）に来る黄経
  const origin = angles ? angles.asc.lon : 0;
  const screenAngle = (lon: number) => 180 + norm360(lon - origin);

  const displayed = spread(
    placements.map((p) => ({ id: p.id, angle: screenAngle(p.lon) }))
  );

  const aspectPoints = new Map<string, number>(
    placements.map((p) => [p.id as string, screenAngle(p.lon)])
  );
  if (angles) {
    aspectPoints.set('asc', screenAngle(angles.asc.lon));
    aspectPoints.set('mc', screenAngle(angles.mc.lon));
  }

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${SIZE + PAD * 2} ${SIZE + PAD * 2}`}
      className="mx-auto block h-auto w-full"
      style={{ maxWidth: 460 }}
      role="img"
      aria-label={
        angles
          ? `出生図。アセンダントは${SIGN_LABEL[angles.asc.position.sign]}`
          : '出生図（出生時刻が不明なため、ハウスと感受点は描いていません）'
      }
    >
      {/* サインの帯 */}
      {Array.from({ length: 12 }, (_, sign) => {
        const from = screenAngle(sign * 30);
        return (
          <g key={sign} className={signClass(sign)}>
            <path
              d={sectorPath(from, from + 30, R_SIGN_OUT, R_SIGN_IN)}
              fill="var(--el-bg)"
              stroke="var(--el-line)"
              strokeWidth={0.5}
            />
            <text
              {...polar(from + 15, (R_SIGN_OUT + R_SIGN_IN) / 2)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={17}
              fill="var(--el-fg)"
            >
              {SIGN_SYMBOL[sign]}
            </text>
          </g>
        );
      })}

      {/* アスペクトを引く内側の円。ハウスが無いときも図の輪郭として引く */}
      <circle cx={C} cy={C} r={R_ASPECT} fill="none" stroke="var(--line)" strokeWidth={0.6} />

      {/* ハウス */}
      {houses && (
        <g>
          <circle cx={C} cy={C} r={R_HOUSE_IN} fill="none" stroke="var(--line)" strokeWidth={0.6} />
          {houses.cusps.map((cusp, i) => {
            const angle = screenAngle(cusp);
            const outer = polar(angle, R_SIGN_IN);
            const inner = polar(angle, R_ASPECT);
            // 1・4・7・10 室は図の骨格なので太く引く
            const major = i % 3 === 0;
            const next = houses.cusps[(i + 1) % 12];
            const mid = angle + norm360(next - cusp) / 2;
            return (
              <g key={i}>
                <line
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  stroke={major ? 'var(--line-strong)' : 'var(--line)'}
                  strokeWidth={major ? 1.2 : 0.6}
                />
                <text
                  {...polar(mid, R_HOUSE_NUM)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fill="var(--ink-faint)"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* アスペクト */}
      <g>
        {aspects.map((a, i) => {
          const from = aspectPoints.get(a.a);
          const to = aspectPoints.get(a.b);
          if (from == null || to == null) return null;
          const p1 = polar(from, R_ASPECT);
          const p2 = polar(to, R_ASPECT);
          const def = ASPECT_BY_KIND[a.kind];
          // ちょうどに近いほど濃く引く
          const tightness = 1 - Math.min(a.orb / 10, 1);
          return (
            <line
              key={`${a.a}-${a.b}-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={toneLine(a.tone)}
              strokeWidth={def.major ? 1 : 0.6}
              strokeDasharray={def.major ? undefined : '3 2'}
              opacity={0.25 + tightness * 0.6}
            />
          );
        })}
      </g>

      {/* 感受点 */}
      {angles && (
        <g>
          {([
            ['asc', 'ASC'],
            ['mc', 'MC'],
            ['dsc', 'DSC'],
            ['ic', 'IC'],
          ] as const).map(([id, label]) => {
            const angle = screenAngle(angles[id].lon);
            const outer = polar(angle, R_SIGN_OUT);
            const inner = polar(angle, R_ASPECT);
            return (
              <g key={id}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="var(--accent)"
                  strokeWidth={1}
                />
                <text
                  {...polar(angle, R_ANGLE_LABEL)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontWeight={600}
                  fill="var(--accent)"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* 天体 */}
      <g>
        {placements.map((p) => {
          const trueAngle = screenAngle(p.lon);
          const shown = displayed.get(p.id)!;
          const tick = polar(trueAngle, R_TICK);
          const foot = polar(shown, R_BODY - 9);
          const at = polar(shown, R_BODY);
          return (
            <g key={p.id}>
              {/* ずらした札から、ほんとうの位置へ引く */}
              <line
                x1={foot.x}
                y1={foot.y}
                x2={tick.x}
                y2={tick.y}
                stroke="var(--line-strong)"
                strokeWidth={0.5}
              />
              <text
                x={at.x}
                y={at.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={15}
                fill="var(--ink)"
              >
                {BODY_SYMBOL[p.id]}
              </text>
              {p.retrograde && (
                <text
                  x={at.x + 9}
                  y={at.y + 7}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8}
                  fill="var(--fire-fg)"
                >
                  R
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
