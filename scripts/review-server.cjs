// Isolated local review server. Never reads or overwrites the user's merit state.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.PORT = '3012';
process.env.TEMPLE_RPC_TOKEN = 'studio-local-review-token-000000000000';
process.env.PYTHONUTF8 = '1';
const config = require('../src/config');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-review-'));
config.DATA_DIR = directory;
config.STATE_FILE = path.join(directory, 'state.json');
config.STAGE_BACKGROUND_DIR = path.join(directory, 'stage-backgrounds');
config.CHRISTIAN_STAGE_BACKGROUND_DIR = path.join(directory, 'christian-backgrounds');
const { createApplication } = require('../src/server');
const system = createApplication();
system.app.get('/__review-fixture', (_req, res) => res.json({ isolated: true }));
system.server.listen(3012, '127.0.0.1', () => console.log('Isolated review: http://127.0.0.1:3012/admin'));
process.on('SIGINT', () => { system.ttsManager.proc?.kill(); system.server.close(); process.exit(); });
