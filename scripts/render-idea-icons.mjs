// Renders the idea card icons from the town's own 3D builders.
// Usage: node scripts/render-idea-icons.mjs   (needs the `playwright` package)
// Writes assets/idea-icons/3d/<idea>-<level>.webp for levels 1..8.
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('Install Playwright first: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { host: '127.0.0.1', port: 5199, strictPort: false }, logLevel: 'warn' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => console.error(error));
  await page.goto(`${url}icon-studio.html?headless`);
  await page.waitForFunction(() => 'iconStudio' in window, null, { timeout: 120000 });
  const images = await page.evaluate(() => {
    const studio = window.iconStudio, out = {};
    for (const idea of studio.ideas) for (let level = 1; level <= studio.maxLevel; level++) out[`${idea}-${level}`] = studio.render(idea, level);
    return out;
  });
  await mkdir('assets/idea-icons/3d', { recursive: true });
  for (const [name, dataUrl] of Object.entries(images)) {
    await writeFile(`assets/idea-icons/3d/${name}.webp`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  console.log(`Wrote ${Object.keys(images).length} icons to assets/idea-icons/3d/`);
} finally {
  await browser.close();
  await server.close();
}
