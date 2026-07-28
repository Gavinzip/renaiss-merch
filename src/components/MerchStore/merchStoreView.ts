export type MerchStoreView = 'cards' | 'catalog';

export const CATALOG_VIEW_ENABLED = false;

const STORE_VIEW_STORAGE_KEY = 'renaiss-merch-store-view';

export function readStoredMerchStoreView(): MerchStoreView {
  try {
    const storedView = window.sessionStorage.getItem(STORE_VIEW_STORAGE_KEY);

    return storedView === 'catalog' ? 'catalog' : 'cards';
  } catch {
    return 'cards';
  }
}

export function saveMerchStoreView(view: MerchStoreView) {
  try {
    window.sessionStorage.setItem(STORE_VIEW_STORAGE_KEY, view);
  } catch {
    // The active view remains available for this mounted store session.
  }
}
