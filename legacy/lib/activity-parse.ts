/**
 * Server-side watch-file parsing (roadmap branch 4).
 * FIT via the official @garmin/fitsdk (Decoder/Stream → session messages),
 * GPX via fast-xml-parser (trackpoints → haversine distance + timestamps).
 */
import { Decoder, Stream } from "@garmin/fitsdk";
import { XMLParser } from "fast-xml-parser";

export type ActivitySummary = {
  /** YYYY-MM-DD (UTC date of the activity start). */
  date: string;
  distance_km: number;
  duration_min: number;
  avg_pace_min_km: number | null;
  avg_hr: number | null;
  source: "fit" | "gpx";
};

function toSummary(
  startTime: Date | null,
  distanceMeters: number,
  durationSeconds: number,
  avgHr: number | null,
  source: "fit" | "gpx",
): ActivitySummary | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 200) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 60) return null;
  const distanceKm = distanceMeters / 1000;
  const durationMin = durationSeconds / 60;
  return {
    date: (startTime ?? new Date()).toISOString().slice(0, 10),
    distance_km: Math.round(distanceKm * 100) / 100,
    duration_min: Math.round(durationMin * 10) / 10,
    avg_pace_min_km: Math.round((durationMin / distanceKm) * 100) / 100,
    avg_hr: avgHr !== null && Number.isFinite(avgHr) ? Math.round(avgHr) : null,
    source,
  };
}

export function parseFit(buffer: Buffer): ActivitySummary | null {
  try {
    const stream = Stream.fromBuffer(buffer);
    const decoder = new Decoder(stream);
    if (!decoder.isFIT() || !decoder.checkIntegrity()) return null;
    const { messages } = decoder.read();
    const session = messages.sessionMesgs?.[0];
    if (!session) return null;
    return toSummary(
      session.startTime instanceof Date ? session.startTime : null,
      Number(session.totalDistance ?? 0),
      Number(session.totalTimerTime ?? session.totalElapsedTime ?? 0),
      session.avgHeartRate != null ? Number(session.avgHeartRate) : null,
      "fit",
    );
  } catch (error) {
    console.error("FIT parse failed:", error);
    return null;
  }
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type GpxPoint = {
  "@_lat": string;
  "@_lon": string;
  time?: string;
  extensions?: Record<string, unknown>;
};

function pointHr(point: GpxPoint): number | null {
  // Garmin TrackPointExtension namespaces vary: gpxtpx:hr / ns3:hr / hr
  const ext = point.extensions as Record<string, unknown> | undefined;
  if (!ext) return null;
  for (const wrapper of Object.values(ext)) {
    if (wrapper && typeof wrapper === "object") {
      for (const [key, value] of Object.entries(
        wrapper as Record<string, unknown>,
      )) {
        if (key.toLowerCase().endsWith("hr") && Number.isFinite(Number(value))) {
          return Number(value);
        }
      }
    }
  }
  return null;
}

export function parseGpx(buffer: Buffer): ActivitySummary | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(buffer.toString("utf-8"));
    const tracks = doc?.gpx?.trk;
    const track = Array.isArray(tracks) ? tracks[0] : tracks;
    if (!track) return null;
    const segments = Array.isArray(track.trkseg) ? track.trkseg : [track.trkseg];

    let distance = 0;
    let firstTime: Date | null = null;
    let lastTime: Date | null = null;
    let hrSum = 0;
    let hrCount = 0;
    let previous: { lat: number; lon: number } | null = null;

    for (const segment of segments) {
      const points: GpxPoint[] = Array.isArray(segment?.trkpt)
        ? segment.trkpt
        : segment?.trkpt
          ? [segment.trkpt]
          : [];
      for (const point of points) {
        const lat = Number(point["@_lat"]);
        const lon = Number(point["@_lon"]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (previous) {
          distance += haversineMeters(previous.lat, previous.lon, lat, lon);
        }
        previous = { lat, lon };
        if (point.time) {
          const time = new Date(point.time);
          if (!Number.isNaN(time.getTime())) {
            if (!firstTime) firstTime = time;
            lastTime = time;
          }
        }
        const hr = pointHr(point);
        if (hr !== null) {
          hrSum += hr;
          hrCount += 1;
        }
      }
    }

    const duration =
      firstTime && lastTime
        ? (lastTime.getTime() - firstTime.getTime()) / 1000
        : 0;
    return toSummary(
      firstTime,
      distance,
      duration,
      hrCount > 0 ? hrSum / hrCount : null,
      "gpx",
    );
  } catch (error) {
    console.error("GPX parse failed:", error);
    return null;
  }
}
