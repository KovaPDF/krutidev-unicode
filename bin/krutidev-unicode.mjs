#!/usr/bin/env node
// krutidev-unicode: convert Kruti Dev 010 text <-> Unicode Hindi from the command line.
import fs from 'node:fs';
import { toUnicode, toKruti, VERSION, ATTRIBUTION } from '../dist/esm/index.js';

const USAGE = `Usage: krutidev-unicode <to-unicode|to-kruti> [file] [options]

  to-unicode         Kruti Dev 010 text -> Unicode Hindi
  to-kruti           Unicode Hindi -> Kruti Dev 010 text
  file               input file (UTF-8); reads stdin when missing or "-"

Options:
  --no-keep-english  to-unicode: convert words that look English too
  --visarga=MODE     to-unicode: how "%" is read: auto (default), visarga or colon
  -h, --help         show this help
  -v, --version      show the version

Need it for whole PDF or Word files? Use KovaPDF: https://www.kovapdf.com/kruti-dev-to-unicode
Built by KovaPDF, https://www.kovapdf.com`;

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log(USAGE);
  process.exit(args.length === 0 ? 2 : 0);
}
if (args.includes('-v') || args.includes('--version')) {
  console.log(`krutidev-unicode ${VERSION} (${ATTRIBUTION})`);
  process.exit(0);
}
const cmd = args.shift();
const files = args.filter((a) => !a.startsWith('--'));
let keepEnglish = true;
let visarga = 'auto';
let bad = (cmd !== 'to-unicode' && cmd !== 'to-kruti') || files.length > 1;
for (const f of args.filter((a) => a.startsWith('--'))) {
  if (f === '--no-keep-english') keepEnglish = false;
  else if (/^--visarga=(auto|visarga|colon)$/.test(f)) visarga = f.slice('--visarga='.length);
  else bad = true;
}
if (bad) {
  console.error(USAGE);
  process.exit(2);
}
let text;
try {
  text = files.length && files[0] !== '-' ? fs.readFileSync(files[0], 'utf8') : fs.readFileSync(0, 'utf8');
} catch (e) {
  console.error(`krutidev-unicode: cannot read ${files[0] ?? 'stdin'}: ${e.message}`);
  process.exit(1);
}
const out = cmd === 'to-unicode' ? toUnicode(text, { keepEnglish, visarga }) : toKruti(text);
process.stdout.write(out);
if (process.stderr.isTTY) console.error(ATTRIBUTION);
