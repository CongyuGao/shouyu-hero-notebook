// Component event tests with lightweight primitive/hook doubles; no browser or live writes.
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('wrangler')] })
);
const output = await build({
  entryPoints: ['components/tier-guide.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  packages: 'external',
  write: false,
  jsx: 'automatic',
  plugins: [
    {
      name: 'tier-entry-test-doubles',
      setup(build) {
        build.onResolve({ filter: /^react$/ }, () => ({
          path: 'hooks',
          namespace: 'test',
        }));
        build.onResolve({ filter: /^@\/components\/ui\// }, () => ({
          path: 'ui',
          namespace: 'test',
        }));
        build.onResolve({ filter: /^lucide-react$/ }, () => ({
          path: 'icons',
          namespace: 'test',
        }));
        build.onResolve({ filter: /^@\/lib\/client-api$/ }, () => ({
          path: 'api',
          namespace: 'test',
        }));
        build.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({
          contents:
            path === 'hooks'
              ? `
          export function useState(initial) {
            const h = globalThis.__tierEntryTest;
            const i = h.cursor++;
            if (!(i in h.states)) h.states[i] = initial;
            return [h.states[i], value => { h.states[i] = value; }];
          }
        `
              : path === 'api'
                ? `
          export async function apiFetch() { return globalThis.__tierEntryTest.settings; }
          export async function readResponse(value) { return value; }
        `
                : (path === 'icons'
                    ? ['Pencil']
                    : [
                        'Button',
                        'Textarea',
                        'Dialog',
                        'DialogContent',
                        'DialogHeader',
                        'DialogTitle',
                        'DialogDescription',
                        'DialogFooter',
                      ]
                  )
                    .map((name) => `export const ${name} = '${name}';`)
                    .join('\n'),
          loader: 'js',
        }));
      },
    },
  ],
});
const filename = resolve('scripts/.tier-entry-test.cjs');
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = require.resolve.paths('react');
compiled._compile(output.outputFiles[0].text, filename);
const { TierGuide } = compiled.exports;
function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  return node?.props ? [node, ...all(node.props.children)] : [];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  return node?.props
    ? text(node.props.children)
    : typeof node === 'string'
      ? node
      : '';
}
const findButton = (tree, label) =>
  all(tree).find((n) => n.type === 'Button' && text(n).includes(label));
function session(props) {
  globalThis.__tierEntryTest = {
    cursor: 0,
    states: [],
    settings: {
      revision: 2,
      context: '共同标准',
      items: [{ tier: 'T1.5', description: '已保存的判断标准' }],
    },
  };
  const render = () => {
    globalThis.__tierEntryTest.cursor = 0;
    return TierGuide(props);
  };
  return { render };
}
try {
  for (const tier of ['T1.5', undefined]) {
    let edited = 0;
    const { render } = session({
      editable: true,
      tier: tier || '未评级',
      hero: { name: '暃', tier, onEdit: () => edited++ },
    });
    let tree = render();
    all(tree)
      .find((n) => n.type === 'Button')
      .props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    tree = render();
    assert.equal(all(tree).find((n) => n.type === 'Dialog').props.open, true);
    assert(text(tree).includes('暃 · 当前评级'));
    assert(text(tree).includes(tier ? '已保存的判断标准' : '该英雄尚未评级'));
    findButton(tree, '修改本英雄评级').props.onClick();
    assert.equal(edited, 1);
    assert.equal(
      all(render()).find((n) => n.type === 'Dialog').props.open,
      false,
    );
  }
  let tree = session({
    editable: false,
    hero: { name: '暃', onEdit: () => assert.fail('readonly') },
  }).render();
  assert(!findButton(tree, '修改本英雄评级'));
  assert(!findButton(tree, '编辑标准'));
  tree = session({ editable: true }).render();
  assert(
    !findButton(tree, '修改本英雄评级'),
    'Global standards have no arbitrary hero target',
  );
  assert(findButton(tree, '编辑标准'));
  const editing = session({
    editable: true,
    hero: { name: '暃', onEdit() {} },
  });
  findButton(editing.render(), '编辑标准').props.onClick();
  assert(
    !findButton(editing.render(), '修改本英雄评级'),
    'Cannot discard an unsaved standard through the shortcut',
  );

  const view = readFileSync('components/guide-view.tsx', 'utf8');
  const editor = readFileSync('components/guide-editor.tsx', 'utf8');
  assert.equal(
    view.match(/onEdit\(0, buildId, \{ kind: 'tier' \}\)/g).length,
    2,
    'Both hero tier triggers pass the exact edit target',
  );
  assert(editor.includes("initialTarget?.kind === 'tier'"));
  assert(
    editor.includes(
      'record?.draft || record?.published || blankGuide(initialHeroId)',
    ),
  );
  assert.equal(editor.match(/id="hero-strength-tier"/g).length, 1);
  assert(
    editor.indexOf('hero-rating-heading') <
      editor.indexOf('选择模式英雄，补充英雄资料'),
  );
  console.log(
    'PASS: rated/unrated hero shortcuts, readonly/global contexts, standard-edit isolation, dialog closure, both routes, draft-first editor and single top-of-panel rating field.',
  );
} finally {
  delete globalThis.__tierEntryTest;
}
