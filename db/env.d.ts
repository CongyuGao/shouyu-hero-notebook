declare const __SHOUYU_CLOUDFLARE__: boolean;
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_EMAIL?: string;
  }
}
