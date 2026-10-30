'use client';

import { cn } from '@/lib/utils';

// 虚构城市的示意地图：等距圆柱投影，坐标由经纬度换算，不依赖外网瓦片
export const MAP_BOUNDS = { minLng: 120.132, maxLng: 120.208, minLat: 30.252, maxLat: 30.304 };
const W = 1000;
const H = 680;

export function project(lng: number, lat: number): { x: number; y: number } {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * W;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * H;
  return { x, y };
}

export function unproject(x: number, y: number): { lng: number; lat: number } {
  const lng = MAP_BOUNDS.minLng + (x / W) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  const lat = MAP_BOUNDS.maxLat - (y / H) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  return { lng, lat };
}

export interface MapPoint {
  lng: number;
  lat: number;
  weight?: number;
  color?: string;
  label?: string;
  severity?: 'low' | 'medium' | 'urgent';
}

const GRID_CELLS = [
  { code: 'YX-01', lng: 120.148, lat: 30.272, label: '青梧' },
  { code: 'YX-02', lng: 120.164, lat: 30.281, label: '云溪' },
  { code: 'YX-03', lng: 120.172, lat: 30.266, label: '南湖' },
  { code: 'QW-04', lng: 120.186, lat: 30.279, label: '望江' },
  { code: 'QW-05', lng: 120.196, lat: 30.268, label: '白鹭' },
  { code: 'QW-06', lng: 120.181, lat: 30.292, label: '东屿' }
];

export function CityMap({
  points = [],
  dark = false,
  className,
  activePoint,
  onPick,
  showGrid = true,
  showLabels = true
}: {
  points?: MapPoint[];
  dark?: boolean;
  className?: string;
  activePoint?: { lng: number; lat: number };
  onPick?: (lng: number, lat: number) => void;
  showGrid?: boolean;
  showLabels?: boolean;
}) {
  const stroke = dark ? 'rgba(54,229,255,.28)' : 'rgba(76,93,240,.22)';
  const road = dark ? 'rgba(54,229,255,.18)' : 'rgba(16,24,40,.12)';
  const land = dark ? 'rgba(10,20,36,.55)' : 'rgba(255,255,255,.85)';
  const landAlt = dark ? 'rgba(12,26,46,.45)' : 'rgba(241,244,249,.8)';

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', dark ? 'bg-[#050b16]' : 'bg-[#EEF1FF]', className)}>
      {dark ? <div className="absolute inset-0 screen-grid opacity-70" /> : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="relative z-10 h-full w-full"
        onClick={(e) => {
          if (!onPick) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const y = ((e.clientY - rect.top) / rect.height) * H;
          const { lng, lat } = unproject(x, y);
          onPick(Number(lng.toFixed(6)), Number(lat.toFixed(6)));
        }}
        style={{ cursor: onPick ? 'crosshair' : 'default' }}
      >
        <defs>
          <linearGradient id="map-land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={dark ? '#0c1930' : '#FBFCFF'} />
            <stop offset="1" stopColor={dark ? '#081120' : '#F1F4FB'} />
          </linearGradient>
          <linearGradient id="map-river" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={dark ? '#1F5C8C' : '#B9D3F2'} />
            <stop offset="1" stopColor={dark ? '#123A5C' : '#D8E7FB'} />
          </linearGradient>
          <radialGradient id="map-glow">
            <stop offset="0" stopColor={dark ? 'rgba(54,229,255,.22)' : 'rgba(76,93,240,.14)'} />
            <stop offset="1" stopColor="transparent" />
          </radialGradient>
          <filter id="map-shadow">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor={dark ? '#36E5FF' : '#4C5DF0'} floodOpacity={dark ? '0.18' : '0.1'} />
          </filter>
        </defs>

        <ellipse cx={W * 0.52} cy={H * 0.48} rx={W * 0.48} ry={H * 0.5} fill="url(#map-glow)" />

        {/* 云溪区 */}
        <path
          d="M 38 118 L 436 54 L 498 214 L 442 404 L 308 616 L 74 588 L 26 356 Z"
          fill="url(#map-land)"
          stroke={stroke}
          strokeWidth="1.6"
          filter="url(#map-shadow)"
        />
        {/* 青梧区 */}
        <path
          d="M 436 54 L 936 96 L 968 560 L 796 646 L 528 606 L 442 404 L 498 214 Z"
          fill={landAlt}
          stroke={stroke}
          strokeWidth="1.6"
        />

        {/* 河流 */}
        <path
          d="M 702 -10 C 690 120 616 214 586 318 C 556 430 512 520 462 690"
          fill="none"
          stroke="url(#map-river)"
          strokeWidth="22"
          opacity=".85"
        />
        <path
          d="M 702 -10 C 690 120 616 214 586 318 C 556 430 512 520 462 690"
          fill="none"
          stroke={dark ? '#36E5FF' : '#7FB1E8'}
          strokeWidth="1.2"
          opacity=".4"
        />

        {/* 道路 */}
        <g stroke={road} strokeWidth="2.4" fill="none">
          <path d="M 60 300 C 220 280 340 300 470 268 S 760 214 952 236" />
          <path d="M 120 500 C 300 470 420 500 590 452 S 850 380 950 400" />
          <path d="M 300 70 C 320 220 300 380 330 600" />
          <path d="M 560 70 C 540 220 580 360 620 600" />
          <path d="M 720 120 C 700 280 760 400 780 610" />
        </g>

        {/* 网格边界 */}
        {showGrid
          ? GRID_CELLS.map((g) => {
              const p = project(g.lng, g.lat);
              return (
                <g key={g.code}>
                  <rect
                    x={p.x - 58}
                    y={p.y - 44}
                    width="116"
                    height="88"
                    rx="14"
                    fill="none"
                    stroke={dark ? 'rgba(54,229,255,.16)' : 'rgba(76,93,240,.14)'}
                    strokeDasharray="5 6"
                  />
                  {showLabels ? (
                    <text
                      x={p.x}
                      y={p.y + 2}
                      textAnchor="middle"
                      fontSize="11"
                      fill={dark ? 'rgba(140,255,193,.5)' : 'rgba(47,59,173,.45)'}
                      fontFamily="ui-monospace, monospace"
                    >
                      {g.code}
                    </text>
                  ) : null}
                </g>
              );
            })
          : null}

        {showLabels ? (
          <g fontSize="13" fill={dark ? 'rgba(160,190,230,.55)' : 'rgba(52,64,84,.5)'}>
            <text x="150" y="560">
              云溪区
            </text>
            <text x="720" y="150">
              青梧区
            </text>
            <text x="640" y="500" fontSize="10" fill={dark ? 'rgba(54,229,255,.45)' : 'rgba(46,144,250,.5)'}>
              云溪河
            </text>
          </g>
        ) : null}

        {/* 数据点 */}
        {points.map((pt, i) => {
          const p = project(pt.lng, pt.lat);
          const color = pt.color ?? (pt.severity === 'urgent' ? '#F04438' : pt.severity === 'medium' ? '#F59300' : '#667085');
          const r = 4 + (pt.weight ?? 1) * 2.4;
          return (
            <g key={`${pt.lng}-${pt.lat}-${i}`}>
              <circle cx={p.x} cy={p.y} r={r * 2.6} fill={color} opacity={dark ? 0.1 : 0.08} />
              <circle cx={p.x} cy={p.y} r={r * 1.7} fill="none" stroke={color} strokeWidth="1" opacity=".4">
                <animate attributeName="r" values={`${r} ; ${r * 2.6}`} dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values=".55;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx={p.x} cy={p.y} r={r} fill={color} opacity={dark ? 0.9 : 0.85} />
              <circle cx={p.x} cy={p.y} r={r * 0.35} fill={dark ? '#04070F' : '#fff'} opacity=".7" />
            </g>
          );
        })}

        {/* 选中点 */}
        {activePoint
          ? (() => {
              const p = project(activePoint.lng, activePoint.lat);
              return (
                <g>
                  <circle cx={p.x} cy={p.y} r="20" fill={dark ? 'rgba(54,229,255,.12)' : 'rgba(76,93,240,.12)'} />
                  <circle cx={p.x} cy={p.y} r="10" fill="none" stroke={dark ? '#36E5FF' : '#4C5DF0'} strokeWidth="2" />
                  <path
                    d={`M ${p.x} ${p.y - 24} l -7 -10 h 14 Z`}
                    fill={dark ? '#36E5FF' : '#4C5DF0'}
                  />
                  <circle cx={p.x} cy={p.y} r="3.5" fill={dark ? '#36E5FF' : '#4C5DF0'} />
                </g>
              );
            })()
          : null}

        {/* 比例尺 */}
        <g transform="translate(52 640)">
          <line x1="0" y1="0" x2="86" y2="0" stroke={dark ? 'rgba(160,190,230,.6)' : 'rgba(52,64,84,.4)'} strokeWidth="1.4" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={dark ? 'rgba(160,190,230,.6)' : 'rgba(52,64,84,.4)'} />
          <line x1="86" y1="-3" x2="86" y2="3" stroke={dark ? 'rgba(160,190,230,.6)' : 'rgba(52,64,84,.4)'} />
          <text x="94" y="4" fontSize="10" fill={dark ? 'rgba(160,190,230,.6)' : 'rgba(52,64,84,.45)'}>
            2km
          </text>
        </g>
      </svg>
    </div>
  );
}
