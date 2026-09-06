// Run ONLY against the isolated local production build, never the real database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { randomBytes, pbkdf2Sync, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { Miniflare } = await import(
  require.resolve('miniflare', { paths: [require.resolve('wrangler')] })
);
const origin = 'http://127.0.0.1:3001';
const modulePaths = [
  'index.js',
  ...readdirSync('dist/server', { recursive: true }).filter(
    (p) => p.endsWith('.js') && p !== 'index.js',
  ),
];
const mf = new Miniflare({
  modules: modulePaths.map((p) => ({
    type: 'ESModule',
    path: resolve('dist/server', p),
  })),
  modulesRoot: resolve('dist/server'),
  compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'],
  bindings: { ADMIN_EMAIL: 'congyugao@163.com' },
  d1Databases: ['DB'],
});
const database = await mf.getD1Database('DB');
const sql = async (q) => {
  let result;
  for (const statement of q.split(';').filter((s) => s.trim()))
    result = await database.prepare(statement).all();
  return result?.results?.length
    ? String(Object.values(result.results[0])[0])
    : '';
};
for (const file of readdirSync('drizzle')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  await sql(
    readFileSync('drizzle/' + file, 'utf8').replaceAll(
      '--> statement-breakpoint',
      '',
    ),
  );
for (const table of [
  'owner_password',
  'owner_sessions',
  'edit_password',
  'edit_sessions',
  'edit_links',
  'edit_attempts',
])
  assert.equal(
    await sql(`SELECT count(*) FROM ${table}`),
    '0',
    `Refuse existing ${table}`,
  );
assert.equal(await sql("SELECT count(*) FROM guides WHERE hero_id='105'"), '0');
const pass = randomBytes(32).toString('base64url'),
  next = randomBytes(32).toString('base64url');
const shared = randomBytes(24).toString('base64url'),
  shared2 = randomBytes(24).toString('base64url');
const salt = randomBytes(32).toString('hex');
const hash =
  'pbkdf2-sha512:100000:' +
  pbkdf2Sync(pass, salt, 100000, 32, 'sha512').toString('hex');
const base = { Origin: origin, 'Content-Type': 'application/json' };
const spoof = {
  ...base,
  'x-notebook-mode': 'manage',
  'oai-authenticated-user-id': 'owner',
  'oai-authenticated-user-email': 'seedy@sites.test',
  Cookie: '__sites_local_auth=1',
};
let count = 0;
const check = (label, condition) => {
  assert(condition, label);
  console.log('PASS ' + label);
  count++;
};
async function request(
  path,
  headers = {},
  data,
  method = data === undefined ? 'GET' : 'POST',
) {
  const response = await mf.dispatchFetch(origin + path, {
    method,
    headers,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const value = await response.json();
  return { status: response.status, data: value, headers: response.headers };
}
const cookie = (r) => r.headers.get('set-cookie')?.split(';')[0];
const loginOwner = (password) =>
  request('/api/owner-session', base, { password });
const loginEdit = (password) =>
  request('/api/edit-session', base, { password });
const creds = (r, mode = 'manage') => ({
  ...base,
  Cookie: cookie(r),
  'x-notebook-mode': mode,
});
const marker = 'CF_AUTH_TEST_' + Date.now();
const doc = {
  ...JSON.parse(readFileSync('data/initial-guides.json', 'utf8'))[0],
  heroId: '105',
  title: marker,
  source: '本机隔离测试',
};
let owner, editor;
try {
  check(
    'owner setup is fail closed',
    !(await request('/api/owner-session')).data.configured,
  );
  check(
    'no public owner registration',
    (
      await request('/api/owner-password', base, {
        password: pass,
        currentPassword: pass,
      })
    ).status === 401,
  );
  check(
    'spoofed Sites headers cannot read owner settings',
    (await request('/api/edit-password', spoof)).status === 401,
  );
  check(
    'spoofed Sites headers cannot write',
    (
      await request('/api/guides', spoof, {
        action: 'draft',
        expectedRevision: 0,
        doc,
      })
    ).status === 401,
  );
  await sql(
    `INSERT INTO owner_password VALUES ('main','${hash}','${salt}',1,'${new Date().toISOString()}');`,
  );
  check(
    'wrong owner password rejected',
    (await loginOwner(next)).status === 401,
  );
  check(
    'cross-site owner login denied',
    (
      await request(
        '/api/owner-session',
        { ...base, Origin: 'https://other.example' },
        { password: pass },
      )
    ).status === 403,
  );
  let r = await loginOwner(pass);
  check('native KDF owner login works', r.status === 200);
  owner = creds(r);
  check(
    'owner cookie is private and root scoped',
    /HttpOnly/.test(r.headers.get('set-cookie')) &&
      /SameSite=Strict/.test(r.headers.get('set-cookie')) &&
      /Path=\//.test(r.headers.get('set-cookie')),
  );
  check(
    'owner session confers admin',
    (await request('/api/guides', owner)).data.access.isAdmin,
  );
  check(
    'owner cookie cannot enable read URL',
    (await request('/api/guides', { Cookie: owner.Cookie })).data.access
      .canEdit === false,
  );
  check(
    'owner cookie cannot become shared session',
    (await request('/api/guides', { ...owner, 'x-notebook-mode': 'edit' })).data
      .access.canEdit === false,
  );
  check(
    'passwords cannot be identical',
    (
      await request('/api/edit-password', owner, {
        action: 'set',
        password: pass,
        expectedRevision: 0,
      })
    ).status === 400,
  );
  r = await request('/api/edit-password', owner, {
    action: 'set',
    password: shared,
    expectedRevision: 0,
  });
  check('owner sets shared password', r.status === 200);
  r = await loginEdit(shared);
  check('shared login works', r.status === 200);
  editor = creds(r, 'edit');
  let access = (await request('/api/guides', editor)).data.access;
  check('shared is editor never admin', access.canEdit && !access.isAdmin);
  const bug = {
    id: 'isolated-bug',
    title: '隔离测试 BUG',
    body: '测试现象，不是真实游戏资料',
    status: '待确认',
    version: '',
    scope: '',
    steps: '',
    workaround: '',
    updatedAt: 'forged-date-must-be-ignored',
  };
  const otherData = await Promise.all(
    ['/api/primer', '/api/library', '/api/guides'].map(
      async (path) => (await request(path)).data,
    ),
  );
  let bugs = await request('/api/bugs');
  check(
    'BUG library starts empty and public',
    bugs.status === 200 &&
      bugs.data.items.length === 0 &&
      bugs.data.revision === 0,
  );
  check(
    'anonymous cannot add BUGs',
    (await request('/api/bugs', base, { entry: bug, expectedRevision: 0 }))
      .status === 401,
  );
  check(
    'read URL cookie cannot add BUGs',
    (
      await request(
        '/api/bugs',
        { ...base, Cookie: editor.Cookie },
        { entry: bug, expectedRevision: 0 },
      )
    ).status === 401,
  );
  check(
    'cross-origin BUG edits rejected',
    (
      await request(
        '/api/bugs',
        { ...editor, Origin: 'https://other.example' },
        { entry: bug, expectedRevision: 0 },
      )
    ).status === 403,
  );
  check(
    'empty BUG description rejected',
    (
      await request('/api/bugs', editor, {
        entry: { ...bug, body: ' ' },
        expectedRevision: 0,
      })
    ).status === 400,
  );
  check(
    'invalid BUG status rejected',
    (
      await request('/api/bugs', editor, {
        entry: { ...bug, status: 'unknown' },
        expectedRevision: 0,
      })
    ).status === 400,
  );
  bugs = await request('/api/bugs', editor, {
    entry: bug,
    expectedRevision: 0,
  });
  check(
    'password editor can add BUG with optional fields empty',
    bugs.status === 200 &&
      bugs.data.items[0].body === bug.body &&
      bugs.data.revision === 1,
  );
  check(
    'BUG update date is server generated',
    Number.isFinite(Date.parse(bugs.data.items[0].updatedAt)),
  );
  check(
    'BUG survives public reload',
    (await request('/api/bugs')).data.items[0].title === bug.title,
  );
  check(
    'stale BUG edit rejected',
    (
      await request('/api/bugs', owner, {
        entry: { ...bug, body: '不得覆盖' },
        expectedRevision: 0,
      })
    ).status === 409,
  );
  bugs = await request('/api/bugs', owner, {
    entry: { ...bug, status: '已修复', workaround: '测试应对办法' },
    expectedRevision: 1,
  });
  check(
    'owner can edit existing BUG without duplicating it',
    bugs.status === 200 &&
      bugs.data.items.length === 1 &&
      bugs.data.items[0].status === '已修复' &&
      bugs.data.revision === 2,
  );
  const simultaneous = await Promise.all(
    ['A', 'B'].map((id) =>
      request('/api/bugs', editor, {
        entry: { ...bug, id },
        expectedRevision: 2,
      }),
    ),
  );
  check(
    'concurrent BUG writers have exactly one winner',
    simultaneous.filter((value) => value.status === 200).length === 1 &&
      simultaneous.filter((value) => value.status === 409).length === 1,
  );
  assert.deepEqual(
    await Promise.all(
      ['/api/primer', '/api/library', '/api/guides'].map(
        async (path) => (await request(path)).data,
      ),
    ),
    otherData,
  );
  check('BUG writes do not change primer, glyphs, runes or guides', true);
  check(
    'shared cannot manage passwords',
    (await request('/api/edit-password', editor)).status === 403,
  );
  check(
    'shared cannot rotate owner password',
    (
      await request('/api/owner-password', editor, {
        currentPassword: pass,
        password: next,
      })
    ).status === 403,
  );
  check(
    'shared cookie cannot spoof manage',
    (
      await request('/api/edit-password', {
        ...editor,
        'x-notebook-mode': 'manage',
      })
    ).status === 401,
  );
  check(
    'shared cannot create links',
    (
      await request('/api/edit-link', editor, {
        action: 'create',
        hours: 1,
        expectedRevision: 0,
      })
    ).status === 403,
  );
  r = await request('/api/guides', editor, {
    action: 'draft',
    doc,
    expectedRevision: 0,
  });
  check('shared can save draft', r.status === 200);
  check(
    'draft is private',
    !(await request('/api/guides')).data.guides.some((g) => g.heroId === '105'),
  );
  check(
    'draft appears in workbench',
    (await request('/api/guides', owner)).data.guides.some(
      (g) => g.heroId === '105' && g.pendingDraft,
    ),
  );
  r = await request('/api/guides', owner, {
    action: 'publish',
    doc,
    expectedRevision: 1,
  });
  check('owner can publish with SQL session guard', r.status === 200);
  check(
    'reader gets published only',
    (await request('/api/guides')).data.guides.some(
      (g) =>
        g.heroId === '105' && g.published.title === marker && !('draft' in g),
    ),
  );
  r = await request('/api/edit-link', owner, {
    action: 'create',
    hours: 1,
    expectedRevision: 0,
  });
  check('owner can create editing link', r.status === 200);
  const oldLink = r.data.key;
  r = await request('/api/edit-password', owner, {
    action: 'set',
    password: shared2,
    expectedRevision: 1,
  });
  check('shared password rotates', r.status === 200);
  check(
    'old shared session revoked',
    (await request('/api/guides', editor)).data.access.canEdit === false,
  );
  check(
    'old shared password rejected',
    (await loginEdit(shared)).status === 401,
  );
  check(
    'revoked editor cannot change BUGs',
    (await request('/api/bugs', editor, { entry: bug, expectedRevision: 3 }))
      .status === 401,
  );
  check(
    'old editing link revoked',
    (await request('/api/edit-session', base, { key: oldLink })).status === 401,
  );
  check(
    'revoked editor cannot write',
    (
      await request('/api/guides', editor, {
        action: 'draft',
        doc,
        expectedRevision: 2,
      })
    ).status === 401,
  );
  const secondOwner = creds(await loginOwner(pass));
  check(
    'wrong current owner password denied',
    (
      await request('/api/owner-password', owner, {
        currentPassword: next,
        password: next,
      })
    ).status === 401,
  );
  check(
    'owner password cannot equal shared',
    (
      await request('/api/owner-password', owner, {
        currentPassword: pass,
        password: shared2,
      })
    ).status === 400,
  );
  r = await request('/api/owner-password', owner, {
    currentPassword: pass,
    password: next,
  });
  check('owner password rotates', r.status === 200);
  check(
    'all owner sessions revoked',
    (await request('/api/edit-password', secondOwner)).status === 401,
  );
  check(
    'owner rotation disables shared password',
    !(await request('/api/edit-session')).data.passwordEnabled,
  );
  check(
    'owner rotation leaves no owner sessions',
    (await sql('SELECT count(*) FROM owner_sessions')) === '0',
  );
  await sql("DELETE FROM edit_attempts WHERE id='owner'");
  check('old owner password rejected', (await loginOwner(pass)).status === 401);
  r = await loginOwner(next);
  check('new owner password works', r.status === 200);
  owner = creds(r);
  const key = owner.Cookie.split('=')[1],
    tokenHash = createHash('sha256').update(key).digest('hex');
  await sql(
    `UPDATE owner_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE token_hash='${tokenHash}'`,
  );
  check(
    'expired owner session denied',
    (await request('/api/edit-password', owner)).status === 401,
  );
  owner = creds(await loginOwner(next));
  check(
    'owner logout works',
    (await request('/api/owner-session', owner, undefined, 'DELETE')).status ===
      200,
  );
  check(
    'logged out cookie cannot be replayed',
    (await request('/api/edit-password', owner)).status === 401,
  );
  await sql("DELETE FROM edit_attempts WHERE id='owner'");
  const attempts = await Promise.all(
    Array.from({ length: 12 }, () => loginOwner(pass)),
  );
  check(
    'parallel owner attempts atomically limited',
    attempts.filter((x) => x.status === 401).length === 10 &&
      attempts.filter((x) => x.status === 429).length === 2,
  );
  check(
    'owner limit does not consume shared attempts',
    (await sql("SELECT count(*) FROM edit_attempts WHERE id='owner'")) ===
      '1' &&
      (await sql("SELECT attempts FROM edit_attempts WHERE id='main'")) !==
        '10',
  );
  console.log(`All ${count} Cloudflare authentication checks passed.`);
} finally {
  await mf.dispose();
}
