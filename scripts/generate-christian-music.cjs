// Generate original, wordless ambient loops for the Thiên Chúa giáo profile.
// Uses only the Node standard library; no sampled or copyrighted recordings.
const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 22050;
const SOURCE_SECONDS = 24;
const BAR_SECONDS = 4;
const CROSSFADE_SECONDS = 0.8;
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'thien-chua-giao', 'music');
const TAU = Math.PI * 2;

const tracks = [
  {
    file: 'sanctuary.wav',
    chords: [[48, 55, 60, 64, 71], [53, 60, 65, 69, 72], [57, 64, 67, 72, 76], [55, 62, 67, 72, 76], [50, 57, 62, 65, 69], [48, 55, 60, 64, 71]],
    melody: [[72, 76, 79], [77, 81, 84], [79, 84, 88], [79, 83, 86], [74, 77, 81], [76, 79, 84]],
    voice: 'organ', pad: 0.52, lead: 0.11, bass: 0.12, shimmer: 0.035
  },
  {
    file: 'morning-grace.wav',
    chords: [[43, 50, 55, 59, 62], [42, 50, 57, 62, 66], [40, 47, 52, 55, 59], [36, 43, 48, 52, 55], [45, 52, 57, 60, 64], [38, 45, 50, 54, 57]],
    melody: [[79, 83, 86], [78, 81, 86], [76, 79, 83], [76, 79, 84], [81, 84, 88], [78, 81, 86]],
    voice: 'piano', pad: 0.39, lead: 0.15, bass: 0.10, shimmer: 0.055
  },
  {
    file: 'candlelight.wav',
    chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 60, 62], [38, 45, 50, 53, 57], [41, 48, 53, 57, 60]],
    melody: [[76, 79, 84], [72, 77, 81], [76, 79, 84], [74, 79, 83], [74, 77, 81], [72, 77, 81]],
    voice: 'bell', pad: 0.48, lead: 0.085, bass: 0.13, shimmer: 0.025
  },
  {
    file: 'garden-peace.wav',
    chords: [[41, 48, 53, 57, 60], [40, 48, 52, 55, 60], [45, 52, 57, 60, 64], [38, 45, 50, 53, 57], [43, 50, 55, 59, 65], [36, 43, 48, 52, 55]],
    melody: [[72, 76, 79], [71, 76, 79], [72, 76, 81], [69, 74, 77], [71, 74, 79], [72, 76, 79]],
    voice: 'harp', pad: 0.42, lead: 0.105, bass: 0.09, shimmer: 0.022
  },
  {
    file: 'gentle-dawn.wav',
    chords: [[50, 57, 62, 66, 69], [49, 57, 61, 64, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 50, 54, 57, 62], [45, 52, 57, 61, 64]],
    melody: [[74, 78, 81], [76, 78, 83], [78, 81, 85], [76, 79, 83], [74, 78, 81], [73, 76, 81]],
    voice: 'flute', pad: 0.43, lead: 0.115, bass: 0.075, shimmer: 0.035
  },
  {
    file: 'still-waters.wav',
    chords: [[43, 50, 55, 59, 62], [40, 47, 52, 55, 59], [41, 48, 53, 57, 60], [38, 45, 50, 53, 57], [43, 50, 55, 59, 62], [36, 43, 48, 52, 55]],
    melody: [[71, 74, 79], [71, 76, 79], [72, 76, 81], [69, 74, 77], [71, 74, 79], [72, 76, 79]],
    voice: 'strings', pad: 0.49, lead: 0.095, bass: 0.11, shimmer: 0.018
  }
];

const frequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
const smooth = value => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

function chordTone(notes, time, detune = 1) {
  let sample = 0;
  for (let index = 0; index < notes.length; index++) {
    const hz = frequency(notes[index]);
    const phase = (index % 2 ? 0.21 : 0);
    sample += Math.sin(TAU * hz * detune * time + phase);
    sample += 0.19 * Math.sin(TAU * hz * 2 * detune * time + phase * 0.7);
    sample += 0.055 * Math.sin(TAU * hz * 3 * detune * time + phase * 1.2);
  }
  return sample / (notes.length * 1.245);
}

function makeEvents(track) {
  const events = [];
  for (let bar = 0; bar < track.chords.length; bar++) {
    const notes = track.melody[bar];
    const positions = track.voice === 'piano' ? [0.35, 1.45, 2.55, 3.35]
      : track.voice === 'harp' ? [0.28, 1.08, 1.92, 2.76, 3.52]
        : track.voice === 'strings' ? [0.3, 2.3]
          : [0.45, 1.8, 3.05];
    positions.forEach((beat, index) => {
      events.push({
        start: bar * BAR_SECONDS + beat,
        duration: track.voice === 'bell' ? 1.65 : track.voice === 'organ' ? 1.25
          : track.voice === 'harp' ? 0.78 : track.voice === 'flute' ? 1.5 : track.voice === 'strings' ? 1.65 : 0.92,
        hz: frequency(notes[index % notes.length]),
        gain: track.voice === 'piano' ? (index % 2 ? 0.72 : 1) : 1,
        pan: ((index % 3) - 1) * 0.34
      });
    });
  }
  return events;
}

function leadSample(event, time, voice) {
  const age = time - event.start;
  if (age < 0 || age >= event.duration) return 0;
  if (voice === 'harp') {
    const attack = Math.min(1, age / 0.012);
    const release = smooth((event.duration - age) / 0.28);
    const pluck = Math.sin(TAU * event.hz * age)
      + 0.2 * Math.sin(TAU * event.hz * 2.01 * age + 0.04)
      + 0.055 * Math.sin(TAU * event.hz * 3.97 * age + 0.12);
    return pluck * attack * release * Math.exp(-age * 2.25) * event.gain;
  }
  if (voice === 'flute' || voice === 'strings') {
    const isFlute = voice === 'flute';
    const attack = smooth(age / (isFlute ? 0.18 : 0.42));
    const release = smooth((event.duration - age) / (isFlute ? 0.34 : 0.5));
    const vibrato = (isFlute ? 0.022 : 0.038) * Math.sin(TAU * (isFlute ? 4.6 : 5.1) * age);
    const phase = TAU * event.hz * age + vibrato;
    const tone = Math.sin(phase)
      + (isFlute ? 0.055 : 0.16) * Math.sin(phase * 2 + 0.06)
      + (isFlute ? 0.012 : 0.035) * Math.sin(phase * 3 + 0.14);
    return tone * attack * release * event.gain;
  }
  const attack = Math.min(1, age / (voice === 'organ' ? 0.07 : 0.018));
  const tail = Math.max(0, (event.duration - age) / (voice === 'bell' ? 0.6 : 0.35));
  const decay = voice === 'piano' ? Math.exp(-age * 2.15) : voice === 'bell' ? Math.exp(-age * 1.35) : 0.68 + 0.32 * Math.exp(-age * 1.4);
  const fundamental = Math.sin(TAU * event.hz * age);
  const overtone = voice === 'bell' ? 0.32 * Math.sin(TAU * event.hz * 2.72 * age) : 0.13 * Math.sin(TAU * event.hz * 2 * age);
  return (fundamental + overtone) * attack * Math.min(1, tail) * decay * event.gain;
}

function renderTrack(track) {
  const sourceFrames = SAMPLE_RATE * SOURCE_SECONDS;
  const overlapFrames = Math.round(SAMPLE_RATE * CROSSFADE_SECONDS);
  const loopFrames = sourceFrames - overlapFrames;
  const left = new Float32Array(sourceFrames);
  const right = new Float32Array(sourceFrames);
  const events = makeEvents(track);

  for (let frame = 0; frame < sourceFrames; frame++) {
    const time = frame / SAMPLE_RATE;
    const bar = Math.floor(time / BAR_SECONDS) % track.chords.length;
    const previous = (bar + track.chords.length - 1) % track.chords.length;
    const withinBar = time % BAR_SECONDS;
    const transition = smooth(withinBar / 0.62);
    const padLeft = chordTone(track.chords[previous], time, 0.9992) * (1 - transition)
      + chordTone(track.chords[bar], time, 1) * transition;
    const padRight = chordTone(track.chords[previous], time, 1.0008) * (1 - transition)
      + chordTone(track.chords[bar], time, 1.0006) * transition;
    const root = frequency(track.chords[bar][0] - 12);
    const bassEnvelope = 0.78 + 0.22 * Math.sin(TAU * time / 8);
    let melodyLeft = 0;
    let melodyRight = 0;
    for (const event of events) {
      const note = leadSample(event, time, track.voice);
      melodyLeft += note * (1 - event.pan * 0.45);
      melodyRight += note * (1 + event.pan * 0.45);
    }
    const shimmer = Math.sin(TAU * 0.11 * time) * track.shimmer;
    left[frame] = padLeft * track.pad + Math.sin(TAU * root * time) * track.bass * bassEnvelope + melodyLeft * track.lead + shimmer;
    right[frame] = padRight * track.pad + Math.sin(TAU * root * 1.0005 * time) * track.bass * bassEnvelope + melodyRight * track.lead + shimmer;
  }

  // Blend the tail into the opening so the WAV can loop without a hard seam.
  const loopLeft = new Float32Array(loopFrames);
  const loopRight = new Float32Array(loopFrames);
  for (let frame = 0; frame < loopFrames; frame++) {
    if (frame < overlapFrames) {
      const mix = smooth(frame / (overlapFrames - 1));
      loopLeft[frame] = left[sourceFrames - overlapFrames + frame] * (1 - mix) + left[frame] * mix;
      loopRight[frame] = right[sourceFrames - overlapFrames + frame] * (1 - mix) + right[frame] * mix;
    } else {
      loopLeft[frame] = left[frame];
      loopRight[frame] = right[frame];
    }
  }

  let peak = 0;
  for (let frame = 0; frame < loopFrames; frame++) peak = Math.max(peak, Math.abs(loopLeft[frame]), Math.abs(loopRight[frame]));
  const master = peak ? 0.72 / peak : 1;
  const pcm = Buffer.alloc(loopFrames * 4);
  for (let frame = 0; frame < loopFrames; frame++) {
    const l = Math.max(-1, Math.min(1, loopLeft[frame] * master));
    const r = Math.max(-1, Math.min(1, loopRight[frame] * master));
    pcm.writeInt16LE(Math.round(l * 32767), frame * 4);
    pcm.writeInt16LE(Math.round(r * 32767), frame * 4 + 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(OUTPUT_DIR, track.file), Buffer.concat([header, pcm]));
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const track of tracks) renderTrack(track);
console.log(`Generated ${tracks.length} original Christian ambient loops in ${OUTPUT_DIR}`);
