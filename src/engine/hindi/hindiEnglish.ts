/**
 * English-word protection for Kruti Dev -> Unicode (kruti.ts), and the Hindi
 * data behind it.
 *
 * Plain Kruti Dev letters ARE ASCII letters ("dk" = का, "Word" = ॅवतक), so
 * which tokens of a pasted text are English is a guess. The rules (the same
 * shape as the Bijoy engine's, lib/bangla/bijoy.ts):
 *  - URLs, e-mail addresses, file names (name.ext), ordinals (1st), numbers
 *    with a per-cent sign (50%) -> English.
 *  - English words (englishWords.ts list, with -s -ed -ing ... forms) and
 *    ALL-CAPS acronyms are SURE English when their Kruti reading cannot be
 *    Hindi (it has a half letter at the end, a vowel sign with no letter, or
 *    a letter pair that never occurs in Hindi: see hindiWordPlausible), and
 *    WEAK English otherwise.
 *  - Very common Hindi words spelt like English in Kruti ("us" = ने, "in" =
 *    पद, HINDI_FIRST below) are HINDI-FIRST: English only inside an English
 *    phrase, never at its edge.
 *  - A "run" is a stretch of non-Kruti tokens on one line. A run with at
 *    least one sure-English word is an English phrase: its weak words and
 *    numbers are kept; Hindi-first words, unknown English-shaped words that
 *    cannot be Hindi, and the letters a / A / I are kept only inside the
 *    phrase. Anything with a non-ASCII Kruti code, or Kruti punctuation codes
 *    inside it ("dk;Z", "n'kgjk"), is Kruti.
 *  - "&" (the Kruti hyphen) splits words: PDF&Q+kby is PDF + फ़ाइल.
 *  - A protected token keeps the English punctuation stuck to it
 *    ("Word," "(PDF)" "'Hello'"), because in a Kruti document those were
 *    typed in an English font; "]" "-" "A" (Kruti comma, full stop, danda)
 *    are still converted.
 *
 * HI_PAIRS: which Devanagari letter pairs occur in real Hindi words (a bit
 * set over HI_ALPHABET, ^ = word start, $ = word end), built from the Hindi
 * strings of lib/i18n/messages/hi.json, the research corpus, two Hindi court
 * judgments and the decoded AIR bulletin of the research (hindi-ref/real and
 * hindi-ref/src/sample*.txt, used only for counting letter pairs) and ~600
 * hand-listed frequent Hindi words; pairs seen in at least two words.
 */

import { isEnglishWordForm, isKnownAcronym } from '../bangla/englishWords';

export type TokClass = 'E' | 'e' | 'f' | 'u' | 'U' | 'N' | 'Q' | 'K' | 'a' | 'I' | 'P';

/* ------------------------------------------------------------------------ */
/* Hindi letter-pair plausibility                                            */
/* ------------------------------------------------------------------------ */

/** ^ = word start, $ = word end, then vowels, consonants, nukta, signs, vowel signs. */
export const HI_ALPHABET =
  '^$अआइईउऊऋएऐओऔऑकखगघङचछजझञटठडढणतथदधनपफबभमयरलळवशषसह़ंँः्ािीुूृेैोौॅॉऽ';

/** Generated bit set (base64), row-major [first][second]. */
export const HI_PAIRS_B64 =
  '/P977//bIAgAAAAAAAAAAAAAlBJ+tyQAgJxwiOl1tgEgAEIgJd5LAgAIAAAUAEEJAAAAhDJqNGQAAAAAAAABgAEAAAABEAAgAAAIAAUQKG0ZAAAAAABCEAQAAAAAAABAgAAAAAAAAARBAAAAAAAQOAQAAGAClHButz3/lwAQAI1EQPwKIgIgvqLL8z8AAAAUCATIjAAAAAAAAAABgAAQAIjwAnweAgAAIASC7CsIAAWEXi3P7yAABJAiAACCBgAAAAABAAgACkAAIEYL8DoJAAGACADIIyAAAAAAtRCvEwAQEIgAQKgCAgACIIQA8CEICAEAyy/r9yEAAAAgtACPggAQAKD3lvwbAkAgIFIL8C+ICIWUGu/rryUghNArPS3/kwAAAADAQLxOAkAorAPD9jsJAAWAACzIryAChAYquC3/hwAQALjVsvoKAsA78P/b8j8JAAWFWibL7wUAAAAAAAAAgAAQSszztjxPAkAAIFKL+DkJAAFAAgfAoyAAnFLqt2z/lwAQSoj2EvwPAkAhoFIL8DsJAK+U3mYDACAAnJAIgggAgAAwAAAABAAAAkC7///7AADIK/fd/+8bICAgnFP/v68AgIBwzun3lgAAKsp59Xf7DgAIAOGFXk0bAAAAAABKACoAgADwSq31vgAAAkAph9dTAgCICIWUfu8LACgABFImECAAAAAAAAAAAAAAEkABBQ5DAAAAAAAAAAACAAA=';

let PAIRS: Uint8Array | null = null;
let ALPHA_INDEX: Map<string, number> | null = null;

function b64decode(s: string): Uint8Array {
  const tbl = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let buf = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = ((buf << 6) | tbl.indexOf(clean[i])) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 0xff;
    }
  }
  return out;
}

function pairsReady(): boolean {
  if (PAIRS === null) {
    if (!HI_PAIRS_B64) return false;
    PAIRS = b64decode(HI_PAIRS_B64);
    ALPHA_INDEX = new Map();
    for (let i = 0; i < HI_ALPHABET.length; i++) ALPHA_INDEX.set(HI_ALPHABET[i], i);
  }
  return true;
}

/**
 * Could this Unicode string be a Hindi word? False when it contains a letter
 * pair (or start / end pair) that does not occur in real Hindi. Nukta letters
 * must be decomposed (NFC). Characters outside the alphabet split the word.
 */
export function hindiWordPlausible(uni: string): boolean {
  if (!pairsReady()) return true;
  const N = HI_ALPHABET.length;
  const idx = ALPHA_INDEX!;
  const pairs = PAIRS!;
  const has = (bit: number) => (pairs[bit >> 3] & (1 << (bit & 7))) !== 0;
  let prev = 0; // ^
  let any = false;
  for (let i = 0; i < uni.length; i++) {
    let ch = uni[i];
    // composed nukta letters count as base + nukta
    if (ch === 'ऩ' || ch === 'ऱ' || ch === 'ऴ') {
      const base = ch === 'ऩ' ? 'न' : ch === 'ऱ' ? 'र' : 'ळ';
      const k0 = idx.get(base)!;
      if (!has(prev * N + k0)) return false;
      prev = k0;
      any = true;
      ch = '़';
    }
    const k = idx.get(ch);
    if (k === undefined || k < 2) {
      if (any && !has(prev * N + 1)) return false;
      prev = 0;
      any = false;
      continue;
    }
    if (!has(prev * N + k)) return false;
    prev = k;
    any = true;
  }
  if (any && !has(prev * N + 1)) return false;
  return true;
}

/* ------------------------------------------------------------------------ */
/* Word lists                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Kruti spellings of common Hindi words that are also English words (exact
 * case). Generated by converting the Hindi words of the sources above to
 * Kruti and keeping those that are English words.
 */
const HINDI_FIRST_LIST = 'us Us in can flag muds buds cpus best Ok ok lc dc dg eu Mp';
let HINDI_FIRST: Set<string> | null = null;

/** Kruti token that is first of all a common Hindi word (see HINDI_FIRST_LIST). */
export function isHindiFirst(token: string): boolean {
  if (HINDI_FIRST === null) HINDI_FIRST = new Set(HINDI_FIRST_LIST.split(' '));
  return HINDI_FIRST.has(token);
}

/** The most frequent Hindi words in Kruti spelling (for detection). */
const KRUTI_COMMON_LIST =
  `dk ds dh esa gS gSa vkSj ls us dks ij Hkh ;g og Fkk Fkh Fks gks dj fd rFkk tks rks bl ml mu bu ge rqe vki vc tc rc dc lc dqN ugha gh fy, ;k ;s os ,d nks rhu rd tk x;k x;h x;s fd;k fd, dh tkrh gksxk gksxh jgk jgh jgs ckn igys lkFk }kjk vkt dy o"kZ fnu ckr dke lHkh vius viuh viuk mudh mlds muds bld blds blds lnL; ljdkj Hkkjr ns'k jkT; ftyk`;
let KRUTI_COMMON: Set<string> | null = null;

export function isKrutiCommonWord(token: string): boolean {
  if (KRUTI_COMMON === null) KRUTI_COMMON = new Set(KRUTI_COMMON_LIST.split(' '));
  // strip Kruti / English trailing punctuation: ] (comma) A (danda) - (full stop)
  return KRUTI_COMMON.has(token) || KRUTI_COMMON.has(token.replace(/(?:AA|[A\]\-,.;:!?])+$/, ''));
}

/* ------------------------------------------------------------------------ */
/* Token classes                                                             */
/* ------------------------------------------------------------------------ */

/** Punctuation stripped from a token's edges before it is judged (ASCII, curly, and Kruti's own). */
export const LEAD_PUNCT = '([{<"\'\u2018\u201C\u00BC\u00DE^';
export const TRAIL_PUNCT = ')]}>"\'.,;:!?\u2019\u201D\u00BD\u00DF*\\%&-';
/** Punctuation that stays English when it is stuck to a protected English word. */
const KEEP_LEAD = '("\'\u2018\u201C';
const KEEP_TRAIL = '.,;:!?)"\'\u2019\u201D';
const URL_RE = /^(?:https?:\/\/|ftp:\/\/|www\.)[^\s]+$/i;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9_\-.]*\.(?:pdf|docx?|xlsx?|pptx?|txt|csv|rtf|odt|ods|odp|jpe?g|png|gif|bmp|webp|tiff?|svg|heic|zip|rar|7z|html?|css|js|ts|json|xml|md|mp[34]|wav|avi|mkv|mov|exe|apk|msi|epub|psd|ai|eps)$/i;
/** A file name; the extension must be all lower or all upper case (Kruti ".M" = ण्ड: n.Md is not a .md file). */
function isFileName(s: string): boolean {
  if (!FILE_RE.test(s)) return false;
  const ext = s.slice(s.lastIndexOf('.') + 1);
  return ext === ext.toLowerCase() || ext === ext.toUpperCase();
}
const NUMBER_RE = /^[0-9]+(?:[.,:/-][0-9]+)*$/;
const PERCENT_RE = /^[0-9]+(?:[.,][0-9]+)?%$/;
const ORDINAL_RE = /^[0-9]+(?:st|nd|rd|th)$/i;
const ALNUM_CODE_RE = /^[A-Z]{1,6}-?[0-9]{1,6}$/; // A4, MP3, COVID-19
const WORD_RE = /^[A-Za-z](?:[A-Za-z'\u2019-]*[A-Za-z])?$/;
const CONTRACTION_RE = /^[A-Za-z]+['\u2019](?:s|t|re|ve|ll|d|m)$/i;
const WHOLE_TRAIL = '.,;:!?)]}"\'\u2019\u201D\u00BD\u00DFA\\-&';

function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7e) return true;
  return false;
}

/**
 * Token classes: E English for sure; e English word that also reads as
 * plausible Hindi; f common Hindi word that is also English (us = ने);
 * u unknown word that cannot be Hindi; U undecided English-shaped word;
 * a the letters a / I (never Hindi alone); I the letter A (alone it is the
 * danda); N number; Q per-cent number; K Kruti;
 * P punctuation only.
 */
export function classifyKrutiToken(core: string, whole: string, plausible: (w: string) => boolean): TokClass {
  if (whole.length <= 512 && /[.@:/]/.test(whole)) {
    if (URL_RE.test(whole) || EMAIL_RE.test(whole) || isFileName(whole)) return 'E';
    if (URL_RE.test(core) || EMAIL_RE.test(core) || isFileName(core)) return 'E';
  }
  if (core.length > 64 || hasNonAscii(core.replace(/\u2019/g, "'"))) return 'K';
  const c0 = core.charCodeAt(0);
  if (c0 >= 48 && c0 <= 57) {
    if (NUMBER_RE.test(core)) return 'N';
    if (ORDINAL_RE.test(core)) return 'E';
  }
  if (ALNUM_CODE_RE.test(core)) return isKnownAcronym(core.replace(/[-0-9]/g, '')) || !plausible(core) ? 'E' : 'e';
  if (!WORD_RE.test(core)) return 'K';
  if (/['\u2019]/.test(core) && !CONTRACTION_RE.test(core)) return 'K';
  const letters = core.replace(/['\u2019-]/g, '');
  if (letters.length === 1) {
    // "a" (ं alone) and "I" (प् alone) are never Hindi; "A" alone is the danda
    if (letters === 'a' || letters === 'I') return 'a';
    if (letters === 'A') return 'I';
    return 'K';
  }
  if (/^A+$/.test(letters)) return 'K'; // AA = ॥
  if (isHindiFirst(core)) return 'f';
  const lower = letters.toLowerCase();
  const allCaps = letters === letters.toUpperCase();
  const capitalised = !allCaps && letters[0] === letters[0].toUpperCase() && letters.slice(1) === letters.slice(1).toLowerCase();
  const allLower = letters === lower;
  const inList = isEnglishWordForm(core.toLowerCase());
  if (allCaps) {
    if (inList || isKnownAcronym(letters)) return plausible(core) ? 'e' : 'E';
    if (!plausible(core)) return 'E';
    return 'K';
  }
  if (inList) return plausible(core) ? 'e' : 'E';
  if ((allLower || capitalised) && letters.length >= 3) return 'U';
  return 'K';
}

interface Tok {
  start: number;
  end: number;
  /** token bounds (whitespace to whitespace) */
  i: number;
  j: number;
  line: number;
  cls: TokClass;
  english: boolean;
  lowerFirst: boolean;
  bare: boolean;
}

function isSpaceCode(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 11 || c === 12 || c === 0xa0 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000;
}

/**
 * Finds the English tokens of a (folded) Kruti text. Returns the keep mask
 * (1 = copy verbatim), or null when nothing is English. Kept words are
 * appended to `kept` (distinct, at most 1000).
 */
export function findEnglishKruti(s: string, kept: string[], plausible: (w: string) => boolean): Uint8Array | null {
  const toks: Tok[] = [];
  const clsCache = new Map<string, TokClass>();
  const n = s.length;
  let line = 0;
  let i = 0;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (isSpaceCode(c)) {
      if (c === 10) line++;
      i++;
      continue;
    }
    // "&" is the Kruti hyphen: PDF&Q+kby (PDF-फ़ाइल) is two words
    if (c === 0x26) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !isSpaceCode(s.charCodeAt(j)) && s.charCodeAt(j) !== 0x26) j++;
    let a = i;
    let b = j;
    while (a < b && LEAD_PUNCT.indexOf(s[a]) >= 0) a++;
    while (b > a && TRAIL_PUNCT.indexOf(s[b - 1]) >= 0) b--;
    if (b > a) {
      const core = s.slice(a, b);
      let we = j;
      while (we > i && WHOLE_TRAIL.indexOf(s[we - 1]) >= 0) we--;
      const whole = s.slice(i, we);
      let cls: TokClass;
      if (PERCENT_RE.test(s.slice(a, j)) && b === j - 1) {
        cls = 'Q';
        b = j;
      } else if (whole === core) {
        const hit = clsCache.get(core);
        if (hit === undefined) {
          cls = classifyKrutiToken(core, whole, plausible);
          clsCache.set(core, cls);
        } else cls = hit;
      } else cls = classifyKrutiToken(core, whole, plausible);
      if (cls === 'E' && (URL_RE.test(whole) || EMAIL_RE.test(whole))) {
        a = i;
        b = i + whole.length;
      }
      if (core.length > 64 && cls !== 'E') cls = 'K';
      toks.push({ start: a, end: b, i, j, line, cls, english: cls === 'E' || cls === 'Q', lowerFirst: /^[a-z]/.test(core), bare: a === i && b === j });
    } else {
      toks.push({ start: i, end: i, i, j, line, cls: 'P', english: false, lowerFirst: false, bare: false });
    }
    i = j;
  }
  if (toks.length === 0) return null;

  // Unknown English-shaped words: only next to an English candidate do they
  // get the "can this be Hindi at all?" test.
  const candidate = (t: Tok | undefined, line0: number) => t !== undefined && t.line === line0 && t.cls !== 'K' && t.cls !== 'U' && t.cls !== 'P' && t.cls !== 'Q';
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.cls !== 'U') continue;
    let p = k - 1;
    while (p >= 0 && toks[p].cls === 'P') p--;
    let q = k + 1;
    while (q < toks.length && toks[q].cls === 'P') q++;
    const prev = p >= 0 ? toks[p] : undefined;
    if (candidate(prev, t.line) || (prev !== undefined && prev.cls === 'u' && prev.line === t.line) || candidate(toks[q], t.line)) {
      const w = s.slice(t.start, t.end);
      t.cls = plausible(w) ? 'K' : 'u';
    } else t.cls = 'K';
  }

  // Runs of non-Kruti tokens on one line (punctuation-only tokens are transparent).
  let k0 = 0;
  while (k0 < toks.length) {
    const t0 = toks[k0];
    if (t0.cls === 'K' || t0.cls === 'P') {
      k0++;
      continue;
    }
    const run: Tok[] = [];
    let k = k0;
    const line0 = t0.line;
    while (k < toks.length && toks[k].line === line0 && toks[k].cls !== 'K') {
      if (toks[k].cls !== 'P') run.push(toks[k]);
      k++;
    }
    let leftK = false;
    for (let m = k0 - 1; m >= 0 && toks[m].line === line0; m--) {
      if (toks[m].cls === 'P') continue;
      leftK = toks[m].cls === 'K';
      break;
    }
    const rightK = k < toks.length && toks[k].line === line0 && toks[k].cls === 'K';
    let sure = 0;
    for (const t of run) if (t.cls === 'E') sure++;
    if (sure > 0) {
      const last = run.length - 1;
      for (let m = 0; m <= last; m++) {
        const t = run[m];
        const leftOk = m > 0 || (!leftK && sure >= 2);
        const rightOk = m < last || (!rightK && sure >= 2);
        switch (t.cls) {
          case 'E':
          case 'e':
            t.english = true;
            break;
          case 'N':
            t.english = run.length > 1;
            break;
          case 'f':
          case 'u':
            t.english = leftOk && rightOk;
            break;
          case 'a':
            t.english = true;
            break;
          case 'I':
            t.english = leftOk && m < last && run[m + 1].lowerFirst;
            break;
          default:
            break;
        }
      }
    }
    k0 = k;
  }

  let mask: Uint8Array | null = null;
  const seen = new Set<string>();
  for (const t of toks) {
    if (!t.english || t.end <= t.start) continue;
    if (mask === null) mask = new Uint8Array(n);
    let a = t.start;
    let b = t.end;
    if (t.cls !== 'N' && t.cls !== 'Q') {
      // English punctuation stuck to the word
      while (a > t.i && KEEP_LEAD.indexOf(s[a - 1]) >= 0) a--;
      while (b < t.j && KEEP_TRAIL.indexOf(s[b]) >= 0) b++;
    }
    mask.fill(1, a, b);
    const w = s.slice(t.start, t.end);
    if (t.cls !== 'N' && t.cls !== 'Q' && !seen.has(w)) {
      seen.add(w);
      if (kept.length < 1000) kept.push(w);
    }
  }
  return mask;
}
