/**
 * Kruti Dev 010 <-> Unicode Hindi conversion engine.
 * Pure TypeScript, no dependencies, browser and Node. Linear time.
 *
 * ============================================================================
 * SPEC (rules and their order). Keep this in sync with the code.
 * ============================================================================
 *
 * Terms. "Code" = one character of Kruti Dev text (a cp1252 glyph code, see
 * krutiMap.ts). "Cluster" = consonant (nukta)? (् consonant (nukta)?)*, one
 * conjunct. "Half glyph" = a consonant drawn without its stroke ("D" क्);
 * "k" after it is the stroke that completes the letter, not ा.
 *
 * KRUTI DEV -> UNICODE (krutiToUnicode)
 *  0. Input folding, 1 char -> 1 char: C1 controls U+0080-U+009F -> their
 *     cp1252 characters; symbol-font PUA U+F020-U+F0FF -> the byte's cp1252
 *     character (PDF text layers).
 *  1. English protection (keepEnglish, ON by default): whitespace tokens that
 *     are English (URLs, e-mails, file names, acronyms, English words in an
 *     English phrase; see hindiEnglish.ts) are copied verbatim, with English
 *     punctuation attached to them (Word, PDF. (PDF) "Word"). They act as
 *     word breaks for every later rule.
 *  2. Tokenizing, one left-to-right pass, longest key first (krutiMap.ts),
 *     into "atoms" in visual order. Markers: M_I (ि before the cluster),
 *     M_I_AN (िं), M_REPH (र् after the cluster), M_HALF (halant of a half
 *     glyph). In this pass:
 *       - doubled codes collapse: "aa" -> "a", "sas" -> "sa", "ZZ" -> "Z";
 *       - a half glyph, a space and "k" (a word split by PDF extraction,
 *         "{ kj") joins: the space is dropped;
 *       - "+" (nukta) typed after a half glyph moves before its halant;
 *       - "%" is ः (visarga) or ":" (colon), auto mode: ":" after a space,
 *         digit, punctuation or start; ":" before "&" (the ":-" heading);
 *         ः before a letter (mid-word: दुःख); otherwise decided in step 3
 *         from the finished word (marker M_VIS): ":" after a vowel sign or
 *         ं ँ (जाएंगे:, प्रति:), ":" after a consonant when the word is a
 *         common label (विषय: दिनांक: नोट:, krutiMap COLON_LABELS), else ः
 *         (अतः, सुखिनः). opts.visarga 'visarga' / 'colon' force one reading
 *         (mid-word stays ः, after a space or digit stays ":");
 *       - "–" / "—" are दृ / कृ before a letter code, else the dash itself;
 *       - characters that are not Kruti codes (emoji, €, "$") and real
 *         Unicode already in the input (Devanagari, other scripts, joiners)
 *         are copied as opaque atoms that never take part in reordering;
 *         the non-Devanagari ones are reported in `unknown`.
 *  3. Reordering, one left-to-right pass over the atoms:
 *     a. M_I / M_I_AN: ि (िं) moves after the WHOLE following cluster
 *        (स्त्रि, क्षि, द्धि, क्त्वि ...); ं ँ typed between the two move
 *        after it. With no cluster after it, ि stays where it is.
 *     b. M_REPH: र् is inserted in front of the cluster before it, skipping
 *        the vowel signs and ं ँ typed in between (कर्त्तव्य, वर्षों, र्द्ध).
 *        "Æ" / "É" put र् (+ ि / िं) on the FOLLOWING cluster.
 *     c. While writing: a half glyph + "k" (ा) is the full letter; + "ks"
 *        (ो) is the full letter + े; + "kS" (ौ) the letter + ै; a halant
 *        before another vowel sign is dropped; two halants are one;
 *        ा + े = ो, ा + ै = ौ, ा + ॅ = ॉ (the common "kW" typing), आ + ॅ = ऑ;
 *        ं / ँ typed before a vowel sign move after it; a nukta after a vowel
 *        sign moves to its consonant; न र ळ + nukta compose (NFC).
 *  4. Output: NFC (nukta letters as base + ़, as NFC requires). Spaces, tabs
 *     and line breaks are never touched.
 *
 * UNICODE -> KRUTI DEV (unicodeToKruti)
 *  1. Devanagari runs are NFC-normalised, then nukta letters are decomposed
 *     (क़ = क + ़, also ऩ ऱ ऴ). ZWJ / ZWNJ next to Devanagari are dropped
 *     (halant + ZWNJ = visible halant, halant + ZWJ = half form, no ligature).
 *  2. Syllables: [र् reph, when a consonant follows] cluster [final ्]
 *     [one vowel sign] [ं ँ ः]*. Independent vowels, signs and digits alone.
 *  3. Cluster -> glyphs, left to right: a 2-consonant ligature when the font
 *     has one (क्ष त्र त्त ज्ञ श्र द्ध द्य द्व द्द द्र क्क क्त क्र प्र फ्र ह्न ह्य
 *     ह्म ह्र ट्ट ट्ठ ड्ड ड्ढ ट्र ड्र छ्र ढ्र ट्य ठ्य ड्य ढ्य छ्य), its half glyph
 *     inside a cluster; a consonant + र at the end = full glyph + "z"
 *     (ब्र = cz); otherwise the half glyph, or full + "~" when the font has
 *     none (द्म = n~e). Single-glyph syllables: रु #, रू :, कृ —, दृ –, हृ â.
 *  4. Visual order: ["f" for ि] glyphs ["~" final halant] [vowel sign]
 *     ["Z" reph] [ं ँ ः]. A final halant is ALWAYS "~", never a half glyph
 *     at a word end (विद्वान् = fo}ku~). चै = pS, चौ = pkS. ॉ = ‚ (U+201A).
 *  5. ॥ = AA, । = A, ":" = % (Kruti ":" draws रू), "." = -, "-" = &, "," = ],
 *     "?" = \, ";" = (, "/" = @, ( ) = ¼ ½, curly quotes ^ * Þ ß (ASCII
 *     quotes by position), … = ---, dashes = &. Devanagari digits -> å ƒ „ …;
 *     Latin digits stay. Latin words (and the punctuation inside them, as in
 *     www.site.com) are passed through and reported in keptEnglish: they
 *     need an English font. Characters Kruti Dev cannot show (ॐ, %, +, @,
 *     emoji, any Latin-1 letter outside a word) are passed through and
 *     reported in `unknown`. Output has no U+0900-U+097F except reported
 *     unknown characters, and no ZWJ / ZWNJ next to Kruti text.
 *
 * LONG TEXT. Every rule looks at most one token beyond a whitespace run, and
 * English phrases end at a line break, so converting a text in parts cut at
 * line breaks (splitIntoParts) gives exactly the result of converting it in
 * one go; the UI converts part by part and yields to the browser in between.
 * ============================================================================
 */

import {
  buildKrutiToUnicode,
  COLON_LABELS,
  CP1252_C1,
  HALANT,
  KRUTI_FONT_NAMES,
  M_HALF,
  M_I,
  M_I_AN,
  M_REPH,
  NUKTA,
  U2K_COMBOS,
  U2K_FULL,
  U2K_HALF,
  U2K_LIGATURES,
  U2K_PUNCT,
  U2K_SIGNS,
  U2K_VOWELS,
} from './krutiMap';
import {
  classifyKrutiToken,
  findEnglishKruti,
  hindiWordPlausible,
  isKrutiCommonWord,
  LEAD_PUNCT,
  TRAIL_PUNCT,
} from './hindiEnglish';

export { KRUTI_FONT_NAMES } from './krutiMap';

/* ======================================================================== */
/* Public types                                                              */
/* ======================================================================== */

export type HindiDirection = 'kruti-to-unicode' | 'unicode-to-kruti';

export interface KrutiToUnicodeOptions {
  /** Leave words that look English (URLs, PDF, Word ...) as they are. Default true. */
  keepEnglish?: boolean;
  /**
   * How "%" is read: 'auto' (default; see the spec), 'visarga' (ः after any
   * letter) or 'colon' (":" everywhere except inside a word).
   */
  visarga?: 'auto' | 'visarga' | 'colon';
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UnicodeToKrutiOptions {}

export type ConvertOptions = KrutiToUnicodeOptions & UnicodeToKrutiOptions;

export interface ConvertReport {
  text: string;
  /** Distinct words left as English (k2u: protected tokens; u2k: Latin words that need an English font). */
  keptEnglish: string[];
  /** Distinct characters that could not be converted; they are kept unchanged in `text`. */
  unknown: string[];
  stats: {
    /** Characters (code points) in the input. */
    chars: number;
    /** Devanagari-block characters on the Unicode side (output for k2u, input for u2k). */
    devanagari: number;
    /** Same number as `devanagari`; the field name the Bijoy report uses, so shared UI code works. */
    bangla: number;
  };
}

export type EncodingKind = 'kruti' | 'unicode' | 'english' | 'mixed' | 'empty';

export interface EncodingGuess {
  kind: EncodingKind;
  /** 0..1 */
  confidence: number;
  /** Word counts behind the guess (for the UI; optional to use). */
  detail: { unicodeWords: number; krutiWords: number; englishWords: number };
}

/* ======================================================================== */
/* Code units and classes                                                    */
/* ======================================================================== */

const C_HALANT = 0x094d;
const C_NUKTA = 0x093c;
const C_AA = 0x093e; // ा
const C_I = 0x093f; // ि
const C_II = 0x0940; // ी
const C_E = 0x0947; // े
const C_AI = 0x0948; // ै
const C_O = 0x094b; // ो
const C_AU = 0x094c; // ौ
const C_CE = 0x0945; // ॅ
const C_CO = 0x0949; // ॉ
const C_ANUS = 0x0902; // ं
const C_CHANDRA = 0x0901; // ँ
const C_VISARGA = 0x0903; // ः
const C_RA = 0x0930;
const C_A_LETTER = 0x0905; // अ
const C_AA_LETTER = 0x0906; // आ
const C_E_LETTER = 0x090f; // ए
const C_AI_LETTER = 0x0910; // ऐ
const C_O_LETTER = 0x0913; // ओ
const C_AU_LETTER = 0x0914; // औ
const C_CAND_O_LETTER = 0x0911; // ऑ
const C_CAND_E_LETTER = 0x090d; // ऍ

const C_MI = M_I.charCodeAt(0);
const C_MIA = M_I_AN.charCodeAt(0);
const C_MREPH = M_REPH.charCodeAt(0);
const C_MHALF = M_HALF.charCodeAt(0);
const C_MVIS = 0xe005; // "%" to be decided once the word is finished

/** Devanagari consonant (क-ह, ळ ऴ ऩ ऱ, क़-य़). */
function isCons(c: number): boolean {
  return (c >= 0x0915 && c <= 0x0939) || (c >= 0x0958 && c <= 0x095f);
}
/** Dependent vowel sign (ा .. ौ, ॎ-ॗ, ॢ ॣ). */
function isVowelSign(c: number): boolean {
  return (c >= 0x093e && c <= 0x094c) || (c >= 0x094e && c <= 0x094f) || (c >= 0x0955 && c <= 0x0957) || c === 0x0962 || c === 0x0963;
}
function isMark(c: number): boolean {
  return c === C_ANUS || c === C_CHANDRA;
}
function isHalantLike(c: number): boolean {
  return c === C_HALANT || c === C_MHALF;
}
function isDevanagari(c: number): boolean {
  return c >= 0x0900 && c <= 0x097f;
}
function isSpaceCode(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 11 || c === 12 || c === 0xa0 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000;
}
function isAsciiDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}
function isLatinLetter(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

/* ======================================================================== */
/* Kruti -> Unicode tables (built once)                                      */
/* ======================================================================== */

interface Entry {
  key: string;
  len: number;
  val: number[];
}

const TAB_SIZE = 0x2220;
let FIRST: (Entry[] | undefined)[] | null = null;
/** Characters that are Kruti letter codes (for the dash / visarga context). */
let LETTER_CODE: Uint8Array | null = null;

function tables(): (Entry[] | undefined)[] {
  if (FIRST) return FIRST;
  const first: (Entry[] | undefined)[] = new Array(TAB_SIZE);
  const letter = new Uint8Array(TAB_SIZE);
  const map = buildKrutiToUnicode();
  map.forEach((v, k) => {
    const c = k.charCodeAt(0);
    const e: Entry = { key: k, len: k.length, val: Array.from(v, (ch) => ch.charCodeAt(0)) };
    (first[c] ??= []).push(e);
    // a letter code draws (part of) a letter or vowel sign, not punctuation
    const v0 = v.charCodeAt(0);
    if (k.length === 1 && (isDevanagari(v0) || v0 >= 0xe000) && v !== '।' && v !== '॥' && v !== 'ऽ' && v !== '॰' && !(v0 >= 0x0966 && v0 <= 0x096f)) letter[c] = 1;
  });
  for (const list of first) if (list) list.sort((a, b) => b.len - a.len);
  letter[0x2013] = 1; // – दृ
  letter[0x2014] = 1; // — कृ
  letter['%'.charCodeAt(0)] = 0;
  FIRST = first;
  LETTER_CODE = letter;
  return first;
}

function isLetterCode(c: number): boolean {
  tables();
  return c < TAB_SIZE && LETTER_CODE![c] === 1;
}

function foldInputChar(c: number): string | null {
  if (c >= 0x80 && c <= 0x9f) {
    const m = CP1252_C1[c - 0x80];
    return m ? m : null;
  }
  if (c >= 0xf020 && c <= 0xf0ff) {
    const b = c - 0xf000;
    if (b >= 0x80 && b <= 0x9f) {
      const m = CP1252_C1[b - 0x80];
      return m ? m : null;
    }
    return String.fromCharCode(b);
  }
  return null;
}

/** Folds PDF / Latin-1 aliases, 1 char -> 1 char so indices stay aligned. */
function foldInput(src: string): string {
  let out: string[] | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (c < 0x80 || (c > 0x9f && c < 0xf020) || c > 0xf0ff) continue;
    const f = foldInputChar(c);
    if (f !== null) {
      if (out === null) out = src.split('');
      out[i] = f;
    }
  }
  return out === null ? src : out.join('');
}

let COLON_SET: Set<string> | null = null;
function colonLabel(w: string): boolean {
  if (COLON_SET === null) COLON_SET = new Set(COLON_LABELS);
  return COLON_SET.has(w);
}

/* ======================================================================== */
/* Kruti -> Unicode                                                          */
/* ======================================================================== */

interface K2UContext {
  keep: Uint8Array | null;
  unknown: Set<string> | null;
  visarga: 'auto' | 'visarga' | 'colon';
  /** Counts readings that real Hindi never has (for the English heuristic); -1 = not counted. */
  anomalies: number;
}

/** Growable code-unit buffer with an "opaque" flag per unit. */
class Buf {
  a: Uint16Array;
  o: Uint8Array;
  n = 0;
  constructor(size: number) {
    this.a = new Uint16Array(Math.max(16, size));
    this.o = new Uint8Array(Math.max(16, size));
  }
  grow(extra: number): void {
    if (this.n + extra <= this.a.length) return;
    let size = this.a.length * 2;
    while (size < this.n + extra) size *= 2;
    const a = new Uint16Array(size);
    a.set(this.a.subarray(0, this.n));
    const o = new Uint8Array(size);
    o.set(this.o.subarray(0, this.n));
    this.a = a;
    this.o = o;
  }
  push(c: number, opaque = 0): void {
    if (this.n >= this.a.length) this.grow(1);
    this.a[this.n] = c;
    this.o[this.n] = opaque;
    this.n++;
  }
  /** Last unit when it is not opaque, else -1. */
  last(back = 1): number {
    const p = this.n - back;
    return p >= 0 && !this.o[p] ? this.a[p] : -1;
  }
  insert(at: number, units: number[]): void {
    const k = units.length;
    this.grow(k);
    this.a.copyWithin(at + k, at, this.n);
    this.o.copyWithin(at + k, at, this.n);
    for (let m = 0; m < k; m++) {
      this.a[at + m] = units[m];
      this.o[at + m] = 0;
    }
    this.n += k;
  }
  toString(): string {
    const a = this.a;
    for (let i = 0; i < this.n; i++) if (a[i] === C_MHALF && !this.o[i]) a[i] = C_HALANT;
    const parts: string[] = [];
    for (let k = 0; k < this.n; k += 8192) {
      parts.push(String.fromCharCode.apply(null, a.subarray(k, Math.min(this.n, k + 8192)) as unknown as number[]));
    }
    return parts.join('');
  }
}

/** Unicode punctuation that ends a word in the output (for the "%" rule). */
function isOutPunct(c: number): boolean {
  return c < 0x80 ? !isLatinLetter(c) && !isAsciiDigit(c) : c === 0x0964 || c === 0x0965 || (c >= 0x2010 && c <= 0x205e);
}

/** Step 2: Kruti codes -> atoms in visual order. */
function tokenize(s: string, ctx: K2UContext): Buf {
  const first = tables();
  const keep = ctx.keep;
  const n = s.length;
  const b = new Buf(n + (n >> 1) + 16);
  let i = 0;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (keep !== null && keep[i]) {
      b.push(c, 1);
      i++;
      continue;
    }
    if (isSpaceCode(c)) {
      b.push(c);
      i++;
      continue;
    }
    // "%": visarga or colon
    if (c === 0x25) {
      i++;
      const prev = b.n > 0 && !b.o[b.n - 1] ? b.a[b.n - 1] : -1;
      const nx = i < n && !(keep !== null && keep[i]) ? s.charCodeAt(i) : -1;
      if (prev < 0 || isSpaceCode(prev) || isAsciiDigit(prev) || isOutPunct(prev)) b.push(0x3a);
      else if (nx === 0x26) b.push(0x3a); // "%&" = ":-"
      else if (nx >= 0 && isLetterCode(nx)) b.push(C_VISARGA); // mid-word: दुःख
      else if (ctx.visarga === 'colon') b.push(0x3a);
      else if (ctx.visarga === 'visarga') b.push(C_VISARGA);
      else b.push(C_MVIS);
      continue;
    }
    // – —: दृ / कृ before a letter code, else the dash
    if (c === 0x2013 || c === 0x2014) {
      const nx = i + 1 < n && !(keep !== null && keep[i + 1]) ? s.charCodeAt(i + 1) : -1;
      if (nx >= 0 && isLetterCode(nx)) {
        b.push(c === 0x2013 ? 0x0926 : 0x0915);
        b.push(0x0943);
      } else b.push(c);
      i++;
      continue;
    }
    let hit: Entry | null = null;
    const list = c < TAB_SIZE ? first[c] : undefined;
    if (list !== undefined) {
      for (const e of list) {
        if (e.len === 1) {
          hit = e;
          break;
        }
        if (i + e.len <= n && s.startsWith(e.key, i)) {
          let ok = true;
          if (keep !== null) for (let m = 1; m < e.len; m++) if (keep[i + m]) ok = false;
          if (ok) {
            hit = e;
            break;
          }
        }
      }
    }
    if (hit === null) {
      // not a Kruti code
      if (isAsciiDigit(c) || c === 0x21) {
        b.push(c);
      } else {
        const isHigh = c >= 0xd800 && c <= 0xdbff && i + 1 < n;
        const ch = isHigh ? s.slice(i, i + 2) : s[i];
        const known = isDevanagari(c) || c === 0x200c || c === 0x200d || (c >= 0xe000 && c <= 0xe0ff);
        if (!known && ctx.unknown !== null) ctx.unknown.add(ch);
        if (ctx.anomalies >= 0 && !isDevanagari(c)) ctx.anomalies++;
        b.push(c, 1);
        if (isHigh) {
          b.push(s.charCodeAt(i + 1), 1);
          i++;
        }
      }
      i++;
      continue;
    }
    const v = hit.val;
    const v0 = v[0];
    const last = b.last();
    // doubled codes: aa -> a, sas -> sa, ZZ -> Z
    if (hit.len === 1 && v.length === 1) {
      if (v0 === C_ANUS && last === C_ANUS) {
        i++;
        continue;
      }
      if (v0 === C_E && last === C_ANUS && b.last(2) === C_E) {
        i++;
        continue;
      }
      if (v0 === C_MREPH && last === C_MREPH) {
        i++;
        continue;
      }
    }
    // a half glyph, a space, then the stroke: one word split by PDF extraction
    if ((v0 === C_AA || v0 === C_O || v0 === C_AU) && last === 0x20 && b.last(2) === C_MHALF) b.n--;
    // nukta typed after a half glyph belongs before its halant
    if (v0 === C_NUKTA && v.length === 1 && isHalantLike(last) && b.n >= 2 && isCons(b.last(2))) {
      b.a[b.n - 1] = C_NUKTA;
      b.push(last);
      i++;
      continue;
    }
    b.grow(v.length);
    for (let m = 0; m < v.length; m++) {
      b.a[b.n] = v[m];
      b.o[b.n] = 0;
      b.n++;
    }
    i += hit.len;
  }
  return b;
}

/** End (exclusive) of the cluster that starts with the consonant at j. */
function clusterEnd(a: Uint16Array, o: Uint8Array, n: number, j: number): number {
  let k = j + 1;
  if (k < n && !o[k] && a[k] === C_NUKTA) k++;
  while (k + 1 < n && !o[k] && !o[k + 1] && isHalantLike(a[k]) && isCons(a[k + 1])) {
    k += 2;
    if (k < n && !o[k] && a[k] === C_NUKTA) k++;
  }
  return k;
}

const COMPOSE_NUKTA: Record<number, number> = { 0x0928: 0x0929, 0x0930: 0x0931, 0x0933: 0x0934 };

/** Steps 3 and 4: atoms -> Unicode. */
function reorder(at: Buf, ctx: K2UContext): string {
  const a = at.a;
  const o = at.o;
  const n = at.n;
  const out = new Buf(n + 16);
  const count = ctx.anomalies >= 0;

  /** Appends a non-opaque unit with the writing clean-ups (spec 3c). */
  const put = (c: number): void => {
    if (isVowelSign(c)) {
      // the place for the sign: before ं / ँ typed ahead of it
      let p = out.n;
      while (p > 0 && !out.o[p - 1] && isMark(out.a[p - 1])) p--;
      const hasBase = p > 0 && !out.o[p - 1];
      if (p < out.n && !hasBase) p = out.n;
      let prev = p > 0 && !out.o[p - 1] ? out.a[p - 1] : -1;
      if (isHalantLike(prev)) {
        const half = prev === C_MHALF;
        if (half && (c === C_AA || c === C_O || c === C_AU)) {
          // the stroke completes the half letter
          out.a.copyWithin(p - 1, p, out.n);
          out.o.copyWithin(p - 1, p, out.n);
          out.n--;
          if (c === C_AA) return;
          c = c === C_O ? C_E : C_AI;
        } else {
          out.a.copyWithin(p - 1, p, out.n);
          out.o.copyWithin(p - 1, p, out.n);
          out.n--;
          if (count && half) ctx.anomalies++;
        }
        p--;
        prev = p > 0 && !out.o[p - 1] ? out.a[p - 1] : -1;
      }
      // two-part signs and the candra vowels
      let merged = -1;
      if (prev === C_AA) merged = c === C_E ? C_O : c === C_AI ? C_AU : c === C_CE ? C_CO : -1;
      else if (prev === C_AA_LETTER && c === C_CE) merged = C_CAND_O_LETTER;
      else if (prev === C_A_LETTER) merged = c === C_AA ? C_AA_LETTER : c === C_O ? C_O_LETTER : c === C_AU ? C_AU_LETTER : c === C_CO ? C_CAND_O_LETTER : -1;
      else if (prev === C_E_LETTER) merged = c === C_E ? C_AI_LETTER : c === C_CE ? C_CAND_E_LETTER : -1;
      if (merged >= 0) {
        out.a[p - 1] = merged;
        return;
      }
      if (count && !(isCons(prev) || prev === C_NUKTA)) ctx.anomalies++;
      if (p === out.n) out.push(c);
      else out.insert(p, [c]);
      return;
    }
    const last = out.last();
    if (c === C_HALANT || c === C_MHALF) {
      if (isHalantLike(last)) {
        if (c === C_HALANT) out.a[out.n - 1] = C_HALANT; // ºz: ह् + ्र
        return;
      }
      if (count && !isCons(last) && last !== C_NUKTA) ctx.anomalies++;
      out.push(c);
      return;
    }
    if (c === C_NUKTA) {
      if (isHalantLike(last) && isCons(out.last(2))) {
        out.a[out.n - 1] = C_NUKTA;
        out.push(last);
        return;
      }
      if (isVowelSign(last) || isMark(last)) {
        let p = out.n;
        while (p > 0 && !out.o[p - 1] && (isVowelSign(out.a[p - 1]) || isMark(out.a[p - 1]))) p--;
        if (p > 0 && !out.o[p - 1] && isCons(out.a[p - 1])) {
          const comp = COMPOSE_NUKTA[out.a[p - 1]];
          if (comp !== undefined) out.a[p - 1] = comp;
          else out.insert(p, [C_NUKTA]);
          return;
        }
      }
      const comp = COMPOSE_NUKTA[last];
      if (comp !== undefined) {
        out.a[out.n - 1] = comp;
        return;
      }
      if (count && !isCons(last)) ctx.anomalies++;
      out.push(c);
      return;
    }
    // Ç (िं) followed by a typed "a": one anusvara
    if (isMark(c) && c === last) return;
    if (count) {
      if ((isMark(c) || c === C_VISARGA) && (last < 0 || isSpaceCode(last) || isOutPunct(last))) ctx.anomalies++;
      if (isCons(c) || isMark(c)) {
        // ok
      } else if (last === C_MHALF) ctx.anomalies++; // a half glyph before a non-letter
    }
    out.push(c);
  };

  /** Inserts र् before the cluster that ends the output (skipping vowel signs and ं ँ). */
  const reph = (): void => {
    const A = out.a;
    const O = out.o;
    let p = out.n;
    while (p > 0 && !O[p - 1] && (isVowelSign(A[p - 1]) || isMark(A[p - 1]))) p--;
    let q = p;
    if (q > 0 && !O[q - 1] && A[q - 1] === C_NUKTA) q--;
    if (q > 0 && !O[q - 1] && isCons(A[q - 1])) {
      q--;
      for (;;) {
        if (q < 2 || O[q - 1] || !isHalantLike(A[q - 1])) break;
        let r = q - 2;
        if (!O[r] && A[r] === C_NUKTA && r >= 1) r--;
        if (O[r] || !isCons(A[r])) break;
        q = r;
      }
      out.insert(q, [C_RA, C_HALANT]);
      return;
    }
    if (count) ctx.anomalies++;
    out.push(C_RA);
    out.push(C_HALANT);
  };

  /** "%" at a word end after a letter: ":" after a vowel sign or a label word, else ः. */
  const visarga = (): void => {
    const last = out.last();
    if (isVowelSign(last) || isMark(last)) {
      out.push(0x3a);
      return;
    }
    if (isCons(last) || last === C_NUKTA) {
      let p = out.n;
      while (p > 0 && out.n - p < 40 && !out.o[p - 1] && isDevanagari(out.a[p - 1])) p--;
      const w = String.fromCharCode.apply(null, Array.from(out.a.subarray(p, out.n)));
      out.push(colonLabel(w) ? 0x3a : C_VISARGA);
      return;
    }
    out.push(0x3a);
  };

  for (let i = 0; i < n; ) {
    const c = a[i];
    if (o[i]) {
      out.push(c, 1);
      i++;
      continue;
    }
    if (c === C_MI || c === C_MIA) {
      let j = i + 1;
      while (j < n && !o[j] && isMark(a[j])) j++;
      if (j < n && !o[j] && isCons(a[j])) {
        const k = clusterEnd(a, o, n, j);
        for (let m = j; m < k; m++) put(a[m]);
        put(C_I);
        if (c === C_MIA) out.push(C_ANUS);
        for (let m = i + 1; m < j; m++) out.push(a[m]);
        i = k;
        continue;
      }
      // no cluster after it: ि stays where it was typed
      if (count) ctx.anomalies++;
      out.push(C_I);
      if (c === C_MIA) out.push(C_ANUS);
      i++;
      continue;
    }
    if (c === C_MREPH) {
      reph();
      i++;
      continue;
    }
    if (c === C_MVIS) {
      visarga();
      i++;
      continue;
    }
    put(c);
    i++;
  }
  if (count && out.n > 0 && out.a[out.n - 1] === C_MHALF && !out.o[out.n - 1]) ctx.anomalies++;
  if (count) {
    for (let i = 0; i + 1 < out.n; i++) {
      if (out.a[i] === C_MHALF && !out.o[i] && !isCons(out.a[i + 1])) ctx.anomalies++;
    }
  }
  return out.toString();
}

function decodeKruti(src: string, keep: Uint8Array | null, unknown: Set<string> | null, opts: KrutiToUnicodeOptions, folded?: string): string {
  const s = folded ?? foldInput(src);
  const ctx: K2UContext = { keep, unknown, visarga: opts.visarga ?? 'auto', anomalies: -1 };
  return reorder(tokenize(s, ctx), ctx);
}

/* ------------------------------------------------------------------------ */
/* English protection glue                                                   */
/* ------------------------------------------------------------------------ */

const PLAUSIBLE_CACHE = new Map<string, boolean>();

/**
 * Could this Kruti token be Hindi? It must decode with no impossible reading
 * (a half letter at a word end, a vowel sign with no letter, a dangling ि or
 * reph) and only with letter pairs that real Hindi has.
 */
function krutiPlausible(token: string): boolean {
  const hit = PLAUSIBLE_CACHE.get(token);
  if (hit !== undefined) return hit;
  const ctx: K2UContext = { keep: null, unknown: null, visarga: 'auto', anomalies: 0 };
  const uni = reorder(tokenize(foldInput(token), ctx), ctx);
  const ok = ctx.anomalies === 0 && hindiWordPlausible(uni);
  if (PLAUSIBLE_CACHE.size > 20000) PLAUSIBLE_CACHE.clear();
  PLAUSIBLE_CACHE.set(token, ok);
  return ok;
}

/* ======================================================================== */
/* Unicode -> Kruti                                                          */
/* ======================================================================== */

interface U2KContext {
  unknown: Set<string> | null;
}

const NUKTA_DECOMP: Record<string, string> = {
  'ऩ': 'ऩ', 'ऱ': 'ऱ', 'ऴ': 'ऴ',
  'क़': 'क़', 'ख़': 'ख़', 'ग़': 'ग़', 'ज़': 'ज़',
  'ड़': 'ड़', 'ढ़': 'ढ़', 'फ़': 'फ़', 'य़': 'य़',
};

function prepareUnicode(src: string): string {
  // NFC for Devanagari: precomposed nukta letters decompose (and we also
  // decompose ऩ ऱ ऴ); a nukta typed after the halant goes before it. These
  // are the only NFC changes that matter for Hindi, so the rest of the text
  // (Latin, emoji) is left exactly as it is.
  if (!/[\u0929\u0931\u0934\u0958-\u095F]|\u094D\u093C/.test(src)) return src;
  return src.replace(/[\u0929\u0931\u0934\u0958-\u095F]|\u094D\u093C/g, (m) => (m.length === 2 ? '\u093C\u094D' : NUKTA_DECOMP[m]));
}

function fullGlyph(cons: string): string {
  const base = U2K_FULL[cons[0]];
  if (cons.length === 1) return base;
  // nukta goes before the stroke: ख़ = [+k
  return base.length > 1 && base.endsWith('k') ? base.slice(0, -1) + '+k' : base + '+';
}
function halfGlyph(cons: string): string | undefined {
  const h = U2K_HALF[cons[0]];
  if (h === undefined) return undefined;
  return cons.length > 1 ? h + '+' : h;
}

/** Cluster -> glyphs (spec U2K 3). `breaks` = indexes that follow a halant + ZWJ (no ligature there). */
function clusterGlyphs(cons: string[], breaks: number[] | null): { glyphs: string[]; lastSingle: boolean } {
  const glyphs: string[] = [];
  const m = cons.length;
  let lastSingle = false;
  let k = 0;
  while (k < m) {
    if (k + 1 < m && cons[k].length === 1 && cons[k + 1].length === 1 && (breaks === null || breaks.indexOf(k + 1) < 0)) {
      const lig = U2K_LIGATURES[cons[k] + HALANT + cons[k + 1]];
      if (lig !== undefined) {
        if (k + 2 === m) glyphs.push(lig.full);
        else glyphs.push(lig.half ?? lig.full + '~');
        k += 2;
        lastSingle = false;
        continue;
      }
    }
    const C = cons[k];
    if (k === m - 1) {
      glyphs.push(fullGlyph(C));
      lastSingle = true;
      k++;
      continue;
    }
    if (k + 2 === m && cons[k + 1] === 'र' && (breaks === null || breaks.indexOf(k + 1) < 0)) {
      // र-फला at the end of the cluster: full glyph + z (ब्र = cz)
      glyphs.push(fullGlyph(C) + 'z');
      lastSingle = false;
      k += 2;
      continue;
    }
    glyphs.push(halfGlyph(C) ?? fullGlyph(C) + '~');
    lastSingle = false;
    k++;
  }
  return { glyphs, lastSingle };
}

const SYL_CACHE = new Map<string, string>();

function isVowelLetter(c: number): boolean {
  return (c >= 0x0904 && c <= 0x0914) || c === 0x0960 || c === 0x0961 || (c >= 0x0972 && c <= 0x0977);
}

/** Can the Kruti font show this Unicode punctuation? Returns the code, or null. */
function punctCode(s: string, k: number, tokStart: number): string | null {
  const ch = s[k];
  const hit = U2K_PUNCT[ch];
  if (hit !== undefined) return hit;
  if (ch === '"') {
    const p = k > tokStart ? s[k - 1] : ' ';
    return /[\s([{\u2018\u201C-]/.test(p) || k === tokStart ? '\u00DE' : '\u00DF';
  }
  if (ch === "'") return k === tokStart || /[\s([{"\u201C]/.test(s[k - 1]) ? '^' : '*';
  if (ch === '!') return '!';
  return null;
}

/** English punctuation that stays as typed when it is stuck to a Latin word (as in hindiEnglish.ts). */
const LATIN_KEEP_LEAD = '("\'\u2018\u201C';
const LATIN_KEEP_TRAIL = '.,;:!?)"\'\u2019\u201D';
function isLatinOrDigit(c: number): boolean {
  return isLatinLetter(c) || isAsciiDigit(c);
}

function encodeUnicode(src: string, ctx: U2KContext): string {
  const s = prepareUnicode(src);
  const n = s.length;
  const out: string[] = [];
  const unknown = ctx.unknown;
  const flag = (ch: string) => {
    if (unknown !== null) unknown.add(ch);
  };
  let i = 0;
  while (i < n) {
    const c0 = s.charCodeAt(i);
    if (isSpaceCode(c0)) {
      let j = i + 1;
      while (j < n && isSpaceCode(s.charCodeAt(j))) j++;
      out.push(s.slice(i, j));
      i = j;
      continue;
    }
    // one whitespace-separated token [i, j)
    let j = i + 1;
    while (j < n && !isSpaceCode(s.charCodeAt(j))) j++;
    let hasLatin = false;
    for (let k = i; k < j; k++) {
      if (isLatinLetter(s.charCodeAt(k))) {
        hasLatin = true;
        break;
      }
    }
    // core = token without edge punctuation (Latin cores keep their inner punctuation)
    let a = i;
    let b = j;
    if (hasLatin) {
      while (a < b && !/[A-Za-z0-9\u0080-\uFFFF]/.test(s[a])) a++;
      while (b > a && !/[A-Za-z0-9\u0080-\uFFFF]/.test(s[b - 1])) b--;
      while (a < b && /[\u2018\u2019\u201C\u201D\u2026\u2013\u2014]/.test(s[a])) a++;
      while (b > a && /[\u2018\u2019\u201C\u201D\u2026\u2013\u2014]/.test(s[b - 1])) b--;
    }
    let k = i;
    while (k < j) {
      const c = s.charCodeAt(k);
      if (isDevanagari(c)) {
        if (isCons(c)) {
          k = encodeSyllable(s, k, j, out, unknown);
          continue;
        }
        if (isVowelLetter(c)) {
          const v = U2K_VOWELS[s[k]];
          if (v !== undefined) out.push(v);
          else {
            out.push(s[k]);
            flag(s[k]);
          }
          k++;
          continue;
        }
        if (c === C_I) {
          out.push('f');
          k++;
          continue;
        }
        const g = U2K_SIGNS[s[k]];
        if (g !== undefined) out.push(g);
        else {
          out.push(s[k]);
          flag(s[k]);
        }
        k++;
        continue;
      }
      if (c === 0x200c || c === 0x200d) {
        const p = k > i ? s.charCodeAt(k - 1) : 0;
        const q = k + 1 < j ? s.charCodeAt(k + 1) : 0;
        if (!isDevanagari(p) && !isDevanagari(q)) out.push(s[k]);
        k++;
        continue;
      }
      if (isLatinLetter(c) || isAsciiDigit(c)) {
        out.push(s[k]);
        k++;
        continue;
      }
      // punctuation and everything else
      const p = k > i ? s.charCodeAt(k - 1) : 0;
      const q = k + 1 < j ? s.charCodeAt(k + 1) : 0;
      // punctuation inside a Latin word (www.site.com, v2.0), or stuck to one
      // ("PDF," "(Word)"), stays as typed: it belongs to the English text, and
      // Kruti -> Unicode keeps it the same way
      const ch0 = s[k];
      const inLatin =
        hasLatin &&
        ((k >= a && k < b && !isDevanagari(p) && !isDevanagari(q)) ||
          (k < a && a < b && LATIN_KEEP_LEAD.indexOf(ch0) >= 0 && isLatinOrDigit(s.charCodeAt(a))) ||
          (k >= b && a < b && LATIN_KEEP_TRAIL.indexOf(ch0) >= 0 && isLatinOrDigit(s.charCodeAt(b - 1))));
      if (inLatin) {
        out.push(s[k]);
        k++;
        continue;
      }
      const code = punctCode(s, k, i);
      if (code !== null) {
        out.push(code);
        k++;
        continue;
      }
      const high = c >= 0xd800 && c <= 0xdbff && k + 1 < j;
      const ch = high ? s.slice(k, k + 2) : s[k];
      out.push(ch);
      flag(ch);
      k += ch.length;
    }
    i = j;
  }
  return out.join('');
}

/** Encodes the syllable starting at k (a consonant, or र् + consonant); returns the next index. */
function encodeSyllable(s: string, start: number, end: number, out: string[], unknown: Set<string> | null): number {
  let k = start;
  let reph = false;
  if (s.charCodeAt(k) === C_RA && k + 2 < end && s.charCodeAt(k + 1) === C_HALANT && isCons(s.charCodeAt(k + 2))) {
    reph = true;
    k += 2;
  }
  const cons: string[] = [];
  let breaks: number[] | null = null;
  let finalHal = false;
  for (;;) {
    let C = s[k];
    k++;
    if (k < end && s.charCodeAt(k) === C_NUKTA) {
      C += NUKTA;
      k++;
    }
    cons.push(C);
    if (k < end && s.charCodeAt(k) === C_HALANT) {
      const nx = k + 1 < end ? s.charCodeAt(k + 1) : -1;
      if (isCons(nx)) {
        k++;
        continue;
      }
      if (nx === 0x200d && k + 2 < end && isCons(s.charCodeAt(k + 2))) {
        (breaks ??= []).push(cons.length);
        k += 2;
        continue;
      }
      finalHal = true;
      k++;
      if (k < end && (s.charCodeAt(k) === 0x200c || s.charCodeAt(k) === 0x200d)) k++;
    }
    break;
  }
  let vs = '';
  if (!finalHal && k < end && isVowelSign(s.charCodeAt(k))) {
    vs = s[k];
    k++;
  }
  let mods = '';
  while (k < end) {
    const c = s.charCodeAt(k);
    if (c === C_ANUS || c === C_CHANDRA || c === C_VISARGA) {
      mods += s[k];
      k++;
    } else break;
  }
  const key = s.slice(start, k);
  let hit = SYL_CACHE.get(key);
  if (hit === undefined) {
    const { glyphs, lastSingle } = clusterGlyphs(cons, breaks);
    let vsCode = '';
    let pre = '';
    if (vs === 'ि') pre = 'f';
    else if (vs !== '') {
      const last = cons[cons.length - 1];
      const combo = lastSingle && last.length === 1 ? U2K_COMBOS[last + vs] : undefined;
      if (combo !== undefined) glyphs[glyphs.length - 1] = combo;
      else vsCode = U2K_SIGNS[vs] ?? vs;
    }
    let m = '';
    for (const ch of mods) m += U2K_SIGNS[ch];
    hit = pre + glyphs.join('') + (finalHal ? '~' : '') + vsCode + (reph ? 'Z' : '') + m;
    if (SYL_CACHE.size > 50000) SYL_CACHE.clear();
    SYL_CACHE.set(key, hit);
  }
  if (unknown !== null && vs !== '' && vs !== 'ि' && U2K_SIGNS[vs] === undefined && !U2K_COMBOS[cons[cons.length - 1] + vs]) unknown.add(vs);
  out.push(hit);
  return k;
}

/* ======================================================================== */
/* Public API                                                                */
/* ======================================================================== */

/** Converts Kruti Dev 010 text to Unicode Hindi. English words are kept unless opts.keepEnglish is false. */
export function krutiToUnicode(text: string, opts?: KrutiToUnicodeOptions): string {
  if (!text) return '';
  const o = opts ?? {};
  const folded = foldInput(text);
  const keep = o.keepEnglish === false ? null : findEnglishKruti(folded, [], krutiPlausible);
  return decodeKruti(text, keep, null, o, folded);
}

/** Converts Unicode Hindi to Kruti Dev 010. Latin text is left as it is. */
export function unicodeToKruti(text: string, opts?: UnicodeToKrutiOptions): string {
  void opts;
  if (!text) return '';
  return encodeUnicode(text, { unknown: null });
}

function countCodePoints(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0xdc00 || c > 0xdfff) n++;
  }
  return n;
}
function countDevanagari(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (isDevanagari(s.charCodeAt(i))) n++;
  return n;
}

/** Latin words in Unicode text (they need an English font once the text is set in Kruti Dev). */
function latinWords(s: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const n = s.length;
  let i = 0;
  while (i < n) {
    while (i < n && isSpaceCode(s.charCodeAt(i))) i++;
    let j = i;
    while (j < n && !isSpaceCode(s.charCodeAt(j))) j++;
    let latin = false;
    for (let k = i; k < j && !latin; k++) latin = isLatinLetter(s.charCodeAt(k));
    if (!latin) {
      i = j;
      continue;
    }
    // a token can also hold Devanagari (PDF-फ़ाइल): take its Latin pieces
    for (const piece of s.slice(i, j).split(/[\u0900-\u097F]+/)) {
      let a = 0;
      let b = piece.length;
      while (a < b && !/[A-Za-z0-9]/.test(piece[a])) a++;
      while (b > a && !/[A-Za-z0-9]/.test(piece[b - 1])) b--;
      const w = piece.slice(a, b);
      if (/[A-Za-z]/.test(w) && !seen.has(w)) {
        seen.add(w);
        if (out.length < 1000) out.push(w);
      }
    }
    i = j;
  }
  return out;
}

/**
 * Converts and reports what could not be converted.
 * k2u: keptEnglish = tokens protected by keepEnglish (default on); unknown =
 *      characters that are not Kruti Dev codes (kept unchanged).
 * u2k: keptEnglish = Latin words (set them in an English font); unknown =
 *      characters Kruti Dev cannot show (kept unchanged).
 * Safe to call on parts of a long text cut at line breaks (splitIntoParts).
 */
export function convertWithReport(text: string, direction: HindiDirection, opts?: ConvertOptions): ConvertReport {
  const o = opts ?? {};
  const src = text ?? '';
  const unknown = new Set<string>();
  const keptEnglish: string[] = [];
  let out: string;
  if (direction === 'kruti-to-unicode') {
    const folded = foldInput(src);
    const keep = o.keepEnglish === false ? null : findEnglishKruti(folded, keptEnglish, krutiPlausible);
    out = src ? decodeKruti(src, keep, unknown, o, folded) : '';
  } else {
    out = encodeUnicode(src, { unknown });
    for (const w of latinWords(src)) keptEnglish.push(w);
  }
  const dev = countDevanagari(direction === 'kruti-to-unicode' ? out : src);
  return {
    text: out,
    keptEnglish,
    unknown: Array.from(unknown).slice(0, 500),
    stats: { chars: countCodePoints(src), devanagari: dev, bangla: dev },
  };
}

/**
 * Cuts a long text into parts of about `size` characters that end at a line
 * break (or, for one very long line, at a space), for converting part by part
 * with convertWithReport and giving the browser a turn in between. Joining the
 * converted parts gives the same text as converting the whole at once
 * whenever every cut falls at a line break.
 */
export function splitIntoParts(text: string, size = 50_000): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.length - i <= size) {
      out.push(text.slice(i));
      break;
    }
    let end = text.lastIndexOf('\n', i + size);
    if (end <= i) end = text.lastIndexOf(' ', i + size);
    end = end <= i ? i + size : end + 1;
    // never cut a surrogate pair
    const c = text.charCodeAt(end - 1);
    if (c >= 0xd800 && c <= 0xdbff) end++;
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Detection                                                                 */
/* ------------------------------------------------------------------------ */

/** Non-ASCII codes that are typical of Kruti Dev text. */
const KRUTI_MARKERS = new Set(Array.from('\u00A1\u00A5\u00AA\u00AB\u00B1\u00B3\u00B6\u00B7\u00B8\u00BA\u00BC\u00BD\u00BE\u00BF\u00C0\u00C1\u00C3\u00C4\u00C5\u00C6\u00C7\u00C8\u00C9\u00CA\u00CB\u00CC\u00CD\u00CE\u00CF\u00D1\u00D2\u00D3\u00D4\u00D6\u00D8\u00D9\u00DC\u00DD\u00DE\u00DF\u00E0\u00E1\u00E2\u00E3\u00E4\u00E5\u00E6\u00E7\u00E8\u00E9\u00EA\u00EB\u00EC\u00ED\u00EE\u00EF\u00F1\u00F4\u00F7\u0152\u0160\u0178\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u2039\u201A\u2122'));
/** ASCII codes that are Kruti letters / signs when they sit inside a word. */
const KRUTI_INNER = /[A-Za-z][;'"[\]{}|=`~+\\/<>#:)%&]|[;'"[{}|=`~+\\/<>#:)][A-Za-z]|[a-z]A$|^[;'"[{|=`~+\\/<>#:)]/;
const CONTRACTION = /^[A-Za-z]+'(?:s|t|re|ve|ll|d|m)$/i;

/**
 * Guesses whether text is Kruti Dev, Unicode Hindi, English, or a mix.
 * Looks at up to the first 200 000 characters.
 */
export function detectEncoding(text: string): EncodingGuess {
  const s0 = text ?? '';
  const s = s0.length > 200000 ? s0.slice(0, 200000) : s0;
  let uni = 0;
  let kru = 0;
  let eng = 0;
  let other = 0;
  const n = s.length;
  let i = 0;
  while (i < n) {
    while (i < n && isSpaceCode(s.charCodeAt(i))) i++;
    if (i >= n) break;
    let j = i;
    while (j < n && !isSpaceCode(s.charCodeAt(j))) j++;
    const tok = foldInput(s.slice(i, j));
    i = j;
    let dev = 0;
    let marker = 0;
    let letters = 0;
    for (let k = 0; k < tok.length; k++) {
      const c = tok.charCodeAt(k);
      if (isDevanagari(c)) dev++;
      else if (KRUTI_MARKERS.has(tok[k])) marker++;
      if (isLatinLetter(c)) letters++;
    }
    if (dev > 0) {
      uni++;
      continue;
    }
    if (letters === 0 && marker === 0) {
      other++;
      continue;
    }
    if (marker > 0 || (KRUTI_INNER.test(tok) && !CONTRACTION.test(tok.replace(/[.,;:!?)"']+$/, '')))) {
      kru++;
      continue;
    }
    if (isKrutiCommonWord(tok)) {
      kru++;
      continue;
    }
    let a = 0;
    let b = tok.length;
    while (a < b && LEAD_PUNCT.indexOf(tok[a]) >= 0) a++;
    while (b > a && TRAIL_PUNCT.indexOf(tok[b - 1]) >= 0) b--;
    const core = tok.slice(a, b);
    if (!core) {
      other++;
      continue;
    }
    const cls = classifyKrutiToken(core, tok, krutiPlausible);
    if (cls === 'E') eng++;
    else if (cls === 'e' || cls === 'a' || cls === 'I') (eng += 0.6), (kru += 0.4);
    else if (cls === 'f') (kru += 0.7), (eng += 0.3);
    else if ((cls === 'K' || cls === 'U') && krutiPlausible(core)) kru++;
    else if (cls === 'U') eng++;
    else if (cls === 'N') other++;
    else eng += 0.5;
  }
  const total = uni + kru + eng;
  if (total === 0) {
    if (other === 0) return { kind: 'empty', confidence: 1, detail: { unicodeWords: 0, krutiWords: 0, englishWords: 0 } };
    return { kind: 'english', confidence: 0.3, detail: { unicodeWords: 0, krutiWords: 0, englishWords: 0 } };
  }
  const detail = { unicodeWords: uni, krutiWords: Math.round(kru), englishWords: Math.round(eng) };
  const size = Math.min(1, 0.5 + total / 20);
  const pu = uni / total;
  const pk = kru / total;
  const pe = eng / total;
  const round = (x: number) => Math.round(x * 100) / 100;
  if (pu >= 0.8) return { kind: 'unicode', confidence: round(pu * size), detail };
  if (pk >= 0.7) return { kind: 'kruti', confidence: round(pk * size), detail };
  if (pe >= 0.8) return { kind: 'english', confidence: round(pe * size), detail };
  if (uni === 0 && pk >= 0.5) return { kind: 'kruti', confidence: round(pk * size * 0.8), detail };
  return { kind: 'mixed', confidence: round(Math.max(pu, pk, pe) * size), detail };
}

/** True when a font name is Kruti Dev 010 (PDF subset prefixes and style suffixes are ignored). */
export function isKrutiFont(name: string): boolean {
  if (!name) return false;
  let n = name.trim().replace(/^[A-Z]{6}\+/, '');
  n = n.split(/[,]/)[0];
  n = n.replace(/[-_\s]+(bold|italic|oblique|regular|normal|light|medium|semibold|black|condensed|narrow|bolditalic|boldoblique)+$/i, '');
  n = n.replace(/(bold|italic|oblique|regular)+$/i, '');
  n = n.replace(/[-_\s]+/g, '').toLowerCase();
  if (!n) return false;
  for (const f of KRUTI_FONT_NAMES) if (f.replace(/[-_\s,]+/g, '').replace(/bold$/i, '').toLowerCase() === n) return true;
  return n === 'krutidev010' || n === 'krdev010';
}
