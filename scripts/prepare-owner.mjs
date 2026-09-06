// Offline owner bootstrap/recovery. Never puts raw credentials in argv/stdout.
// Usage: node scripts/prepare-owner.mjs init|reset outputs/<new-private-directory>
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const [action, requested] = process.argv.slice(2);
assert(['init', 'reset'].includes(action), 'Specify init or reset');
assert(requested, 'Specify a new private output directory under outputs/');
const output = resolve(requested),
  allowed = resolve('outputs') + sep;
assert(
  output.startsWith(allowed) && !existsSync(output),
  'Refuse existing or non-private directory',
);
const password = randomBytes(32).toString('base64url');
const salt = randomBytes(32).toString('hex');
const hash =
  'pbkdf2-sha512:100000:' +
  pbkdf2Sync(password, salt, 100000, 32, 'sha512').toString('hex');
const now = new Date().toISOString();
// All substituted values are generated hex/base64/date constants, never user SQL.
let sql =
  action === 'init'
    ? `INSERT OR IGNORE INTO owner_password(id,password_hash,salt,revision,updated_at) VALUES ('main','${hash}','${salt}',1,'${now}');\n`
    : `UPDATE owner_password SET password_hash='${hash}',salt='${salt}',revision=revision+1,updated_at='${now}' WHERE id='main';\n`;
if (action === 'reset') {
  const changed = `EXISTS(SELECT 1 FROM owner_password WHERE id='main' AND password_hash='${hash}')`;
  sql += `DELETE FROM owner_sessions WHERE ${changed};\n`;
  sql += `UPDATE edit_password SET password_hash=NULL,salt=NULL,revision=revision+1,updated_at='${now}',mutation_id='reset-${salt}' WHERE id='main' AND ${changed};\n`;
  sql += `UPDATE edit_links SET token_hash=NULL,revision=revision+1,expires_at='${now}',updated_at='${now}' WHERE id='main' AND ${changed};\n`;
  sql += `DELETE FROM edit_sessions WHERE ${changed};\n`;
  sql += `DELETE FROM edit_attempts WHERE id='owner' AND ${changed};\n`;
}
mkdirSync(output, { recursive: true, mode: 0o700 });
writeFileSync(resolve(output, 'owner.sql'), sql, { flag: 'wx', mode: 0o600 });
writeFileSync(
  resolve(output, '站长初始密码.txt'),
  `守御手册 · 站长私人凭据\n\n站长密码：${password}\n\n仅你自己保管，不要发送到群或分享给共同编辑者。\n公网管理入口：网站地址后加 /manage?page=workspace\n登录后，可在工作台最下方“站长密码”中更改。改密后此文件中的初始密码失效。\n共同编辑者使用另一套“编辑密码”，由你在“密码与分享设置”中设置。\n此文件不上传 GitHub，不随网站发布。请保存到自己的密码管理器。\n`,
  { flag: 'wx', mode: 0o600 },
);
console.log(
  `Private owner credentials and SQL prepared in ${output}; no password printed.`,
);
