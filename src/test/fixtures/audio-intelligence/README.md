# Browser-generated Audio Intelligence golden fixture

`eyes-cut-deeper.chromium.json` is generated entirely inside Chromium from the
original audio bytes. The browser uses the same production calls as DRMVYZ:

1. `new AudioContext()`
2. `AudioContext.decodeAudioData()`
3. `analyzeTrackBuffer(audioBuffer)` with no imported seed
4. `analyzeRgbWaveform(audioBuffer)`

Node is only the launcher and file transport. It does not calculate BPM, beat
positions, downbeats, bars, sections, pitch, key, energy, spectral features,
semantic moments, structural boundaries, or RGB waveform values.

The comparison is exact UTF-8 byte equality after sorted-key JSON
canonicalization. The fixture also records the browser user agent, platform,
language, and `AudioContext` sample rate so an environment change cannot be
silently accepted. The sole excluded analysis field is
`trackAnalysis.createdAt`, because it is generated from the wall clock and is
not audio intelligence.

## Source identity

- Canonical filename: `Subtronics x Inez - Eyes Cut Deeper (DiMilans DNB Remix).wav`
- Size: `30,211,220` bytes
- SHA-256: `6da53e582ad6c3553693c897c1c8c8c960bf2da9770d7d9fda7e72570e8c5f6e`

## Generate

```bash
npm run audio:golden:generate -- \
  --audio "/absolute/path/Subtronics x Inez - Eyes Cut Deeper (DiMilans DNB Remix).wav" \
  --source-name "Subtronics x Inez - Eyes Cut Deeper (DiMilans DNB Remix).wav"
```

## Verify

```bash
npm run audio:golden:verify -- \
  --audio "/absolute/path/Subtronics x Inez - Eyes Cut Deeper (DiMilans DNB Remix).wav"
```

A different browser decoder, Chromium release, OS audio stack, or default
`AudioContext` sample rate may legitimately produce different decoded PCM and
therefore a byte mismatch. The fixture records the Chromium identity and decoded sample rate, and the
command also prints them for diagnostics.
