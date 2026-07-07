export interface FilterOptions {
	normalizeWhitespace: boolean;
	stripCarriageReturns: boolean;
	stripControlChars: boolean;
	stripUnicodeControl: boolean;
	stripEmojis: boolean;
	stripCodeSymbols: boolean;
	customPatterns: string[];
}

const defaultOptions: FilterOptions = {
	normalizeWhitespace: true,
	stripCarriageReturns: true,
	stripControlChars: true,
	stripUnicodeControl: true,
	stripEmojis: true,
	stripCodeSymbols: false,
	customPatterns: [],
};

const EMOJI_RE =
	/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2605}\u{2607}-\u{2612}\u{2614}-\u{267F}\u{2692}-\u{269C}\u{26A0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2767}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{FE00}-\u{FE0F}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F1AC}\u{1F1E6}-\u{1F1FF}\u{1F201}-\u{1F20F}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}-\u{1F251}\u{1F260}\u{1F262}-\u{1F265}\u{1F270}\u{1F272}-\u{1F275}\u{1F277}\u{1F279}-\u{1F27B}\u{1F280}\u{1F2C0}\u{1F2C1}\u{1F2C2}-\u{1F2CB}\u{1F2CC}-\u{1F2CF}\u{1F2D1}-\u{1F2DB}\u{1F2DC}-\u{1F2FF}\u{1F300}-\u{1F320}\u{1F32D}-\u{1F33C}\u{1F33F}\u{1F340}\u{1F350}-\u{1F37B}\u{1F37C}\u{1F37E}-\u{1F3EA}\u{1F3EB}-\u{1F3FF}\u{1F400}-\u{1F53D}\u{1F546}-\u{1F64D}\u{1F680}-\u{1F6FF}\u{1F90C}-\u{1F93A}\u{1F93C}-\u{1F945}\u{1F947}-\u{1F976}\u{1F97A}-\u{1F9CB}\u{1F9CD}-\u{1F9FF}\u{200D}\u{20E3}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2605}\u{2607}-\u{2612}\u{2614}-\u{267F}\u{2692}-\u{269C}\u{26A0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2767}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

export function sanitizeText(
	text: string,
	options?: Partial<FilterOptions>,
): string {
	if (!text) return "";
	const opts = { ...defaultOptions, ...options };
	let result = text;

	// 1. Strip carriage returns (\r → space)
	if (opts.stripCarriageReturns) {
		result = result.replace(/\r/g, " ");
	}

	// 2. Strip control chars (ASCII 0x00-0x1F + DEL 0x7F, except \t=0x09, \n=0x0A)
	if (opts.stripControlChars) {
		result = result.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
	}

	// 3. Strip Unicode control/format chars
	if (opts.stripUnicodeControl) {
		result = result.replace(
			/[\u200B-\u200F\uFEFF\u2060\u2066-\u206F\uFFF9-\uFFFB]/g,
			"",
		);
	}

	// 4. Apply custom patterns (format: "regex" or "regex:replacement")
	for (const pattern of opts.customPatterns) {
		try {
			const idx = pattern.indexOf(':');
			const hasReplacement = idx >= 0 && pattern.slice(idx + 1).includes('$');
			const [regexStr, replacement] = hasReplacement
				? [pattern.slice(0, idx), pattern.slice(idx + 1)]
				: [pattern, ""];
			result = result.replace(new RegExp(regexStr, "gu"), replacement);
		} catch {
			// Invalid regex — skip silently
		}
	}

	// 5. Strip emojis
	if (opts.stripEmojis) {
		result = result.replace(EMOJI_RE, "");
	}

	// 6. Strip code symbols (replace with space to preserve word separation)
	if (opts.stripCodeSymbols) {
		result = result.replace(/\/\*/g, " "); // /*
		result = result.replace(/\*\//g, " "); // */
		result = result.replace(/\/\//g, " "); // //
		result = result.replace(/[{}()<>]/g, " "); // individual chars (no / or *)
	}

	// 7. Normalize whitespace LAST (collapses spaces from all previous steps)
	if (opts.normalizeWhitespace) {
		result = result.replace(/\s+/g, " ").trim();
	}

	return result;
}
