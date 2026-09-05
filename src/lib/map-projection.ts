import { siteConfig } from "@/lib/site-config";

/**
 * Web Mercator projection, matching what Google Static Maps renders.
 *
 * The delivery-area graphic layers hand-drawn pins over a real map image.
 * They only line up if both use the same projection, centre and zoom — so
 * the constants below are shared: the image URL is built from them, and
 * every pin position is computed from them. Change one and both move
 * together.
 */

/** Square viewport, in the SVG's own coordinate units and the image's px. */
export const MAP_SIZE = 520;

/**
 * Zoom 11 puts ~24km across the box at this latitude, which fits every
 * delivery town plus the 10km ring with room for labels.
 */
export const MAP_ZOOM = 11;

export const MAP_CENTER = siteConfig.coordinates;

/** Metres per pixel at a given latitude and zoom (Google's tile math). */
function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** World pixel coordinates at zoom 0, before scaling. */
function project(lat: number, lng: number): { x: number; y: number } {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: 128 * (1 + lng / 180),
    y:
      128 *
      (1 - Math.log((1 + sinLat) / (1 - sinLat)) / (2 * Math.PI)),
  };
}

/**
 * lat/lng -> position inside the MAP_SIZE box, origin top-left.
 * A point at the centre returns exactly (MAP_SIZE/2, MAP_SIZE/2).
 */
export function latLngToPoint(
  lat: number,
  lng: number
): { x: number; y: number } {
  const scale = 2 ** MAP_ZOOM;
  const centre = project(MAP_CENTER.lat, MAP_CENTER.lng);
  const point = project(lat, lng);

  return {
    x: (point.x - centre.x) * scale + MAP_SIZE / 2,
    y: (point.y - centre.y) * scale + MAP_SIZE / 2,
  };
}

/** Kilometres -> radius in box units, for the delivery-radius ring. */
export function kmToPixels(km: number): number {
  return (km * 1000) / metresPerPixel(MAP_CENTER.lat, MAP_ZOOM);
}

/**
 * The Google Static Maps image sitting behind the pins.
 *
 * Styled down to greys so the brand-coloured pins and ring stay the
 * loudest thing in the frame — an unstyled Google map fights the cream
 * palette badly. Returns null when there's no key, and the graphic falls
 * back to its illustrated background.
 */
export function staticMapUrl(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const styles = [
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
    "feature:administrative|element:labels|visibility:simplified",
    "feature:road|element:labels|visibility:off",
    "feature:road|element:geometry|color:0xe8dfc8",
    "feature:landscape|element:geometry|color:0xf4efe0",
    "feature:water|element:geometry|color:0xd8cfae",
  ];

  const params = new URLSearchParams({
    center: `${MAP_CENTER.lat},${MAP_CENTER.lng}`,
    zoom: String(MAP_ZOOM),
    size: `${MAP_SIZE}x${MAP_SIZE}`,
    // Retina — Google returns 2x pixels for the same coordinate space, so
    // the projection maths above is unaffected.
    scale: "2",
    maptype: "roadmap",
    key,
  });
  for (const style of styles) params.append("style", style);

  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}
