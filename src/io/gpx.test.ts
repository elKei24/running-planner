import { describe, expect, it } from 'vitest';
import { haversineKm, parseActivity, parseGpx, parseTcx } from './gpx';

// Roughly 1 km north along a meridian, one point every 100 m, 30 s apart.
function gpx(points: number, withTime = true): string {
  const pts = Array.from({ length: points }, (_, i) => {
    const lat = (48 + (i * 0.1) / 111.195).toFixed(6);
    const time = withTime ? `<time>${new Date(Date.UTC(2026, 10, 6, 7, 0, i * 30)).toISOString()}</time>` : '';
    return `<trkpt lat="${lat}" lon="11.5"><ele>500</ele>${time}</trkpt>`;
  }).join('\n');
  return `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>Run</name><trkseg>${pts}</trkseg></trk></gpx>`;
}

describe('gpx', () => {
  it('computes haversine distances', () => {
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
    expect(haversineKm(48, 11.5, 48, 11.5)).toBe(0);
  });

  it('parses track points into distance, duration and date', () => {
    const a = parseGpx(gpx(11));
    expect(a.points).toBe(11);
    expect(a.distanceKm).toBeCloseTo(1.0, 1);
    expect(a.durationSec).toBe(300);
    expect(a.date).toBe('2026-11-06');
  });

  it('copes with files without timestamps and self-closing points', () => {
    const a = parseGpx(gpx(5, false));
    expect(a.durationSec).toBeUndefined();
    expect(a.date).toBeUndefined();
    const b = parseGpx('<gpx><trk><trkseg><trkpt lat="48" lon="11"/><trkpt lat="48.001" lon="11"/></trkseg></trk></gpx>');
    expect(b.points).toBe(2);
    expect(b.distanceKm).toBeCloseTo(0.11, 2);
  });

  it('rejects files with no points', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/No track points/);
  });
});

describe('tcx', () => {
  const tcx = (withGps: boolean) => `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap><Track>
    <Trackpoint><Time>2026-11-06T07:00:00Z</Time>${withGps ? '<Position><LatitudeDegrees>48</LatitudeDegrees><LongitudeDegrees>11.5</LongitudeDegrees></Position>' : ''}<DistanceMeters>0</DistanceMeters></Trackpoint>
    <Trackpoint><Time>2026-11-06T07:10:00Z</Time>${withGps ? '<Position><LatitudeDegrees>48.009</LatitudeDegrees><LongitudeDegrees>11.5</LongitudeDegrees></Position>' : ''}<DistanceMeters>2000</DistanceMeters></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

  it('prefers the device distance over GPS distance', () => {
    const a = parseTcx(tcx(true));
    expect(a.distanceKm).toBe(2);
    expect(a.durationSec).toBe(600);
    expect(a.date).toBe('2026-11-06');
    expect(a.points).toBe(2);
  });

  it('handles indoor files without GPS', () => {
    const a = parseTcx(tcx(false));
    expect(a).toEqual({ distanceKm: 2, durationSec: 600, points: 0, date: '2026-11-06' });
  });
});

describe('parseActivity', () => {
  it('detects the format from the extension or content', () => {
    expect(parseActivity(gpx(3), 'morning.GPX').points).toBe(3);
    expect(parseActivity(gpx(3)).points).toBe(3);
    expect(() => parseActivity('<fit/>', 'x.fit')).toThrow(/Unsupported/);
  });
});
