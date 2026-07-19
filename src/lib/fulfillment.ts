export type FulfillmentExportRecord = {
  id: string;
  createdAt: string;
  recipientCount: number;
};

export type FulfillmentOverview = {
  completedRecipientCount: number;
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

export async function exportFulfillmentCsv(): Promise<{
  blob: Blob;
  fileName: string;
  recipientCount: number;
  exportedAt: string;
}> {
  const response = await fetch('/api/admin/fulfillment/export', {
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

  return {
    blob: await response.blob(),
    fileName,
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
