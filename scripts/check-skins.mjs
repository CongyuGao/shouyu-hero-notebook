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
const { heroSkins, validatePosterId, skinImageUrl, isPinnedSkinImage } =
  await moduleFrom('lib/skins.ts');
const { blankGuide, validateGuide } = await moduleFrom('lib/guide.ts');
const { createGuideExport } = await moduleFrom('lib/guide-export.ts');
assert.equal(heroSkins.length, 363);
assert.equal(new Set(heroSkins.map((skin) => skin.id)).size, 363);
assert.equal(new Set(heroSkins.map((skin) => skin.heroId)).size, 42);
assert.equal(heroSkins.filter((skin) => skin.heroId === '151').length, 2);
const originalCatalog = JSON.parse(
  readFileSync('data/hero-skins.json', 'utf8'),
);
for (const original of originalCatalog)
  assert.deepEqual(
    heroSkins.find((skin) => skin.id === original.id),
    original,
    'Existing poster identities and URLs must remain valid',
  );
assert(
  heroSkins.some((skin) => skin.heroId === '542' && skin.name === '朽木白哉'),
);
for (const skin of heroSkins) {
  for (const key of ['image', 'thumbnail', 'avatar'])
    assert(
      isPinnedSkinImage(skin[key]),
      `Rejected catalog asset ${skin.id}/${key}`,
    );
  assert.equal(validatePosterId(skin.id, skin.heroId), skin.id);
}
const added = heroSkins.find(
  (skin) => skin.heroId === '542' && skin.name === '朽木白哉',
);
for (const invalid of [
  added.image.replace('/d3968d118d5587ed4ebfcdaa5582fe6cb190e77a/', '/main/'),
  added.image.replace('raw.githubusercontent.com', 'attacker.example'),
  added.image.replace('5wallpaper-bigskin-images/', 'private-files/'),
  added.image.replace(/[^/]+$/, '%2Fsecret.jpg'),
  added.image + '?redirect=https://attacker.example',
])
  assert.equal(isPinnedSkinImage(invalid), false);
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
  const communityResponse = await GET(
    new Request(
      `https://example.com/api/skin-image?id=${added.id}&size=thumbnail`,
    ),
  );
  assert.equal(communityResponse.status, 200);
  assert.equal(fetched.at(-1).url, added.thumbnail);
  assert.equal(fetched.at(-1).options.redirect, 'manual');
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
  'PASS: 363 pinned catalog entries, 42 heroes, existing poster compatibility, manual-only selection, published-only export, restricted two-source image proxy.',
);
