import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cli = new URL('../bin/krutidev-unicode.mjs', import.meta.url).pathname;
const run = (args, input) => execFileSync(process.execPath, [cli, ...args], { input, encoding: 'utf8' });

test('to-unicode reads stdin', () => {
  assert.equal(run(['to-unicode'], 'esjk uke jke gSA'), 'मेरा नाम राम है।');
});
test('to-kruti reads a file', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ku-')), 'in.txt');
  fs.writeFileSync(f, 'भारत सरकार');
  assert.equal(run(['to-kruti', f]), 'Hkkjr ljdkj');
});
test('options', () => {
  assert.equal(run(['to-unicode'], 'PDF Q+kby'), 'PDF फ़ाइल');
  assert.equal(run(['to-unicode', '--no-keep-english'], 'Word'), 'ॅवतक');
});
test('help, version and bad use', () => {
  assert.match(run(['--help']), /kovapdf\.com\/kruti-dev-to-unicode/);
  assert.match(run(['--version']), /KovaPDF/);
  assert.equal(spawnSync(process.execPath, [cli, 'to-unicode', '--bogus'], { encoding: 'utf8' }).status, 2);
});
