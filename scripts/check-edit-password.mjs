// Local integration checks only: never replace an owner's password or real guide.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
const origin = process.argv[2] || 'http://localhost:3000';
assert.equal(new URL(origin).hostname, 'localhost');
const database =
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite';
const sql = (q) =>
  execFileSync('/usr/bin/sqlite3', [database, q], { encoding: 'utf8' }).trim();
for (const table of [
  'edit_password',
  'edit_links',
  'edit_sessions',
  'edit_attempts',
])
  assert.equal(
    sql(`SELECT count(*) FROM ${table}`),
    '0',
    `Refuse to replace existing ${table}`,
  );
assert.equal(sql("SELECT count(*) FROM guides WHERE hero_id='105'"), '0');
const baseline = sql(
  "SELECT json_group_array(json_object('hero',hero_id,'draft',draft_json,'published',published_json,'revision',revision,'updated',updated_at)) FROM guides WHERE hero_id<>'105'",
);
const libraries = sql(
  "SELECT json_group_array(json_object('kind',kind,'items',items_json,'revision',revision)) FROM libraries",
);
const marker = `PASSWORD_TEST_${Date.now()}`;
const pass1 = ' 巡游 ' + randomBytes(18).toString('hex') + ' ',
  pass2 = randomBytes(24).toString('base64url');
const headers = { Origin: origin, 'Content-Type': 'application/json' };
const owner = {
  ...headers,
  Cookie: '__sites_local_auth=1',
  'x-notebook-mode': 'manage',
};
const mutations = new Set(),
  sessionHashes = new Set(),
  linkHashes = new Set();
let revokedLinkTime = '';
const sha = (s) => createHash('sha256').update(s).digest('hex');
let passed = 0;
const check = (name, okay) => {
  assert(okay, name);
  passed++;
  console.log('PASS ' + name);
};
async function request(
  path,
  h = {},
  data,
  method = data === undefined ? 'GET' : 'POST',
) {
  const r = await fetch(origin + path, {
    method,
    headers: h,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await r.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text.slice(0, 150) };
  }
  return { status: r.status, data: payload, headers: r.headers };
}
async function setPassword(password, revision, action = 'set') {
  const r = await request('/api/edit-password', owner, {
    action,
    password,
    expectedRevision: revision,
  });
  if (r.status === 200) {
    mutations.add(sql("SELECT mutation_id FROM edit_password WHERE id='main'"));
    revokedLinkTime = sql(
      "SELECT updated_at FROM edit_links WHERE id='main' AND token_hash IS NULL",
    );
  }
  return r;
}
async function login(password) {
  const r = await request('/api/edit-session', headers, { password });
  if (r.status === 200) {
    const cookie = r.headers.get('set-cookie').split(';')[0];
    sessionHashes.add(sha(cookie.slice(cookie.indexOf('=') + 1)));
    return {
      ...r,
      editor: { ...headers, Cookie: cookie, 'x-notebook-mode': 'edit' },
    };
  }
  return r;
}
const routes = [
  '/api/guides',
  '/api/library',
  '/api/primer',
  '/api/roster',
  '/api/tiers',
];
const doc = {
  ...JSON.parse(readFileSync('data/initial-guides.json', 'utf8'))[0],
  heroId: '105',
  title: marker,
  source: '仅本地接口检查',
};
try {
  check(
    'password unavailable initially',
    !(await request('/api/edit-session')).data.passwordEnabled,
  );
  check(
    'anonymous cannot read password settings',
    (await request('/api/edit-password')).status === 401,
  );
  check(
    'anonymous cannot set password',
    (
      await request('/api/edit-password', headers, {
        action: 'set',
        password: pass1,
        expectedRevision: 0,
      })
    ).status === 401,
  );
  check(
    'owner cannot set short password',
    (await setPassword('123', 0)).status === 400,
  );
  check(
    'cross-origin owner change denied',
    (
      await request(
        '/api/edit-password',
        { ...owner, Origin: 'https://other.example' },
        { action: 'set', password: pass1, expectedRevision: 0 },
      )
    ).status === 403,
  );
  let r = await setPassword(pass1, 0);
  if (r.status !== 200) console.error(r.status, r.data.error);
  check(
    'owner sets password using Workers native KDF',
    r.status === 200 && r.data.enabled,
  );
  const stored = sql("SELECT password_hash FROM edit_password WHERE id='main'");
  check(
    'only salted versioned hash stored',
    stored.startsWith('pbkdf2-sha512:100000:') && !stored.includes(pass1),
  );
  check(
    'owner GET contains no hash salt or password',
    Object.keys((await request('/api/edit-password', owner)).data)
      .sort()
      .join(',') === 'enabled,revision,updatedAt',
  );
  check('incorrect password rejected', (await login(pass2)).status === 401);
  r = await login(pass1);
  check('Unicode and spaces password round trip', r.status === 200);
  const editor = r.editor;
  check(
    'session is HttpOnly Strict API cookie',
    /HttpOnly/.test(r.headers.get('set-cookie')) &&
      /SameSite=Strict/.test(r.headers.get('set-cookie')) &&
      /Path=\/api/.test(r.headers.get('set-cookie')),
  );
  const access = (await request('/api/guides', editor)).data.access;
  check('password grants editor not owner', access.canEdit && !access.isAdmin);
  check(
    'password holder cannot read owner settings',
    (await request('/api/edit-password', editor)).status === 403,
  );
  check(
    'password holder cannot change password',
    (
      await request('/api/edit-password', editor, {
        action: 'set',
        password: pass2,
        expectedRevision: 1,
      })
    ).status === 403,
  );
  check(
    'password holder cannot create links',
    (
      await request('/api/edit-link', editor, {
        action: 'create',
        expectedRevision: 0,
        hours: 24,
      })
    ).status === 403,
  );
  check(
    'changing mode cannot become owner',
    (
      await request('/api/edit-password', {
        ...editor,
        'x-notebook-mode': 'manage',
      })
    ).status === 401,
  );
  for (const route of routes)
    check(
      'editor can reach validation ' + route,
      (await request(route, editor, {})).status === 400,
    );
  r = await request('/api/guides', editor, {
    action: 'draft',
    doc,
    expectedRevision: 0,
  });
  check('password editor can save draft', r.status === 200);
  let records = (await request('/api/guides', editor)).data.guides;
  check(
    'workspace marks saved draft pending',
    records.find((g) => g.heroId === '105')?.pendingDraft,
  );
  let read = (await request('/api/guides', { Cookie: editor.Cookie })).data;
  check(
    'normal URL remains read-only and hides draft',
    !read.access.canEdit && !read.guides.some((g) => g.heroId === '105'),
  );
  check(
    'publish succeeds',
    (
      await request('/api/guides', editor, {
        action: 'publish',
        doc,
        expectedRevision: 1,
      })
    ).status === 200,
  );
  records = (await request('/api/guides', editor)).data.guides;
  check(
    'published draft leaves pending section',
    !records.find((g) => g.heroId === '105').pendingDraft,
  );
  check(
    'unfinished update saved',
    (
      await request('/api/guides', editor, {
        action: 'draft',
        doc: { ...doc, notes: '待完成的修改' },
        expectedRevision: 2,
      })
    ).status === 200,
  );
  records = (await request('/api/guides', editor)).data.guides;
  check(
    'unpublished changes return to pending',
    records.find((g) => g.heroId === '105').pendingDraft,
  );
  read = (await request('/api/guides')).data.guides.find(
    (g) => g.heroId === '105',
  );
  check(
    'public version unchanged and pending status private',
    read.published.notes !== '待完成的修改' && read.pendingDraft === undefined,
  );
  const link = await request('/api/edit-link', owner, {
    action: 'create',
    hours: 24,
    expectedRevision: 0,
  });
  check('owner can independently issue edit link', link.status === 200);
  linkHashes.add(sha(link.data.key));
  const linkSession = await request('/api/edit-session', headers, {
    key: link.data.key,
  });
  const linkEditor = {
    ...headers,
    Cookie: linkSession.headers.get('set-cookie').split(';')[0],
    'x-notebook-mode': 'edit',
  };
  check(
    'password change succeeds',
    (await setPassword(pass2, 1)).status === 200,
  );
  for (const route of routes)
    check(
      'old password session denied ' + route,
      (await request(route, editor, {})).status === 401,
    );
  check('old password no longer works', (await login(pass1)).status === 401);
  check(
    'old special link also revoked',
    (await request('/api/edit-session', headers, { key: link.data.key }))
      .status === 401,
  );
  check(
    'already-open old link session denied',
    (
      await request('/api/guides', linkEditor, {
        action: 'draft',
        doc,
        expectedRevision: 3,
      })
    ).status === 401,
  );
  r = await login(pass2);
  check('new password works', r.status === 200);
  const next = r.editor;
  check(
    'stale owner changes cannot overwrite',
    (await setPassword(pass1, 1)).status === 409,
  );
  check(
    'failed stale update leaves new session valid',
    (await request('/api/edit-session', next)).data.active,
  );
  check(
    'logout succeeds',
    (await request('/api/edit-session', next, undefined, 'DELETE')).status ===
      200,
  );
  check(
    'logged-out token cannot replay',
    !(await request('/api/edit-session', next)).data.active,
  );
  r = await login(pass2);
  const last = r.editor;
  sql(
    `UPDATE edit_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE token_hash='${sha(last.Cookie.split('=')[1])}'`,
  );
  check(
    'expired session denied',
    (await request('/api/guides', last, {})).status === 401,
  );
  // 4 attempts since change; reserve 6 more, then all must reject before KDF.
  const attempts = Number(
    sql("SELECT attempts FROM edit_attempts WHERE id='main'"),
  );
  const batch = await Promise.all(
    Array.from({ length: 12 }, () => login(pass1)),
  );
  check(
    'parallel attempts respect durable limit',
    batch.filter((x) => x.status === 401).length === 10 - attempts &&
      batch.filter((x) => x.status === 429).length === 12 - (10 - attempts),
  );
  check(
    'rate limit has retry guidance',
    (await login(pass2)).headers.get('retry-after') === '300',
  );
  check(
    'owner still has access during lockout',
    (await request('/api/edit-password', owner)).status === 200,
  );
  check(
    'owner disables password and clears old grants',
    (await setPassword(undefined, 2, 'disable')).status === 200,
  );
  check('disabled password cannot log in', (await login(pass2)).status === 401);
  check(
    'password entry now unavailable',
    !(await request('/api/edit-session')).data.passwordEnabled,
  );
  console.log(`${passed} password and pending-draft checks passed`);
} finally {
  sql(
    `BEGIN; DELETE FROM revisions WHERE hero_id='105' AND json_extract(snapshot,'$.title')='${marker}'; DELETE FROM guides WHERE hero_id='105' AND json_extract(draft_json,'$.title')='${marker}'; COMMIT;`,
  );
  for (const hash of sessionHashes)
    sql(`DELETE FROM edit_sessions WHERE token_hash='${hash}'`);
  for (const hash of linkHashes)
    sql(`DELETE FROM edit_links WHERE id='main' AND token_hash='${hash}'`);
  if (revokedLinkTime)
    sql(
      `DELETE FROM edit_links WHERE id='main' AND token_hash IS NULL AND updated_at='${revokedLinkTime}'`,
    );
  if (mutations.size) {
    const match = [...mutations].map((x) => `'${x}'`).join(',');
    sql(
      `DELETE FROM edit_attempts WHERE id='main' AND EXISTS (SELECT 1 FROM edit_password WHERE mutation_id IN (${match})); DELETE FROM edit_password WHERE id='main' AND mutation_id IN (${match})`,
    );
  }
  assert.equal(
    sql(
      "SELECT json_group_array(json_object('hero',hero_id,'draft',draft_json,'published',published_json,'revision',revision,'updated',updated_at)) FROM guides WHERE hero_id<>'105'",
    ),
    baseline,
  );
  assert.equal(
    sql(
      "SELECT json_group_array(json_object('kind',kind,'items',items_json,'revision',revision)) FROM libraries",
    ),
    libraries,
  );
  console.log(
    'Temporary test credentials and guide removed; real guides/libraries unchanged.',
  );
}
