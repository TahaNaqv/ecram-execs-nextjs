// Build the brand film for the Experience section from the source footage and music.
//   npm run media:brand-film
// Needs ffmpeg on PATH. Writes public/assets/brand-film.mp4 and its poster, brand-film-poster.jpg.
// The source footage is too large to deploy, so it lives in media-src/ (git-ignored); the music stays in public/assets.
// The clip's length is shown on the poster, so keep DURATION in app/(site)/_components/brand-film.tsx in step.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const SOURCE = "media-src/The all-new electric Mercedes-Benz VLE 300 - Velvet Brown.mp4";
const MUSIC = "public/assets/background_music.mp3";
const OUT = "public/assets/brand-film.mp4";
const POSTER = "public/assets/brand-film-poster.jpg";

const START = 77; // 1:17 in the source, the van at rest
const END = 305; // 5:05, as it drives out of frame
const SPEED = 2;
const MUSIC_OFFSET = 0.35; // silence before the first note
const LOUDNESS = "I=-16:TP=-1.5:LRA=11"; // common target for web video

const duration = (END - START) / SPEED;
const fadeOut = 3;

for (const file of [SOURCE, MUSIC]) {
  if (!existsSync(file)) {
    console.error(`Missing ${file}`);
    process.exit(1);
  }
}

// Returns stderr, where ffmpeg writes its logs and loudnorm its measurements
const ffmpeg = (args: string[]) => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed:\n${result.stderr}`);
  return result.stderr;
};
const musicInput = ["-ss", String(MUSIC_OFFSET), "-i", MUSIC];
const trimMusic = `atrim=0:${duration},asetpts=PTS-STARTPTS`;

// Pass 1: measure the music so pass 2 can normalise it linearly, without pumping
const log = ffmpeg([...musicInput, "-af", `${trimMusic},loudnorm=${LOUDNESS}:print_format=json`, "-f", "null", "-"]);
const measured = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));

const audio = [
  trimMusic,
  `loudnorm=${LOUDNESS}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`,
  "aresample=48000",
  "afade=t=in:d=0.5",
  `afade=t=out:st=${duration - fadeOut}:d=${fadeOut}`,
].join(",");

// Pass 2: cut and speed up the footage, drop its own audio and lay the music under it.
// H.264 high profile + AAC plays in every browser; faststart lets playback begin before the file has fully downloaded.
const tmp = `${OUT}.tmp.mp4`;
ffmpeg([
  "-ss", String(START), "-to", String(END), "-i", SOURCE,
  ...musicInput,
  "-filter_complex", `[0:v]setpts=PTS/${SPEED},fps=25,format=yuv420p[v];[1:a]${audio}[a]`,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-level", "4.0",
  "-c:a", "aac", "-b:a", "160k", "-ac", "2",
  "-t", String(duration), "-movflags", "+faststart",
  tmp,
]);
renameSync(tmp, OUT);

ffmpeg(["-i", OUT, "-frames:v", "1", "-q:v", "3", POSTER]);
console.log(`Wrote ${OUT} (${duration}s) and ${POSTER}`);
