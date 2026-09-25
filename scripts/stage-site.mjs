import { cp, mkdir, writeFile } from 'node:fs/promises';

// These paths are already served by GitHub Pages and must survive the new build.
for (const path of ['assets/games', 'assets/idea-icons', 'idle-wizard', 'idle-whitch-craft']) {
  await mkdir(`dist/${path}`, { recursive: true });
  await cp(path, `dist/${path}`, { recursive: true, force: true });
}
await cp('favicon.svg', 'dist/favicon.svg');
await writeFile('dist/.nojekyll', '');
