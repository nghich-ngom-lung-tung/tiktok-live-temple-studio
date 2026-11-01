import { spawnSync } from 'node:child_process';

if (process.env.TEMPLE_SKIP_ZEROTTS_SETUP === '1') {
  console.log('[setup] Skipping ZeroTTS Python dependencies (TEMPLE_SKIP_ZEROTTS_SETUP=1).');
  process.exit(0);
}

const result = spawnSync('uv', ['sync', '--locked'], {
  stdio: 'inherit',
  windowsHide: true
});

if (result.error?.code === 'ENOENT') {
  console.error('[setup] Could not find uv. Install Python 3.10+ and uv, then rerun npm install.');
  console.error('[setup] For a frontend-only install, set TEMPLE_SKIP_ZEROTTS_SETUP=1 before npm install.');
  process.exit(1);
}

if (result.error) {
  console.error(`[setup] Could not start uv: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('[setup] ZeroTTS Python dependencies are ready.');
