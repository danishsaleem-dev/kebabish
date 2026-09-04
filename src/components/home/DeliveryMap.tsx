import { siteConfig } from "@/lib/site-config";

/**
 * A stylized illustration of the delivery area — deliberately NOT a real
 * map render (no tiles, no external map provider). Pin positions below are
 * hand-placed for a pleasant, roughly-directionally-correct composition,
 * not surveyed coordinates; see CLAUDE.md if real geocoding ever replaces
 * this. Kept as one SVG so it can be fully themed and animated.
 */
const VIEWBOX = 520;
const CENTER = VIEWBOX / 2;

const TOWN_POSITIONS: Record<string, { x: number; y: number; side: "top" | "bottom" | "left" | "right" }> = {
  Bovenkarspel: { x: 300, y: 288, side: "right" },
  Grootebroek: { x: 328, y: 316, side: "right" },
  Lutjebroek: { x: 306, y: 352, side: "right" },
  Westwoud: { x: 200, y: 292, side: "left" },
  "Zwaagdijk-Oost": { x: 368, y: 252, side: "right" },
  "Zwaagdijk-West": { x: 336, y: 228, side: "top" },
  Wognum: { x: 262, y: 388, side: "bottom" },
  Nibbixwoud: { x: 165, y: 322, side: "left" },
  Midwoud: { x: 146, y: 262, side: "left" },
  Oosterblokker: { x: 280, y: 360, side: "bottom" },
  Wervershoof: { x: 352, y: 168, side: "right" },
  Enkhuizen: { x: 412, y: 116, side: "right" },
  Hoorn: { x: 258, y: 452, side: "bottom" },
};

// Tip sits at the group's local (0,0); the rounded head extends upward.
const PIN_PATH = "M0,0 C0,0 -9,-13 -9,-20 a9,9 0 1,1 18,0 C9,-13 0,0 0,0 Z";

const LABEL_OFFSET: Record<string, { dx: number; dy: number; anchor: "start" | "end" | "middle" }> = {
  right: { dx: 13, dy: -17, anchor: "start" },
  left: { dx: -13, dy: -17, anchor: "end" },
  top: { dx: 0, dy: -33, anchor: "middle" },
  bottom: { dx: 0, dy: 15, anchor: "middle" },
};

function Pin({
  x,
  y,
  scale = 1,
  fill,
  holeFill,
}: {
  x: number;
  y: number;
  scale?: number;
  fill: string;
  holeFill: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={PIN_PATH} fill={fill} />
      <circle cx={0} cy={-20} r={3.4} fill={holeFill} />
    </g>
  );
}

export default function DeliveryMap() {
  const towns = siteConfig.deliveryAreaTowns.filter(
    (town) => town !== siteConfig.address.city
  );

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      role="img"
      aria-label={`Bezorggebied van ${siteConfig.brandName} rond ${siteConfig.address.city}`}
      className="h-auto w-full"
    >
      <defs>
        <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a95026" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#a95026" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* canvas */}
      <rect width={VIEWBOX} height={VIEWBOX} rx="28" fill="#f4efe0" />
      <circle cx={CENTER} cy={CENTER} r={230} fill="url(#map-glow)" />

      {/* faint road-like grid — decorative, not literal streets */}
      <g stroke="#3d3831" strokeOpacity="0.06" strokeWidth="1.5">
        {[1, 2, 3, 4].map((i) => (
          <line key={`h${i}`} x1={0} y1={(VIEWBOX / 5) * i} x2={VIEWBOX} y2={(VIEWBOX / 5) * i} />
        ))}
        {[1, 2, 3, 4].map((i) => (
          <line key={`v${i}`} x1={(VIEWBOX / 5) * i} y1={0} x2={(VIEWBOX / 5) * i} y2={VIEWBOX} />
        ))}
      </g>

      {/* static radius rings */}
      {[80, 140, 200].map((r) => (
        <circle
          key={r}
          cx={CENTER}
          cy={CENTER}
          r={r}
          fill="none"
          stroke="#a95026"
          strokeOpacity="0.22"
          strokeWidth="1.25"
          strokeDasharray={r === 200 ? "3 6" : undefined}
        />
      ))}

      {/* ambient radar ping, staggered */}
      {[0, 1.2, 2.4].map((delay) => (
        <circle
          key={delay}
          className="radar-ring"
          cx={CENTER}
          cy={CENTER}
          r={70}
          fill="none"
          stroke="#a95026"
          strokeWidth="1.5"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}

      {/* Placed in the sparse bottom-left quadrant so it never crowds a
          pin label — the cluster of towns sits bottom-center/bottom-right. */}
      <text
        x={CENTER - 150}
        y={CENTER + 148}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        letterSpacing="1.5"
        fill="#a95026"
        fillOpacity="0.75"
      >
        {siteConfig.deliveryRadiusKm} KM
      </text>

      {/* pins — kitchen first so it leads the reveal stagger */}
      <g data-reveal-group>
        <g data-reveal>
          <Pin x={CENTER} y={CENTER} scale={1.5} fill="#a95026" holeFill="#f4efe0" />
          <text
            x={CENTER}
            y={CENTER + 24}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#3d3831"
          >
            {siteConfig.address.city}
          </text>
        </g>

        {towns.map((town) => {
          const pos = TOWN_POSITIONS[town];
          if (!pos) return null;
          const label = LABEL_OFFSET[pos.side];

          return (
            <g key={town} data-reveal>
              <Pin x={pos.x} y={pos.y} scale={0.85} fill="#3d3831" holeFill="#f4efe0" />
              <text
                x={pos.x + label.dx}
                y={pos.y + label.dy}
                textAnchor={label.anchor}
                fontSize="11.5"
                fontWeight="600"
                fill="#3d3831"
                fillOpacity="0.8"
              >
                {town}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
