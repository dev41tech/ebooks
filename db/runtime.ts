import {database} from './sql';
import {bucket} from './storage';
// Server-only runtime; no Cloudflare bindings or browser-visible credentials.
export const env = {
 DB:database, BUCKET:bucket,
 get ADMIN_EMAILS(){return process.env.ADMIN_EMAILS;},
 get SAMBU_ADMIN_EMAILS(){return process.env.SAMBU_ADMIN_EMAILS;},
 get SAMBU_ADMIN_TESTER_EMAILS(){return process.env.SAMBU_ADMIN_TESTER_EMAILS;},
 get SAMBU_BETA_EMAILS(){return process.env.SAMBU_BETA_EMAILS;},
 get SAMBU_BETA_OPEN(){return process.env.SAMBU_BETA_OPEN;}
};
