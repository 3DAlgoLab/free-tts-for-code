import assert from "node:assert";
import { sanitizeText, type FilterOptions } from "../src/filter";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
const failures: Array<{ name: string; message: string }> = [];

function test(name: string, fn: () => void) {
	try {
		fn();
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (err: any) {
		failed++;
		failures.push({ name, message: err.message ?? String(err) });
		console.error(`  ✗ ${name}`);
		console.error(`    ${err.message ?? String(err)}`);
	}
}

/* ------------------------------------------------------------------ */
/* Default options                                                     */
/* ------------------------------------------------------------------ */

const defaultOpts: FilterOptions = {
	normalizeWhitespace: true,
	stripCarriageReturns: true,
	stripControlChars: true,
	stripUnicodeControl: true,
	stripEmojis: true,
	stripCodeSymbols: false,
};

/* ------------------------------------------------------------------ */
/* 15 test cases                                                       */
/* ------------------------------------------------------------------ */

export function run() {
	console.log("sanitizeText tests\n");

	// 1. Plain text passes through unchanged
	test("plain text passes through unchanged", () => {
		const result = sanitizeText("Hello world, this is a test.");
		assert.strictEqual(result, "Hello world, this is a test.");
	});

	// 2. \r → space when stripCarriageReturns is true
	test("\\r converted to space when stripCarriageReturns is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello\r\rWorld", opts);
		// \r → space, normalizeWhitespace collapses → "Hello World"
		assert.strictEqual(result, "Hello World");
	});

	// \r not stripped when stripCarriageReturns is false (becomes space via normalizeWhitespace)
	test("\\r becomes space when stripCarriageReturns is false", () => {
		const opts = { ...defaultOpts, stripCarriageReturns: false };
		const result = sanitizeText("Hel\rlo", opts);
		// \r not stripped but normalizeWhitespace collapses it to space
		assert.strictEqual(result, "Hel lo");
	});

	// 3. Multiple consecutive whitespace collapsed to single space
	test("multiple whitespace collapsed when normalizeWhitespace is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello   world\n\n  test", opts);
		assert.strictEqual(result, "Hello world test");
	});

	test("multiple spaces collapsed to single space", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello   world", opts);
		assert.strictEqual(result, "Hello world");
	});

	test("tabs and newlines normalized with normalizeWhitespace", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello\n\n\nWorld", opts);
		assert.strictEqual(result, "Hello World");
	});

	test("normalizeWhitespace off preserves original spacing", () => {
		const opts = { ...defaultOpts, normalizeWhitespace: false };
		const result = sanitizeText("Hello   world", opts);
		assert.strictEqual(result, "Hello   world");
	});

	// 4. Control chars stripped
	test("null byte stripped when stripControlChars is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello\x00World", opts);
		assert.strictEqual(result, "HelloWorld");
	});

	test("bell char stripped when stripControlChars is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Alert\x07here", opts);
		assert.strictEqual(result, "Alerthere");
	});

	test("various control chars stripped", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("A\x01B\x02C\x1F", opts);
		assert.strictEqual(result, "ABC");
	});

	test("control chars preserved when stripControlChars is false", () => {
		const opts = { ...defaultOpts, stripControlChars: false };
		const result = sanitizeText("Hello\x00World", opts);
		assert.strictEqual(result, "Hello\x00World");
	});

	// 5. Tab and newline: stripControlChars doesn't strip them
	test("tab not stripped by stripControlChars (without normalizeWhitespace)", () => {
		const opts = { ...defaultOpts, normalizeWhitespace: false };
		const result = sanitizeText("Hello\tWorld", opts);
		assert.ok(result.includes("\t"), "tab should survive stripControlChars");
	});

	test("newline not stripped by stripControlChars (without normalizeWhitespace)", () => {
		const opts = { ...defaultOpts, normalizeWhitespace: false };
		const result = sanitizeText("Hello\nWorld", opts);
		assert.ok(
			result.includes("\n"),
			"newline should survive stripControlChars",
		);
	});

	// 6. Zero-width space stripped
	test("zero-width space stripped when stripUnicodeControl is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello\u200BWorld", opts);
		assert.strictEqual(result, "HelloWorld");
	});

	test("zero-width space preserved when stripUnicodeControl is false", () => {
		const opts = { ...defaultOpts, stripUnicodeControl: false };
		const result = sanitizeText("Hello\u200BWorld", opts);
		assert.strictEqual(result, "Hello\u200BWorld");
	});

	// 7. BOM stripped
	test("BOM stripped when stripUnicodeControl is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("\uFEFFHello", opts);
		assert.strictEqual(result, "Hello");
	});

	test("RTL marker stripped when stripUnicodeControl is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello\u200FWorld", opts);
		assert.strictEqual(result, "HelloWorld");
	});

	test("left-to-right mark stripped when stripUnicodeControl is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello\u200EWorld", opts);
		assert.strictEqual(result, "HelloWorld");
	});

	// 8. Emojis removed
	test("waving hand emoji removed when stripEmojis is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Hello 👋 World", opts);
		assert.strictEqual(result, "Hello World");
	});

	test("grinning face emoji removed when stripEmojis is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Say 😀 hi", opts);
		assert.strictEqual(result, "Say hi");
	});

	test("party popper emoji removed when stripEmojis is true", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("Celebrate 🎉 now", opts);
		assert.strictEqual(result, "Celebrate now");
	});

	test("multiple emojis removed", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("👋😀🎉", opts);
		assert.strictEqual(result, "");
	});

	test("emojis preserved when stripEmojis is false", () => {
		const opts = { ...defaultOpts, stripEmojis: false };
		const result = sanitizeText("Hello 👋 World", opts);
		assert.strictEqual(result, "Hello 👋 World");
	});

	// 9. Code symbols removed (normalizeWhitespace trims by default)
	test("curly braces removed when stripCodeSymbols is true", () => {
		const opts = { ...defaultOpts, stripCodeSymbols: true };
		const result = sanitizeText("{ hello }", opts);
		assert.strictEqual(result, "hello");
	});

	test("parentheses removed when stripCodeSymbols is true", () => {
		const opts = { ...defaultOpts, stripCodeSymbols: true };
		const result = sanitizeText("(hello)", opts);
		assert.strictEqual(result, "hello");
	});

	test("angle brackets removed when stripCodeSymbols is true", () => {
		const opts = { ...defaultOpts, stripCodeSymbols: true };
		const result = sanitizeText("<hello>", opts);
		assert.strictEqual(result, "hello");
	});

	test("comment slashes removed when stripCodeSymbols is true", () => {
		const opts = { ...defaultOpts, stripCodeSymbols: true };
		const result = sanitizeText("// comment", opts);
		assert.strictEqual(result, "comment");
	});

	test("block comment slashes removed when stripCodeSymbols is true", () => {
		const opts = { ...defaultOpts, stripCodeSymbols: true };
		const result = sanitizeText("/* comment */", opts);
		assert.strictEqual(result, "comment");
	});

	// 10. Code symbols preserved when stripCodeSymbols is false
	test("code symbols preserved when stripCodeSymbols is false", () => {
		const opts = { ...defaultOpts, stripCodeSymbols: false };
		const result = sanitizeText("{ hello (world) <test> }", opts);
		assert.strictEqual(result, "{ hello (world) <test> }");
	});

	// 11. Default options
	test("default options: stripCarriageReturns is true", () => {
		const result = sanitizeText("Hel\rlo");
		assert.ok(!result.includes("\r"), "CR should be stripped by default");
	});

	test("default options: normalizeWhitespace is true", () => {
		const result = sanitizeText("Hello   world");
		assert.strictEqual(result, "Hello world");
	});

	test("default options: stripControlChars is true", () => {
		const result = sanitizeText("Hello\x00World");
		assert.strictEqual(result, "HelloWorld");
	});

	test("default options: stripUnicodeControl is true", () => {
		const result = sanitizeText("Hello\u200BWorld");
		assert.strictEqual(result, "HelloWorld");
	});

	test("default options: stripEmojis is true", () => {
		const result = sanitizeText("Hello 👋");
		assert.strictEqual(result, "Hello");
	});

	test("default options: stripCodeSymbols is false", () => {
		const result = sanitizeText("{ code }");
		assert.strictEqual(result, "{ code }");
	});

	// 12. Empty string returns empty string
	test("empty string returns empty string", () => {
		assert.strictEqual(sanitizeText(""), "");
	});

	test("only-whitespace input returns empty after normalization", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("   \n\t   ", opts);
		assert.strictEqual(result, "");
	});

	// 13. Mixed input
	test("mixed input with defaults produces clean output", () => {
		const input = "Hello\r\n\tWorld\x00!\u200B👋{code}";
		const result = sanitizeText(input);
		// Step through defaults (normalizeWhitespace runs LAST):
		// stripCarriageReturns: \r → space → "Hello \n\tWorld\x00!\u200B👋{code}"
		// stripControlChars (\x00 removed): "Hello \n\tWorld!\u200B👋{code}"
		// stripUnicodeControl (\u200B removed): "Hello \n\tWorld!👋{code}"
		// stripEmojis (👋 removed): "Hello \n\tWorld!{code}"
		// normalizeWhitespace: all ws → single space → "Hello World!{code}"
		assert.strictEqual(result, "Hello World!{code}");
	});

	// 14. CJK characters preserved
	test("CJK characters preserved", () => {
		const result = sanitizeText("你好世界", defaultOpts);
		assert.strictEqual(result, "你好世界");
	});

	test("Korean characters preserved", () => {
		const result = sanitizeText("안녕하세요", defaultOpts);
		assert.strictEqual(result, "안녕하세요");
	});

	test("Japanese characters preserved", () => {
		const result = sanitizeText("こんにちは世界", defaultOpts);
		assert.strictEqual(result, "こんにちは世界");
	});

	test("mixed CJK and Latin preserved", () => {
		const result = sanitizeText("Hello 世界 World", defaultOpts);
		assert.strictEqual(result, "Hello 世界 World");
	});

	// 15. Each option independently toggleable
	test("only stripEmojis=true, others false", () => {
		const opts: FilterOptions = {
			normalizeWhitespace: false,
			stripCarriageReturns: false,
			stripControlChars: false,
			stripUnicodeControl: false,
			stripEmojis: true,
			stripCodeSymbols: false,
		};
		const input = "Hello\r\x00\u200B👋{code}  world";
		const result = sanitizeText(input, opts);
		// Only emoji should be removed; everything else stays
		assert.ok(result.includes("\r"), "CR should be kept");
		assert.ok(result.includes("\x00"), "null byte should be kept");
		assert.ok(result.includes("\u200B"), "ZWS should be kept");
		assert.ok(!result.includes("👋"), "emoji should be removed");
		assert.ok(result.includes("{"), "braces should be kept");
		assert.ok(result.includes("  "), "extra spaces should be kept");
	});

	test("only stripCodeSymbols=true, others false", () => {
		const opts: FilterOptions = {
			normalizeWhitespace: false,
			stripCarriageReturns: false,
			stripControlChars: false,
			stripUnicodeControl: false,
			stripEmojis: false,
			stripCodeSymbols: true,
		};
		const input = "Hello {code} 👋";
		const result = sanitizeText(input, opts);
		assert.strictEqual(result, "Hello  code  👋");
	});

	test("only stripControlChars=true, others false", () => {
		const opts: FilterOptions = {
			normalizeWhitespace: false,
			stripCarriageReturns: false,
			stripControlChars: true,
			stripUnicodeControl: false,
			stripEmojis: false,
			stripCodeSymbols: false,
		};
		const input = "Hello\x00\x07World\u200B👋{code}";
		const result = sanitizeText(input, opts);
		assert.ok(!result.includes("\x00"), "null byte stripped");
		assert.ok(!result.includes("\x07"), "bell stripped");
		assert.ok(result.includes("\u200B"), "ZWS kept");
		assert.ok(result.includes("👋"), "emoji kept");
		assert.ok(result.includes("{"), "brace kept");
	});

	test("only stripUnicodeControl=true, others false", () => {
		const opts: FilterOptions = {
			normalizeWhitespace: false,
			stripCarriageReturns: false,
			stripControlChars: false,
			stripUnicodeControl: true,
			stripEmojis: false,
			stripCodeSymbols: false,
		};
		const input = "Hello\u200B\uFEFF\u200E\x00👋{code}";
		const result = sanitizeText(input, opts);
		assert.ok(!result.includes("\u200B"), "ZWS stripped");
		assert.ok(!result.includes("\uFEFF"), "BOM stripped");
		assert.ok(!result.includes("\u200E"), "LRM stripped");
		assert.ok(result.includes("\x00"), "null byte kept");
		assert.ok(result.includes("👋"), "emoji kept");
	});

	test("only normalizeWhitespace=true, others false", () => {
		const opts: FilterOptions = {
			normalizeWhitespace: true,
			stripCarriageReturns: false,
			stripControlChars: false,
			stripUnicodeControl: false,
			stripEmojis: false,
			stripCodeSymbols: false,
		};
		const result = sanitizeText("Hello   \t\t  world", opts);
		assert.strictEqual(result, "Hello world");
	});

	test("only stripCarriageReturns=true, others false", () => {
		const opts: FilterOptions = {
			normalizeWhitespace: false,
			stripCarriageReturns: true,
			stripControlChars: false,
			stripUnicodeControl: false,
			stripEmojis: false,
			stripCodeSymbols: false,
		};
		const result = sanitizeText("Hello\r\rWorld\x00👋{code}", opts);
		// \r → space, nothing else touched
		assert.strictEqual(result, "Hello  World\x00👋{code}");
	});

	// Extra: Defensive + regression tests
	test("standalone / and * preserved by stripCodeSymbols", () => {
		const opts = { ...defaultOpts, stripCodeSymbols: true };
		const result = sanitizeText("page 1/2 and 3*4", opts);
		assert.strictEqual(result, "page 1/2 and 3*4");
	});

	test("DEL (0x7F) stripped by stripControlChars", () => {
		const opts = { ...defaultOpts };
		const result = sanitizeText("HelloWorld", opts);
		assert.strictEqual(result, "HelloWorld");
	});

	test("undefined input returns empty string", () => {
		const result = sanitizeText(undefined as unknown as string);
		assert.strictEqual(result, "");
	});

	// 16. voiceLabel (pure function, mirrored from extension.ts)
	const voiceLabel = (id: string): string => {
		const parts = id.split("-");
		const [locale, name] = parts;
		const quality = parts.slice(2).join("-");
		const prettyLocale = locale?.replace("_", " ");
		const prettyName = name?.replace(/_/g, " ");
		const q = quality ? ` (${quality})` : "";
		return `${prettyLocale} - ${prettyName}${q}`;
	};
	test("voiceLabel standard format", () => {
		assert.strictEqual(
			voiceLabel("en_US-hfc_female-medium"),
			"en US - hfc female (medium)",
		);
	});
	test("voiceLabel French upstream", () => {
		assert.strictEqual(
			voiceLabel("fr_FR-upstream-low"),
			"fr FR - upstream (low)",
		);
	});
	test("voiceLabel multi-dash speaker name", () => {
		assert.strictEqual(
			voiceLabel("en_US-am_vctk-medium"),
			"en US - am vctk (medium)",
		);
	});
	test("voiceLabel two-part ID", () => {
		assert.strictEqual(voiceLabel("en_US-hfc_male"), "en US - hfc male");
	});
	test("voiceLabel single-part ID", () => {
		assert.strictEqual(voiceLabel("unknown"), "unknown - undefined");
	});

	// Summary
	console.log(`\n${passed} passed, ${failed} failed`);
	if (failed > 0) {
		console.log("\nFailures:");
		for (const f of failures) {
			console.log(`  - ${f.name}: ${f.message}`);
		}
		process.exit(1);
	}
}

// Auto-run when executed directly
run();
