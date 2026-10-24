import { HttpError, sendJson } from '../http.mjs';
import { readJsonBody } from '../shipping-details.mjs';
import { readSession, sameOrigin } from '../postgres/auth.mjs';
import { getPool } from '../postgres/database.mjs';
import { createEmptyBinder, validateBinder } from '../../shared/member-binder.js';
import { readBinderLibrary } from './library.mjs';
import { BINDER_BODY_BYTES } from '../../shared/binder-writing.js';

export async function handleBinderRoutes(req, res, url) {
  if (!['/api/binder', '/api/binder/library'].includes(url.pathname)) return false;
  if (!['GET', 'PUT'].includes(req.method) || url.pathname.endsWith('/library') && req.method !== 'GET') {
    throw new HttpError(405, 'method_not_allowed');
  }
  const session = await readSession(req);
  const sub = session?.user?.sub;
  if (!sub) throw new HttpError(401, 'authentication_required');
  if (session.user.isDemo) throw new HttpError(403, 'binder_requires_real_account');
  if (url.pathname.endsWith('/library')) {
    sendJson(res, 200, await readBinderLibrary(session, { forceRefresh: url.searchParams.get('refresh') === '1' }));
    return true;
  }
  if (req.method === 'GET') {
    const { rows: [row] } = await getPool().query(
      'SELECT document, revision, updated_at FROM public.member_binders WHERE user_sub=$1', [sub]);
    sendJson(res, 200, row ? { binder: validateBinder(row.document), revision: row.revision, updatedAt: row.updated_at }
      : { binder: createEmptyBinder(), revision: 0, updatedAt: null });
    return true;
  }
  sameOrigin(req);
  const input = await readJsonBody(req, BINDER_BODY_BYTES);
  let binder;
  try { binder = validateBinder(input.binder); }
  catch { throw new HttpError(400, 'invalid_binder'); }
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new HttpError(400, 'invalid_binder_revision');
  const { badges } = await readBinderLibrary(session);
  const owned = new Set(badges.map(badge => badge.tokenId));
  if (binder.pages.some(page => page.slots.some(token => token !== null && !owned.has(token)))) {
    throw new HttpError(403, 'binder_badge_not_owned');
  }
  // Optimistic locking prevents another tab from silently replacing this edit.
  const { rows: [saved] } = await getPool().query(`
    WITH updated AS (
      UPDATE public.member_binders SET document=$2::jsonb,revision=revision+1,updated_at=now()
      WHERE user_sub=$1 AND revision=$3 RETURNING revision,updated_at
    ), inserted AS (
      INSERT INTO public.member_binders (user_sub,document,revision,updated_at)
      SELECT $1,$2::jsonb,1,now() WHERE $3::integer=0
      ON CONFLICT (user_sub) DO NOTHING RETURNING revision,updated_at
    ) SELECT * FROM updated UNION ALL SELECT * FROM inserted`,
    [sub, JSON.stringify(binder), input.revision]);
  if (!saved) throw new HttpError(409, 'binder_revision_conflict');
  sendJson(res, 200, { binder, revision: saved.revision, updatedAt: saved.updated_at });
  return true;
}
