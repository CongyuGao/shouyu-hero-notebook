// Local only. Does not alter real guides/libraries or an existing editor link.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const origin = process.argv[2] || 'http://localhost:3000';
assert.equal(
  new URL(origin).hostname,
  'localhost',
  'Never run on a deployed site',
);
const database =
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite';
const sql = (query) =>
  execFileSync('/usr/bin/sqlite3', [database, query], {
    encoding: 'utf8',
  }).trim();
assert.equal(
  sql("SELECT count(*) FROM edit_links WHERE id='main'"),
  '0',
  'An editor link already exists: refuse to rotate any user-owned link',
);
assert.equal(
  sql("SELECT count(*) FROM guides WHERE hero_id='105'"),
  '0',
  'Never overwrite user guide 105',
);
const baseline = sql(
  "SELECT json_group_array(json_object('hero',hero_id,'draft',draft_json,'published',published_json,'revision',revision,'updated',updated_at)) FROM guides WHERE hero_id<>'105'",
);
const librariesBefore = sql(
  "SELECT json_group_array(json_object('kind',kind,'items',items_json,'revision',revision,'updated',updated_at)) FROM libraries",
);
const marker = `LINK_TEST_${Date.now()}`;
const jsonHeaders = { Origin: origin, 'Content-Type': 'application/json' };
const owner = {
  ...jsonHeaders,
  Cookie: '__sites_local_auth=1',
  'x-notebook-mode': 'manage',
};
const requests = async (
  path,
  headers = {},
  data,
  method = data === undefined ? 'GET' : 'POST',
) => {
  const response = await fetch(origin + path, {
    method,
    headers,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { error: text };
  }
  return { status: response.status, data: result, headers: response.headers };
};
let passed = 0;
const check = (name, condition) => {
  assert(condition, name);
  passed++;
  console.log('PASS ' + name);
};
const hashes = new Set();
let ownedRevokedRow = '';
let editor;
const sha = (key) => createHash('sha256').update(key).digest('hex');
const writeRoutes = [
  '/api/guides',
  '/api/library',
  '/api/primer',
  '/api/roster',
  '/api/tiers',
];
const guide = {
  heroId: '105',
  title: marker,
  author: '隔离接口测试',
  intro: '',
  version: 'TEST',
  source: '',
  verified: false,
  talents: Array.from({ length: 24 }, (_, i) => ({
    id: `t${String(i + 1).padStart(2, '0')}`,
    skill: Math.floor(i / 8) + 1,
    name: `测试天赋${i}`,
    description: '非游戏数据',
  })),
  builds: [
    {
      id: 'test-build',
      name: '隔离测试',
      summary: '非游戏攻略',
      order: '',
      glyphs: '',
      runes: '',
      arcana: '',
      notes: '',
      talentIds: Array.from({ length: 24 }, (_, i) => i)
        .filter((i) => i % 8 < 6)
        .map((i) => `t${String(i + 1).padStart(2, '0')}`),
      picks: [],
      coreIds: [],
      glyphIds: [],
      runeIds: [],
      runeCounts: {},
    },
  ],
  cores: [],
  glyphs: [],
  runeLibrary: [],
};
try {
  for (const route of writeRoutes)
    check(
      'anonymous denied ' + route,
      (await requests(route, { ...jsonHeaders, 'x-notebook-mode': 'edit' }, {}))
        .status === 401,
    );
  check(
    'anonymous owner metadata denied',
    (await requests('/api/edit-link')).status === 401,
  );
  check(
    'legacy grant API disabled',
    (await requests('/api/editors', owner, {})).status === 410,
  );
  check(
    'spoofed owner denied',
    (
      await requests(
        '/api/edit-link',
        {
          ...jsonHeaders,
          'x-notebook-mode': 'manage',
          'oai-authenticated-user-id': 'fake',
          'oai-authenticated-user-email': 'seedy@sites.test',
        },
        { action: 'create', expectedRevision: 0, hours: 168 },
      )
    ).status === 401,
  );
  check(
    'invalid duration denied',
    (
      await requests('/api/edit-link', owner, {
        action: 'create',
        expectedRevision: 0,
        hours: 0,
      })
    ).status === 400,
  );
  let r = await requests('/api/edit-link', owner, {
    action: 'create',
    expectedRevision: 0,
    hours: 168,
  });
  check(
    'owner creates expiring link',
    r.status === 200 &&
      /^[a-f0-9]{64}$/.test(r.data.key) &&
      Date.parse(r.data.expiresAt) > Date.now(),
  );
  const firstKey = r.data.key;
  hashes.add(sha(firstKey));
  check(
    'D1 stores only hash',
    sql("SELECT token_hash FROM edit_links WHERE id='main'") === sha(firstKey),
  );
  r = await requests('/api/edit-link', owner);
  check(
    'owner GET never returns secret/hash',
    r.status === 200 &&
      !('key' in r.data) &&
      !JSON.stringify(r.data).includes(firstKey) &&
      !('token_hash' in r.data),
  );
  check(
    'cross-origin exchange denied',
    (
      await requests(
        '/api/edit-session',
        { ...jsonHeaders, Origin: 'https://other.example' },
        { key: firstKey },
      )
    ).status === 403,
  );
  check(
    'missing Origin denied',
    (
      await requests(
        '/api/edit-session',
        { 'Content-Type': 'application/json' },
        { key: firstKey },
      )
    ).status === 403,
  );
  check(
    'invalid link denied',
    (await requests('/api/edit-session', jsonHeaders, { key: '0'.repeat(64) }))
      .status === 401,
  );
  r = await requests('/api/edit-session', jsonHeaders, { key: firstKey });
  check('no-login link exchange', r.status === 200);
  const cookie = r.headers.get('set-cookie');
  check(
    'cookie HttpOnly Strict and API scoped',
    /HttpOnly/i.test(cookie) &&
      /SameSite=Strict/i.test(cookie) &&
      /Path=\/api/i.test(cookie),
  );
  editor = {
    ...jsonHeaders,
    'x-notebook-mode': 'edit',
    Cookie: cookie.split(';')[0],
  };
  check(
    'link holder has edit but not owner access',
    (await requests('/api/guides', editor)).data.access.canEdit &&
      !(await requests('/api/guides', editor)).data.access.isAdmin,
  );
  check(
    'link holder cannot rotate link',
    (
      await requests('/api/edit-link', editor, {
        action: 'rotate',
        expectedRevision: 1,
        hours: 24,
      })
    ).status === 403,
  );
  for (const route of writeRoutes)
    check(
      'authenticated route reaches validation ' + route,
      (await requests(route, editor, {})).status === 400,
    );
  r = await requests('/api/guides', editor, {
    doc: guide,
    action: 'draft',
    expectedRevision: 0,
  });
  if (r.status !== 200)
    console.error('Draft test response:', r.status, r.data.error);
  check(
    '18 selections persist as 6 per skill',
    r.status === 200 && r.data.revision === 1,
  );
  r = await requests('/api/guides', { Cookie: editor.Cookie });
  check(
    'ordinary mode read-only even with editor cookie',
    r.data.access.canEdit === false &&
      r.data.guides.every((g) => g.draft === undefined) &&
      !r.data.guides.some((g) => g.heroId === '105'),
  );
  check(
    'owner cookie alone keeps ordinary reading mode',
    !(await requests('/api/guides', { Cookie: '__sites_local_auth=1' })).data
      .access.canEdit,
  );
  check(
    'history not visible in read mode',
    (await requests('/api/history?heroId=105', { Cookie: editor.Cookie }))
      .status === 401,
  );
  const overflow = structuredClone(guide);
  overflow.builds[0].talentIds.push('t07');
  r = await requests('/api/guides', editor, {
    doc: overflow,
    action: 'draft',
    expectedRevision: 1,
  });
  check(
    'server rejects seventh from one skill',
    r.status === 400 && /一技能/.test(r.data.error),
  );
  r = await requests('/api/guides', editor, {
    doc: guide,
    action: 'publish',
    expectedRevision: 1,
  });
  check('link holder can publish', r.status === 200 && r.data.revision === 2);
  const publishedAt = r.data.publishedAt;
  r = await requests('/api/guides', editor, {
    doc: guide,
    action: 'draft',
    expectedRevision: 2,
  });
  check(
    'draft saves preserve publication date',
    r.status === 200 && r.data.publishedAt === publishedAt,
  );
  const conflict = await Promise.all([
    requests('/api/guides', editor, {
      doc: guide,
      action: 'draft',
      expectedRevision: 3,
    }),
    requests('/api/guides', editor, {
      doc: guide,
      action: 'draft',
      expectedRevision: 3,
    }),
  ]);
  check(
    'concurrent saves still use CAS',
    conflict
      .map((r) => r.status)
      .sort()
      .join(',') === '200,409',
  );
  const hash = sha(firstKey);
  sql(
    `UPDATE edit_links SET expires_at='2000-01-01T00:00:00.000Z' WHERE id='main' AND token_hash='${hash}' AND revision=1`,
  );
  check(
    'expired link cannot exchange',
    (await requests('/api/edit-session', jsonHeaders, { key: firstKey }))
      .status === 401,
  );
  for (const route of writeRoutes)
    check(
      'expired session denied ' + route,
      (await requests(route, editor, {})).status === 401,
    );
  check(
    'expired session cannot read history',
    (await requests('/api/history?heroId=105', editor)).status === 401,
  );
  r = await requests('/api/edit-link', owner, {
    action: 'rotate',
    expectedRevision: 1,
    hours: 24,
  });
  check('owner rotates link', r.status === 200);
  const secondKey = r.data.key;
  hashes.add(sha(secondKey));
  check(
    'rotated old key rejected',
    (await requests('/api/edit-session', jsonHeaders, { key: firstKey }))
      .status === 401,
  );
  r = await requests('/api/edit-session', jsonHeaders, { key: secondKey });
  check('new link works', r.status === 200);
  const nextEditor = {
    ...editor,
    Cookie: r.headers.get('set-cookie').split(';')[0],
  };
  check(
    'stale owner rotation conflicts',
    (
      await requests('/api/edit-link', owner, {
        action: 'rotate',
        expectedRevision: 1,
        hours: 24,
      })
    ).status === 409,
  );
  r = await requests('/api/edit-link', owner, {
    action: 'revoke',
    expectedRevision: 2,
  });
  check('owner revokes', r.status === 200);
  ownedRevokedRow = sql(
    "SELECT updated_at FROM edit_links WHERE id='main' AND revision=3 AND token_hash IS NULL",
  );
  check(
    'revoked link cannot exchange',
    (await requests('/api/edit-session', jsonHeaders, { key: secondKey }))
      .status === 401,
  );
  check(
    'already open revoked session cannot save',
    (
      await requests('/api/guides', nextEditor, {
        doc: guide,
        action: 'draft',
        expectedRevision: 4,
      })
    ).status === 401,
  );
  check(
    'logout clears cookie',
    /Max-Age=0/.test(
      (
        await requests('/api/edit-session', editor, undefined, 'DELETE')
      ).headers.get('set-cookie'),
    ),
  );
  console.log(`${passed} edit-link / talent / save integration checks passed`);
} finally {
  sql(
    `BEGIN; DELETE FROM revisions WHERE hero_id='105' AND json_extract(snapshot,'$.title')='${marker}'; DELETE FROM guides WHERE hero_id='105' AND json_extract(draft_json,'$.title')='${marker}'; COMMIT;`,
  );
  if (hashes.size)
    sql(
      `DELETE FROM edit_links WHERE id='main' AND token_hash IN (${[...hashes].map((h) => `'${h}'`).join(',')})`,
    );
  if (ownedRevokedRow)
    sql(
      `DELETE FROM edit_links WHERE id='main' AND revision=3 AND token_hash IS NULL AND updated_at='${ownedRevokedRow}'`,
    );
  assert.equal(
    sql(
      "SELECT json_group_array(json_object('hero',hero_id,'draft',draft_json,'published',published_json,'revision',revision,'updated',updated_at)) FROM guides WHERE hero_id<>'105'",
    ),
    baseline,
    'Real guide data must stay unchanged',
  );
  assert.equal(
    sql(
      "SELECT json_group_array(json_object('kind',kind,'items',items_json,'revision',revision,'updated',updated_at)) FROM libraries",
    ),
    librariesBefore,
    'Real libraries must stay unchanged',
  );
  console.log(
    'Only this run’s temporary rows removed; real guides and libraries unchanged.',
  );
}
