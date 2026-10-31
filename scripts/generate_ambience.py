"""Generate six original, loopable ambient soundscapes. Requires numpy only."""
from pathlib import Path
import wave
import numpy as np

RATE, SECONDS = 24000, 48
OUT = Path(__file__).resolve().parents[1] / 'public/assets/music'

def generate(name, index):
    rng = np.random.default_rng(731 + index)
    t = np.arange(RATE * SECONDS, dtype=np.float64) / RATE
    roots = [130.81, 146.83, 164.81, 174.61, 110.0, 196.0]
    root = roots[index]
    sound = np.zeros_like(t)
    for i, ratio in enumerate([1, 1.5, 2, 2.5]):
        frequency = round(root * ratio * SECONDS) / SECONDS
        envelope = .55 + .45 * np.sin(2*np.pi*(i+1)*t/SECONDS + index)**2
        sound += .07/(i+1) * envelope * np.sin(2*np.pi*frequency*t + .18*np.sin(2*np.pi*t/SECONDS))
    # Different pentatonic bell / flute phrases for each scene.
    notes = [0, 2, 4, 7, 9, 12]
    for start in range(2, SECONDS-6, 5 if index % 2 else 7):
        local = np.maximum(0, t-start)
        frequency = root * 2**(notes[int(rng.integers(0, 6))]/12 + 1)
        envelope = (1-np.exp(-local*3))*np.exp(-local/(1.5+index*.25))*(t >= start)
        sound += .09*envelope*(np.sin(2*np.pi*frequency*local)+.15*np.sin(2*np.pi*frequency*2.01*local))
    if index in [1, 2, 3]:
        noise = rng.normal(size=t.size)
        bins = np.fft.rfftfreq(t.size, 1/RATE)
        spectrum = np.fft.rfft(noise)
        spectrum *= 1 / np.sqrt(np.maximum(bins, 80))
        spectrum *= np.exp(-bins/(2500 if index == 1 else 800))
        bed = np.fft.irfft(spectrum, n=t.size)
        bed /= np.max(np.abs(bed))
        sound += bed * [.0, .11, .16, .05][index] * (.7+.3*np.sin(2*np.pi*t/12)**2)
    fade = np.minimum(np.minimum(t/2, (SECONDS-t)/2), 1).clip(0, 1)
    sound *= fade
    sound *= .55 / max(.55, float(np.max(np.abs(sound))))
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as file:
        file.setnchannels(1); file.setsampwidth(2); file.setframerate(RATE)
        file.writeframes((sound*32767).astype('<i2').tobytes())
    print(name, '48 seconds')

if __name__ == '__main__':
    for i, name in enumerate(['lotus', 'rain', 'stream', 'bamboo', 'night', 'dawn']):
        generate(name, i)
    t = np.arange(int(RATE*.48))/RATE
    rng = np.random.default_rng(928)
    wood = sum(a*np.sin(2*np.pi*f*t)*np.exp(-t/d) for f,a,d in [(480,.55,.09),(817,.4,.065),(1290,.24,.045),(2310,.13,.025)])
    wood += rng.normal(size=t.size)*np.exp(-t/.009)*.18
    wood *= np.minimum(t/.0015,1)
    wood *= .8/max(.8,float(np.max(np.abs(wood))))
    with wave.open(str(OUT/'wooden-fish.wav'),'wb') as file:
        file.setnchannels(1);file.setsampwidth(2);file.setframerate(RATE)
        file.writeframes((wood*32767).astype('<i2').tobytes())
