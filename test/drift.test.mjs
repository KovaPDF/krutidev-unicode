// Drift check: inside the KovaPDF monorepo, the engine copy in src/engine must
// equal the website engine byte for byte (the full check, including the
// Python tables and the vectors, is packages/scripts/sync-font-libs.mjs --check).
// Skipped in the standalone public repository, where the website is not present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const site = new URL('../../../frontend/lib/', import.meta.url);
const present = fs.existsSync(new URL('hindi/kruti.ts', site));

test('src/engine equals the website engine', { skip: !present && 'website engine not present (standalone repo)' }, () => {
  for (const f of ['hindi/kruti.ts', 'hindi/krutiMap.ts', 'hindi/hindiEnglish.ts', 'bangla/englishWords.ts']) {
    const a = fs.readFileSync(new URL(f, site));
    const b = fs.readFileSync(new URL(`../src/engine/${f}`, import.meta.url));
    assert.ok(a.equals(b), `src/engine/${f} differs from frontend/lib/${f}: run node packages/scripts/sync-font-libs.mjs`);
  }
});
