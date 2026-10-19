import { createMissionRouteHandler } from '../missions/routes.mjs';
import { handleRosterDrawRoute } from '../roster-draw/routes.mjs';
import { createSurfDrawHandler } from '../surf-draw/routes.mjs';
import { handleSurfDrawAccessRoute } from '../surf-draw/access.mjs';
import { createSurfOperatorHandler } from '../surf-draw/operator-routes.mjs';
import { requireFulfillmentAdministrator } from '../fulfillment-admin.mjs';
import { readFulfillmentOverview, createFulfillmentExport } from '../fulfillment.mjs';
import { readSession, sameOrigin } from './auth.mjs';
import { HttpError, sendJson } from '../http.mjs';

const missions = createMissionRouteHandler({readSession});
const surf = createSurfDrawHandler({readSession});
const operator = createSurfOperatorHandler();
export async function handleWorkflowRoutes(req, res, url) {
  // Dedicated draw-room access is independent of Renaiss SSO.
  if (await handleSurfDrawAccessRoute(req,res,url)) return true;
  if (await handleRosterDrawRoute(req,res,url)) return true;
  if (await operator(req,res,url)) return true;
  if (await surf(req,res,url)) return true;
  if (await missions(req,res,url)) return true;
  if (!['/api/admin/fulfillment','/api/admin/fulfillment/export'].includes(url.pathname)) return false;
  const exporting=url.pathname.endsWith('/export');
  if (req.method !== (exporting?'POST':'GET')) throw new HttpError(405,'method_not_allowed');
  requireFulfillmentAdministrator(await readSession(req));
  if (!exporting) {sendJson(res,200,await readFulfillmentOverview());return true;}
  sameOrigin(req);
  const {csv,exportRecord}=await createFulfillmentExport({productId:url.searchParams.get('productId')});
  const body=Buffer.from(csv,'utf8'), scope=exportRecord.productId||'all';
  res.writeHead(200,{'Cache-Control':'no-store, private','Content-Type':'text/csv; charset=utf-8',
    'Content-Length':body.length,'Content-Disposition':`attachment; filename="renaiss-merch-fulfillment-${scope}-${exportRecord.createdAt.replace(/[:.]/g,'-')}.csv"`,
    'X-Fulfillment-Export-Count':String(exportRecord.recipientCount),'X-Fulfillment-Exported-At':exportRecord.createdAt,'X-Fulfillment-Export-Product':scope});
  res.end(body);return true;
}
