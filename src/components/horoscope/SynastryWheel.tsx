import { ASPECT_BY_KIND, BODY_SYMBOL, SIGN_SYMBOL } from '../../core/horoscope/constants';
import { norm360 } from '../../core/horoscope/math';
import type { Synastry } from '../../core/horoscope/synastry';
import { signClass, toneLine } from './style';
import { C, VIEW_BOX, polar, sectorPath, spread } from './wheel';

/**
 * 二人ぶんを重ねた円（二重円）。
 *
 * 内側が自分、外側が相手。ハウスは自分の図のものを使う（相手の天体が
 * 自分のどの部屋に入るかを見るための図なので）。中央の線は二人のあいだの角度。
 */

const R_SIGN_OUT = 196;
const R_SIGN_IN = 166;
/** 外側の輪＝相手の天体 */
const R_OUTER = 152;
const R_OUTER_TICK = 142;
const R_HOUSE_IN = 136;
const R_HOUSE_NUM = 127;
/** 内側の輪＝自分の天体 */
const R_INNER = 112;
const R_INNER_TICK = 120;
const R_ASPECT = 98;

const MIN_GAP = 8;

export default function SynastryWheel({ synastry }: { synastry: Synastry }) {
  const { self, other, aspects } = synastry;

  // 自分のアセンダントを左に置く。無ければ牡羊座 0 度
  const origin = self.angles ? self.angles.asc.lon : 0;
  const screenAngle = (lon: number) => 180 + norm360(lon - origin);

  const innerShown = spread(
    self.placements.map((p) => ({ id: p.id, angle: screenAngle(p.lon) })),
    MIN_GAP
  );
  const outerShown = spread(
    other.placements.map((p) => ({ id: p.id, angle: screenAngle(p.lon) })),
    MIN_GAP
  );

  const selfAngleOf = new Map<string, number>(
    self.placements.map((p) => [p.id as string, screenAngle(p.lon)])
  );
  if (self.angles) {
    selfAngleOf.set('asc', screenAngle(self.angles.asc.lon));
    selfAngleOf.set('mc', screenAngle(self.angles.mc.lon));
  }
  const otherAngleOf = new Map<string, number>(
    other.placements.map((p) => [p.id as string, screenAngle(p.lon)])
  );
  if (other.angles) {
    otherAngleOf.set('asc', screenAngle(other.angles.asc.lon));
    otherAngleOf.set('mc', screenAngle(other.angles.mc.lon));
  }

  return (
    <svg
      viewBox={VIEW_BOX}
      className="mx-auto block h-auto w-full"
      style={{ maxWidth: 460 }}
      role="img"
      aria-label="二人の出生図を重ねた円。内側が自分、外側が相手"
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

      <circle cx={C} cy={C} r={R_ASPECT} fill="none" stroke="var(--line)" strokeWidth={0.6} />
      <circle cx={C} cy={C} r={R_HOUSE_IN} fill="none" stroke="var(--line)" strokeWidth={0.6} />

      {/* ハウスは自分の図のもの */}
      {self.houses && (
        <g>
          {self.houses.cusps.map((cusp, i) => {
            const angle = screenAngle(cusp);
            const outer = polar(angle, R_SIGN_IN);
            const inner = polar(angle, R_ASPECT);
            const major = i % 3 === 0;
            const next = self.houses!.cusps[(i + 1) % 12];
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

      {/* 二人のあいだの角度 */}
      <g>
        {aspects.map((a, i) => {
          const from = selfAngleOf.get(a.a);
          const to = otherAngleOf.get(a.b);
          if (from == null || to == null) return null;
          const p1 = polar(from, R_ASPECT);
          const p2 = polar(to, R_ASPECT);
          const major = ASPECT_BY_KIND[a.kind].major;
          const tightness = 1 - Math.min(a.orb / 10, 1);
          return (
            <line
              key={`${a.a}-${a.b}-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={toneLine(a.tone)}
              strokeWidth={major ? 1 : 0.6}
              strokeDasharray={major ? undefined : '3 2'}
              opacity={0.25 + tightness * 0.6}
            />
          );
        })}
      </g>

      {/* 自分の感受点 */}
      {self.angles && (
        <g>
          {(['asc', 'mc'] as const).map((id) => {
            const angle = screenAngle(self.angles![id].lon);
            const outer = polar(angle, R_SIGN_OUT + 9);
            const inner = polar(angle, R_ASPECT);
            return (
              <g key={id}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={polar(angle, R_SIGN_OUT).x}
                  y2={polar(angle, R_SIGN_OUT).y}
                  stroke="var(--accent)"
                  strokeWidth={1}
                />
                <text
                  x={outer.x}
                  y={outer.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontWeight={600}
                  fill="var(--accent)"
                >
                  {id === 'asc' ? 'ASC' : 'MC'}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* 内側＝自分の天体 */}
      <g>
        {self.placements.map((p) => {
          const shown = innerShown.get(p.id)!;
          const tick = polar(screenAngle(p.lon), R_INNER_TICK);
          const foot = polar(shown, R_INNER + 9);
          const at = polar(shown, R_INNER);
          return (
            <g key={`self-${p.id}`}>
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
                fontSize={14}
                fill="var(--ink)"
              >
                {BODY_SYMBOL[p.id]}
              </text>
            </g>
          );
        })}
      </g>

      {/* 外側＝相手の天体 */}
      <g>
        {other.placements.map((p) => {
          const shown = outerShown.get(p.id)!;
          const tick = polar(screenAngle(p.lon), R_OUTER_TICK);
          const foot = polar(shown, R_OUTER - 9);
          const at = polar(shown, R_OUTER);
          return (
            <g key={`other-${p.id}`}>
              <line
                x1={foot.x}
                y1={foot.y}
                x2={tick.x}
                y2={tick.y}
                stroke="var(--accent)"
                strokeWidth={0.5}
                opacity={0.6}
              />
              <text
                x={at.x}
                y={at.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                fill="var(--accent)"
              >
                {BODY_SYMBOL[p.id]}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
