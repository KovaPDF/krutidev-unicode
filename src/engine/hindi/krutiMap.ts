/**
 * Kruti Dev 010 <-> Unicode Hindi: the data tables. The engine is kruti.ts.
 *
 * How Kruti Dev text is stored
 * ----------------------------
 * Kruti Dev 010 is not an encoding of Devanagari letters; it is a font that
 * draws Devanagari glyph pictures on Windows-1252 codes (the Remington
 * typewriter layout). "dk;kZy;" set in Kruti Dev 010 shows कार्यालय. When the
 * text is pasted as Unicode every byte arrives as the cp1252 character with
 * the same code (0xE7 -> "ç", 0x86 -> "†"), so all keys below are those
 * Unicode characters; non-ASCII keys are written as \u escapes.
 *
 * Glyphs are in visual order:
 *  - chhoti i (ि, code "f") is typed BEFORE the whole consonant cluster;
 *  - the reph (र् over the next letter, code "Z") is typed AFTER the cluster
 *    and its vowel signs;
 *  - many consonants are a "half" glyph + the vertical stroke "k"
 *    ("[" ख् + "k" = ख), which is also the ा sign;
 *  - conjuncts are either a ligature glyph ("{k" क्ष, "=" त्र, "K" ज्ञ) or half
 *    forms followed by a full letter ("L" स् + "Fk" थ = स्थ); a consonant
 *    with no half glyph takes the visible halant "~" ("n~e" = द्म).
 *
 * Where the facts come from
 * -------------------------
 * The code -> glyph facts are those of the Kruti Dev 010 glyph layout, as
 * listed in the de-facto converter table (author and licence unknown, so
 * nothing is copied from it: this file is written from the facts) and
 * CHECKED BY RENDERING in the Kruti Dev 010 webfont for every code used in
 * the research corpus:
 * Ÿ = त्त, Ü = श्, è = ध्, Æ = र्ि, Ç = िं, Ã = ई, È = ीं, ± = र्ं,
 * ‘ ’ = ष्, “ ” = श्, ‚ = ॉ, · = ऽ, ³ = ङ, AA = ॥, ~ = ्, + = ़.
 * Codes marked UNVERIFIED below come only from the de-facto table (they are
 * accepted on input because real documents written by other converters
 * contain them) and were not rendered.
 *
 * Markers. The engine's internal placeholder code units (Private Use Area)
 * stand for glyphs that must be moved:
 *   M_I     ि typed before the cluster (moves after it)
 *   M_I_AN  ि + ं typed before the cluster (Ç)
 *   M_REPH  र् typed after the cluster (moves before it)
 *   M_HALF  the halant of a half glyph ("D" = क + M_HALF). It behaves like
 *           ् but a following stroke "k" completes the letter instead of
 *           adding ा ("Dk" = क, "Ùk" = त्त), and it is never left at a word
 *           end in the output (it becomes ्).
 */

export const M_I = '\uE001';
export const M_I_AN = '\uE002';
export const M_REPH = '\uE003';
export const M_HALF = '\uE004';

export const HALANT = '\u094D';
export const NUKTA = '\u093C';
export const ZWJ = '\u200D';
export const ZWNJ = '\u200C';

const H = M_HALF;

/* ------------------------------------------------------------------------ */
/* Kruti Dev -> Unicode                                                      */
/* ------------------------------------------------------------------------ */

/** Full consonants. */
const K_FULL: Record<string, string> = {
  d: 'क', x: 'ग', '\u00C4': 'घ' /* Ä */, '\u00B3': 'ङ' /* ³ */,
  p: 'च', N: 'छ', t: 'ज', '>': 'झ', '\u00A5': 'ञ' /* ¥ */,
  V: 'ट', B: 'ठ', M: 'ड', '<': 'ढ',
  r: 'त', n: 'द', u: 'न',
  i: 'प', Q: 'फ', c: 'ब', e: 'म',
  ';': 'य', j: 'र', y: 'ल', G: 'ळ', o: 'व', l: 'स', g: 'ह',
  '\u00D2': 'भ', // Ò  UNVERIFIED (de-facto table)
};

/**
 * Half glyphs (no vertical stroke). Each one + "k" is the full letter; the
 * engine generates those "Xk" entries itself.
 */
const K_HALF: Record<string, string> = {
  D: 'क', '[': 'ख', X: 'ग', '?': 'घ', P: 'च', T: 'ज', '\u00F7': 'झ' /* ÷ */,
  '\u00D6': 'झ' /* Ö UNVERIFIED */, '.': 'ण', R: 'त', F: 'थ', '/': 'ध',
  '\u00E8': 'ध' /* è (rendered) */, '\u00CB': 'ध' /* Ë UNVERIFIED */, U: 'न', I: 'प',
  '\u00B6': 'फ' /* ¶ */, C: 'ब', H: 'भ', E: 'म', '\u00B8': 'य' /* ¸ */, Y: 'ल', O: 'व',
  "'": 'श', '\u00DC': 'श' /* Ü (rendered) */, '"': 'ष', L: 'स', '\u00BA': 'ह' /* º */,
  // Word AutoCorrect turns ' and " into curly quotes; the font draws
  // ‘ ’ as ष् and “ ” as श् (checked by rendering, research 1.7)
  '\u2018': 'ष', '\u2019': 'ष', '\u201C': 'श', '\u201D': 'श',
  // half ligatures
  '{': 'क्ष', '\u00D9': 'त्त' /* Ù */, '\u0178': 'त्त' /* Ÿ (rendered) */,
  '\u00AB': 'त्र' /* « */, '\u2122': 'न्न' /* ™ */,
};

/** Ligature glyphs (full). */
const K_LIG: Record<string, string> = {
  K: 'ज्ञ', J: 'श्र', '=': 'त्र', ')': 'द्ध', '|': 'द्य', '}': 'द्व',
  '\u00F4': 'क्क', // ô
  '\u00E4': 'क्त', // ä
  '\u00D8': 'क्र', // Ø
  '\u00E7': 'प्र', // ç
  '\u00C1': 'प्र', // Á  UNVERIFIED
  '\u00DD': 'फ्र', // Ý
  '\u00E6': 'द्र', // æ
  '\u00ED': 'द्द', // í
  '\u00CC': 'द्द', // Ì  UNVERIFIED
  '\u00EA': 'ट्ट', // ê
  '\u00CD': 'ट्ट', // Í  UNVERIFIED
  '\u00EB': 'ट्ठ', // ë
  '\u00CE': 'ट्ठ', // Î  UNVERIFIED
  '\u00EC': 'ड्ड', // ì
  '\u00CF': 'ड्ड', // Ï  UNVERIFIED
  '\u00EF': 'ड्ढ', // ï
  '\u00D4': 'ड्ढ', // Ô  UNVERIFIED
  '\u00E9': 'न्न', // é
  '\u00E0': 'ह्न', // à
  '\u00E1': 'ह्य', // á
  '\u00E3': 'ह्म', // ã
  '\u00E2': 'हृ', // â
  '\u00D1': 'कृ', // Ñ  UNVERIFIED
  '#': 'रु',
  ':': 'रू',
  // second halves (phala) that join the previous consonant
  z: '्र',
  '\u00AA': '्र', // ª (after ट ड छ ढ)
  '\u00EE': '्य', // î (after ट ठ ड ढ छ)  UNVERIFIED
  '\u00D3': '्य', // Ó  UNVERIFIED
};

/** Independent vowels (multi-code sequences included). */
const K_VOWELS: Record<string, string> = {
  v: 'अ', vk: 'आ', b: 'इ', bZ: 'ई', '\u00C3': 'ई' /* Ã (rendered) */, 'b\u00B1': 'ईं',
  m: 'उ', '\u00C5': 'ऊ' /* Å */, _: 'ऋ', ',': 'ए', ',s': 'ऐ', vks: 'ओ', vkS: 'औ',
  vkW: 'ऑ', 'v\u201A': 'ऑ', ',W': 'ऍ',
};

/** Vowel signs and marks. "f" and the composites use the markers. */
const K_SIGNS: Record<string, string> = {
  k: 'ा', f: M_I, h: 'ी', q: 'ु', w: 'ू', '`': 'ृ', s: 'े', S: 'ै', ks: 'ो', kS: 'ौ',
  W: 'ॅ', '\u201A': 'ॉ' /* ‚ */, a: 'ं', '\u00A1': 'ँ' /* ¡ */,
  Z: M_REPH, '~': HALANT, '+': NUKTA,
  // composites (rendered: Æ Ç È ±)
  '\u00C6': 'र्' + M_I, // Æ = reph + ि on the FOLLOWING cluster
  '\u00C9': 'र्' + M_I_AN, // É = reph + िं on the following cluster  UNVERIFIED
  '\u00C7': M_I_AN, // Ç = िं
  '\u00C8': 'ीं', // È
  '\u00B1': M_REPH + 'ं', // ± = reph + ं
  '\u00CA': 'ी' + M_REPH, // Ê = ी + reph  UNVERIFIED
};

/** Digits, punctuation and other signs. */
const K_OTHER: Record<string, string> = {
  '\u00E5': '०', '\u0192': '१', '\u201E': '२', '\u2026': '३', '\u2020': '४',
  '\u2021': '५', '\u02C6': '६', '\u2030': '७', '\u0160': '८', '\u2039': '९',
  A: '।', AA: '॥',
  '-': '.', '&': '-', ']': ',', '\\': '?', '(': ';', '@': '/',
  '\u00BC': '(', '\u00BD': ')', '\u00BF': '{', '\u00C0': '}', '\u00BE': '=',
  '^': '\u2018', '*': '\u2019', '\u00DE': '\u201C', '\u00DF': '\u201D',
  '\u00B7': 'ऽ' /* · (rendered) */, '\u2022': 'ऽ' /* • UNVERIFIED */, '\u2219': 'ऽ' /* ∙ UNVERIFIED */,
  '\u0152': '॰' /* Œ */, '\u00F1': '॰' /* ñ UNVERIFIED */,
};

/**
 * The whole Kruti -> Unicode table (code sequence -> Unicode with markers).
 * Built once; the tokenizer takes the longest key at each position.
 * Context-dependent codes are NOT here (kruti.ts decides them):
 *   %      ः (visarga) or ":" (colon), see the spec in kruti.ts
 *   – —    दृ / कृ before a letter code, a dash otherwise
 */
export function buildKrutiToUnicode(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(K_FULL)) m.set(k, v);
  for (const [k, v] of Object.entries(K_HALF)) {
    m.set(k, v + H);
    m.set(k + 'k', v); // half + stroke = the full letter
  }
  for (const [k, v] of Object.entries(K_LIG)) m.set(k, v);
  for (const [k, v] of Object.entries(K_VOWELS)) m.set(k, v);
  for (const [k, v] of Object.entries(K_SIGNS)) m.set(k, v);
  for (const [k, v] of Object.entries(K_OTHER)) m.set(k, v);
  return m;
}

/** cp1252 characters for bytes 0x80-0x9F (index = byte - 0x80; '' = undefined). */
export const CP1252_C1: readonly string[] = [
  '\u20AC', '', '\u201A', '\u0192', '\u201E', '\u2026', '\u2020', '\u2021',
  '\u02C6', '\u2030', '\u0160', '\u2039', '\u0152', '', '\u017D', '',
  '', '\u2018', '\u2019', '\u201C', '\u201D', '\u2022', '\u2013', '\u2014',
  '\u02DC', '\u2122', '\u0161', '\u203A', '\u0153', '', '\u017E', '\u0178',
];

/* ------------------------------------------------------------------------ */
/* Unicode -> Kruti Dev                                                      */
/* ------------------------------------------------------------------------ */

/** Independent vowels. */
export const U2K_VOWELS: Readonly<Record<string, string>> = {
  'अ': 'v', 'आ': 'vk', 'इ': 'b', 'ई': 'bZ', 'उ': 'm', 'ऊ': '\u00C5', 'ऋ': '_',
  'ए': ',', 'ऐ': ',s', 'ओ': 'vks', 'औ': 'vkS', 'ऑ': 'v\u201A', 'ऍ': ',W',
};

/** Full consonant glyphs. */
export const U2K_FULL: Readonly<Record<string, string>> = {
  'क': 'd', 'ख': '[k', 'ग': 'x', 'घ': '?k', 'ङ': '\u00B3',
  'च': 'p', 'छ': 'N', 'ज': 't', 'झ': '>', 'ञ': '\u00A5',
  'ट': 'V', 'ठ': 'B', 'ड': 'M', 'ढ': '<', 'ण': '.k',
  'त': 'r', 'थ': 'Fk', 'द': 'n', 'ध': '/k', 'न': 'u',
  'प': 'i', 'फ': 'Q', 'ब': 'c', 'भ': 'Hk', 'म': 'e',
  'य': ';', 'र': 'j', 'ल': 'y', 'ळ': 'G', 'व': 'o',
  'श': "'k", 'ष': '"k', 'स': 'l', 'ह': 'g',
};

/** Half glyphs. Consonants missing here (ङ छ ञ ट ठ ड ढ द र ळ) take full + "~". */
export const U2K_HALF: Readonly<Record<string, string>> = {
  'क': 'D', 'ख': '[', 'ग': 'X', 'घ': '?', 'च': 'P', 'ज': 'T', 'झ': '\u00F7',
  'ण': '.', 'त': 'R', 'थ': 'F', 'ध': '/', 'न': 'U', 'प': 'I', 'फ': '\u00B6',
  'ब': 'C', 'भ': 'H', 'म': 'E', 'य': '\u00B8', 'ल': 'Y', 'व': 'O',
  'श': "'", 'ष': '"', 'स': 'L', 'ह': '\u00BA',
};

/**
 * Conjunct glyphs, keyed by the Unicode cluster. `full` is the glyph at the
 * end of a cluster, `half` (when the font has one) inside a cluster.
 */
export const U2K_LIGATURES: Readonly<Record<string, { full: string; half?: string }>> = {
  'क्ष': { full: '{k', half: '{' },
  'त्र': { full: '=', half: '\u00AB' },
  'त्त': { full: '\u00D9k', half: '\u00D9' },
  'ज्ञ': { full: 'K' },
  'श्र': { full: 'J' },
  'द्ध': { full: ')' },
  'द्य': { full: '|' },
  'द्व': { full: '}' },
  'द्द': { full: '\u00ED' },
  'द्र': { full: '\u00E6' },
  'क्क': { full: '\u00F4' },
  'क्त': { full: '\u00E4' },
  'क्र': { full: '\u00D8' },
  'प्र': { full: '\u00E7' },
  'फ्र': { full: '\u00DD' },
  'ह्न': { full: '\u00E0' },
  'ह्य': { full: '\u00E1' },
  'ह्म': { full: '\u00E3' },
  'ह्र': { full: '\u00BAz' },
  'ट्ट': { full: '\u00EA' },
  'ट्ठ': { full: '\u00EB' },
  'ड्ड': { full: '\u00EC' },
  'ड्ढ': { full: '\u00EF' },
  'ट्र': { full: 'V\u00AA' },
  'ड्र': { full: 'M\u00AA' },
  'छ्र': { full: 'N\u00AA' },
  'ढ्र': { full: '<\u00AA' },
  'ट्य': { full: 'V\u00EE' },
  'ठ्य': { full: 'B\u00EE' },
  'ड्य': { full: 'M\u00EE' },
  'ढ्य': { full: '<\u00EE' },
  'छ्य': { full: 'N\u00EE' },
};

/** A single consonant + vowel sign drawn as one glyph. */
export const U2K_COMBOS: Readonly<Record<string, string>> = {
  'रु': '#', 'रू': ':', 'कृ': '\u2014', 'दृ': '\u2013', 'हृ': '\u00E2',
};

/** Vowel signs other than ि (which is "f", written before the cluster). */
export const U2K_SIGNS: Readonly<Record<string, string>> = {
  'ा': 'k', 'ी': 'h', 'ु': 'q', 'ू': 'w', 'ृ': '`', 'े': 's', 'ै': 'S',
  'ो': 'ks', 'ौ': 'kS', 'ॅ': 'W', 'ॉ': '\u201A',
  'ं': 'a', 'ँ': '\u00A1', 'ः': '%',
  '्': '~', '़': '+', 'ऽ': '\u00B7', '।': 'A', '॥': 'AA', '॰': '\u0152',
  '०': '\u00E5', '१': '\u0192', '२': '\u201E', '३': '\u2026', '४': '\u2020',
  '५': '\u2021', '६': '\u02C6', '७': '\u2030', '८': '\u0160', '९': '\u2039',
};

/**
 * Punctuation in Unicode text -> the Kruti code that draws it. ASCII " and '
 * are decided by position (opening / closing) in kruti.ts.
 */
export const U2K_PUNCT: Readonly<Record<string, string>> = {
  ':': '%', '.': '-', '-': '&', ',': ']', '?': '\\', ';': '(', '/': '@',
  '(': '\u00BC', ')': '\u00BD', '{': '\u00BF', '}': '\u00C0', '=': '\u00BE',
  '\u2018': '^', '\u2019': '*', '\u201C': '\u00DE', '\u201D': '\u00DF',
  '\u2026': '---', '\u2013': '&', '\u2014': '&', '\u2010': '&', '\u2011': '&',
};

/* ------------------------------------------------------------------------ */
/* Visarga or colon                                                          */
/* ------------------------------------------------------------------------ */

/**
 * Kruti Dev has one code, "%", for both ः and ":" (its ":" draws रू). After a
 * word ending in a consonant, "%" is read as ः (अतः, पुनः, सुखिनः) unless the
 * word is one of these labels that official letters and forms end with a
 * colon ("विषय%" = विषय:). Words ending in a vowel sign take ":" anyway.
 */
export const COLON_LABELS: readonly string[] = (
  'विषय संदर्भ सन्दर्भ दिनांक दिनाँक क्रमांक नोट टीप उदाहरण प्रेषक प्रेषित नाम पद स्थान समय आदेश निवेदन ' +
  'निवास अनुलग्नक संलग्नक संलग्न फोन फ़ोन मोबाइल ईमेल पिन कोड लिंग आयु धर्म वर्ग उत्तर प्रश्न हस्ताक्षर ' +
  'कुल योग शुल्क दर मूल्य रकम भुगतान बैंक स्रोत माध्यम उद्देश्य शीर्षक नियम अनुच्छेद पृष्ठ भाग खंड खण्ड ' +
  'अध्याय प्रपत्र प्रारूप तारीख वार दिन माह महीना वर्ष सत्र पता पत्र पत्रांक क्र सं संख्या जिला तहसील ग्राम ' +
  'राज्य देश विभाग कार्यालय निर्णय परिणाम कारण विवरण टिप्पणी सूचना अवधि स्थिति शाखा खाता खाताधारक'
).split(' ');

/* ------------------------------------------------------------------------ */
/* Kruti Dev font names                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Names under which Kruti Dev 010 text reaches us: the Windows family name,
 * the PostScript name PDFs embed (with a subset prefix and style suffix that
 * isKrutiFont strips), the TTF file stem, and spellings seen in Office files.
 *
 * DevLys 010 is deliberately NOT included: whether its glyph codes equal
 * Kruti Dev 010's is unverified (research hindi.md sections 2.1 and 9;
 * converter sites ship it as a separate converter). Other Kruti Dev numbers
 * (011, 016, 020, 040, 055 ...) are separate layouts or designs and are not
 * included either until a font check confirms their codes.
 */
export const KRUTI_FONT_NAMES: string[] = [
  'Kruti Dev 010',
  'KrutiDev010',
  'Kruti_Dev_010',
  'Kruti-Dev-010',
  'Kruti Dev010',
  'KrutiDev 010',
  'KRDEV010',
  'Kruti Dev 010 Bold',
  'KrutiDev010-Bold',
  'KrutiDev010,Bold',
];
