// One-off: transcribe the 6-May Zoom audio via OpenAI Whisper.
// Run: node --env-file=.env.local scripts/transcribe-zoom-2026-05-06.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const AUDIO = 'C:\\Users\\denni\\OneDrive\\ドキュメント\\Downloads\\ZOOM RECORDINGS\\2026-05-06 18.01.46 mmc build meeting Wednesday 6 may\\audio1884456203.m4a';
const OUT_TXT = 'C:\\Users\\denni\\PycharmProjects\\mmcbuild\\docs\\meeting-transcript-2026-05-06.txt';
const OUT_JSON = 'C:\\Users\\denni\\PycharmProjects\\mmcbuild\\docs\\meeting-transcript-2026-05-06.json';

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error('OPENAI_API_KEY not set. Run with: node --env-file=.env.local <script>');
  process.exit(1);
}

const buf = readFileSync(AUDIO);
console.log(`Loaded ${(buf.length / 1024 / 1024).toFixed(2)} MB from ${basename(AUDIO)}`);

const form = new FormData();
form.append('file', new Blob([buf], { type: 'audio/mp4' }), 'audio.m4a');
form.append('model', 'whisper-1');
form.append('response_format', 'verbose_json');
form.append('timestamp_granularities[]', 'segment');
form.append('language', 'en');

console.log('Uploading to OpenAI Whisper…');
const t0 = Date.now();
const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const json = await res.json();
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s. Duration: ${json.duration?.toFixed(1)}s. Segments: ${json.segments?.length}.`);

writeFileSync(OUT_JSON, JSON.stringify(json, null, 2), 'utf8');

const lines = (json.segments ?? []).map(s => {
  const mm = String(Math.floor(s.start / 60)).padStart(2, '0');
  const ss = String(Math.floor(s.start % 60)).padStart(2, '0');
  return `[${mm}:${ss}] ${s.text.trim()}`;
});
writeFileSync(OUT_TXT, lines.join('\n') + '\n', 'utf8');

console.log(`Wrote: ${OUT_TXT}`);
console.log(`Wrote: ${OUT_JSON}`);
