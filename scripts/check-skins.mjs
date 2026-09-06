import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('wrangler')] })
);
async function moduleFrom(path) {
  const compiled = await build({
    entryPoints: [path],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
  );
}
const { heroSkins, validatePosterId, skinImageUrl } =
  await moduleFrom('lib/skins.ts');
const { blankGuide, validateGuide } = await moduleFrom('lib/guide.ts');
const { createGuideExport } = await moduleFrom('lib/guide-export.ts');
assert.equal(heroSkins.length, 304);
assert.equal(new Set(heroSkins.map((skin) => skin.id)).size, 304);
assert.equal(new Set(heroSkins.map((skin) => skin.heroId)).size, 41);
assert(!heroSkins.some((skin) => skin.heroId === '151'));
for (const skin of heroSkins) {
  for (const key of ['image', 'thumbnail', 'avatar'])
    assert.match(
      skin[key],
      /^https:\/\/raw\.githubusercontent\.com\/lengyibai\/wzry-material\/[a-f0-9]{40}\/heros\/[a-zA-Z0-9_\-]+\.(webp|png|jpg|jpeg)$/,
    );
  assert.equal(validatePosterId(skin.id, skin.heroId), skin.id);
}
assert(!blankGuide('166').posterId, 'New guides never auto-select a poster');
assert.equal(validatePosterId(undefined, '166'), '');
const arthur = heroSkins.filter((skin) => skin.heroId === '166');
assert.throws(() => validatePosterId(arthur[0].id, '128'));
assert.throws(() => validatePosterId('https://example.com/image.png', '166'));
const guide = structuredClone(
  JSON.parse(readFileSync('data/initial-guides.json', 'utf8')).find(
    (guide) => guide.heroId === '166',
  ),
);
guide.posterId = arthur[0].id;
assert.equal(validateGuide(guide, true).posterId, arthur[0].id);
assert.throws(() =>
  validateGuide({
    ...guide,
    posterId: heroSkins.find((skin) => skin.heroId === '128').id,
  }),
);
const model = createGuideExport(
  {
    published: guide,
    publishedAt: '2026-09-07T00:00:00Z',
    draft: { ...guide, posterId: arthur[1].id },
  },
  guide.builds[0].id,
  'https://example.com',
);
assert.equal(model.poster.image, skinImageUrl(arthur[0].id));
assert(
  !JSON.stringify(model).includes(arthur[1].id),
  'Draft posters stay private',
);
const { GET } = await moduleFrom('app/api/skin-image/route.ts');
const originalFetch = globalThis.fetch;
const fetched = [];
globalThis.fetch = async (url, options) => {
  fetched.push({ url, options });
  return new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'Content-Type': 'image/webp' },
  });
};
try {
  for (const query of [
    'id=missing',
    `id=${arthur[0].id}&size=constructor`,
    'id=https://example.com/a.webp',
  ])
    assert.equal(
      (await GET(new Request(`https://example.com/api/skin-image?${query}`)))
        .status,
      404,
    );
  assert.equal(fetched.length, 0);
  const response = await GET(
    new Request(
      `https://example.com/api/skin-image?id=${arthur[0].id}&url=https://attacker.example/private`,
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].url, arthur[0].image);
  assert.equal(fetched[0].options.redirect, 'manual');
  assert.match(response.headers.get('Cache-Control'), /public/);
  for (const status of [301, 302, 307, 308, 404, 503]) {
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      assert.equal(options.redirect, 'manual');
      return new Response(null, {
        status,
        headers: {
          Location: 'https://attacker.example/private',
          'Content-Type': 'image/webp',
        },
      });
    };
    assert.equal(
      (
        await GET(
          new Request(`https://example.com/api/skin-image?id=${arthur[0].id}`),
        )
      ).status,
      502,
      `Upstream ${status} must not be served or followed`,
    );
    assert.equal(calls, 1, 'Redirect targets must never be fetched');
  }
  globalThis.fetch = async () =>
    new Response('<html>not an image</html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  assert.equal(
    (
      await GET(
        new Request(`https://example.com/api/skin-image?id=${arthur[0].id}`),
      )
    ).status,
    502,
  );
  globalThis.fetch = async () => {
    throw new Error('network unavailable');
  };
  assert.equal(
    (
      await GET(
        new Request(`https://example.com/api/skin-image?id=${arthur[0].id}`),
      )
    ).status,
    502,
  );
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  'PASS: 304 pinned catalog entries, manual-only selection, hero validation, published-only export, restricted public image proxy.',
);
