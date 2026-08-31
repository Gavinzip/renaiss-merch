import type { MerchProductId } from './merchProducts';

export type FulfillmentProductScope = 'all' | MerchProductId;

export type FulfillmentExportRecord = {
  id: string;
  createdAt: string;
  productId: MerchProductId | null;
  recipientCount: number;
};

export type FulfillmentOverview = {
  completedRecipientCount: number;
  completedRecipientCounts: Record<MerchProductId, number>;
  lastExport: FulfillmentExportRecord | null;
  previousExportRecipientCount: number | null;
  exports: FulfillmentExportRecord[];
};

export class FulfillmentError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'FulfillmentError';
  }
}

export async function readFulfillmentOverview(): Promise<FulfillmentOverview> {
  const response = await fetch('/api/admin/fulfillment', {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin'
  });

  if (!response.ok) {
    throw await toFulfillmentError(response);
  }

  return (await response.json()) as FulfillmentOverview;
}

export async function exportFulfillmentCsv(productScope: FulfillmentProductScope): Promise<{
  blob: Blob;
  fileName: string;
  productScope: FulfillmentProductScope;
  recipientCount: number;
  exportedAt: string;
}> {
  const query = new URLSearchParams({ productId: productScope });
  const response = await fetch(`/api/admin/fulfillment/export?${query}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'text/csv' }
  });

  if (!response.ok) {
    throw await toFulfillmentError(response);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] ||
    'renaiss-merch-fulfillment.csv';
  const recipientCount = Number(response.headers.get('X-Fulfillment-Export-Count'));
  const exportedAt = response.headers.get('X-Fulfillment-Exported-At') || new Date().toISOString();
  const responseProductScope = response.headers.get('X-Fulfillment-Export-Product');

  if (responseProductScope !== productScope) {
    throw new FulfillmentError('fulfillment_export_scope_mismatch');
  }

  return {
    blob: await response.blob(),
    fileName,
    productScope,
    recipientCount: Number.isSafeInteger(recipientCount) ? recipientCount : 0,
    exportedAt
  };
}

async function toFulfillmentError(response: Response) {
  try {
    const payload = (await response.json()) as { code?: string };
    return new FulfillmentError(payload.code || 'fulfillment_request_failed');
  } catch {
    return new FulfillmentError('fulfillment_request_failed');
  }
}
