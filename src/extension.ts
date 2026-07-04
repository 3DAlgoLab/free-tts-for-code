import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { spawn, type ChildProcess } from "child_process";
import { sanitizeText, type FilterOptions } from "./filter.js";

let piperProcess: ChildProcess | undefined;
let playerProcess: ChildProcess | undefined;
let tmpWavPath: string | undefined;

const MAX_TEXT_LENGTH = 10000;

function getPiperPath(context: vscode.ExtensionContext): string {
	const platform = os.platform();
	const arch = os.arch();
	const extPath = context.extensionUri.fsPath;
	const binDir = path.join(extPath, "piper");

	let subdir: string;
	if (platform === "win32") subdir = "windows_amd64";
	else if (platform === "darwin")
		subdir = arch === "arm64" ? "macos_aarch64" : "macos_x64";
	else if (platform === "linux") {
		if (arch === "arm64") subdir = "linux_aarch64";
		else if (arch === "arm") subdir = "linux_armv7l";
		else subdir = "linux_x86_64";
	} else throw new Error(`Unsupported platform: ${platform}`);

	return path.join(
		binDir,
		subdir,
		platform === "win32" ? "piper.exe" : "piper",
	);
}

function getFilterOptions(): FilterOptions {
	const cfg = vscode.workspace.getConfiguration("free-tts.filter");
	return {
		normalizeWhitespace: cfg.get("normalizeWhitespace", true),
		stripCarriageReturns: cfg.get("stripCarriageReturns", true),
		stripControlChars: cfg.get("stripControlChars", true),
		stripUnicodeControl: cfg.get("stripUnicodeControl", true),
		stripEmojis: cfg.get("stripEmojis", true),
		stripCodeSymbols: cfg.get("stripCodeSymbols", false),
	};
}

function getAvailableVoices(context: vscode.ExtensionContext): string[] {
	const voicesDir = path.join(context.extensionUri.fsPath, "voices");
	try {
		return fs
			.readdirSync(voicesDir)
			.filter((f) => f.endsWith(".onnx"))
			.map((f) => f.replace(".onnx", ""));
	} catch {
		return [];
	}
}

function voiceLabel(id: string): string {
	const parts = id.split("-");
	const [locale, name] = parts;
	const quality = parts.slice(2).join("-");
	const prettyLocale = locale?.replace("_", " ");
	const prettyName = name?.replace(/_/g, " ");
	const q = quality ? ` (${quality})` : "";
	return `${prettyLocale} - ${prettyName}${q}`;
}

async function selectVoice(context: vscode.ExtensionContext): Promise<void> {
	const voices = getAvailableVoices(context);
	if (!voices.length) {
		vscode.window.showErrorMessage("No voice models found.");
		return;
	}
	const picked = await vscode.window.showQuickPick(
		voices.map((v) => ({ label: voiceLabel(v), description: v })),
		{ placeHolder: "Select a voice" },
	);
	if (picked) {
		await vscode.workspace
			.getConfiguration("free-tts")
			.update("voice", picked.description, vscode.ConfigurationTarget.Global);
	}
}

function stopPlayback(): void {
	try {
		piperProcess?.kill();
		playerProcess?.kill();
	} catch {
		/* ignore */
	}
	piperProcess = undefined;
	playerProcess = undefined;
	if (tmpWavPath) {
		try {
			fs.unlinkSync(tmpWavPath);
		} catch {
			/* ignore */
		}
		tmpWavPath = undefined;
	}
}

function isExecutable(filePath: string): boolean {
	try {
		const stats = fs.statSync(filePath);
		return (stats.mode & fs.constants.S_IXUSR) !== 0;
	} catch {
		return false;
	}
}

async function readAloud(context: vscode.ExtensionContext): Promise<void> {
	let text: string | undefined;
	const editor = vscode.window.activeTextEditor;
	if (editor) text = editor.document.getText(editor.selection);

	if (!text?.trim()) {
		vscode.window.showInformationMessage("Select some text to read aloud.");
		return;
	}

	stopPlayback();

	const filtered = sanitizeText(text, getFilterOptions());

	if (filtered.length > MAX_TEXT_LENGTH) {
		vscode.window.showWarningMessage(
			`Text too long (${filtered.length} chars). Only first ${MAX_TEXT_LENGTH} chars will be read.`,
		);
	}

	const voice = vscode.workspace
		.getConfiguration("free-tts")
		.get<string>("voice", "en_US-hfc_female-medium");
	const voicePath = path.join(
		context.extensionUri.fsPath,
		"voices",
		`${voice}.onnx`,
	);

	let piperPath: string;
	try {
		piperPath = getPiperPath(context);
	} catch (e) {
		vscode.window.showErrorMessage((e as Error).message);
		return;
	}

	if (!fs.existsSync(piperPath)) {
		vscode.window.showErrorMessage(
			"Piper binary not found. Check installation.",
		);
		return;
	}
	if (!fs.existsSync(voicePath)) {
		vscode.window.showErrorMessage(`Voice model "${voice}" not found.`);
		return;
	}

	const platform = os.platform();
	const isWindows = platform === "win32";

	if (isWindows) {
		tmpWavPath = path.join(os.tmpdir(), `free-tts-${Date.now()}.wav`);
		const piper = spawn(
			piperPath,
			["--model", voicePath, "--output-file", tmpWavPath],
			{ cwd: path.dirname(piperPath), windowsHide: true },
		);
		piperProcess = piper;

		piper.stdin.write(filtered.slice(0, MAX_TEXT_LENGTH));
		piper.stdin.end();

		piper.on("close", (code) => {
			if (code !== 0) {
				vscode.window.showErrorMessage(`Piper exited with code ${code}`);
				stopPlayback();
				return;
			}
			if (tmpWavPath && fs.existsSync(tmpWavPath)) {
				const player = spawn("powershell", [
					"-Command",
					`(New-Object Media.SoundPlayer '${tmpWavPath}').SyncPlay()`,
				]);
				playerProcess = player;
			}
		});

		piper.on("error", (e) => {
			vscode.window.showErrorMessage(`Piper error: ${e.message}`);
			stopPlayback();
		});
	} else {
		const playerCmd =
			platform === "darwin"
				? { command: "afplay", args: ["-"] }
				: {
						command: "aplay",
						args: ["-r", "22050", "-f", "S16_LE", "-t", "raw", "-"],
					};

		const piper = spawn(piperPath, ["--model", voicePath, "--output-raw"], {
			cwd: path.dirname(piperPath),
		});
		const player = spawn(playerCmd.command, playerCmd.args);
		piperProcess = piper;
		playerProcess = player;

		piper.stdout.pipe(player.stdin);
		piper.stdin.write(filtered.slice(0, MAX_TEXT_LENGTH));
		piper.stdin.end();

		piper.on("close", () => player.stdin?.end());
		piper.on("error", (e) => {
			vscode.window.showErrorMessage(`Piper error: ${e.message}`);
			stopPlayback();
		});
		player.on("error", (e) => {
			vscode.window.showErrorMessage(`Playback error: ${e.message}`);
			stopPlayback();
		});
	}
}

async function downloadAssets(context: vscode.ExtensionContext): Promise<void> {
	const scriptsDir = path.join(context.extensionUri.fsPath, "scripts");
	const scriptPath = path.join(scriptsDir, "download-assets.js");
	if (!fs.existsSync(scriptPath)) {
		vscode.window.showErrorMessage(
			"download-assets.js not found. Please run `node scripts/download-assets.js` manually.",
		);
		return;
	}

	const progress = await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: "Downloading Free TTS assets...",
			cancellable: true,
		},
		async (_prog, token) => {
			return new Promise<void>((resolve, reject) => {
				const child = spawn("node", [scriptPath], {
					cwd: context.extensionUri.fsPath,
					windowsHide: true,
				});
				token.onCancellationRequested(() => {
					child.kill();
					reject(new Error("Cancelled"));
				});
				child.on("close", (code) => {
					if (code === 0) resolve();
					else reject(new Error(`Exit code ${code}`));
				});
				child.on("error", reject);
			});
		},
	);

	try {
		await progress;
		vscode.window.showInformationMessage("Free TTS assets downloaded!");
	} catch (e) {
		const msg =
			(e as Error).message === "Cancelled"
				? "Download cancelled."
				: `Download failed: ${(e as Error).message}`;
		vscode.window.showErrorMessage(msg);
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("free-tts.readAloud", () =>
			readAloud(context),
		),
		vscode.commands.registerCommand("free-tts.stopPlayback", stopPlayback),
		vscode.commands.registerCommand("free-tts.selectVoice", () =>
			selectVoice(context),
		),
	);

	// Set execute permissions on Linux/macOS
	if (os.platform() === "linux" || os.platform() === "darwin") {
		try {
			const piperPath = getPiperPath(context);
			if (!isExecutable(piperPath)) fs.chmodSync(piperPath, 0o755);
			const binDir = path.dirname(piperPath);
			for (const bin of ["espeak-ng", "piper_phonemize"]) {
				const bp = path.join(binDir, bin);
				if (fs.existsSync(bp) && !isExecutable(bp)) fs.chmodSync(bp, 0o755);
			}
		} catch {
			/* ignore */
		}
	}

	// Auto-download assets on first run
	try {
		const piperPath = getPiperPath(context);
		const voicesDir = path.join(context.extensionUri.fsPath, "voices");
		const hasPiper = fs.existsSync(piperPath);
		const hasVoices =
			fs.existsSync(voicesDir) &&
			fs.readdirSync(voicesDir).some((f) => f.endsWith(".onnx"));

		if (!hasPiper || !hasVoices) {
			downloadAssets(context);
		}
	} catch {
		/* ignore startup checks */
	}
}

export function deactivate() {
	stopPlayback();
}
