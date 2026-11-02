const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { writeJsonAtomic } = require('../src/utils/atomicJson');
const { TempleStateModel } = require('../src/models/templeStateModel');
const { ChristianStateModel } = require('../src/profiles/thien-chua-giao/stateModel');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-persistence-'));
  const filename = path.join(directory, 'ordered.json');
  await Promise.all(Array.from({ length: 30 }, (_, revision) => writeJsonAtomic(filename, { revision, text: 'Dữ liệu hợp lệ' })));
  assert.equal(JSON.parse(await fs.readFile(filename, 'utf8')).revision, 29);
  assert.ok(!(await fs.readdir(directory)).some(file => file.endsWith('.tmp')));
  for (const [name, Model] of [['buddhist', TempleStateModel], ['christian', ChristianStateModel]]) {
    const stateFile = path.join(directory, `${name}.json`);
    const model = new Model({ stateFile });
    model.state.recentEvents = [{ id: 'persisted', type: 'prayer', user: 'Kiểm tra lưu' }];
    model.saveState();
    const deadline = Date.now() + 5000;
    while (true) {
      try { if (JSON.parse(await fs.readFile(stateFile, 'utf8')).recentEvents?.[0]?.id === 'persisted') break; } catch (_) {}
      assert.ok(Date.now() < deadline, `${name} did not save its recent events`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const reloaded = new Model({ stateFile });
    assert.equal(reloaded.state.recentEvents[0].id, 'persisted');
  }
  console.log('PASS persistence: serialized atomic snapshots, no temporary residue, both profiles restore activity after reload.');
})().catch(error => { console.error(error); process.exitCode = 1; });
