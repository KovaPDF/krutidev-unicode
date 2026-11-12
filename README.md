# krutidev-unicode

Convert Hindi text typed in **Kruti Dev 010** to **Unicode**, and Unicode back to Kruti Dev.

This is the same conversion engine that runs the Kruti Dev to Unicode tool on KovaPDF. It is plain code with no dependencies: it works in Node.js, in the browser and in Python, offline, and nothing is sent anywhere.

Need it for whole PDF or Word files? Use KovaPDF: https://www.kovapdf.com/kruti-dev-to-unicode

Built by KovaPDF, https://www.kovapdf.com

| | |
|---|---|
| npm | `@kovapdf/krutidev-unicode` (ESM, CommonJS and TypeScript types, zero runtime dependencies) |
| PyPI | `krutidev-unicode` (pure Python, no dependencies, Python 3.10+) |
| CLI | `krutidev-unicode to-unicode < in.txt` |
| Directions | Kruti Dev 010 to Unicode, Unicode to Kruti Dev 010 |

## Install

```sh
npm install @kovapdf/krutidev-unicode
pip install krutidev-unicode
```

## JavaScript

```js
import { toUnicode, toKruti } from '@kovapdf/krutidev-unicode';
// or: const { toUnicode, toKruti } = require('@kovapdf/krutidev-unicode');

toUnicode('esjk uke jke gSA');   // 'मेरा नाम राम है।'
toKruti('भारत सरकार');           // 'Hkkjr ljdkj'

// English words in Kruti text are kept by default (PDF, Word, URLs, e-mails)
toUnicode('PDF Q+kby dks Word esa cnysa');                 // 'PDF फ़ाइल को Word में बदलें'
toUnicode('Word', { keepEnglish: false });                 // 'ॅवतक'

// "%" is both the visarga and the colon in Kruti Dev; 'auto' (default) decides by context
toUnicode('fo"k;% okf"kZd ijh{kk');                        // 'विषय: वार्षिक परीक्षा'
toUnicode('vr% vkils fuosnu gS');                          // 'अतः आपसे निवेदन है'
```

More functions:

```js
import { convertWithReport, detectEncoding, isKrutiFont, splitIntoParts } from '@kovapdf/krutidev-unicode';

convertWithReport('ॐ नमः PDF → 50% छूट', 'unicode-to-kruti');
// { text: 'ॐ ue% PDF → 50% NwV', keptEnglish: ['PDF'], unknown: ['ॐ', '→', '%'], stats: { chars: 19, devanagari: 7, bangla: 7 } }

detectEncoding('esjk uke jke gSA Hkkjr ljdkj').kind; // 'kruti'  ('unicode', 'english', 'mixed' or 'empty' otherwise)
isKrutiFont('ABCDEF+KrutiDev010-Bold');              // true
```

| Function | What it does |
|---|---|
| `toUnicode(text, options?)` (also `krutiToUnicode`) | Kruti Dev 010 to Unicode. Options: `keepEnglish` (default `true`), `visarga` (`'auto'` default, `'visarga'` or `'colon'`: how `%` is read). |
| `toKruti(text)` (also `unicodeToKruti`) | Unicode to Kruti Dev 010. Latin words and digits are left as they are. |
| `convertWithReport(text, direction, options?)` | Either direction (`'kruti-to-unicode'` or `'unicode-to-kruti'`) plus a report: words kept as English and characters that could not be converted. (`stats.bangla` repeats `stats.devanagari` so code shared with the Bijoy package works.) |
| `detectEncoding(text)` | Guesses whether text is Kruti Dev, Unicode Hindi, English or mixed, with a confidence. |
| `isKrutiFont(name)` | True for Kruti Dev 010 under its Windows, PDF and Office names. |
| `splitIntoParts(text, size?)` | Cuts a long text at line breaks, so it can be converted part by part with the same result. |
| `KRUTI_FONT_NAMES` | Known Kruti Dev 010 font names. |

## Python

```python
from krutidev_unicode import to_unicode, to_kruti, convert_with_report, detect_encoding, is_kruti_font

to_unicode("esjk uke jke gSA")                       # 'मेरा नाम राम है।'
to_kruti("भारत सरकार")                               # 'Hkkjr ljdkj'
to_unicode("Word", keep_english=False)               # 'ॅवतक'
to_unicode('fo"k;% ge', visarga="visarga")
detect_encoding("esjk uke jke gSA")["kind"]          # 'kruti'
```

The Python functions take the same options as keyword arguments in snake case (`keep_english`, `visarga`), and `convert_with_report` / `detect_encoding` return dicts with the same keys as the JavaScript objects.

## Command line

```sh
npx @kovapdf/krutidev-unicode to-unicode < kruti.txt > unicode.txt
krutidev-unicode to-kruti unicode.txt > kruti.txt
krutidev-unicode to-unicode --no-keep-english --visarga=colon form.txt
python -m krutidev_unicode to-unicode < kruti.txt     # the Python package has the same CLI
```

Input is UTF-8 from a file or stdin; the result goes to stdout.

## Kruti Dev, Mangal and why text looks like "dk;kZy;"

* **Kruti Dev 010 is a legacy font.** It does not store Devanagari letters. It stores ordinary Latin codes on the old Remington typewriter layout and the font draws Hindi shapes on top of them. That is why Kruti Dev text turns into "dk;kZy;" (कार्यालय) when the font is missing, when it is pasted into a web form, or when a search engine reads it.
* **Mangal, Nirmala UI and Noto Sans Devanagari are Unicode fonts.** They show real Unicode Hindi, which every modern phone, browser and search engine understands. Text converted with this library should be set in a Unicode font.
* To go the other way (for a print shop or an exam form that still asks for Kruti Dev), convert Unicode to Kruti Dev and set the result in Kruti Dev 010.
* Only **Kruti Dev 010** is supported. DevLys 010 and other Kruti Dev numbers (011, 016, 055 ...) may use different codes and are not claimed.

This package contains no fonts. Install the fonts you need from their own publishers.

## How accurate is it?

The engine is the one KovaPDF uses on its website. It handles the chhoti i (ि) typed before the cluster, the reph (र्) typed after it, half letters, conjunct glyphs (क्ष त्र ज्ञ श्र द्ध ...), nukta letters, the colon or visarga `%`, curly quotes from Word, text copied out of PDFs, and English words mixed into Kruti text. `test/vectors.json` holds over 600 input and output pairs made by running the website engine on real words, sentences, conjuncts, numbers and mixed English; the JavaScript and the Python tests both check every one.

Keeping English words in Kruti text is a guess, because plain Kruti letters are themselves ASCII letters. `convertWithReport` lists every word it kept; turn it off with `keepEnglish: false`.

## Development

```sh
npm install && npm test             # builds dist/ and runs the tests
cd python && pip install -e . pytest && pytest
```

The engine in `src/engine` and the Python tables in `python/src/krutidev_unicode/_tables.py` are generated from the KovaPDF website engine by a sync script; please report conversion problems as issues rather than editing those files.

## Licence

The code is MIT licensed (see LICENSE). The KovaPDF name, logo and website content are not covered by that licence, and no fonts are included.
