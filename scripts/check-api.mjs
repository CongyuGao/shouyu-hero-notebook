// This integration check is intentionally restricted to the fresh local preview.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const origin = process.argv[2] || 'http://localhost:3000';
assert.equal(
  new URL(origin).hostname,
  'localhost',
  'Never run write tests on a deployed site',
);
const marker = `TEST_ONLY_${Date.now()}`;
const headers = {
  Cookie: '__sites_local_auth=1',
  'Content-Type': 'application/json',
  Origin: origin,
};
const api = async (path, options = {}) => {
  const r = await fetch(`${origin}${path}`, options);
  const t = await r.text();
  let data;
  try {
    data = JSON.parse(t);
  } catch {
    data = { error: t };
  }
  return { status: r.status, data };
};
const post = (payload, extra = {}) =>
  api('/api/guides', {
    method: 'POST',
    headers: { ...headers, ...extra },
    body: JSON.stringify(payload),
  });
let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`PASS ${name}`);
};
const initial = await api('/api/guides', { headers });
assert.equal(initial.data.access.isAdmin, true);
assert(
  !initial.data.guides.some((g) => g.heroId === '105'),
  'Do not overwrite existing hero content',
);
const doc = {
  heroId: '105',
  title: marker,
  author: '自动检查（非游戏资料）',
  intro: '',
  version: 'TEST',
  source: '隔离功能检查',
  verified: false,
  talents: Array.from({ length: 24 }, (_, i) => ({
    id: `t${String(i + 1).padStart(2, '0')}`,
    name: `测试天赋${i + 1}`,
    description: '非游戏数据',
  })),
  builds: [
    {
      id: 'test-build',
      name: '测试流派',
      summary: '非游戏攻略',
      order: '',
      talentIds: ['t01'],
      picks: [],
      glyphs: '',
      runes: '',
      arcana: '',
      notes: '',
      coreIds: ['test-core'],
      glyphIds: ['test-glyph'],
    },
  ],
  glyphs: [
    {
      id: 'test-glyph',
      name: '测试雕文',
      effect: '非游戏数据',
      usage: '仅测试',
    },
  ],
  cores: [
    { id: 'test-core', skill: 1, name: '测试核心', description: '非游戏数据' },
  ],
};
try {
  let r = await api('/api/guides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc, action: 'publish', expectedRevision: 0 }),
  });
  check('anonymous write denied', () => assert.equal(r.status, 401));
  r = await api('/api/guides', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'oai-authenticated-user-id': 'fake',
      'oai-authenticated-user-email': 'seedy@sites.test',
    },
    body: JSON.stringify({ doc, action: 'publish', expectedRevision: 0 }),
  });
  check('spoofed identity headers denied', () => assert.equal(r.status, 401));
  r = await api('/api/editors');
  check('editor list hidden from anonymous', () => assert.equal(r.status, 401));
  r = await post(null);
  check('malformed object rejected', () => assert.equal(r.status, 400));
  r = await post(
    { doc, action: 'draft', expectedRevision: 0 },
    { Origin: 'https://other.example' },
  );
  check('cross-origin write denied', () => assert.equal(r.status, 403));
  r = await post({ doc, action: 'draft', expectedRevision: 0 });
  check('draft persisted', () => {
    assert.equal(r.status, 200);
    assert.equal(r.data.revision, 1);
  });
  r = await api('/api/guides');
  check('draft hidden from readers', () =>
    assert(!r.data.guides.some((g) => g.heroId === '105')),
  );
  r = await post({
    doc: { ...doc, title: '' },
    action: 'publish',
    expectedRevision: 1,
  });
  check('incomplete publishing rejected', () => assert.equal(r.status, 400));
  r = await post({ doc, action: 'publish', expectedRevision: 1 });
  check('valid guide published', () => {
    assert.equal(r.status, 200);
    assert.equal(r.data.revision, 2);
    assert(r.data.publishedAt);
  });
  const publishedAt = r.data.publishedAt;
  r = await api('/api/guides');
  let visible = r.data.guides.find((g) => g.heroId === '105');
  check('public payload excludes draft and identity', () => {
    assert.equal(visible.published.title, marker);
    assert.equal(visible.draft, undefined);
    assert.equal(visible.updatedBy, undefined);
    assert.equal(visible.published.glyphs[0].name, '测试雕文');
    assert.equal(visible.published.talents.length, 24);
    assert.deepEqual(visible.published.builds[0].coreIds, ['test-core']);
    assert.deepEqual(visible.published.builds[0].glyphIds, ['test-glyph']);
  });
  r = await post({
    doc: { ...doc, title: marker + '_PRIVATE' },
    action: 'draft',
    expectedRevision: 2,
  });
  check('draft keeps actual publication timestamp', () =>
    assert.equal(r.data.publishedAt, publishedAt),
  );
  r = await api('/api/guides');
  check('saving draft does not change public guide', () =>
    assert.equal(
      r.data.guides.find((g) => g.heroId === '105').published.title,
      marker,
    ),
  );
  const conflict = await Promise.all([
    post({
      doc: { ...doc, title: marker + '_A' },
      action: 'draft',
      expectedRevision: 3,
    }),
    post({
      doc: { ...doc, title: marker + '_B' },
      action: 'draft',
      expectedRevision: 3,
    }),
  ]);
  check('concurrent updates do not overwrite', () =>
    assert.deepEqual(conflict.map((x) => x.status).sort(), [200, 409]),
  );
  r = await api('/api/history?heroId=105', { headers });
  check('history includes successful mutations only', () => {
    assert.equal(r.data.length, 4);
    assert.equal(r.data[0].revision, 4);
  });
  r = await post({ doc, action: 'unpublish', expectedRevision: 4 });
  check('unpublish preserves draft', () => assert.equal(r.data.revision, 5));
  r = await api('/api/guides');
  check('unpublished guide hidden', () =>
    assert(!r.data.guides.some((g) => g.heroId === '105')),
  );
  r = await api('/api/guides', { headers });
  check('saved content survives new request', () =>
    assert.equal(
      r.data.guides.find((g) => g.heroId === '105').draft.title,
      marker,
    ),
  );
  const email = `test-${marker.toLowerCase()}@example.test`;
  r = await api('/api/editors', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, action: 'add' }),
  });
  check('admin grants permission', () => assert.equal(r.status, 200));
  r = await api('/api/editors', { headers });
  check('grant stored', () => assert(r.data.some((e) => e.email === email)));
  r = await api('/api/editors', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, action: 'remove' }),
  });
  check('admin revokes permission', () => assert.equal(r.status, 200));
  console.log(`${passed} integration checks passed`);
} finally {
  const database =
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite';
  execFileSync('/usr/bin/sqlite3', [
    database,
    `BEGIN; DELETE FROM revisions WHERE hero_id='105' AND json_extract(snapshot,'$.title') LIKE '${marker}%'; DELETE FROM guides WHERE hero_id='105' AND json_extract(draft_json,'$.title') LIKE '${marker}%'; DELETE FROM editors WHERE email='test-${marker.toLowerCase()}@example.test'; COMMIT;`,
  ]);
  console.log('Removed only this run’s temporary local test rows.');
}
