/**
 * Watch-file golden vectors: builds FIT (with the Garmin SDK's encoder) and
 * GPX fixtures in testdata/activity/, runs the LEGACY parsers
 * (legacy/lib/activity-parse.ts) over them, and writes
 * testdata/golden/activity-files.json for the Go parsers to replay.
 *
 *   make golden-activity   (needs the two npm packages — see the Makefile)
 *
 * Deleted together with legacy/ at cutover.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Encoder, Profile } from "@garmin/fitsdk";
import { parseFit, parseGpx } from "@/lib/activity-parse";

const dir = "testdata/activity";
mkdirSync(dir, { recursive: true });

// ---- FIT ------------------------------------------------------------------

type Session = Record<string, unknown>;

function fitFile(sessions: Session[], records = 5): Uint8Array {
  const encoder = new Encoder();
  const start = new Date("2026-09-20T07:00:00Z");
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: "activity",
    manufacturer: "development",
    product: 1,
    timeCreated: start,
    serialNumber: 1234,
  });
  for (let i = 0; i < records; i++) {
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(start.getTime() + i * 1000),
      distance: i * 3,
      heartRate: 140 + i,
    });
  }
  for (const session of sessions) {
    encoder.onMesg(Profile.MesgNum.SESSION, { timestamp: start, sport: "running", ...session });
  }
  return encoder.close();
}

const run5k = fitFile([
  {
    startTime: new Date("2026-09-20T07:00:00Z"),
    totalDistance: 5012.34,
    totalTimerTime: 1623.5,
    totalElapsedTime: 1700,
    avgHeartRate: 152,
  },
]);
const corrupt = Uint8Array.from(run5k);
corrupt[corrupt.length - 20] ^= 0xff;

const FIT: Record<string, Uint8Array> = {
  "run-5k.fit": run5k,
  "elapsed-only.fit": fitFile([
    { startTime: new Date("2026-09-18T18:30:00Z"), totalDistance: 8000, totalElapsedTime: 2400 },
  ]),
  "two-sessions.fit": fitFile([
    { startTime: new Date("2026-09-17T06:00:00Z"), totalDistance: 10000, totalTimerTime: 3000, avgHeartRate: 147 },
    { startTime: new Date("2026-09-17T08:00:00Z"), totalDistance: 3000, totalTimerTime: 900, avgHeartRate: 120 },
  ]),
  "too-short.fit": fitFile([{ startTime: new Date("2026-09-16T06:00:00Z"), totalDistance: 150, totalTimerTime: 600 }]),
  "too-brief.fit": fitFile([{ startTime: new Date("2026-09-16T06:00:00Z"), totalDistance: 900, totalTimerTime: 59 }]),
  "no-session.fit": fitFile([]),
  "corrupt.fit": corrupt,
  "not-a-fit.fit": new TextEncoder().encode("definitely not a FIT file, just some text"),
};

// ---- GPX ------------------------------------------------------------------

type Point = { lat: string; lon: string; time?: string; ext?: string };

function track(n: number, opts: { lat0?: number; t0?: number; stepS?: number; ext?: (i: number) => string } = {}) {
  const { lat0 = 52.37, t0 = Date.parse("2026-09-19T06:00:00Z"), stepS = 4, ext } = opts;
  return Array.from({ length: n }, (_, i): Point => ({
    lat: (lat0 + i * 0.0001).toFixed(6),
    lon: (4.89 + i * 0.00005).toFixed(6),
    time: new Date(t0 + i * stepS * 1000).toISOString(),
    ext: ext?.(i),
  }));
}

function trkpts(points: Point[]) {
  return points
    .map(
      (p) =>
        `<trkpt lat="${p.lat}" lon="${p.lon}">${p.time !== undefined ? `<time>${p.time}</time>` : ""}${p.ext ?? ""}</trkpt>`,
    )
    .join("\n");
}

function gpx(tracks: string[][], ns = 'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"') {
  const body = tracks
    .map((segments) => `<trk><name>Run</name>${segments.map((s) => `<trkseg>${s}</trkseg>`).join("")}</trk>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1" ${ns}>${body}</gpx>`;
}

const garminHr = (i: number) =>
  `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + (i % 20)}</gpxtpx:hr><gpxtpx:cad>84</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>`;
const ns3Hr = (i: number) => `<extensions><ns3:TrackPointExtension><ns3:hr>${150 + (i % 7)}</ns3:hr></ns3:TrackPointExtension></extensions>`;
const flatHr = (i: number) => `<extensions><hr>${150 + (i % 7)}</hr></extensions>`;

const long = track(300, { ext: garminHr });
const noTime = track(300).map((p) => ({ ...p, time: undefined }));
const localTimes = track(200, { stepS: 5 }).map((p) => ({ ...p, time: p.time!.replace(".000Z", "") }));
const fractional = track(200, { stepS: 5 }).map((p, i) => ({ ...p, time: p.time!.replace(".000Z", `.${(i * 37) % 1000}Z`) }));
const withBadPoints = track(250).map((p, i) => (i === 10 ? { ...p, lat: "abc" } : i === 20 ? { ...p, time: "not a time" } : p));

const GPX: Record<string, string> = {
  "garmin-hr.gpx": gpx([[trkpts(long.slice(0, 150)), trkpts(long.slice(150))]]),
  "ns3-hr.gpx": gpx([[trkpts(track(240, { ext: ns3Hr }))]], 'xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"'),
  "flat-hr.gpx": gpx([[trkpts(track(240, { ext: flatHr }))]]),
  "two-tracks.gpx": gpx([[trkpts(track(200))], [trkpts(track(400, { lat0: 40 }))]]),
  "local-times.gpx": gpx([[trkpts(localTimes)]]),
  "fractional-times.gpx": gpx([[trkpts(fractional)]]),
  "bad-points.gpx": gpx([[trkpts(withBadPoints)]]),
  "no-time.gpx": gpx([[trkpts(noTime)]]),
  "single-point.gpx": gpx([[trkpts(track(1))]]),
  "too-short.gpx": gpx([[trkpts(track(15, { stepS: 10 }))]]),
  "no-track.gpx": gpx([]),
  "not-xml.gpx": "this is not xml <<<",
};

// ---- write fixtures + expected summaries ----------------------------------

const cases: { file: string; want: unknown }[] = [];
for (const [name, bytes] of Object.entries(FIT)) {
  writeFileSync(`${dir}/${name}`, bytes);
  cases.push({ file: name, want: parseFit(Buffer.from(readFileSync(`${dir}/${name}`))) });
}
for (const [name, text] of Object.entries(GPX)) {
  writeFileSync(`${dir}/${name}`, text);
  cases.push({ file: name, want: parseGpx(Buffer.from(readFileSync(`${dir}/${name}`))) });
}

writeFileSync(
  "testdata/golden/activity-files.json",
  JSON.stringify(
    { generatedBy: "scripts/golden/activity-files.ts", topic: "watch-file parsing (legacy/lib/activity-parse.ts)", cases },
    null,
    2,
  ) + "\n",
);
console.log(cases.map((c) => `${c.file}: ${JSON.stringify(c.want)}`).join("\n"));
