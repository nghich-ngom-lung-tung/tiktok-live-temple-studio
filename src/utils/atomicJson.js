const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const pending = new Map();

// Serialize snapshots per file and replace only after the complete JSON is written.
function writeJsonAtomic(filename, value) {
  const payload = JSON.stringify(value, null, 2);
  const task = (pending.get(filename) || Promise.resolve()).catch(() => {}).then(async () => {
    const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, payload, { flag: 'wx' });
      await fs.rename(temporary, filename);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  });
  pending.set(filename, task);
  const cleanup = () => { if (pending.get(filename) === task) pending.delete(filename); };
  task.then(cleanup, cleanup);
  return task;
}

module.exports = { writeJsonAtomic };
