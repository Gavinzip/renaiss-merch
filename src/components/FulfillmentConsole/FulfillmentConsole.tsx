import { useEffect, useState } from 'react';
import {
  exportFulfillmentCsv,
  FulfillmentError,
  readFulfillmentOverview,
  type FulfillmentProductScope,
  type FulfillmentOverview
} from '../../lib/fulfillment';
import {
  MERCH_PRODUCT_IDS,
  MERCH_PRODUCT_LABELS,
  type MerchProductId
} from '../../lib/merchProducts';
import './FulfillmentConsole.css';

type FulfillmentConsoleProps = {
  onClose: () => void;
};

type LoadState = 'loading' | 'ready' | 'error';

const PRODUCT_SCOPE_OPTIONS: ReadonlyArray<{
  id: FulfillmentProductScope;
  label: string;
}> = [
  { id: 'all', label: 'All products' },
  ...MERCH_PRODUCT_IDS.map((id) => ({ id, label: MERCH_PRODUCT_LABELS[id] }))
];

export function FulfillmentConsole({ onClose }: FulfillmentConsoleProps) {
  const [overview, setOverview] = useState<FulfillmentOverview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [productScope, setProductScope] =
    useState<FulfillmentProductScope>('all');
  const selectedRecipientCount = overview
    ? readScopedRecipientCount(overview, productScope)
    : 0;
  const latestScopedExport = overview?.exports.find(
    (record) => readExportRecordScope(record.productId) === productScope
  ) || null;

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const nextOverview = await readFulfillmentOverview();

        if (active) {
          setOverview(nextOverview);
          setLoadState('ready');
        }
      } catch (error) {
        if (active) {
          setNotice(readErrorMessage(error));
          setLoadState('error');
        }
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, []);

  async function handleExport() {
    setIsExporting(true);
    setNotice(null);

    try {
      const result = await exportFulfillmentCsv(productScope);
      downloadCsv(result.blob, result.fileName);
      setOverview((current) => {
        if (!current) {
          return current;
        }

        const record = {
          id: `${result.exportedAt}-${result.recipientCount}`,
          createdAt: result.exportedAt,
          productId: result.productScope === 'all' ? null : result.productScope,
          recipientCount: result.recipientCount
        };

        return {
          ...current,
          lastExport: record,
          previousExportRecipientCount: result.recipientCount,
          exports: [record, ...current.exports]
        };
      });
      setNotice(`Exported ${result.recipientCount} completed ${readProductScopeLabel(result.productScope)} recipient${result.recipientCount === 1 ? '' : 's'}.`);
    } catch (error) {
      setNotice(readErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="fulfillment-console" aria-labelledby="fulfillment-title">
      <div className="fulfillment-console__backdrop" aria-hidden="true" />
      <div className="fulfillment-console__panel">
        <header className="fulfillment-console__header">
          <div>
            <p className="fulfillment-console__eyebrow">RENAISS MERCH</p>
            <h2 id="fulfillment-title">Fulfilment</h2>
            <p>Export only completed shipping details for dispatch.</p>
          </div>
          <button className="fulfillment-console__close" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        {loadState === 'loading' ? (
          <p className="fulfillment-console__loading" role="status">Loading shipment records.</p>
        ) : null}

        {loadState === 'error' ? (
          <p className="fulfillment-console__error" role="alert">{notice}</p>
        ) : null}

        {loadState === 'ready' && overview ? (
          <>
            <div className="fulfillment-console__metrics">
              <Metric label="Ready in scope" value={selectedRecipientCount} />
              <Metric
                label="Previous in scope"
                value={latestScopedExport?.recipientCount ?? 'None'}
              />
              <Metric
                label="Latest in scope"
                value={latestScopedExport ? formatDate(latestScopedExport.createdAt) : 'Not exported'}
                compact
              />
            </div>

            <fieldset className="fulfillment-console__scope">
              <legend>Export product</legend>
              <div className="fulfillment-console__scope-options">
                {PRODUCT_SCOPE_OPTIONS.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name="fulfillment-product-scope"
                      value={option.id}
                      checked={productScope === option.id}
                      onChange={() => {
                        setProductScope(option.id);
                        setNotice(null);
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="fulfillment-console__action-row">
              <div>
                <p className="fulfillment-console__action-label">Exporting now</p>
                <strong className="fulfillment-console__scope-name">
                  {readProductScopeLabel(productScope)}
                </strong>
                <p className="fulfillment-console__action-copy">
                  {selectedRecipientCount} completed recipient{selectedRecipientCount === 1 ? '' : 's'} ready for CSV export.
                </p>
              </div>
              <button
                className="fulfillment-console__export"
                type="button"
                onClick={() => void handleExport()}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting' : 'Export CSV'}
              </button>
            </div>

            {notice ? <p className="fulfillment-console__notice" role="status">{notice}</p> : null}

            <section className="fulfillment-console__history" aria-labelledby="fulfillment-history-title">
              <div className="fulfillment-console__history-heading">
                <h3 id="fulfillment-history-title">Export history</h3>
                <span>{overview.exports.length} recorded</span>
              </div>
              {overview.exports.length ? (
                <ol>
                  {overview.exports.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{readProductScopeLabel(readExportRecordScope(item.productId))}</strong>
                        <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                      </div>
                      <span>{item.recipientCount} recipient{item.recipientCount === 1 ? '' : 's'}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="fulfillment-console__empty">No export has been made yet.</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}

function readScopedRecipientCount(
  overview: FulfillmentOverview,
  productScope: FulfillmentProductScope
) {
  return productScope === 'all'
    ? overview.completedRecipientCount
    : overview.completedRecipientCounts[productScope];
}

function readProductScopeLabel(productScope: FulfillmentProductScope) {
  return productScope === 'all'
    ? 'All products'
    : MERCH_PRODUCT_LABELS[productScope];
}

function readExportRecordScope(
  productId: MerchProductId | null
): FulfillmentProductScope {
  return productId || 'all';
}

function Metric({
  label,
  value,
  compact = false
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'fulfillment-console__metric fulfillment-console__metric--compact' : 'fulfillment-console__metric'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function downloadCsv(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function readErrorMessage(error: unknown) {
  if (error instanceof FulfillmentError) {
    if (error.code === 'fulfillment_access_denied') {
      return 'This Renaiss account is not approved for fulfilment access.';
    }

    if (error.code === 'unauthenticated') {
      return 'Sign in with an approved Renaiss account to continue.';
    }
  }

  return 'Shipment records are unavailable right now.';
}
