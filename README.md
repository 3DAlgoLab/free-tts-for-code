# Free TTS for Code

Local text-to-speech for VS Code using [Piper](https://github.com/rhasspy/piper). Reads your code aloud — no cloud services, no API keys, fully offline.

Built on [Piper_TTS](https://github.com/heyseth/Piper_TTS) with improved text filtering, easier setup, and a more robust codebase.

## Features

- **Read Aloud** — Select text in your editor and hear it spoken naturally
- **Voice Selection** — Pick from multiple voices and languages
- **Smart Text Filtering** — Strips non-readable characters, emojis, control codes, and optionally code symbols before synthesis
- **Custom Filters** — Add your own regex patterns to strip or transform text (e.g. unwrap `**bold**` → `bold`) before speaking
- **One-Click Setup** — Download TTS engine and voices directly from the VS Code command palette
- **Fully Offline** — Everything runs locally on your machine
- **Cross-Platform** — Windows, macOS, and Linux
## Quick Start

### 1. Install

**From VSIX:** Extensions → ⋯ → Install from VSIX → select `free-tts-for-code-0.1.10.vsix`

**From source:**

```bash
npm install
```

### 2. Download Assets

**From Command Palette:** `Ctrl+Shift+P` → "Free TTS: Download Engine & Voices"

**Or from script:**

```bash
node scripts/download-assets.js
```

The extension will prompt you to download assets on first run. Or run manually:

**Available voices:**

| Voice | Language | Description |
| ----- | -------- | ----------- |
| `en_US-hfc_female-medium` | English (US) | Female, medium quality |
| `en_US-hfc_male-medium` | English (US) | Male, medium quality |
| `en_GB-semaine-medium` | English (UK) | Female, medium quality |
| `fr_FR-upstream-medium` | French | Upstream voice, medium quality |
| `ko_KR-ksspeaking_medium-medium` | Korean | KS Speaking, medium quality |

Add more anytime:

```bash
node scripts/download-assets.js fr_FR-upstream-medium ko_KR-ksspeaking_medium-medium
```

### 3. Use It

1. **Select text** in your editor
2. **Right-click** → "Free TTS: Read Aloud" (or `Ctrl+Shift+P` → "Free TTS: Read Aloud")
3. **Change voice:** `Ctrl+Shift+P` → "Free TTS: Select Voice"
4. **Stop playback:** Right-click → "Free TTS: Stop Reading"

## Configuration

Open Settings (`Ctrl+,`) and search for "Free TTS":

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `free-tts.voice` | `en_US-hfc_female-medium` | Active voice model |
| `free-tts.filter.normalizeWhitespace` | `true` | Collapse multiple whitespace to single space |
| `free-tts.filter.stripCarriageReturns` | `true` | Replace `\r` with space |
| `free-tts.filter.stripControlChars` | `true` | Remove ASCII control characters (except `\t`, `\n`) |
| `free-tts.filter.stripUnicodeControl` | `true` | Remove Unicode format/control characters (ZWS, BOM, etc.) |
| `free-tts.filter.stripEmojis` | `true` | Remove emoji characters |
| `free-tts.filter.stripCodeSymbols` | `false` | Remove `/*`, `*/`, `//`, `{}`, `()`, `<>` |
| `free-tts.filter.customPatterns` | `[]` | Custom regex patterns (e.g. `['\\*\\*(.+?)\\*\\*:$1']` to unwrap **bold**) |
1. You select text in the editor
2. Text passes through the **filter pipeline** (`src/filter.ts`) — strips non-speakable characters
3. **Piper TTS engine** synthesizes speech from filtered text
4. Audio plays through your system's default player:
   - **Windows**: PowerShell SoundPlayer (plays WAV directly)
   - **macOS**: `afplay` (pipes raw PCM)
   - **Linux**: `aplay` (pipes raw PCM)

## Project Structure

```
free-tts-for-code/
├── src/
│   ├── extension.ts    # VS Code extension entry point
│   └── filter.ts       # Text sanitization module
├── test/
│   └── preprocess.test.ts  # 64 unit tests
├── scripts/
│   └── download-assets.js  # Asset downloader
├── piper/              # Piper TTS binaries (downloaded)
├── voices/             # Voice models (downloaded)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run watch

# Package as VSIX
npx @vscode/vsce package
```

### Adding New Voices

Edit `scripts/download-assets.js` and add an entry to the `VOICES` object:

```javascript
"ja_JP-nitech-medium": {
  url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/ja/ja_JP/nitech/medium/ja_JP-nitech-medium.onnx",
  config: "https://huggingface.co/rhasspy/piper-voices/resolve/main/ja/ja_JP/nitech/medium/ja_JP-nitech-medium.onnx.json",
},
```

Find available voices on [HuggingFace](https://huggingface.co/rhasspy/piper-voices).

## Requirements

- **VS Code** 1.125.0+
- **Node.js** 20+
- **Platform players:**
  - Windows: Built-in (PowerShell)
  - macOS: Built-in (`afplay`)
  - Linux: `aplay` (usually pre-installed)

## License

MIT
