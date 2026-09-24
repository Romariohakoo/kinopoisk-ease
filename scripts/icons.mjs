// Рисует PNG-иконки расширения из SVG через Chromium (Playwright): npm run icons
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'extension/icons');
const SIZES = [16, 32, 48, 128];

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2B3456"/>
      <stop offset="1" stop-color="#090D1A"/>
    </linearGradient>
    <linearGradient id="play" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#C9CEE0"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="30" fill="url(#bg)"/>
  <path d="M48 36v56c0 4.3 4.7 6.9 8.3 4.6l43.6-28c3.3-2.1 3.3-7 0-9.1L56.3 31.4C52.7 29.1 48 31.7 48 36Z" fill="url(#play)"/>
</svg>`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
        `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    const file = path.join(outDir, `icon-${size}.png`);
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
    console.log(`✓ ${path.relative(root, file)}`);
}
await browser.close();
