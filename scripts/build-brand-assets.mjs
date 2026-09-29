import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'public/brand');
await mkdir(destination, { recursive: true });
const mark = await readFile(path.join(destination, 'wave-broadwalk-mark.svg'));
const source = path.join(root, 'assets/branding/broadwalk-wave-source.png');
const icons = new Map();
for (const [size, name] of [[16, 'favicon-16.png'], [32, 'favicon-32.png'], [48, 'favicon-48.png'], [180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  const png = await sharp(mark).resize(size, size).png().toBuffer();
  icons.set(size, png);
  await writeFile(path.join(destination, name), png);
}
const sizes = [16, 32, 48], header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16, png = icons.get(size);
  header[entry] = size; header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(path.join(root, 'public/favicon.ico'), Buffer.concat([header, ...sizes.map(size => icons.get(size))]));
await sharp(source).resize(1200, 800).webp({ quality: 86 }).toFile(path.join(destination, 'broadwalk-wave.webp'));

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="shade"><stop offset="0" stop-color="#254537"/><stop offset=".48" stop-color="#254537" stop-opacity=".94"/><stop offset="1" stop-color="#254537" stop-opacity="0"/></linearGradient></defs>
  <rect width="1000" height="630" fill="url(#shade)"/>
  <image x="55" y="52" width="66" height="66" href="data:image/svg+xml;base64,${mark.toString('base64')}"/>
  <text x="137" y="97" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" font-weight="bold" letter-spacing="-1" fill="#eff3e5">tidewatch<tspan fill="#b7cea1">.</tspan></text>
  <text x="59" y="193" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" letter-spacing="3" fill="#c4d4b1">A LITTLE FORESIGHT FOR YOUR COAST</text>
  <text x="55" y="280" font-family="DejaVu Sans, Arial, sans-serif" font-size="48" font-weight="bold" letter-spacing="-1.5" fill="#eff3e5">Stay one step ahead</text>
  <text x="55" y="345" font-family="DejaVu Sans, Arial, sans-serif" font-size="48" font-weight="bold" letter-spacing="-1.5" fill="#eff3e5">of the rising tide.</text>
  <text x="59" y="403" font-family="DejaVu Sans, Arial, sans-serif" font-size="19" fill="#c5d5b4">Tides and rainfall. A clearer view, together.</text>
  <rect x="59" y="514" width="390" height="1" fill="#77956b" opacity=".7"/>
  <text x="59" y="551" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" letter-spacing="2" fill="#c4d4b1">HOLLYWOOD BEACH, FLORIDA · 33019</text>
</svg>`);
await sharp(source).resize(1200, 630, { fit: 'cover', position: 'centre' }).composite([{ input: overlay }]).png().toFile(path.join(destination, 'social-card.png'));
console.log('Brand assets generated: SVG mark, 6 PNG icon sizes, ICO, WebP hero, and 1200×630 social card.');
