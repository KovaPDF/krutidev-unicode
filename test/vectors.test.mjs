// Shared test vectors (test/vectors.json, made by running the KovaPDF website
// engine) against the built package, through both import and require.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as esm from '../dist/esm/index.js';

const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
const vectors = JSON.parse(fs.readFileSync(new URL('./vectors.json', import.meta.url), 'utf8'));

function run(lib, v) {
  const o = v.options ?? {};
  switch (v.fn) {
    case 'toUnicode': return lib.toUnicode(v.input, o);
    case 'toKruti': return lib.toKruti(v.input, o);
    case 'convertWithReport': return lib.convertWithReport(v.input, o.direction, o);
    case 'detectEncoding': return lib.detectEncoding(v.input);
    case 'isKrutiFont': return lib.isKrutiFont(v.input);
    case 'splitIntoParts': return lib.splitIntoParts(v.input, o.size);
    default: throw new Error('unknown fn ' + v.fn);
  }
}

test('at least 100 vectors', () => assert.ok(vectors.length >= 100, String(vectors.length)));

for (const [name, lib] of [['import', esm], ['require', cjs]]) {
  test(`${name}: every vector`, () => {
    let pass = 0;
    for (const v of vectors) {
      assert.deepStrictEqual(run(lib, v), v.expected, `vector #${v.id} (${v.fn}) ${JSON.stringify(v.input).slice(0, 80)}`);
      pass++;
    }
    assert.equal(pass, vectors.length);
  });
}

test('exports', () => {
  for (const lib of [esm, cjs]) {
    assert.equal(lib.toUnicode, lib.krutiToUnicode);
    assert.equal(lib.toKruti, lib.unicodeToKruti);
    assert.ok(lib.KRUTI_FONT_NAMES.includes('Kruti Dev 010'));
    assert.match(lib.ATTRIBUTION, /KovaPDF/);
    assert.equal(lib.VERSION, JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  }
});
