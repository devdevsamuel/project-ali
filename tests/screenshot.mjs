// Renders a set of game states to PNG files with headless Chrome so the
// visuals can be inspected. Run: node tests/screenshot.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4321;
const OUT = new URL('../.screenshots/', import.meta.url).pathname;

mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});
await delay(2500);

// Each scenario is a query string the page understands.
const scenarios = [
  { name: '01-start-sign', query: '?autostart&t=0.2' },
  { name: '02-rain-heavy', query: '?autostart&crystals=4&t=2' },
  { name: '03-reunion', query: '?autostart&crystals=4&t=12' },
  { name: '04-kick-impact', query: '?autostart&kick=0.13' },
  { name: '05-robbery', query: '?autostart&robbery=2.6' },
  { name: '06-robbery-stolen', query: '?autostart&robbery=4.2' },
  { name: '07-super-kick', query: '?autostart&kicks=5' },
  { name: '08-dog-sign', query: '?autostart&distance=126' },
  { name: '09-rain-stage2', query: '?autostart&distance=70&crystals=2' },
];

for (const scenario of scenarios) {
  const profile = `/tmp/chrome-shot-${scenario.name}`;
  rmSync(profile, { recursive: true, force: true });
  const shot = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1100,900',
    `--user-data-dir=${profile}`,
    `--screenshot=${OUT}${scenario.name}.png`,
    `--virtual-time-budget=6000`,
    `http://localhost:${PORT}/${scenario.query}`,
  ], { stdio: 'ignore' });
  await new Promise((resolve) => shot.on('exit', resolve));
  console.log('captured', scenario.name);
}

server.kill('SIGTERM');
process.exit(0);
