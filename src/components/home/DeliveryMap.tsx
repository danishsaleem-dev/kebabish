"use client";

import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/site-config";
import {
  MAP_SIZE,
  kmToPixels,
  latLngToPoint,
  staticMapUrl,
} from "@/lib/map-projection";

/**
 * The delivery area: real map underneath, brand pins and radius ring on top.
 *
 * Pin positions are projected from each town's real coordinates using the
 * same centre/zoom as the map image (see lib/map-projection.ts), so they
 * sit on the actual towns rather than being art-directed into place.
 *
 * A client component only so a failed map image can fall back to the
 * illustrated background — a broken Google request otherwise renders as a
 * grey error tile, which looks worse than no map at all.
 */

const CENTRE = MAP_SIZE / 2;

// Tip sits at the group's local (0,0); the rounded head extends upward.
const PIN_PATH = "M0,0 C0,0 -9,-13 -9,-20 a9,9 0 1,1 18,0 C9,-13 0,0 0,0 Z";

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

type Placed = {
  dx: number;
  dy: number;
  anchor: "start" | "end";
  box: { x0: number; x1: number; y: number };
};

/** ~11.5px semibold — close enough to fit- and collision-test against. */
const labelWidth = (name: string) => name.length * 6.2;

/**
 * Lay out the town labels.
 *
 * Pins are fixed by real coordinates, so labels are the only thing free to
 * move — and they have to, because geography clusters them: Lutjebroek,
 * Grootebroek and Bovenkarspel sit along the same road at nearly identical
 * latitude, and their labels land on top of each other.
 *
 * Each label prefers the outward side (away from the centre cluster) and
 * above its pin, then falls back through the remaining corners until one
 * neither leaves the canvas nor collides with a label already placed.
 * Towns come in nearest-first order, so the closest — the ones a customer
 * most likely cares about — get first pick.
 */
function placeLabels(towns: { name: string; x: number; y: number }[]) {
  const placed: Placed[] = [];

  return towns.map((town) => {
    const width = labelWidth(town.name);
    const outwardRight = town.x >= CENTRE;

    const candidates = [
      { right: outwardRight, dy: -17 },
      { right: outwardRight, dy: 24 },
      { right: !outwardRight, dy: -17 },
      { right: !outwardRight, dy: 24 },
    ];

    const options = candidates.map(({ right, dy }) => {
      const dx = right ? 13 : -13;
      const x0 = right ? town.x + dx : town.x + dx - width;
      return {
        dx,
        dy,
        anchor: (right ? "start" : "end") as "start" | "end",
        box: { x0, x1: x0 + width, y: town.y + dy },
      };
    });

    const fits = (o: Placed) => o.box.x0 >= 4 && o.box.x1 <= MAP_SIZE - 4;
    const clear = (o: Placed) =>
      !placed.some(
        (p) =>
          Math.abs(p.box.y - o.box.y) < 12 &&
          p.box.x0 < o.box.x1 &&
          o.box.x0 < p.box.x1
      );

    const chosen =
      options.find((o) => fits(o) && clear(o)) ??
      options.find(fits) ??
      options[0];

    placed.push(chosen);
    return chosen;
  });
}

export default function DeliveryMap() {
  const [mapFailed, setMapFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const mapUrl = staticMapUrl();
  const showMap = Boolean(mapUrl) && !mapFailed;

  // The image is server-rendered, so a failed request (bad key, quota,
  // offline) can error before React hydrates and attaches onError — the
  // event is simply missed. A finished-but-zero-width image is the
  // reliable tell after mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setMapFailed(true);
  }, []);

  const kitchen = latLngToPoint(
    siteConfig.coordinates.lat,
    siteConfig.coordinates.lng
  );
  const radius = kmToPixels(siteConfig.deliveryRadiusKm);

  const towns = siteConfig.deliveryAreaTowns
    .filter((t) => t.name !== siteConfig.address.city)
    .map((town) => ({ ...town, ...latLngToPoint(town.lat, town.lng) }));

  const labels = placeLabels(towns);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-cream-300">
      {showMap && (
        <img
          ref={imgRef}
          src={mapUrl!}
          alt=""
          aria-hidden="true"
          onError={() => setMapFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Warms the greyed map into the cream palette and keeps the pins
          legible over busy areas. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cream-200/45 mix-blend-multiply"
      />

      <svg
        viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
        role="img"
        aria-label={`Bezorggebied van ${siteConfig.brandName} rond ${siteConfig.address.city}`}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a95026" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#a95026" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Fallback ground when there's no map image. */}
        {!showMap && (
          <>
            <rect width={MAP_SIZE} height={MAP_SIZE} fill="#f4efe0" />
            <g stroke="#3d3831" strokeOpacity="0.06" strokeWidth="1.5">
              {[1, 2, 3, 4].map((i) => (
                <line
                  key={`h${i}`}
                  x1={0}
                  y1={(MAP_SIZE / 5) * i}
                  x2={MAP_SIZE}
                  y2={(MAP_SIZE / 5) * i}
                />
              ))}
              {[1, 2, 3, 4].map((i) => (
                <line
                  key={`v${i}`}
                  x1={(MAP_SIZE / 5) * i}
                  y1={0}
                  x2={(MAP_SIZE / 5) * i}
                  y2={MAP_SIZE}
                />
              ))}
            </g>
          </>
        )}

        <circle cx={kitchen.x} cy={kitchen.y} r={radius} fill="url(#map-glow)" />

        {/* The real 10km radius, plus two inner rings for depth. */}
        {[radius * 0.4, radius * 0.7, radius].map((r, i) => (
          <circle
            key={r}
            cx={kitchen.x}
            cy={kitchen.y}
            r={r}
            fill="none"
            stroke="#a95026"
            strokeOpacity={i === 2 ? 0.5 : 0.25}
            strokeWidth={i === 2 ? 1.75 : 1.25}
            strokeDasharray={i === 2 ? "5 6" : undefined}
          />
        ))}

        {[0, 1.2, 2.4].map((delay) => (
          <circle
            key={delay}
            className="radar-ring"
            cx={kitchen.x}
            cy={kitchen.y}
            r={radius * 0.35}
            fill="none"
            stroke="#a95026"
            strokeWidth="1.5"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}

        {/* Sits on the ring itself, bottom-left, where no town falls. */}
        <text
          x={kitchen.x - radius * 0.72}
          y={kitchen.y + radius * 0.76}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          letterSpacing="1.5"
          fill="#a95026"
          fillOpacity="0.85"
        >
          {siteConfig.deliveryRadiusKm} KM
        </text>

        <g data-reveal-group>
          <g data-reveal>
            <Pin
              x={kitchen.x}
              y={kitchen.y}
              scale={1.5}
              fill="#a95026"
              holeFill="#f4efe0"
            />
            <text
              x={kitchen.x}
              y={kitchen.y + 24}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#3d3831"
              stroke="#f4efe0"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {siteConfig.address.city}
            </text>
          </g>

          {towns.map((town, i) => {
            const label = labels[i];
            return (
              <g key={town.name} data-reveal>
                <Pin
                  x={town.x}
                  y={town.y}
                  scale={0.85}
                  fill="#3d3831"
                  holeFill="#f4efe0"
                />
                {/* Cream halo behind the text so town names stay readable
                    wherever they land on the map. */}
                <text
                  x={town.x + label.dx}
                  y={town.y + label.dy}
                  textAnchor={label.anchor}
                  fontSize="11.5"
                  fontWeight="600"
                  fill="#3d3831"
                  stroke="#f4efe0"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {town.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
