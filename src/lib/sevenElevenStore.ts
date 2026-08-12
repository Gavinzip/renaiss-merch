import type {
  ShippingClaimPayload,
  ShippingDeliveryMethod
} from './shippingClaim';
import type { MerchProductId } from './merchProducts';

const draftStorageKey = 'renaiss-merch-seven-eleven-draft-v1';
const selectionEndpoint = '/api/merch-7-eleven/selection';
const mapStartEndpoint = '/api/merch-7-eleven/map';
const tokenPattern = /^[A-Za-z0-9]{20}$/;
const selectionPromiseByToken = new Map<
  string,
  Promise<ReturnedSevenElevenSelection>
>();

export type SevenElevenSelectionContext = 'profile' | 'claim';

export type SevenElevenStore = {
  address: string;
  id: string;
  name: string;
  outside: boolean;
};

export type ReturnedSevenElevenSelection = {
  context: SevenElevenSelectionContext;
  draft: Partial<ShippingClaimPayload> | null;
  productId: MerchProductId | null;
  selectionToken: string;
  store: SevenElevenStore;
};

type SelectionDraft = {
  context: SevenElevenSelectionContext;
  draft: Partial<ShippingClaimPayload>;
  productId: MerchProductId | null;
};

export function beginSevenElevenStoreSelection(input: {
  context: SevenElevenSelectionContext;
  draft: Partial<ShippingClaimPayload>;
  productId?: MerchProductId;
}) {
  const productId = input.context === 'claim' ? input.productId || null : null;
  const draft: SelectionDraft = {
    context: input.context,
    draft: input.draft,
    productId
  };

  window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));

  const form = document.createElement('form');
  form.action = mapStartEndpoint;
  form.method = 'post';
  appendHiddenField(form, 'context', input.context);
  appendHiddenField(form, 'returnTo', readCleanReturnTo());
  appendHiddenField(form, 'device', isMobileDevice() ? '1' : '0');

  if (productId) {
    appendHiddenField(form, 'productId', productId);
  }

  document.body.append(form);
  form.submit();
}

export function readReturnedSevenElevenContext(): {
  context: SevenElevenSelectionContext;
  productId: MerchProductId | null;
  token: string;
} | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('sevenElevenSelection') || '';
  const context = params.get('sevenElevenContext');
  const productId = params.get('sevenElevenProduct');

  if (
    !tokenPattern.test(token) ||
    (context !== 'profile' && context !== 'claim')
  ) {
    return null;
  }

  if (
    context === 'claim' &&
    productId !== 'shirt' &&
    productId !== 'bracelet'
  ) {
    return null;
  }

  return {
    context,
    productId: context === 'claim' ? (productId as MerchProductId) : null,
    token
  };
}

export async function consumeReturnedSevenElevenSelection(input: {
  context: SevenElevenSelectionContext;
  productId?: MerchProductId;
}): Promise<ReturnedSevenElevenSelection | null> {
  const returnedContext = readReturnedSevenElevenContext();

  if (
    !returnedContext ||
    returnedContext.context !== input.context ||
    (input.context === 'claim' &&
      returnedContext.productId !== input.productId)
  ) {
    return null;
  }

  let request = selectionPromiseByToken.get(returnedContext.token);

  if (!request) {
    request = fetchReturnedSelection(returnedContext.token).then(
      (selection) => {
        const draft = readSelectionDraft(
          selection.context,
          selection.productId
        );
        clearReturnedSelectionLocation();
        window.sessionStorage.removeItem(draftStorageKey);
        return {
          ...selection,
          draft
        };
      }
    );
    selectionPromiseByToken.set(returnedContext.token, request);
  }

  try {
    return await request;
  } catch (error) {
    selectionPromiseByToken.delete(returnedContext.token);
    throw error;
  }
}

export function readStoredShippingDeliveryMethod(
  value: unknown
): ShippingDeliveryMethod {
  return value === 'seven_eleven_c2c'
    ? 'seven_eleven_c2c'
    : 'home_delivery';
}

export function resolveShippingDeliveryMethod(
  country: unknown
): ShippingDeliveryMethod {
  return typeof country === 'string' && country.trim().toUpperCase() === 'TW'
    ? 'seven_eleven_c2c'
    : 'home_delivery';
}

export function isTaiwanMobileNumber(value: unknown) {
  if (typeof value !== 'string') {
    return false;
  }

  return /^(?:09\d{8}|\+8869\d{8})$/.test(
    value.trim().replace(/[\s().-]/g, '')
  );
}

export function needsTaiwanMobileUpdate(
  phone: unknown,
  deliveryMethod: ShippingDeliveryMethod
) {
  return (
    deliveryMethod === 'seven_eleven_c2c' &&
    !isTaiwanMobileNumber(phone)
  );
}

export function applyTaiwanMobileValidity(
  form: HTMLFormElement,
  deliveryMethod: ShippingDeliveryMethod,
  describedById: string
) {
  const field = form.elements.namedItem('phone');

  if (!(field instanceof HTMLInputElement)) {
    return;
  }

  const isInvalid = needsTaiwanMobileUpdate(field.value, deliveryMethod);

  field.setCustomValidity(
    isInvalid ? '7-ELEVEN 取件請填寫台灣手機號碼。' : ''
  );

  if (isInvalid) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', describedById);
  } else {
    field.removeAttribute('aria-invalid');
    if (field.getAttribute('aria-describedby') === describedById) {
      field.removeAttribute('aria-describedby');
    }
  }
}

export function readSevenElevenStore(
  details: Partial<ShippingClaimPayload>
): SevenElevenStore | null {
  if (
    !details.sevenElevenStoreId ||
    !details.sevenElevenStoreName ||
    !details.sevenElevenStoreAddress
  ) {
    return null;
  }

  return {
    address: details.sevenElevenStoreAddress,
    id: details.sevenElevenStoreId,
    name: details.sevenElevenStoreName,
    outside: details.sevenElevenStoreOutside === '1'
  };
}

export function needsTaiwanSevenElevenUpdate(
  details: Partial<ShippingClaimPayload> | null | undefined
) {
  if (details?.country?.trim().toUpperCase() !== 'TW') {
    return false;
  }

  return (
    details.deliveryMethod !== 'seven_eleven_c2c' ||
    !isTaiwanMobileNumber(details.phone) ||
    typeof details.sevenElevenSelectionToken !== 'string' ||
    !tokenPattern.test(details.sevenElevenSelectionToken) ||
    !details.sevenElevenStoreId ||
    !details.sevenElevenStoreName ||
    !details.sevenElevenStoreAddress
  );
}

export function toSevenElevenShippingFields(
  selection: Pick<ReturnedSevenElevenSelection, 'selectionToken' | 'store'>
) {
  return {
    country: 'TW',
    deliveryMethod: 'seven_eleven_c2c' as const,
    sevenElevenSelectionToken: selection.selectionToken,
    sevenElevenStoreAddress: selection.store.address,
    sevenElevenStoreId: selection.store.id,
    sevenElevenStoreName: selection.store.name,
    sevenElevenStoreOutside: selection.store.outside ? '1' : '0'
  };
}

function readSelectionDraft(
  context: SevenElevenSelectionContext,
  productId: MerchProductId | null
) {
  try {
    const raw = window.sessionStorage.getItem(draftStorageKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SelectionDraft>;

    if (
      parsed.context !== context ||
      parsed.productId !== productId ||
      !parsed.draft ||
      typeof parsed.draft !== 'object'
    ) {
      return null;
    }

    return parsed.draft;
  } catch {
    return null;
  }
}

async function fetchReturnedSelection(token: string) {
  const response = await fetch(selectionEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  });

  if (!response.ok) {
    throw new Error(`7-ELEVEN selection returned ${response.status}.`);
  }

  return parseReturnedSelection(await response.json());
}

function parseReturnedSelection(value: unknown): ReturnedSevenElevenSelection {
  if (!value || typeof value !== 'object') {
    throw new Error('7-ELEVEN selection response is invalid.');
  }

  const candidate = value as {
    context?: unknown;
    productId?: unknown;
    selectionToken?: unknown;
    store?: {
      address?: unknown;
      id?: unknown;
      name?: unknown;
      outside?: unknown;
    };
  };
  const context = candidate.context;
  const productId = candidate.productId;
  const store = candidate.store;

  if (
    (context !== 'profile' && context !== 'claim') ||
    (productId !== null &&
      productId !== 'shirt' &&
      productId !== 'bracelet') ||
    typeof candidate.selectionToken !== 'string' ||
    !tokenPattern.test(candidate.selectionToken) ||
    !store ||
    typeof store.id !== 'string' ||
    !store.id ||
    typeof store.name !== 'string' ||
    !store.name ||
    typeof store.address !== 'string' ||
    !store.address ||
    typeof store.outside !== 'boolean'
  ) {
    throw new Error('7-ELEVEN selection response is invalid.');
  }

  return {
    context,
    draft: null,
    productId,
    selectionToken: candidate.selectionToken,
    store: {
      address: store.address,
      id: store.id,
      name: store.name,
      outside: store.outside
    }
  };
}

function appendHiddenField(
  form: HTMLFormElement,
  name: string,
  value: string
) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.append(input);
}

function readCleanReturnTo() {
  const url = new URL(window.location.href);
  url.searchParams.delete('sevenElevenSelection');
  url.searchParams.delete('sevenElevenContext');
  url.searchParams.delete('sevenElevenProduct');
  return `${url.pathname}${url.search}${url.hash || '#store'}`;
}

function clearReturnedSelectionLocation() {
  const url = new URL(window.location.href);
  url.searchParams.delete('sevenElevenSelection');
  url.searchParams.delete('sevenElevenContext');
  url.searchParams.delete('sevenElevenProduct');
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`
  );
}

function isMobileDevice() {
  return (
    window.matchMedia?.('(pointer: coarse)').matches === true ||
    window.innerWidth <= 860
  );
}
