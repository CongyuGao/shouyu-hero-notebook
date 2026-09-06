// Source-level layout contracts; this is not a browser interaction test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');
function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [
    ...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'g')),
  ];
  assert.equal(matches.length, 1, `Expected one scoped rule for ${selector}`);
  return matches[0][1];
}
const popup = declarations(
  ".scrollable-site-dialog[data-slot='dialog-content']",
);
assert.match(popup, /max-height:\s*calc\(100vh - 2rem\)/);
assert.match(popup, /max-height:\s*calc\(100dvh - 2rem\)/);
assert.match(popup, /overflow-y:\s*auto/);
assert.match(popup, /touch-action:\s*pan-y pinch-zoom/);
assert.match(popup, /overscroll-behavior-y:\s*contain/);
assert.match(
  declarations(".scrollable-site-dialog[data-slot='dialog-content'] > *"),
  /flex-shrink:\s*0/,
);
const fields = declarations('.tier-guide-dialog > .detail-edit-fields');
assert.match(fields, /flex:\s*none/);
assert.match(fields, /overflow:\s*visible/);
for (const filename of [
  'components/guide-export-dialog.tsx',
  'components/tier-guide.tsx',
  'components/hero-poster-picker.tsx',
])
  assert.match(
    readFileSync(filename, 'utf8'),
    /<DialogContent\s+className="[^"]*scrollable-site-dialog/,
  );
const exporter = readFileSync('components/guide-export-dialog.tsx', 'utf8');
assert.match(exporter, /images\.map\(/);
assert(!exporter.includes('ChevronLeft') && !exporter.includes('ChevronRight'));
console.log(
  'PASS: both long dialogs use a viewport-bounded scroll area, non-shrinking content, and touch scrolling; tier fieldset is not a nested scroll trap.',
);
