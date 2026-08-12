import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  ShippingProfileError,
  readStoredShippingProfile,
  saveShippingProfile,
  type ShippingProfilePayload
} from '../../lib/shippingProfile';
import {
  applyChineseShippingFormValidity,
  emptyChineseShippingReview,
  focusFirstInvalidChineseShippingField,
  reviewChineseShippingDetails,
  type ChineseShippingReview
} from '../../lib/chineseShippingValidation';
import {
  isChineseShippingErrorCode
} from '../../../shared/shipping-address-policy.js';
import { shippingCountries } from '../../lib/shippingCountries';
import {
  beginSevenElevenStoreSelection,
  consumeReturnedSevenElevenSelection,
  applyTaiwanMobileValidity,
  needsTaiwanMobileUpdate,
  needsTaiwanSevenElevenUpdate,
  readSevenElevenStore,
  resolveShippingDeliveryMethod,
  toSevenElevenShippingFields,
  type SevenElevenStore
} from '../../lib/sevenElevenStore';
import type { ShippingDeliveryMethod } from '../../lib/shippingClaim';
import './ShippingSettings.css';

type ShippingSettingsProps = {
  accountLabel: string;
  onClose: () => void;
  onProfileReviewChange: (needsUpdate: boolean) => void;
};

type SettingsState =
  | 'loading'
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'invalid'
  | 'store-required'
  | 'error';

const chineseShippingNoticeId = 'shipping-settings-chinese-notice';

const profileFieldNames: Array<keyof ShippingProfilePayload> = [
  'addressLine1',
  'addressLine2',
  'city',
  'country',
  'deliveryNotes',
  'email',
  'firstName',
  'lastName',
  'phone',
  'postalCode',
  'region'
];

const emailInputPattern = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';
const phoneInputPattern = '[+()0-9\\s.-]{6,32}';

export function ShippingSettings({
  accountLabel,
  onClose,
  onProfileReviewChange
}: ShippingSettingsProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [settingsState, setSettingsState] =
    useState<SettingsState>('loading');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [chineseShippingReview, setChineseShippingReview] =
    useState<ChineseShippingReview>(emptyChineseShippingReview);
  const [shippingCountry, setShippingCountry] = useState('US');
  const [deliveryMethod, setDeliveryMethod] =
    useState<ShippingDeliveryMethod>('home_delivery');
  const [sevenElevenStore, setSevenElevenStore] =
    useState<SevenElevenStore | null>(null);
  const [sevenElevenSelectionToken, setSevenElevenSelectionToken] =
    useState('');
  const [taiwanMobileNeedsUpdate, setTaiwanMobileNeedsUpdate] =
    useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const [storedProfile, returnedSelection] = await Promise.all([
          readStoredShippingProfile(),
          consumeReturnedSevenElevenSelection({ context: 'profile' })
        ]);

        if (cancelled) {
          return;
        }

        setSavedAt(storedProfile.savedAt);

        const profile = returnedSelection
          ? {
              ...(returnedSelection.draft || storedProfile.profile || {}),
              ...toSevenElevenShippingFields(returnedSelection)
            }
          : storedProfile.profile;

        if (profile) {
          const country = profile.country || 'US';
          const nextDeliveryMethod = resolveShippingDeliveryMethod(country);
          const profileNeedsUpdate = needsTaiwanSevenElevenUpdate(profile);
          setShippingCountry(country);
          setDeliveryMethod(nextDeliveryMethod);
          setSevenElevenStore(readSevenElevenStore(profile));
          setSevenElevenSelectionToken(
            profile.sevenElevenSelectionToken || ''
          );
          setTaiwanMobileNeedsUpdate(
            needsTaiwanMobileUpdate(
              profile.phone || '',
              nextDeliveryMethod
            )
          );
          window.requestAnimationFrame(() => {
            if (!cancelled && formRef.current) {
              applyProfileValues(formRef.current, profile);
              applyTaiwanMobileValidity(
                formRef.current,
                nextDeliveryMethod,
                chineseShippingNoticeId
              );
              const review = syncChineseShippingReview(formRef.current, {
                ...profile,
                country,
                deliveryMethod: nextDeliveryMethod
              });
              setChineseShippingReview(review);
              const needsUpdate = review.needsUpdate || profileNeedsUpdate;
              setSettingsState(
                returnedSelection || needsUpdate ? 'dirty' : 'idle'
              );
              onProfileReviewChange(needsUpdate);
            }
          });
        } else {
          setSettingsState('idle');
          onProfileReviewChange(false);
        }
      } catch {
        if (!cancelled) {
          setSettingsState('error');
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [onProfileReviewChange]);

  function handleFormChange(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const country = readFormValue(new FormData(form), 'country');
    const nextDeliveryMethod = resolveShippingDeliveryMethod(country);

    setShippingCountry(country);

    if (nextDeliveryMethod !== deliveryMethod) {
      setDeliveryMethod(nextDeliveryMethod);
    }

    applyTaiwanMobileValidity(
      form,
      nextDeliveryMethod,
      chineseShippingNoticeId
    );
    setTaiwanMobileNeedsUpdate(
      needsTaiwanMobileUpdate(
        readFormValue(new FormData(form), 'phone'),
        nextDeliveryMethod
      )
    );
    const review = syncChineseShippingReview(form, {
      ...readProfileValues(form),
      deliveryMethod: nextDeliveryMethod
    });
    setChineseShippingReview(review);

    if (settingsState !== 'loading' && settingsState !== 'saving') {
      setSettingsState('dirty');
    }
  }

  function handleSelectSevenElevenStore() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    beginSevenElevenStoreSelection({
      context: 'profile',
      draft: {
        ...readProfileValues(form),
        country: 'TW',
        deliveryMethod: 'seven_eleven_c2c'
      }
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (settingsState === 'saving') {
      return;
    }

    const profile = readProfileValues(event.currentTarget);
    applyTaiwanMobileValidity(
      event.currentTarget,
      deliveryMethod,
      chineseShippingNoticeId
    );
    setTaiwanMobileNeedsUpdate(
      needsTaiwanMobileUpdate(profile.phone, deliveryMethod)
    );

    if (
      deliveryMethod === 'seven_eleven_c2c' &&
      (!sevenElevenStore || !sevenElevenSelectionToken)
    ) {
      setSettingsState('store-required');
      return;
    }

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      setSettingsState('invalid');
      return;
    }

    const review = syncChineseShippingReview(event.currentTarget, profile);
    setChineseShippingReview(review);

    if (review.needsUpdate) {
      setSettingsState('invalid');
      focusFirstInvalidChineseShippingField(event.currentTarget, review);
      return;
    }

    setSettingsState('saving');

    try {
      const savedProfile = await saveShippingProfile(profile);
      setSavedAt(savedProfile.savedAt);
      setSettingsState('saved');
      onProfileReviewChange(false);
    } catch (error) {
      setSettingsState(
        error instanceof ShippingProfileError
          ? isChineseShippingErrorCode(error.code) ||
            error.code === 'taiwan_mobile_invalid' ||
            error.code === 'taiwan_mobile_required'
            ? 'invalid'
            : error.code.startsWith('seven_eleven_')
              ? 'store-required'
              : 'error'
          : 'error'
      );
    }
  }

  const isLoading = settingsState === 'loading';
  const isSaving = settingsState === 'saving';

  return (
    <div className="shipping-settings" role="presentation">
      <section
        aria-labelledby="shipping-settings-title"
        aria-modal="true"
        className="shipping-settings__panel"
        role="dialog"
      >
        <header className="shipping-settings__header">
          <div>
            <p>Account defaults</p>
            <h2 id="shipping-settings-title">Shipping address</h2>
          </div>
          <button onClick={onClose} type="button">
            Close
          </button>
        </header>

        <div className="shipping-settings__intro">
          <p>
            Save the recipient details you use most often. New product claims
            will be prefilled automatically.
          </p>
          <p>
            Every claim stays independent. You can change its address without
            changing these defaults, and product options such as size remain
            specific to that item.
          </p>
          <span>{accountLabel}</span>
        </div>

        <form
          ref={formRef}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
        >
          {chineseShippingReview.isRequired ? (
            <div
              className={`shipping-settings__language-notice ${
                chineseShippingReview.needsUpdate || taiwanMobileNeedsUpdate
                  ? 'is-invalid'
                  : ''
              }`}
              id={chineseShippingNoticeId}
              role={
                chineseShippingReview.needsUpdate || taiwanMobileNeedsUpdate
                  ? 'alert'
                  : 'status'
              }
            >
              <span aria-hidden="true">!</span>
              <div>
                <strong>
                  {deliveryMethod === 'seven_eleven_c2c'
                    ? '中文姓名與台灣手機必填'
                    : '中文地址必填'}
                </strong>
                <p>
                  {deliveryMethod === 'seven_eleven_c2c'
                    ? '台灣訂單一律使用 7-ELEVEN 店到店。取件姓名須包含中文字，並填寫台灣手機號碼。'
                    : '中國的收件人姓名及地址必須包含中文字。'}
                </p>
              </div>
            </div>
          ) : null}

          <fieldset disabled={isLoading || isSaving}>
            <input
              name="deliveryMethod"
              type="hidden"
              value={deliveryMethod}
            />
            <input
              name="sevenElevenSelectionToken"
              type="hidden"
              value={sevenElevenSelectionToken}
            />
            <input
              name="sevenElevenStoreAddress"
              type="hidden"
              value={sevenElevenStore?.address || ''}
            />
            <input
              name="sevenElevenStoreId"
              type="hidden"
              value={sevenElevenStore?.id || ''}
            />
            <input
              name="sevenElevenStoreName"
              type="hidden"
              value={sevenElevenStore?.name || ''}
            />
            <input
              name="sevenElevenStoreOutside"
              type="hidden"
              value={sevenElevenStore?.outside ? '1' : '0'}
            />
            <label className="shipping-settings__field-half">
              {chineseShippingReview.isRequired
                ? 'First name (中文)'
                : 'First name'}
              <input
                autoComplete="shipping given-name"
                name="firstName"
                required
                type="text"
              />
            </label>
            <label className="shipping-settings__field-half">
              {chineseShippingReview.isRequired
                ? 'Last name (中文)'
                : 'Last name'}
              <input
                autoComplete="shipping family-name"
                name="lastName"
                required
                type="text"
              />
            </label>
            <label className="shipping-settings__field-half">
              Email
              <input
                autoComplete="email"
                name="email"
                pattern={emailInputPattern}
                placeholder="name@example.com"
                required
                type="email"
              />
            </label>
            <label className="shipping-settings__field-half">
              Phone
              <input
                autoComplete="shipping tel"
                name="phone"
                pattern={phoneInputPattern}
                placeholder={
                  deliveryMethod === 'seven_eleven_c2c'
                    ? '0912 345 678'
                    : '+1 555 000 0000'
                }
                required
                type="tel"
              />
            </label>
            <label className="shipping-settings__field-half">
              Country / region
              <select
                autoComplete="shipping country-name"
                defaultValue="US"
                name="country"
                required
              >
                {shippingCountries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
            {deliveryMethod === 'seven_eleven_c2c' &&
            shippingCountry === 'TW' ? (
              <div className="shipping-settings__store-picker shipping-settings__field-wide">
                <div>
                  <span>Pickup store</span>
                  {sevenElevenStore ? (
                    <p>
                      <strong>{sevenElevenStore.name}</strong>
                      <span>
                        {sevenElevenStore.id} · {sevenElevenStore.address}
                      </span>
                    </p>
                  ) : (
                    <p>尚未選擇取件門市。</p>
                  )}
                </div>
                <button onClick={handleSelectSevenElevenStore} type="button">
                  {sevenElevenStore ? '更換門市' : '選擇門市'}
                </button>
              </div>
            ) : (
              <>
                <label className="shipping-settings__field-half">
                  ZIP / postal code
                  <input
                    autoComplete="shipping postal-code"
                    name="postalCode"
                    required
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-wide">
                  Address line 1
                  <input
                    autoComplete="shipping address-line1"
                    name="addressLine1"
                    placeholder="Street address or PO box"
                    required
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-wide">
                  Address line 2
                  <input
                    autoComplete="shipping address-line2"
                    name="addressLine2"
                    placeholder="Apartment, suite, unit, building (optional)"
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-half">
                  City
                  <input
                    autoComplete="shipping address-level2"
                    name="city"
                    required
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-half">
                  State / province
                  <input
                    autoComplete="shipping address-level1"
                    name="region"
                    required
                    type="text"
                  />
                </label>
              </>
            )}
            <label className="shipping-settings__field-wide">
              Delivery notes
              <textarea
                name="deliveryNotes"
                placeholder="Gate code, preferred delivery detail, or local instructions (optional)"
                rows={3}
              />
            </label>
          </fieldset>

          <div className="shipping-settings__footer">
            <p role="status">
              {readSettingsStatus(
                settingsState,
                savedAt,
                chineseShippingReview,
                deliveryMethod,
                taiwanMobileNeedsUpdate
              )}
            </p>
            <button disabled={isLoading || isSaving} type="submit">
              {isSaving ? 'Saving' : 'Save defaults'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function readProfileValues(form: HTMLFormElement): ShippingProfilePayload {
  const data = new FormData(form);
  const country = readFormValue(data, 'country');

  return {
    addressLine1: readFormValue(data, 'addressLine1'),
    addressLine2: readFormValue(data, 'addressLine2'),
    city: readFormValue(data, 'city'),
    country,
    deliveryMethod: resolveShippingDeliveryMethod(country),
    deliveryNotes: readFormValue(data, 'deliveryNotes'),
    email: readFormValue(data, 'email'),
    firstName: readFormValue(data, 'firstName'),
    lastName: readFormValue(data, 'lastName'),
    phone: readFormValue(data, 'phone'),
    postalCode: readFormValue(data, 'postalCode'),
    region: readFormValue(data, 'region'),
    sevenElevenSelectionToken: readFormValue(
      data,
      'sevenElevenSelectionToken'
    ),
    sevenElevenStoreAddress: readFormValue(
      data,
      'sevenElevenStoreAddress'
    ),
    sevenElevenStoreId: readFormValue(data, 'sevenElevenStoreId'),
    sevenElevenStoreName: readFormValue(data, 'sevenElevenStoreName'),
    sevenElevenStoreOutside: readFormValue(
      data,
      'sevenElevenStoreOutside'
    )
  };
}

function readFormValue(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function applyProfileValues(
  form: HTMLFormElement,
  profile: Partial<ShippingProfilePayload>
) {
  for (const fieldName of profileFieldNames) {
    const field = form.elements.namedItem(fieldName);
    const value = profile[fieldName];

    if (
      (field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement) &&
      typeof value === 'string'
    ) {
      field.value = value;
    }
  }
}

function syncChineseShippingReview(
  form: HTMLFormElement,
  profile: Partial<ShippingProfilePayload> = readProfileValues(form)
) {
  const review = reviewChineseShippingDetails(profile);
  applyChineseShippingFormValidity(
    form,
    review,
    chineseShippingNoticeId
  );
  return review;
}

function readSettingsStatus(
  settingsState: SettingsState,
  savedAt: string | null,
  chineseShippingReview: ChineseShippingReview,
  deliveryMethod: ShippingDeliveryMethod,
  taiwanMobileNeedsUpdate: boolean
) {
  switch (settingsState) {
    case 'loading':
      return 'Loading your saved defaults.';
    case 'saving':
      return 'Saving your default recipient details.';
    case 'dirty':
      return deliveryMethod === 'seven_eleven_c2c'
        ? '門市與收件資料尚未儲存。'
        : 'Changes are not saved yet.';
    case 'saved':
      return 'Defaults saved. Future claims will be prefilled.';
    case 'invalid':
      return deliveryMethod === 'seven_eleven_c2c'
        ? '請更新標示的中文姓名與台灣手機號碼。'
        : 'Update the highlighted name and address fields before saving.';
    case 'store-required':
      return '請先選擇 7-ELEVEN 取件門市。';
    case 'error':
      return 'Your defaults could not be loaded or saved. Please try again.';
    default:
      if (
        chineseShippingReview.needsUpdate ||
        taiwanMobileNeedsUpdate
      ) {
        return deliveryMethod === 'seven_eleven_c2c'
          ? '請更新標示的中文姓名與台灣手機號碼。'
          : 'Update the highlighted name and address fields before saving.';
      }

      return savedAt
        ? `Saved ${new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(new Date(savedAt))}.`
        : 'No defaults saved yet.';
  }
}
