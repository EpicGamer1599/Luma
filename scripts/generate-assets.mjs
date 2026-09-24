import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
mkdirSync('public/demo', { recursive: true });
mkdirSync('build', { recursive: true });
const palettes = [
  ['#bdc8ac', '#edf0bc', '#748d6c', '#314f42', '#142e27'],
  ['#b69687', '#f1c69b', '#8b7c8c', '#574b69', '#292839'],
  ['#7b9ea5', '#c4d9c5', '#628487', '#305559', '#142e36'],
  ['#c7a084', '#ffe1ad', '#b27054', '#754a3d', '#362d30'],
  ['#95af80', '#e1d59b', '#668867', '#39593f', '#1e372b'],
  ['#959dc1', '#dad7e8', '#696f9c', '#424965', '#242c44'],
];
const names = [
  'A little wonder',
  'Beyond the horizon',
  'Future / imperfect',
  'Worlds within worlds',
  'A moment in time',
  'Made to explore',
];
for (let i = 0; i < 6; i++) {
  const p = palettes[i];
  const trees = Array.from({ length: 15 }, (_, n) => {
    const x = 35 + n * 57,
      y = 300 + Math.sin(n * 2 + i) * 40,
      s = 30 + ((n * 13) % 55);
    return `<path d="M${x} ${y - s}l${s / 3} ${s * 0.7}h${-s / 6}l${s / 3} ${s * 0.65}h${-s}l${s / 3} ${-s * 0.65}h${-s / 6}Z" fill="${p[4]}" opacity="${0.35 + (n % 3) * 0.2}"/>`;
  }).join('');
  const motif =
    i === 2
      ? `<g stroke="${p[1]}" stroke-width="2" fill="none" opacity=".6"><path d="M440 280V120l90-45 90 45v160l-90 50zM440 120l90 50 90-50M530 170v160"/><circle cx="530" cy="178" r="95"/></g>`
      : i === 5
        ? `<g transform="translate(495 175)"><circle r="99" fill="${p[4]}" opacity=".65"/><circle r="82" fill="none" stroke="${p[1]}" stroke-width="1" opacity=".6"/><path d="M-20-35L40 0-20 35Z" fill="${p[1]}"/></g>`
        : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient><linearGradient id="shade" x2="0" y2="1"><stop stop-color="${p[4]}" stop-opacity="0"/><stop offset="1" stop-color="${p[4]}" stop-opacity=".8"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".08"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><g filter="url(#grain)"><rect width="800" height="450" fill="url(#sky)"/><circle cx="${535 + i * 12}" cy="105" r="${43 + i * 3}" fill="${p[1]}"/><path d="M-50 290L110 130 198 230 310 84 465 250 592 140 840 310V450H-50Z" fill="${p[2]}"/><path d="M216 196L310 84 385 164 328 150 303 174 283 142Z" fill="${p[1]}" opacity=".7"/><path d="M-40 350L95 263 205 314 420 215 515 302 670 202 850 290V450H-40Z" fill="${p[3]}"/><path d="M-50 380Q130 290 300 367T830 315V450H-50Z" fill="${p[4]}" opacity=".85"/>${trees}${motif}<rect width="800" height="450" fill="url(#shade)"/></g><text x="35" y="376" fill="${p[1]}" font-family="Georgia,serif" font-size="33" font-style="italic">${names[i]}</text><text x="37" y="404" fill="${p[1]}" opacity=".6" font-family="Arial,sans-serif" font-size="10" letter-spacing="3">LUMA / SAMPLE COLLECTION 0${i + 1}</text></svg>`;
  writeFileSync(`public/demo/${i}.svg`, svg);
}
// Original app icon, generated from simple geometry; no external assets needed.
const size = 256,
  raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    const dx = Math.max(32 - x, 0, x - 223),
      dy = Math.max(32 - y, 0, y - 223),
      inside = dx * dx + dy * dy < 32 * 32;
    const triangle = x >= 97 && x <= 175 && Math.abs(y - 128) < (175 - x) * 0.62;
    const color = triangle ? [22, 47, 34] : [179, 231, 188];
    raw.set([...color, inside ? 255 : 0], offset);
  }
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    len = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync('build/icon.png', png);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
writeFileSync('build/icon.ico', Buffer.concat([ico, png]));
