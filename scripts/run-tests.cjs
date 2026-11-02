const { spawnSync } = require('node:child_process');
const path = require('node:path');
for (const script of ['test-studio.cjs', 'test-live-audio.cjs', 'test-live-runtime.cjs', 'test-live-runtime-http.cjs', 'test-christian-runtime.cjs', 'test-state-persistence.cjs', 'test-https-launcher.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit', windowsHide: true });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
