// Behavioral scheduler tests plus source contracts; no browser UI automation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('wrangler')] })
);
const output = await build({
  entryPoints: ['lib/navigation-scroll.ts'],
  bundle: true,
  format: 'esm',
  write: false,
});
const { scheduleScrollToTop } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`
);
const frames = new Map();
let next = 0;
globalThis.requestAnimationFrame = (fn) => {
  frames.set(++next, fn);
  return next;
};
globalThis.cancelAnimationFrame = (id) => frames.delete(id);
function paint() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((fn) => fn());
}
const calls = [];
let target = null;
scheduleScrollToTop(() => target);
assert.equal(calls.length, 0, 'Never scroll the old panel before commit');
target = { scrollTo: (value) => calls.push(value) };
paint();
assert.deepEqual(calls, [{ top: 0, left: 0, behavior: 'instant' }]);
const cancel = scheduleScrollToTop(() => target);
cancel();
paint();
assert.equal(calls.length, 1, 'Obsolete navigation must cancel');
scheduleScrollToTop(() => null);
paint();
const editor = readFileSync('components/guide-editor.tsx', 'utf8');
assert.match(editor, /className="editor-scroll" ref=\{editorScroll\}/);
assert.match(
  editor,
  /scheduleScrollToTop\(\(\) => editorScroll\.current\),\s*\[editorTab, preview, buildId\]/,
);
const notebook = readFileSync('app/notebook.tsx', 'utf8');
assert.match(
  notebook,
  /scheduleScrollToTop\(\(\) => window\),\s*\[tab, selected\]/,
);
assert.match(notebook, /scrollRestoration = 'manual'/);
assert.match(notebook, /scrollRestoration = previous/);
console.log(
  'PASS: committed navigation scrolls the correct container, cancelled transitions are ignored, and typing/data refresh are not reset dependencies.',
);
