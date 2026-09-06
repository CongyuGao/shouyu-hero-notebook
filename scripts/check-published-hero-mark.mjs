// Render the actual hero library without a browser or live database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('wrangler')] })
);
const output = await build({
  entryPoints: ['components/hero-library.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: ['react', 'react-dom', 'react/*', 'react-dom/*'],
  write: false,
  logLevel: 'silent',
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', output.outputFiles[0].text)(
  require,
  compiled,
  compiled.exports,
);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const guide = JSON.parse(readFileSync('data/initial-guides.json', 'utf8')).find(
  (guide) => guide.heroId === '166',
);
const roster = {
  intro: '',
  groups: [{ id: 'test', name: '测试批次', heroIds: ['166'] }],
};
function render(records) {
  return renderToStaticMarkup(
    React.createElement(compiled.exports.HeroLibrary, {
      roster,
      records,
      editable: false,
      loading: false,
      onOpen() {},
      onRosterSaved() {},
    }),
  );
}
const pending = render([]);
assert(
  !pending.includes('class="hero-published-label"'),
  'Reference data alone is not a published guide',
);
const draft = render([{ heroId: '166', published: null, draft: guide }]);
assert(
  !draft.includes('class="hero-published-label"'),
  'Private drafts must not light up a public hero',
);
const published = render([
  { heroId: '166', published: guide, publishedAt: '2026-09-07T00:00:00Z' },
]);
assert.match(published, /mode-hero-card has-guide/);
assert.match(published, /hero-published-label/);
assert.match(published, /攻略已发布/);
const css = readFileSync('app/globals.css', 'utf8');
assert.match(
  css,
  /prefers-reduced-motion: no-preference[\s\S]*animation: published-guide-glint/,
);
console.log(
  'PASS: only published guides receive the illuminated card and explicit badge; drafts and reference-only heroes remain unmarked.',
);
