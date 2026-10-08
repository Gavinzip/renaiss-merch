import { useEffect, useRef, useState } from 'react';
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
import { SurfParticipants } from './SurfParticipants';

type FulfillmentConsoleProps = {
  onClose: () => void;
  initialSection?: 'shipping' | 'surf';
};

type LoadState = 'loading' | 'ready' | 'error';

export function FulfillmentConsole({ onClose, initialSection = 'shipping' }: FulfillmentConsoleProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { locale } = useLocale();
  const [section, setSection] = useState(initialSection);
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
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
    if (section !== 'shipping') return;
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
  }, [locale, section]);

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
    <dialog ref={dialogRef} className="fulfillment-console" aria-labelledby="fulfillment-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="fulfillment-console__backdrop" aria-hidden="true" />
      <div className={`fulfillment-console__panel${section === 'surf' ? ' fulfillment-console__panel--participants' : ''}`}>
        <header className="fulfillment-console__header">
          <div>
            <p className="fulfillment-console__eyebrow">RENAISS MERCH</p>
            <h2 id="fulfillment-title">{section === 'surf' ? inlineCopy[locale].surfRaffleParticipants : copy.title}</h2>
            <p>{section === 'surf' ? inlineCopy[locale].reviewVerificationResultsAndTicketCountsFor : copy.intro}</p>
          </div>
          <button className="fulfillment-console__close" type="button" onClick={onClose}>
            {copy.close}
          </button>
        </header>
        <nav className="fulfillment-console__sections" aria-label={inlineCopy[locale].managementSections}>
          <button type="button" aria-pressed={section === 'shipping'} onClick={() => setSection('shipping')}>{inlineCopy[locale].shipping}</button>
          <button type="button" aria-pressed={section === 'surf'} onClick={() => setSection('surf')}>{inlineCopy[locale].surfParticipants}</button>
        </nav>
        {section === 'surf' ? <SurfParticipants /> : <>
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
        </>}
      </div>
    </dialog>
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
  ko: {
    accessDenied: "이 Renaiss 계정에는 배송 관리 권한이 없습니다.",
    allProducts: "모든 상품",
    close: "닫기",
    empty: "아직 내보낸 기록이 없습니다.",
    exportCsv: "CSV 내보내기",
    exportHistory: "내보내기 기록",
    exportProduct: "내보낼 상품",
    exported: (count: number, product: string) =>
      `${product} 수령인 정보 ${count}건을 내보냈습니다.`,
    exporting: "내보내는 중",
    exportingNow: "이번 내보내기",
    intro: "배송을 위해 작성이 완료된 수령인 정보만 내보냅니다.",
    latestInScope: "선택 범위 최근 내보내기",
    loading: "배송 기록을 불러오고 있습니다.",
    none: "없음",
    notExported: "내보내지 않음",
    previousInScope: "선택 범위 이전 수량",
    readyForExport: (count: number) =>
      `작성 완료된 수령인 정보 ${count}건을 CSV로 내보낼 수 있습니다.`,
    readyInScope: "선택 범위 내보내기 가능",
    recipientCount: (count: number) =>
      `수령인 정보 ${count}건`,
    recorded: (count: number) => `기록 ${count}건`,
    title: "배송 관리",
    unauthenticated: "권한이 있는 Renaiss 계정으로 로그인해 주세요.",
    unavailable: "현재 배송 기록을 확인할 수 없습니다."
  },
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

const inlineCopy = {
  "en": {
    surfRaffleParticipants: "Surf raffle participants",
    reviewVerificationResultsAndTicketCountsFor: "Review verification results and ticket counts for each participant.",
    managementSections: "Management sections",
    shipping: "Shipping",
    surfParticipants: "Surf participants"
  },
  "zh-TW": {
    surfRaffleParticipants: "Surf 抽獎名單",
    reviewVerificationResultsAndTicketCountsFor: "查看每位參加者的驗證結果與抽獎票數。",
    managementSections: "管理項目",
    shipping: "出貨資料",
    surfParticipants: "Surf 抽獎名單"
  },
  "ko": {
    surfRaffleParticipants: "Surf 추첨 참가자",
    reviewVerificationResultsAndTicketCountsFor: "참가자별 인증 결과와 응모권 수를 확인하세요.",
    managementSections: "관리 메뉴",
    shipping: "배송",
    surfParticipants: "Surf 참가자"
  }
} as const;
