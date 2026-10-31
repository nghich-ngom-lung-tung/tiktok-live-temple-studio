const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ZeroTtsManager {
  constructor({ rootDir, workerPath, stateModel, broadcastNotification }) {
    this.rootDir = rootDir;
    this.workerPath = workerPath;
    this.stateModel = stateModel;
    this.broadcastNotification = broadcastNotification;
    this.proc = null;
    this.ready = false;
    this.status = 'starting';
    this.voice = 'maichi';
    this.voices = ['maichi'];
    this.model = 'zeroweight-ai/ZeroTTS';
    this.lastError = null;
    this.stderrTail = '';
    this.pending = new Map();
    this.inflight = new Map();
    this.synthesisTail = Promise.resolve();
    this.reqCounter = 0;
    this.buffer = '';
    process.once('exit', () => { this.proc?.kill(); });
    this.startWorker();
  }

  resolvePythonBin() {
    const candidates = [
      path.join(this.rootDir, '.venv', 'Scripts', 'python.exe'),
      path.join(this.rootDir, '.venv', 'bin', 'python')
    ];
    const venvPy = candidates.find((candidate) => fs.existsSync(candidate));
    return venvPy || (process.platform === 'win32' ? 'python' : 'python3');
  }

  startWorker() {
    const pyBin = this.resolvePythonBin();
    console.log(`[ZeroTTS] Khởi chạy worker với ${pyBin} (Giọng mặc định: Mai Chi)...`);
    this.status = 'loading';
    this.lastError = null;
    this.stderrTail = '';
    this.proc = spawn(pyBin, [this.workerPath], {
      cwd: this.rootDir,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        HF_HUB_DISABLE_XET: process.env.HF_HUB_DISABLE_XET || '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.proc.on('error', (error) => {
      this.ready = false;
      this.status = 'error';
      this.lastError = `Không khởi chạy được Python (${pyBin}): ${error.message}`;
      console.error(`[ZeroTTS] ${this.lastError}`);
      this.broadcastNotification('tts.status', this.getStatus());
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) this.handleWorkerLine(line.trim());
      }
    });

    this.proc.stderr.on('data', (chunk) => {
      const rawMessage = chunk.toString('utf8');
      this.stderrTail = `${this.stderrTail}${rawMessage}`.slice(-4000);
      const message = rawMessage.trim();
      if (message) console.log(`[ZeroTTS stderr] ${message}`);
    });

    this.proc.on('exit', (code) => {
      console.warn(`[ZeroTTS] Worker thoát với mã ${code}`);
      this.ready = false;
      if (!this.lastError && code !== 0 && this.stderrTail.trim()) {
        const lines = this.stderrTail.trim().split(/\r?\n/).filter(Boolean);
        this.lastError = lines[lines.length - 1].slice(0, 300);
      }
      if (!this.lastError && code !== 0) {
        this.lastError = `Worker thoát với mã ${code}.`;
      }
      this.status = this.lastError ? 'error' : 'stopped';
      this.broadcastNotification('tts.status', this.getStatus());
      for (const [, item] of this.pending) {
        clearTimeout(item.timer);
        item.resolve({ ok: false, error: 'ZeroTTS worker exited' });
      }
      this.pending.clear();
    });
  }

  handleWorkerLine(line) {
    try {
      const message = JSON.parse(line);
      if (message.type === 'status') {
        this.status = message.status;
        this.model = message.model || this.model;
        this.broadcastNotification('tts.status', this.getStatus());
      } else if (message.type === 'ready') {
        this.ready = true;
        this.status = 'ready';
        this.lastError = null;
        this.voice = message.voice || 'maichi';
        this.voices = message.voices || ['maichi'];
        this.model = message.model || this.model;
        console.log(`[ZeroTTS] Sẵn sàng sau ${message.loadSec}s! Giọng: ${this.voice} (${this.voices.join(', ')})`);
        this.broadcastNotification('tts.status', this.getStatus());
      } else if (message.type === 'result' && message.id != null) {
        const entry = this.pending.get(message.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(message.id);
          entry.resolve(message);
        }
      } else if (message.type === 'error') {
        console.error('[ZeroTTS Error]', message.error);
        this.status = 'error';
        this.lastError = String(message.error || 'ZeroTTS không khởi động được.').slice(0, 300);
        this.broadcastNotification('tts.status', this.getStatus());
      }
    } catch (_) {
      console.log('[ZeroTTS stdout]', line);
    }
  }

  getStatus() {
    return {
      ready: this.ready,
      status: this.status,
      engine: 'ZeroTTS (zeroweight-ai/ZeroTTS)',
      voice: this.stateModel.state.settings.ttsVoice || this.voice || 'maichi',
      voices: this.voices,
      model: this.model,
      lastError: this.lastError
    };
  }

  synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    if (cleanText.length > 1000) return Promise.resolve({ ok: false, error: 'Nội dung tối đa 1000 ký tự.' });
    if (this.inflight.size >= 12) return Promise.resolve({ ok: false, error: 'Hàng đợi giọng đọc đang đầy, thử lại sau.' });
    const voice = (voiceOverride || this.stateModel.state.settings.ttsVoice || 'maichi').toLowerCase();
    if (this.ready && !this.voices.includes(voice)) {
      return Promise.resolve({ ok: false, error: `Giọng đọc không được hỗ trợ: ${voice}` });
    }
    const dedupKey = `${voice}::${cleanText}`;
    if (this.inflight.has(dedupKey)) return this.inflight.get(dedupKey);

    const promise = this.synthesisTail.then(() => new Promise((resolve) => {
      if (!this.proc || !this.ready) {
        resolve({ ok: false, error: `ZeroTTS đang ở trạng thái: ${this.status}` });
        return;
      }
      const id = ++this.reqCounter;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'ZeroTTS synthesis timeout' });
      }, 180_000);

      this.pending.set(id, { resolve, timer });
      this.proc.stdin.write(`${JSON.stringify({ id, text: cleanText, voice })}\n`, (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ ok: false, error: 'Không gửi được nội dung tới ZeroTTS.' });
      });
    })).finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    this.synthesisTail = promise.catch(() => {});
    return promise;
  }
}

module.exports = { ZeroTtsManager };
