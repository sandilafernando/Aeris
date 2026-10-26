const DAY_MS = 86_400_000;
const FRAME_STEP_MS = 10 * 60_000;

export const GIBS_WMS_ENDPOINT =
  "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
export const GIBS_WMTS_ENDPOINT =
  "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0";

/**
 * NASA GIBS advertises a frame before it has finished ingesting it. A frame
 * that is still blank comes back as a valid HTTP 200 PNG of only a few
 * kilobytes, so the client probes the decoded byte length instead of trusting
 * the status code.
 */
export const MIN_PLAUSIBLE_IMAGE_BYTES = 5_000;

export const SATELLITE_BBOX = Object.freeze({
  west: 76.5,
  south: 3.5,
  east: 85.5,
  north: 11.5,
});

function utcDateString(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * GIBS exposes one XML document per layer and UTC day range. Asking for
 * yesterday through tomorrow keeps the request valid across midnight.
 */
export function availabilityXmlUrl(layer, now = new Date()) {
  const time = now instanceof Date ? now.getTime() : Number(now);
  const base = Number.isFinite(time) ? time : Date.now();
  const range = `${utcDateString(new Date(base - DAY_MS))}--${utcDateString(
    new Date(base + DAY_MS),
  )}`;
  return `${GIBS_WMTS_ENDPOINT}/${layer}/default/2km/all/${range}.xml`;
}

/**
 * The availability document lists 10-minute ranges, for example
 * `2026-10-26T02:50:00Z/2026-10-26T12:30:00Z/PT10M`. The last timestamp is
 * the newest advertised frame. It can still be blank for a short period.
 */
export function parseLatestFrameTime(xml) {
  if (typeof xml !== "string" || xml.length === 0) return null;
  const matches = xml.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g);
  if (!matches?.length) return null;
  const latest = Date.parse(matches[matches.length - 1]);
  return Number.isFinite(latest)
    ? new Date(latest).toISOString().replace(/\.\d{3}Z$/, "Z")
    : null;
}

/**
 * Newest first, starting one step before the advertised frame because the
 * newest frame is the one most likely to be partially ingested. The caller
 * walks this list until an image passes the size probe.
 */
export function frameCandidates(latestIso, count = 3) {
  const latest = Date.parse(latestIso);
  if (!Number.isFinite(latest)) return [];
  return Array.from({ length: count }, (_, index) =>
    new Date(latest - (index + 1) * FRAME_STEP_MS)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
  );
}

export function buildImageUrl(
  layer,
  { time = null, width = 900, height = 800 } = {},
) {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layer,
    STYLES: "",
    FORMAT: "image/png",
    TRANSPARENT: "FALSE",
    SRS: "EPSG:4326",
    BBOX: `${SATELLITE_BBOX.west},${SATELLITE_BBOX.south},${SATELLITE_BBOX.east},${SATELLITE_BBOX.north}`,
    WIDTH: String(width),
    HEIGHT: String(height),
  });
  if (time) params.set("TIME", String(time).replace(/\.\d{3}Z$/, "Z"));
  return `${GIBS_WMS_ENDPOINT}?${params.toString()}`;
}

export function isPlausibleImageSize(bytes) {
  return Number.isFinite(bytes) && bytes >= MIN_PLAUSIBLE_IMAGE_BYTES;
}

export function markerPosition(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (
    latitude < SATELLITE_BBOX.south ||
    latitude > SATELLITE_BBOX.north ||
    longitude < SATELLITE_BBOX.west ||
    longitude > SATELLITE_BBOX.east
  ) {
    return null;
  }
  const left =
    ((longitude - SATELLITE_BBOX.west) / (SATELLITE_BBOX.east - SATELLITE_BBOX.west)) * 100;
  const top =
    ((SATELLITE_BBOX.north - latitude) / (SATELLITE_BBOX.north - SATELLITE_BBOX.south)) * 100;
  return {
    left: `${Math.min(97, Math.max(3, left))}%`,
    top: `${Math.min(97, Math.max(3, top))}%`,
  };
}
