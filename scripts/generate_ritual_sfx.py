"""Generate original temple-bell and fortune-stick sounds with NumPy only."""
from pathlib import Path
import wave
import numpy as np

RATE = 24000
OUT = Path(__file__).resolve().parents[1] / "public/assets/music"


def save_stereo(name: str, samples: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    peak = float(np.max(np.abs(samples)))
    if peak > 0:
        samples = samples * min(1.0, 0.82 / peak)
    pcm = np.clip(samples * 32767, -32768, 32767).astype("<i2")
    with wave.open(str(OUT / name), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())


def make_temple_bell() -> None:
    duration = 5.6
    t = np.arange(round(RATE * duration), dtype=np.float64) / RATE
    dry = np.zeros_like(t)

    # Bronze bells have bright partials that ring at different rates.
    modes = [
        (108.7, .31, 3.2, .11), (164.3, .17, 2.8, .23),
        (219.6, .27, 3.6, .34), (286.2, .23, 2.6, .46),
        (328.8, .39, 4.2, .17), (438.1, .30, 3.5, .28),
        (572.7, .22, 2.4, .42), (658.4, .20, 2.8, .15),
        (876.3, .14, 1.9, .39), (1098.2, .10, 1.55, .22),
        (1436.0, .065, 1.15, .33), (1811.0, .04, .85, .47),
    ]
    rng = np.random.default_rng(4128)
    for frequency, amplitude, decay, pan in modes:
        phase = rng.uniform(-np.pi, np.pi)
        beat = .66 * np.sin(2 * np.pi * (frequency + .63) * t + phase)
        beat += .34 * np.sin(2 * np.pi * (frequency - .91) * t + phase * .61)
        onset = 1 - np.exp(-t * 95)
        dry += amplitude * onset * np.exp(-t / decay) * beat

    # A soft mallet contact and low body make the strike feel physical.
    mallet = rng.normal(size=t.size) * np.exp(-t / .008)
    mallet *= .055
    dry += mallet
    dry += .13 * np.sin(2 * np.pi * 86 * t) * np.exp(-t / .19)
    dry *= np.minimum(t / .0015, 1)

    # Sparse, warm room reflections widen the tail without a metallic echo.
    tail_len = RATE
    ir_l = np.zeros(tail_len)
    ir_r = np.zeros(tail_len)
    ir_l[0] = ir_r[0] = .84
    delays = np.arange(round(RATE * .018), tail_len, round(RATE * .026))
    for delay in delays:
        envelope = .20 * np.exp(-delay / (RATE * .34))
        ir_l[delay] = envelope * rng.uniform(-.8, .8)
        offset = min(tail_len - 1, delay + round(RATE * .009))
        ir_r[offset] += envelope * rng.uniform(-.8, .8)

    size = 1 << (len(dry) + tail_len - 2).bit_length()
    spectrum = np.fft.rfft(dry, size)
    left = np.fft.irfft(spectrum * np.fft.rfft(ir_l, size), size)[:len(t)]
    right = np.fft.irfft(spectrum * np.fft.rfft(ir_r, size), size)[:len(t)]
    left = .82 * dry + .42 * left
    right = .82 * dry + .42 * right
    stereo = np.column_stack((left, right))
    fade = np.minimum(1, np.maximum(0, (duration - t) / .30))
    stereo *= fade[:, None]
    save_stereo("temple-bell.wav", stereo)


def add_wood_tap(sound: np.ndarray, start: float, strength: float, rng: np.random.Generator) -> None:
    first = round(start * RATE)
    length = min(round(RATE * .105), len(sound) - first)
    if length <= 0:
        return
    t = np.arange(length, dtype=np.float64) / RATE
    frequencies = [336 * rng.uniform(.96, 1.04), 608 * rng.uniform(.95, 1.05), 947 * rng.uniform(.94, 1.06)]
    partials = np.zeros(length)
    for index, frequency in enumerate(frequencies):
        partials += [1, .47, .22][index] * np.sin(2 * np.pi * frequency * t + rng.uniform(-.2, .2))
    envelope = np.exp(-t / rng.uniform(.023, .044))
    transient = rng.normal(size=length) * np.exp(-t / .0018) * .32
    sound[first:first + length] += strength * (partials * envelope * .19 + transient)


def make_fortune_shake() -> None:
    duration = 2.35
    t = np.arange(round(RATE * duration), dtype=np.float64) / RATE
    rng = np.random.default_rng(8153)
    noise = rng.normal(size=t.size)
    frequencies = np.fft.rfftfreq(t.size, 1 / RATE)
    spectrum = np.fft.rfft(noise)
    spectrum *= np.exp(-frequencies / 4600) / np.sqrt(np.maximum(frequencies, 85))
    airy_rattle = np.fft.irfft(spectrum, n=t.size)
    airy_rattle /= max(.0001, float(np.max(np.abs(airy_rattle))))

    movement = (.45 + .55 * np.sin(2 * np.pi * 3.2 * t + .55) ** 2)
    movement *= np.clip(t / .035, 0, 1) * np.clip((duration - t) / .17, 0, 1)
    sound = .16 * airy_rattle * movement
    sound += .025 * np.sin(2 * np.pi * 127 * t) * movement

    tap_times = [.035, .20, .32, .51, .64, .82, .94, 1.11, 1.25, 1.43, 1.56, 1.72, 1.88, 2.035]
    for index, start in enumerate(tap_times):
        pulse = .60 if index in (2, 6, 10) else .38
        if index == len(tap_times) - 1:
            pulse = .72
        add_wood_tap(sound, start, pulse * rng.uniform(.82, 1.12), rng)

    # The final contact has a short hollow cup resonance and settles quietly.
    finish = 2.06
    offset = round(finish * RATE)
    tail = t[offset:]
    sound[offset:] += .15 * np.sin(2 * np.pi * 438 * tail) * np.exp(-tail / .16)
    fade = np.minimum(np.clip(t / .02, 0, 1), np.clip((duration - t) / .15, 0, 1))
    sound *= fade
    pan = .5 + .19 * np.sin(2 * np.pi * .7 * t + .4)
    stereo = np.column_stack((sound * (1 - pan), sound * pan))
    save_stereo("fortune-shake.wav", stereo)


def make_wooden_fish() -> None:
    """A short, warm, hollow temple-block strike with a soft mallet attack."""
    duration = .72
    t = np.arange(round(RATE * duration), dtype=np.float64) / RATE
    rng = np.random.default_rng(2718)
    sound = np.zeros_like(t)

    # Slightly detuned wooden resonances make the body ring without a pitched synth feel.
    modes = [
        (238, .30, .19), (319, .42, .16), (486, .27, .12),
        (672, .16, .085), (918, .075, .055), (1260, .035, .038),
    ]
    for frequency, amplitude, decay in modes:
        phase = rng.uniform(-np.pi, np.pi)
        detune = rng.uniform(.7, 2.0)
        component = np.sin(2 * np.pi * frequency * t + phase)
        component += .22 * np.sin(2 * np.pi * (frequency + detune) * t + phase * .73)
        sound += amplitude * component * np.exp(-t / decay)

    mallet = rng.normal(size=t.size) * np.exp(-t / .0015)
    sound += .105 * mallet
    sound += .10 * np.sin(2 * np.pi * 138 * t) * np.exp(-t / .045)

    # A small, delayed body reflection adds depth while keeping the hit dry enough for speech.
    echo_start = round(.052 * RATE)
    echo_t = t[:len(t) - echo_start]
    sound[echo_start:] += .105 * sound[:len(echo_t)] * np.exp(-echo_t / .18)
    sound *= np.clip(t / .0012, 0, 1) * np.clip((duration - t) / .12, 0, 1)
    sound = np.tanh(sound * 1.4)
    pan = .5 + .06 * np.sin(2 * np.pi * .9 * t)
    stereo = np.column_stack((sound * (1 - pan), sound * pan))
    save_stereo("wooden-fish.wav", stereo)


if __name__ == "__main__":
    make_temple_bell()
    make_fortune_shake()
    make_wooden_fish()
    print("Generated temple-bell.wav (5.6s), fortune-shake.wav (2.35s), and wooden-fish.wav (0.72s)")
