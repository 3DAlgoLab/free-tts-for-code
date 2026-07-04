#!/usr/bin/env node
/**
 * Download script for Free TTS for Code.
 * Grabs Piper binaries, voice models, and Windows Sox player.
 *
 * Usage:
 *   node scripts/download-assets.js                          # defaults
 *   node scripts/download-assets.js en_US-hfc_female-medium  # specific voice
 *   node scripts/download-assets.js en_US-hfc_female-medium fr_FR-upstream-medium  # multiple
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLATFORM = os.platform();
const arch = os.arch();

function piperPlatform() {
	if (PLATFORM === "win32") return "windows_amd64";
	if (PLATFORM === "darwin")
		return arch === "arm64" ? "macos_aarch64" : "macos_x64";
	if (arch === "arm64") return "linux_aarch64";
	if (arch === "arm") return "linux_armv7l";
	return "linux_x86_64";
}

function localDir() {
	const pp = piperPlatform();
	if (pp.startsWith("windows")) return "windows_amd64";
	if (pp === "macos_aarch64") return "macos_aarch64";
	if (pp === "macos_x64") return "macos_x64";
	if (pp === "linux_aarch64") return "linux_aarch64";
	if (pp === "linux_armv7l") return "linux_armv7l";
	return "linux_x86_64";
}

async function download(url, dest) {
	console.log(`↓ ${url}`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
	const buf = await res.arrayBuffer();
	fs.writeFileSync(dest, Buffer.from(buf));
	console.log(`  → ${dest} (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

function extractArchive(archive, destDir) {
	fs.mkdirSync(destDir, { recursive: true });
	console.log(`↕ extracting to ${destDir}`);

	const cmd =
		PLATFORM === "win32"
			? `powershell -Command "Expand-Archive -Force '${archive}' '${destDir}'"`
			: archive.endsWith(".tar.gz") || archive.endsWith(".tgz")
				? `tar xzf "${archive}" -C "${destDir}"`
				: archive.endsWith(".zip")
					? `unzip -o "${archive}" -d "${destDir}"`
					: null;

	if (!cmd) throw new Error(`Unknown archive: ${archive}`);

	try {
		execSync(cmd, { stdio: "inherit" });
	} catch (e) {
		throw new Error(`Failed to extract: ${e}`);
	}
	fs.unlinkSync(archive);
}

function copyAcrossDevices(src, dest) {
	fs.copyFileSync(src, dest);
	fs.unlinkSync(src);
}

const PIPER_VERSION = "2023.11.14-2";

function piperUrl(pp) {
	const ext = PLATFORM === "win32" ? "zip" : "tar.gz";
	return `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_${pp}.${ext}`;
}

const VOICES = {
	"en_US-hfc_female-medium": {
		url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx",
		config:
			"https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json",
	},
	"en_US-hfc_male-medium": {
		url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx",
		config:
			"https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx.json",
	},
	"en_GB-semaine-medium": {
		url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/semaine/medium/en_GB-semaine-medium.onnx",
		config:
			"https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/semaine/medium/en_GB-semaine-medium.onnx.json",
	},
	"fr_FR-upstream-medium": {
		url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_UP/upstream/medium/fr_FR-upstream-medium.onnx",
		config:
			"https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_UP/upstream/medium/fr_FR-upstream-medium.onnx.json",
	},
	"ko_KR-ksspeaking_medium-medium": {
		url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/ko/ko_KR/ksspeaking_medium/medium/ko_KR-ksspeaking_medium-medium.onnx",
		config:
			"https://huggingface.co/rhasspy/piper-voices/resolve/main/ko/ko_KR/ksspeaking_medium/medium/ko_KR-ksspeaking_medium-medium.onnx.json",
	},
};

async function main() {
	const requestedVoices = process.argv.slice(2);
	const voicesToDownload = requestedVoices.length
		? requestedVoices
		: ["en_US-hfc_female-medium"];

	for (const v of voicesToDownload) {
		if (!(v in VOICES)) {
			console.error(`Unknown voice: ${v}`);
			console.error(`Available: ${Object.keys(VOICES).join(", ")}`);
			process.exit(1);
		}
	}

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "free-tts-"));

	try {
		/* 1. Piper binary */
		console.log("\n=== Piper TTS ===");
		const pp = piperPlatform();
		const ext = PLATFORM === "win32" ? "zip" : "tar.gz";
		const piperArchive = path.join(tmp, `piper_${pp}.${ext}`);
		await download(piperUrl(pp), piperArchive);

		const extractDir = path.join(tmp, "piper_extract");
		extractArchive(piperArchive, extractDir);

		const binDest = path.join(ROOT, "piper", localDir());
		fs.mkdirSync(binDest, { recursive: true });

		function walk(dir) {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (
					entry.isFile() &&
					/^piper(\.exe)?$|^espeak-ng|^espeak-ng\.dll|^piper_phonemize|^piper_phonemize\.dll$/.test(
						entry.name,
					)
				) {
					console.log(`  → ${entry.name}`);
					fs.copyFileSync(full, path.join(binDest, entry.name));
				}
			}
		}
		walk(extractDir);

		if (PLATFORM !== "win32") {
			for (const bin of ["piper", "espeak-ng", "piper_phonemize"]) {
				const bp = path.join(binDest, bin);
				if (fs.existsSync(bp)) fs.chmodSync(bp, 0o755);
			}
		}

		/* 2. Voice models */
		console.log("\n=== Voice Models ===");
		const voicesDir = path.join(ROOT, "voices");
		fs.mkdirSync(voicesDir, { recursive: true });

		for (const voiceId of voicesToDownload) {
			const voice = VOICES[voiceId];
			const onnxPath = path.join(voicesDir, `${voiceId}.onnx`);
			if (fs.existsSync(onnxPath)) {
				console.log(`  ⊘ ${voiceId} (already exists)`);
				continue;
			}
			await download(voice.url, path.join(tmp, "model.onnx"));
			copyAcrossDevices(path.join(tmp, "model.onnx"), onnxPath);
			console.log(`  → ${voiceId}`);

			await download(voice.config, path.join(tmp, "config.json"));
			copyAcrossDevices(
				path.join(tmp, "config.json"),
				path.join(voicesDir, `${voiceId}.json`),
			);
		}

		console.log("\n✓ Done!");
		console.log(`Platform: ${pp}`);
		console.log(`Binaries: piper/${localDir()}/`);
		console.log(`Voices: ${voicesToDownload.join(", ")}`);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
