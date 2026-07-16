import { useId } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { MouseHandlerDataParam } from 'recharts';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface Props {
  profile: [number, number][];
  track: [number, number][];
  onPointHover?: (point: [number, number] | null) => void;
}

interface ChartPoint {
  distance: number;
  elevation: number;
  ascent_m: number;
  descent_m: number;
  isPeak: boolean;
}

export function computeElevationYDomain(profile: [number, number][]): {
  yMin: number;
  yMax: number;
} {
  const elevations = profile.map(([, elevation]) => elevation);
  const minHeight = Math.min(...elevations);
  const maxHeight = Math.max(...elevations);
  const range = maxHeight - minHeight;

  if (range === 0) {
    return { yMin: minHeight - 50, yMax: maxHeight + 50 };
  }

  const padding = range * 0.1;
  return {
    yMin: minHeight - padding,
    yMax: maxHeight + padding,
  };
}

function enrichProfileData(profile: [number, number][]): ChartPoint[] {
  const maxElevation = Math.max(...profile.map(([, elevation]) => elevation));
  let ascent = 0;
  let descent = 0;

  return profile.map(([distance, elevation], i) => {
    if (i > 0) {
      const delta = elevation - profile[i - 1][1];
      if (delta > 0) ascent += delta;
      else if (delta < 0) descent += -delta;
    }
    return {
      distance,
      elevation,
      ascent_m: Math.round(ascent),
      descent_m: Math.round(descent),
      isPeak: elevation === maxElevation,
    };
  });
}

function ElevationTooltip({
  active,
  payload,
  label,
  contentStyle,
  labelStyle,
  itemStyle,
}: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload as ChartPoint;

  return (
    <div className="recharts-default-tooltip" style={contentStyle}>
      <p className="recharts-tooltip-label" style={labelStyle}>
        {`Dystans: ${label} km`}
      </p>
      <ul className="recharts-tooltip-item-list">
        <li className="recharts-tooltip-item" style={itemStyle}>
          <span className="recharts-tooltip-item-name">Wysokość</span>
          <span className="recharts-tooltip-item-separator"> : </span>
          <span className="recharts-tooltip-item-value">
            {Math.round(point.elevation)} m n.p.m.
          </span>
        </li>
        <li className="recharts-tooltip-item elevation-tooltip-gain-loss" style={itemStyle}>
          <span className="elevation-tooltip-gain">
            <ArrowUp size={13} strokeWidth={2.5} />
            Wejścia : {point.ascent_m}m
          </span>
          <span className="elevation-tooltip-loss">
            <ArrowDown size={13} strokeWidth={2.5} />
            Zejścia: {point.descent_m}m
          </span>
        </li>
      </ul>
    </div>
  );
}

export default function ElevationChart({ profile, track, onPointHover }: Props) {
  const fillGradientId = `elevation-fill-${useId().replace(/:/g, '')}`;

  if (profile.length < 2) return null;

  const data = enrichProfileData(profile);
  const { yMin, yMax } = computeElevationYDomain(profile);
  const peaks = data.filter((point) => point.isPeak);

  function resolveTrackIndex(state: MouseHandlerDataParam | null): number | null {
    const raw = state?.activeTooltipIndex;
    if (raw == null) return null;
    if (typeof raw === 'number') return raw;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function handleMouseMove(state: MouseHandlerDataParam) {
    if (!onPointHover) return;
    const idx = resolveTrackIndex(state);
    if (idx != null && track[idx]) {
      onPointHover(track[idx]);
    }
  }

  function handleMouseLeave() {
    onPointHover?.(null);
  }

  return (
    <div className="elevation-chart">
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 16, left: 4, bottom: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a6741" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#4a6741" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="distance"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => `${v} km`}
            stroke="var(--text-muted)"
            fontSize={12}
          />
          <YAxis
            dataKey="elevation"
            domain={[yMin, yMax]}
            tickFormatter={(v) => `${Math.round(v)} m`}
            stroke="var(--text-muted)"
            fontSize={12}
            width={48}
          />
          <Tooltip
            content={(props) => <ElevationTooltip {...props} />}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow)',
              padding: '0.7rem 0.95rem',
            }}
            labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--green)' }}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            baseValue={yMin}
            stroke="none"
            fill={`url(#${fillGradientId})`}
            fillOpacity={1}
            isAnimationActive={false}
            activeDot={false}
            dot={false}
            legendType="none"
            tooltipType="none"
          />
          <Line
            type="monotone"
            dataKey="elevation"
            stroke="var(--green)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent)' }}
          />
          {peaks.map((peak, i) => (
            <ReferenceDot
              key={`${peak.distance}-${i}`}
              x={peak.distance}
              y={peak.elevation}
              r={5}
              className="elevation-peak-dot"
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
