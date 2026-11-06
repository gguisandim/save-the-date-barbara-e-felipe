"""Generate a subtle ocean / far-away gull ambience without third-party recordings.

Requirements outside the Next.js app: numpy, scipy and ffmpeg.
Use: python scripts/generate_ambience.py

Sound design: soft rolling shore swells (not aggressive foam), sparse far-off gull
calls, gentle stereo field, seamless looping, and -15 dBFS master peak so mobile
browsers that ignore audio.volume cannot play it at an intrusive level.
"""
from pathlib import Path
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt, resample_poly

OUT = Path(__file__).resolve().parents[1] / 'public/media/brisa-e-gaivotas.mp3'
SR = 24000
DURATION = 54
N = SR * DURATION
rng = np.random.default_rng(214071)
t = np.arange(N, dtype=np.float32) / SR


def colored_noise(lo, hi, *, order=2):
    source = rng.standard_normal(N).astype(np.float32)
    sos = butter(order, [lo, hi], btype='bandpass', fs=SR, output='sos')
    filtered = sosfilt(sos, source).astype(np.float32)
    return filtered / max(np.std(filtered), 1e-6)


# Non-periodic wave swells. Mostly mid/low texture; virtually no abrasive hiss
# or resonant 'conch-shell' sound. Each crest expands and then eases away.
wave_body = colored_noise(145, 820)
wave_air = colored_noise(500, 2700)
low_breeze = colored_noise(115, 480)
left = np.zeros(N, dtype=np.float32)
right = np.zeros(N, dtype=np.float32)

surge = np.zeros(N, dtype=np.float32)
crest = np.zeros(N, dtype=np.float32)
for onset, strength in [
    (-4, .5), (2.7, .55), (10.2, .67), (17.8, .52),
    (25.4, .64), (32.8, .58), (40.4, .56), (48.1, .62), (55.4, .56)
]:
    s = (t - onset).astype(np.float32)
    # Rounded, slowly fading swell; no 'crashing' transients.
    surge += strength * np.exp(-0.5 * ((s - 1.5) / 2.8)**2)
    crest += strength * np.exp(-0.5 * ((s - 2.35) / 1.75)**2)

# Deliberately low amplitude: a distant beach, not a wave breaking at the mic.
sea = (.027 + .041 * surge) * wave_body + (.0028 + .009 * crest) * wave_air
breeze = (.011 + .003 * np.sin(t * .18 + .7)) * low_breeze
left += sea + breeze
right += np.roll(sea, int(.011 * SR)) * .96 + np.roll(breeze, int(.031 * SR)) * .9


def gull_call(position, *, gain=.041, pan=-.25, pitch=1.0, variant=0):
    """Soft distant gull cry: formant-rich nonstationary harmonic glissando.

    Two non-identical syllables and breath/voice flutter keep it from sounding
    like a pure electronic chirp. Sparse placement is intentional.
    """
    length = 1.65 if variant == 0 else 1.42
    count = int(length * SR)
    q = np.arange(count, dtype=np.float32) / SR
    if variant == 0:
        # rising 'kyee' falling 'ah', with a brief pause
        freq = np.interp(q, [0, .11, .32, .49, .68, 1.0, 1.29, length],
                         [590, 720, 970, 790, 640, 870, 590, 520])
        env = (np.maximum(0, np.sin(np.pi * np.clip(q/.77, 0, 1)))**1.65 * (q < .77) +
               .62 * np.maximum(0, np.sin(np.pi * np.clip((q-.78)/(.65), 0, 1)))**1.5 * (q > .78))
    else:
        freq = np.interp(q, [0, .08, .24, .40, .62, .91, 1.15, length],
                         [680, 860, 1030, 820, 720, 840, 620, 580])
        env = (np.maximum(0, np.sin(np.pi * np.clip(q/.62,0,1)))**1.6 * (q < .62) +
               .55 * np.maximum(0, np.sin(np.pi * np.clip((q-.67)/(.68),0,1)))**1.65 * (q > .67))
    wobble = (1 + .009*np.sin(2*np.pi*15*q) + .004*np.sin(2*np.pi*22*q + .9))
    phase = 2*np.pi*np.cumsum(freq * pitch * wobble) / SR
    harmonic = np.sin(phase) + .31*np.sin(2*phase + .4) + .12*np.sin(3*phase + 1.3)
    # Slight pulsed raspy voice quality, diffuse when distant.
    vocal = harmonic * env * (1 + .1 * np.sin(2*np.pi*34*q))
    # Roll off brightness: sea birds sound far away, not directly overhead.
    sos = butter(2, 1650, btype='lowpass', fs=SR, output='sos')
    vocal = sosfilt(sos, vocal).astype(np.float32)
    # Subtle echo spreads the cry into the atmosphere without obvious reverb.
    delay = int(.19 * SR)
    voice = vocal.copy()
    voice[delay:] += .18 * vocal[:-delay]
    start = int(position * SR)
    if 0 <= start < N:
        end = min(N, start + len(voice))
        segment = voice[:end-start] * gain
        lp = np.sqrt((1 - pan) / 2)
        rp = np.sqrt((1 + pan) / 2)
        left[start:end] += lp*segment
        right[start:end] += rp*segment


# Natural distance: birds heard occasionally, never competing with the words.
for call in [
    (5.6, .041, -.42, .92, 0),
    (7.1, .023, -.35, 1.04, 1),
    (19.9, .034, .55, .98, 1),
    (34.4, .045, -.22, .91, 0),
    (36.3, .020, .18, 1.12, 1),
    (46.0, .033, .46, 1.02, 0)
]:
    gull_call(call[0], gain=call[1], pan=call[2], pitch=call[3], variant=call[4])

# Broad but delicate stereo; no sub-bass, and no sharp frequencies above 5k.
for channel in [left, right]:
    channel[:] = sosfilt(butter(2, [100, 4200], fs=SR, btype='bandpass', output='sos'), channel)

# Create a transparent seamless wrap with a short crossfade. Keep birds away
# from the seam. This avoids abrupt change when an HTMLAudioElement loops.
x = np.stack([left, right], axis=1)
fade_n = int(2.5*SR)
start = x[:fade_n].copy()
finish = x[-fade_n:].copy()
u = np.linspace(0, 1, fade_n, dtype=np.float32)
u = u*u*(3 - 2*u)
# Blend the tail into a reversed copy of the head: the final sample equals
# the very first sample, while changes remain inconspicuous in soft noise.
x[-fade_n:] = finish * (1-u[:, None]) + start[::-1] * u[:, None]

# Normalize to a deliberately soft ceiling. Even if Safari ignores the player
# volume property, the source itself cannot blast at full scale.
peak = np.max(np.abs(x))
x *= min(1.0, .18 / max(peak, 1e-9))
pcm = np.clip(x*32767, -32768, 32767).astype(np.int16)

proc = subprocess.Popen([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0',
    '-c:a', 'libmp3lame', '-b:a', '96k', '-ar', '24000', str(OUT)
], stdin=subprocess.PIPE)
assert proc.stdin
proc.stdin.write(pcm.tobytes())
proc.stdin.close()
if proc.wait():
    raise RuntimeError('ffmpeg failed while encoding audio')
print(f'{OUT} / {DURATION}s / {OUT.stat().st_size//1024} KB / peak={np.max(abs(x)):.3f}, RMS={np.sqrt(np.mean(x**2)):.3f}')
