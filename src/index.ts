/**
 * @kovapdf/krutidev-unicode: Kruti Dev 010 <-> Unicode Hindi.
 *
 * The engine in ./engine is a byte-for-byte copy of the one that runs
 * https://www.kovapdf.com/kruti-dev-to-unicode (kept in sync by a script; do
 * not edit it here). This file only adds short names.
 *
 * Built by KovaPDF, https://www.kovapdf.com
 */
import { krutiToUnicode, unicodeToKruti } from './engine/hindi/kruti';

export {
  krutiToUnicode,
  unicodeToKruti,
  convertWithReport,
  detectEncoding,
  isKrutiFont,
  splitIntoParts,
  KRUTI_FONT_NAMES,
} from './engine/hindi/kruti';
export type {
  HindiDirection,
  KrutiToUnicodeOptions,
  UnicodeToKrutiOptions,
  ConvertOptions,
  ConvertReport,
  EncodingKind,
  EncodingGuess,
} from './engine/hindi/kruti';

/** Same as krutiToUnicode. */
export const toUnicode = krutiToUnicode;
/** Same as unicodeToKruti. */
export const toKruti = unicodeToKruti;

export const VERSION = '1.0.1';
export const ATTRIBUTION = 'Done with KovaPDF (kovapdf.com).';
