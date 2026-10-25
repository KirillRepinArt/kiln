// The queue at scale (v0.6 gate): 500 finished pictures, a job rendering — the poll stays light, the Queue tab opens
// fast and scrolls smoothly, thumbnails are small files (never the full PNGs), the page's image cache stays bounded.
// Numbers go to tools/tests/out/scale.json (compare versions by running this file against each).
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const N = 500,
  OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc = b => {
  let c = -1;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
/* a real-size picture (864×1152, 1 MP — what decoding costs), a soft gradient so it isn't trivially small */
function png(w, h, r, g, b) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1);
    raw[o] = 0;
    for (let x = 0; x < w; x++) {
      const k = o + 1 + x * 3,
        v = (x + y) % 64;
      raw[k] = (r + v) & 255;
      raw[k + 1] = (g + v) & 255;
      raw[k + 2] = (b + v) & 255;
    }
  }
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(w, 0);
  ih.writeUInt32BE(h, 4);
  ih[8] = 8;
  ih[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ih),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const PROMPT =
  "a quiet harbour at dawn, fog over the water, fishing boats tied up along the pier, gulls, wet cobblestones, warm light in one window, cinematic, 35mm, soft grain, muted palette, long exposure, " +
  "an old man mending nets on a bench, a dog asleep at his feet, mist rolling in from the sea, distant lighthouse, overcast sky, reflections in puddles, quiet mood";
function fill({ out, data }) {
  const files = [
    [200, 60, 60],
    [60, 160, 90],
    [70, 90, 200],
    [190, 170, 60],
    [140, 70, 170],
  ].map(c => png(864, 1152, ...c));
  const t0 = Date.now() / 1000 - N * 120,
    jobs = [];
  for (let i = 1; i <= N; i++) {
    const file = `harbour-${String(i).padStart(3, "0")}.png`;
    writeFileSync(join(out, file), files[i % files.length]);
    jobs.push({
      id: i,
      kind: "txt2img",
      status: "done",
      created: t0 + i * 120,
      started: t0 + i * 120 + 1,
      finished: t0 + i * 120 + 100,
      step: 4,
      steps: 4,
      progress: 1,
      spec: {
        prompt: PROMPT,
        raw: PROMPT,
        picks: [],
        name: "Harbour",
        mp: "1.0",
        ar: "3:4",
        w: 864,
        h: 1152,
        steps: 4,
        seed: 1000 + i,
        loras: [
          { name: "detail_enhancer_krea2", w: 0.5 },
          { name: "skin_texture_krea2", w: 0.4 },
        ],
        shift: 1.15,
        cfg: 1,
        sampler: "Euler",
        scheduler: "Simple",
      },
      file,
      seed_used: 1000 + i,
      infotext:
        PROMPT +
        "\nSteps: 4, Sampler: Euler, Schedule type: Simple, CFG scale: 1, Distilled CFG Scale: 1.15, Seed: " +
        (1000 + i) +
        ', Size: 864x1152, Model: krea2_turbo_fp8_scaled, Lora hashes: "detail_enhancer_krea2: 0123456789ab, skin_texture_krea2: ba9876543210", Version: f2.0.1',
    });
  }
  writeFileSync(join(data, "queue.json"), JSON.stringify(jobs));
}

export async function scale(k, t) {
  const r = {};
  await k.sleep(1500);
  await k.job("[fill:446688] rendering", { steps: 400 });
  await k.until(`current()&&current().step>=1`, 30000, 100);
  // 1 · the poll while a job renders
  await k.ev(`(performance.clearResourceTimings(),1)`);
  await k.sleep(5000);
  const polls = await k.ev(
    `performance.getEntriesByType("resource").filter(e=>e.name.includes("/api/state")).map(e=>e.encodedBodySize||e.transferSize)`,
  );
  r.pollCount = polls.length;
  r.pollAvgKB = +(polls.reduce((a, b) => a + b, 0) / Math.max(1, polls.length) / 1024).toFixed(1);
  r.pollMedianKB = +([...polls].sort((a, b) => a - b)[polls.length >> 1] / 1024).toFixed(1);
  r.fullPolls = polls.filter(b => b > 100 * 1024).length;
  // 2 · opening the Queue tab
  await k.ev(`(performance.clearResourceTimings(),1)`);
  r.queueOpenMs = await k.ev(
    `(()=>{const t=performance.now();showView("queue");document.body.offsetHeight;return Math.round(performance.now()-t)})()`,
  );
  await k.sleep(3000);
  const loads = await k.ev(`performance.getEntriesByType("resource").map(e=>e.name)`);
  r.fullPngLoads = loads.filter(u => u.includes("/files/")).length;
  r.thumbLoads = loads.filter(u => u.includes("/qthumbs/")).length;
  // 3 · scrolling the queue while the job renders: frame gaps
  r.scroll = await k.ev(
    `new Promise(res=>{const q=$("qwrap"),gaps=[];let last=performance.now(),n=0;(function f(now){gaps.push(now-last);last=now;q.scrollTop+=40;if(++n<180)requestAnimationFrame(f);else{gaps.shift();gaps.sort((a,b)=>a-b);res({frames:n,p50:+gaps[gaps.length>>1].toFixed(1),p95:+gaps[Math.floor(gaps.length*.95)].toFixed(1),max:+gaps[gaps.length-1].toFixed(1)})}})(performance.now())})`,
  );
  await k.sleep(3000);
  const loads2 = await k.ev(`performance.getEntriesByType("resource").map(e=>e.name)`);
  r.fullPngLoadsAfterScroll = loads2.filter(u => u.includes("/files/")).length;
  // 3b · a second visit (thumbnails exist now): no full pictures at all
  await k.send("Page.reload");
  await k.until(`!!(window.LIVE&&window._jobsReady)`, 20000, 100);
  await k.sleep(800);
  await k.ev(`(performance.clearResourceTimings(),1)`);
  r.queueOpenMs2 = await k.ev(
    `(()=>{const t=performance.now();showView("queue");document.body.offsetHeight;return Math.round(performance.now()-t)})()`,
  );
  await k.sleep(2500);
  r.fullPngLoadsSecondVisit = (await k.ev(`performance.getEntriesByType("resource").map(e=>e.name)`)).filter(u =>
    u.includes("/files/"),
  ).length;
  // 4 · browsing 60 pictures in the Gallery: the page's image cache
  await k.ev(`(showView("gen"),1)`);
  await k.ev(`(document.querySelector('.tab[data-v="gallery"]').click(),1)`);
  await k.sleep(500);
  for (let i = 0; i < 60; i++) {
    await k.ev(`(genNav(-1),1)`);
    await k.sleep(60);
  }
  r.imgCache = await k.ev(`typeof __imgsN==="function"?__imgsN():"n/a"`);
  r.ok = true;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "scale.json"), JSON.stringify(r, null, 1));
  console.log("    scale:", JSON.stringify(r));
  // one full list may land in the window (the refresh right after the job started — on a slow machine it arrives late)
  t.ok(r.pollMedianKB < 8 && r.fullPolls <= 1, "the poll while a job renders stays light (only the running job)", r);
  t.ok(r.fullPngLoads <= 30, "first visit: a thumbnail is made once per row you see (not all 500)", r);
  t.ok(r.fullPngLoadsSecondVisit === 0, "after that the Queue never loads a full picture for its rows", r);
  t.ok(r.queueOpenMs < 120 && r.queueOpenMs2 < 120, "the Queue tab opens fast", r);
  if (process.env.CI) console.log("scale (CI, no GPU — frame times reported, not judged):", JSON.stringify(r.scroll));
  else
    t.ok(
      r.scroll.p50 < 20 && r.scroll.max < 150,
      "scrolling stays smooth while a job renders (typical frame one refresh; no long stall)",
      r,
    );
  t.ok(r.imgCache <= 16, "the page's picture cache stays bounded", r);
}
scale.opts = { step: 1, before: fill, width: 1600, height: 1000 };
