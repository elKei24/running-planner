/**
 * Minimal GPX / TCX track parsing for logging a run from a watch export.
 * Deliberately regex-based so it runs anywhere (no DOMParser) and stays tiny.
 */
export interface ParsedActivity {
  /** Local calendar date of the first track point, if the file has timestamps. */
  date?: string;
  distanceKm: number;
  durationSec?: number;
  points: number;
}

const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function localDate(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function finish(points: Array<{ lat: number; lon: number; time?: number }>, distanceOverride?: number): ParsedActivity {
  if (points.length === 0) throw new Error('No track points found.');
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    distanceKm += haversineKm(a.lat, a.lon, b.lat, b.lon);
  }
  if (distanceOverride !== undefined && distanceOverride > 0) distanceKm = distanceOverride;
  const times = points.map((p) => p.time).filter((t): t is number => t !== undefined);
  const result: ParsedActivity = { distanceKm: Math.round(distanceKm * 100) / 100, points: points.length };
  if (times.length >= 2) result.durationSec = Math.round((Math.max(...times) - Math.min(...times)) / 1000);
  const first = points.find((p) => p.time !== undefined);
  if (first?.time !== undefined) {
    const d = localDate(new Date(first.time).toISOString());
    if (d) result.date = d;
  }
  return result;
}

export function parseGpx(text: string): ParsedActivity {
  const points: Array<{ lat: number; lon: number; time?: number }> = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const attrs = m[1] ?? m[3] ?? '';
    const body = m[2] ?? '';
    const lat = Number(/\blat="([^"]+)"/.exec(attrs)?.[1]);
    const lon = Number(/\blon="([^"]+)"/.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const timeText = /<time>([^<]+)<\/time>/.exec(body)?.[1];
    const time = timeText ? Date.parse(timeText.trim()) : Number.NaN;
    points.push(Number.isNaN(time) ? { lat, lon } : { lat, lon, time });
  }
  return finish(points);
}

export function parseTcx(text: string): ParsedActivity {
  const points: Array<{ lat: number; lon: number; time?: number }> = [];
  const re = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/g;
  let m: RegExpExecArray | null;
  let lastDistanceM: number | undefined;
  let firstTime: number | undefined;
  let lastTime: number | undefined;
  while ((m = re.exec(text))) {
    const body = m[1] ?? '';
    const lat = Number(/<LatitudeDegrees>([^<]+)<\/LatitudeDegrees>/.exec(body)?.[1]);
    const lon = Number(/<LongitudeDegrees>([^<]+)<\/LongitudeDegrees>/.exec(body)?.[1]);
    const timeText = /<Time>([^<]+)<\/Time>/.exec(body)?.[1];
    const time = timeText ? Date.parse(timeText.trim()) : Number.NaN;
    const dist = Number(/<DistanceMeters>([^<]+)<\/DistanceMeters>/.exec(body)?.[1]);
    if (Number.isFinite(dist)) lastDistanceM = dist;
    if (!Number.isNaN(time)) {
      firstTime = firstTime ?? time;
      lastTime = time;
    }
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push(Number.isNaN(time) ? { lat, lon } : { lat, lon, time });
  }
  if (points.length === 0 && lastDistanceM !== undefined && firstTime !== undefined && lastTime !== undefined) {
    // Treadmill/indoor files: distance and time, no GPS.
    const result: ParsedActivity = { distanceKm: Math.round(lastDistanceM / 10) / 100, durationSec: Math.round((lastTime - firstTime) / 1000), points: 0 };
    const d = localDate(new Date(firstTime).toISOString());
    if (d) result.date = d;
    return result;
  }
  return finish(points, lastDistanceM !== undefined ? lastDistanceM / 1000 : undefined);
}

/** Detect the format from the file name or content and parse it. */
export function parseActivity(text: string, filename = ''): ParsedActivity {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tcx') || /<TrainingCenterDatabase/i.test(text)) return parseTcx(text);
  if (lower.endsWith('.gpx') || /<gpx\b/i.test(text)) return parseGpx(text);
  throw new Error('Unsupported file. Export your run as GPX or TCX.');
}
