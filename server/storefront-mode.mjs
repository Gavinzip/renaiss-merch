export const STOREFRONT_MODE_ENV = 'MERCH_STOREFRONT_MODE';
export const STOREFRONT_MODES = Object.freeze({
  preview: 'preview',
  production: 'production'
});

export function getStorefrontMode(environment = process.env) {
  const value = environment[STOREFRONT_MODE_ENV]?.trim().toLowerCase();

  if (!value) {
    throw new Error(
      `${STOREFRONT_MODE_ENV} is required and must be ` +
        `"${STOREFRONT_MODES.preview}" or "${STOREFRONT_MODES.production}".`
    );
  }

  if (!Object.values(STOREFRONT_MODES).includes(value)) {
    throw new Error(
      `${STOREFRONT_MODE_ENV} must be ` +
        `"${STOREFRONT_MODES.preview}" or "${STOREFRONT_MODES.production}".`
    );
  }

  return value;
}

export function isProductionStorefrontMode(
  mode = getStorefrontMode()
) {
  return mode === STOREFRONT_MODES.production;
}

export function isVersionedStorefrontPath(pathname) {
  return pathname === '/v1.2' || pathname.startsWith('/v1.2/');
}

export function productionStorefrontLocation(url) {
  const pathname = url.pathname.slice('/v1.2'.length) || '/';

  return `${pathname}${url.search}`;
}
