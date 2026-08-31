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
  type MerchProductId
} from '../../lib/merchProducts';
import './FulfillmentConsole.css';
import {
  formatLocalizedDate,
  readLocalizedProductName,
  useLocale,
  type AppLocale
} from '../../i18n/LocaleContext';

type FulfillmentConsoleProps = {
  onClose: () => void;
};

type LoadState = 'loading' | 'ready' | 'error';

export function FulfillmentConsole({ onClose }: FulfillmentConsoleProps) {
  const { locale } = useLocale();
  const copy = fulfillmentCopy[locale];
  const productScopeOptions: ReadonlyArray<{
    id: FulfillmentProductScope;
    label: string;
  }> = [
    { id: 'all', label: copy.allProducts },
    ...MERCH_PRODUCT_IDS.map((id) => ({
      id,
      label: readLocalizedProductName(id, locale)
    }))
  ];
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
          setNotice(readErrorMessage(error, locale));
          setLoadState('error');
        }
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, [locale]);

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
      setNotice(
        copy.exported(
          result.recipientCount,
          readProductScopeLabel(result.productScope, locale)
        )
      );
    } catch (error) {
      setNotice(readErrorMessage(error, locale));
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
            <h2 id="fulfillment-title">{copy.title}</h2>
            <p>{copy.intro}</p>
          </div>
          <button className="fulfillment-console__close" type="button" onClick={onClose}>
            {copy.close}
          </button>
        </header>

        {loadState === 'loading' ? (
          <p className="fulfillment-console__loading" role="status">{copy.loading}</p>
        ) : null}

        {loadState === 'error' ? (
          <p className="fulfillment-console__error" role="alert">{notice}</p>
        ) : null}

        {loadState === 'ready' && overview ? (
          <>
            <div className="fulfillment-console__metrics">
              <Metric label={copy.readyInScope} value={selectedRecipientCount} />
              <Metric
                label={copy.previousInScope}
                value={latestScopedExport?.recipientCount ?? copy.none}
              />
              <Metric
                label={copy.latestInScope}
                value={latestScopedExport
                  ? formatLocalizedDate(latestScopedExport.createdAt, locale)
                  : copy.notExported}
                compact
              />
            </div>

            <fieldset className="fulfillment-console__scope">
              <legend>{copy.exportProduct}</legend>
              <div className="fulfillment-console__scope-options">
                {productScopeOptions.map((option) => (
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
                <p className="fulfillment-console__action-label">{copy.exportingNow}</p>
                <strong className="fulfillment-console__scope-name">
                  {readProductScopeLabel(productScope, locale)}
                </strong>
                <p className="fulfillment-console__action-copy">
                  {copy.readyForExport(selectedRecipientCount)}
                </p>
              </div>
              <button
                className="fulfillment-console__export"
                type="button"
                onClick={() => void handleExport()}
                disabled={isExporting}
              >
                {isExporting ? copy.exporting : copy.exportCsv}
              </button>
            </div>

            {notice ? <p className="fulfillment-console__notice" role="status">{notice}</p> : null}

            <section className="fulfillment-console__history" aria-labelledby="fulfillment-history-title">
              <div className="fulfillment-console__history-heading">
                <h3 id="fulfillment-history-title">{copy.exportHistory}</h3>
                <span>{copy.recorded(overview.exports.length)}</span>
              </div>
              {overview.exports.length ? (
                <ol>
                  {overview.exports.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{readProductScopeLabel(readExportRecordScope(item.productId), locale)}</strong>
                        <time dateTime={item.createdAt}>{formatLocalizedDate(item.createdAt, locale)}</time>
                      </div>
                      <span>{copy.recipientCount(item.recipientCount)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="fulfillment-console__empty">{copy.empty}</p>
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

function readProductScopeLabel(
  productScope: FulfillmentProductScope,
  locale: AppLocale
) {
  return productScope === 'all'
    ? fulfillmentCopy[locale].allProducts
    : readLocalizedProductName(productScope, locale);
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

function readErrorMessage(error: unknown, locale: AppLocale) {
  const copy = fulfillmentCopy[locale];

  if (error instanceof FulfillmentError) {
    if (error.code === 'fulfillment_access_denied') {
      return copy.accessDenied;
    }

    if (error.code === 'unauthenticated') {
      return copy.unauthenticated;
    }
  }

  return copy.unavailable;
}

const fulfillmentCopy = {
  en: {
    accessDenied: 'This Renaiss account is not approved for fulfilment access.',
    allProducts: 'All products',
    close: 'Close',
    empty: 'No export has been made yet.',
    exportCsv: 'Export CSV',
    exportHistory: 'Export history',
    exportProduct: 'Export product',
    exported: (count: number, product: string) =>
      `Exported ${count} completed ${product} recipient${count === 1 ? '' : 's'}.`,
    exporting: 'Exporting',
    exportingNow: 'Exporting now',
    intro: 'Export only completed shipping details for dispatch.',
    latestInScope: 'Latest in scope',
    loading: 'Loading shipment records.',
    none: 'None',
    notExported: 'Not exported',
    previousInScope: 'Previous in scope',
    readyForExport: (count: number) =>
      `${count} completed recipient${count === 1 ? '' : 's'} ready for CSV export.`,
    readyInScope: 'Ready in scope',
    recipientCount: (count: number) =>
      `${count} recipient${count === 1 ? '' : 's'}`,
    recorded: (count: number) => `${count} recorded`,
    title: 'Fulfilment',
    unauthenticated: 'Sign in with an approved Renaiss account to continue.',
    unavailable: 'Shipment records are unavailable right now.'
  },
  'zh-TW': {
    accessDenied: '此 Renaiss 帳號未獲得出貨管理權限。',
    allProducts: '所有商品',
    close: '關閉',
    empty: '目前尚無匯出紀錄。',
    exportCsv: '匯出 CSV',
    exportHistory: '匯出紀錄',
    exportProduct: '匯出商品',
    exported: (count: number, product: string) =>
      `已匯出 ${count} 筆已完成的「${product}」收件資料。`,
    exporting: '匯出中',
    exportingNow: '本次匯出',
    intro: '只匯出已完成填寫、可供出貨的收件資料。',
    latestInScope: '此範圍最近匯出',
    loading: '正在載入出貨資料。',
    none: '無',
    notExported: '尚未匯出',
    previousInScope: '此範圍上次筆數',
    readyForExport: (count: number) =>
      `共有 ${count} 筆已完成的收件資料可匯出為 CSV。`,
    readyInScope: '此範圍可匯出',
    recipientCount: (count: number) => `${count} 筆收件資料`,
    recorded: (count: number) => `${count} 筆紀錄`,
    title: '出貨管理',
    unauthenticated: '請登入已核准的 Renaiss 帳號以繼續。',
    unavailable: '目前無法取得出貨資料。'
  }
} as const;
