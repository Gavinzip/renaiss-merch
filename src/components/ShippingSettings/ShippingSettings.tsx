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
import { readShippingCountries } from '../../lib/shippingCountries';
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
import {
  formatLocalizedDate,
  useLocale,
  type AppLocale
} from '../../i18n/LocaleContext';

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
  const { locale } = useLocale();
  const copy = settingsCopy[locale];
  const shippingCountries = readShippingCountries(locale);
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
            <p>{copy.eyebrow}</p>
            <h2 id="shipping-settings-title">{copy.title}</h2>
          </div>
          <button onClick={onClose} type="button">
            {copy.close}
          </button>
        </header>

        <div className="shipping-settings__intro">
          <p>{copy.introPrimary}</p>
          <p>{copy.introSecondary}</p>
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
                    ? copy.chineseNoticeTaiwanTitle
                    : copy.chineseNoticeChinaTitle}
                </strong>
                <p>
                  {deliveryMethod === 'seven_eleven_c2c'
                    ? copy.chineseNoticeTaiwanBody
                    : copy.chineseNoticeChinaBody}
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
                ? copy.firstNameChinese
                : copy.firstName}
              <input
                autoComplete="shipping given-name"
                name="firstName"
                required
                type="text"
              />
            </label>
            <label className="shipping-settings__field-half">
              {chineseShippingReview.isRequired
                ? copy.lastNameChinese
                : copy.lastName}
              <input
                autoComplete="shipping family-name"
                name="lastName"
                required
                type="text"
              />
            </label>
            <label className="shipping-settings__field-half">
              {copy.email}
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
              {copy.phone}
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
              {copy.countryRegion}
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
                  <span>{copy.pickupStore}</span>
                  {sevenElevenStore ? (
                    <p>
                      <strong>{sevenElevenStore.name}</strong>
                      <span>
                        {sevenElevenStore.id} · {sevenElevenStore.address}
                      </span>
                    </p>
                  ) : (
                    <p>{copy.noStoreSelected}</p>
                  )}
                </div>
                <button onClick={handleSelectSevenElevenStore} type="button">
                  {sevenElevenStore ? copy.changeStore : copy.selectStore}
                </button>
              </div>
            ) : (
              <>
                <label className="shipping-settings__field-half">
                  {copy.postalCode}
                  <input
                    autoComplete="shipping postal-code"
                    name="postalCode"
                    required
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-wide">
                  {copy.addressLine1}
                  <input
                    autoComplete="shipping address-line1"
                    name="addressLine1"
                    placeholder={copy.addressLine1Placeholder}
                    required
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-wide">
                  {copy.addressLine2}
                  <input
                    autoComplete="shipping address-line2"
                    name="addressLine2"
                    placeholder={copy.addressLine2Placeholder}
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-half">
                  {copy.city}
                  <input
                    autoComplete="shipping address-level2"
                    name="city"
                    required
                    type="text"
                  />
                </label>
                <label className="shipping-settings__field-half">
                  {copy.region}
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
              {copy.deliveryNotes}
              <textarea
                name="deliveryNotes"
                placeholder={copy.deliveryNotesPlaceholder}
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
                taiwanMobileNeedsUpdate,
                locale
              )}
            </p>
            <button disabled={isLoading || isSaving} type="submit">
              {isSaving ? copy.saving : copy.saveDefaults}
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
  taiwanMobileNeedsUpdate: boolean,
  locale: AppLocale
) {
  const copy = settingsCopy[locale];

  switch (settingsState) {
    case 'loading':
      return copy.statusLoading;
    case 'saving':
      return copy.statusSaving;
    case 'dirty':
      return deliveryMethod === 'seven_eleven_c2c'
        ? copy.statusStoreDirty
        : copy.statusDirty;
    case 'saved':
      return copy.statusSaved;
    case 'invalid':
      return deliveryMethod === 'seven_eleven_c2c'
        ? copy.statusTaiwanInvalid
        : copy.statusInvalid;
    case 'store-required':
      return copy.statusStoreRequired;
    case 'error':
      return copy.statusError;
    default:
      if (
        chineseShippingReview.needsUpdate ||
        taiwanMobileNeedsUpdate
      ) {
        return deliveryMethod === 'seven_eleven_c2c'
          ? copy.statusTaiwanInvalid
          : copy.statusInvalid;
      }

      return savedAt
        ? copy.statusSavedAt(formatLocalizedDate(savedAt, locale))
        : copy.statusEmpty;
  }
}

const settingsCopy = {
  en: {
    addressLine1: 'Address line 1',
    addressLine1Placeholder: 'Street address or PO box',
    addressLine2: 'Address line 2',
    addressLine2Placeholder: 'Apartment, suite, unit, building (optional)',
    changeStore: 'Change store',
    chineseNoticeChinaBody:
      'The recipient name and address for China must include Chinese characters.',
    chineseNoticeChinaTitle: 'Chinese address required',
    chineseNoticeTaiwanBody:
      'Taiwan orders use 7-ELEVEN store pickup. The recipient name must include Chinese characters and a Taiwan mobile number is required.',
    chineseNoticeTaiwanTitle: 'Chinese name and Taiwan mobile number required',
    city: 'City',
    close: 'Close',
    countryRegion: 'Country / region',
    deliveryNotes: 'Delivery notes',
    deliveryNotesPlaceholder:
      'Gate code, preferred delivery detail, or local instructions (optional)',
    email: 'Email',
    eyebrow: 'Account defaults',
    firstName: 'First name',
    firstNameChinese: 'First name (Chinese)',
    introPrimary:
      'Save the recipient details you use most often. New product claims will be prefilled automatically.',
    introSecondary:
      'Every claim stays independent. You can change its address without changing these defaults, and product options such as size remain specific to that item.',
    lastName: 'Last name',
    lastNameChinese: 'Last name (Chinese)',
    noStoreSelected: 'No pickup store selected.',
    phone: 'Phone',
    pickupStore: 'Pickup store',
    postalCode: 'ZIP / postal code',
    region: 'State / province',
    saveDefaults: 'Save defaults',
    saving: 'Saving',
    selectStore: 'Select store',
    statusDirty: 'Changes are not saved yet.',
    statusEmpty: 'No defaults saved yet.',
    statusError: 'Your defaults could not be loaded or saved. Please try again.',
    statusInvalid: 'Update the highlighted name and address fields before saving.',
    statusLoading: 'Loading your saved defaults.',
    statusSaved: 'Defaults saved. Future claims will be prefilled.',
    statusSavedAt: (date: string) => `Saved ${date}.`,
    statusSaving: 'Saving your default recipient details.',
    statusStoreDirty: 'Store and recipient details are not saved yet.',
    statusStoreRequired: 'Select a 7-ELEVEN pickup store first.',
    statusTaiwanInvalid: 'Update the highlighted Chinese name and Taiwan mobile number.',
    title: 'Shipping address'
  },
  'zh-TW': {
    addressLine1: '地址第 1 行',
    addressLine1Placeholder: '街道地址或郵政信箱',
    addressLine2: '地址第 2 行',
    addressLine2Placeholder: '公寓、樓層、單位或大樓名稱（選填）',
    changeStore: '更換門市',
    chineseNoticeChinaBody: '中國的收件人姓名及地址必須包含中文字。',
    chineseNoticeChinaTitle: '中文地址必填',
    chineseNoticeTaiwanBody:
      '台灣訂單一律使用 7-ELEVEN 店到店。取件姓名須包含中文字，並填寫台灣手機號碼。',
    chineseNoticeTaiwanTitle: '中文姓名與台灣手機必填',
    city: '城市',
    close: '關閉',
    countryRegion: '國家／地區',
    deliveryNotes: '配送備註',
    deliveryNotesPlaceholder: '門禁、偏好配送方式或當地配送說明（選填）',
    email: '電子信箱',
    eyebrow: '帳號預設資料',
    firstName: '名字',
    firstNameChinese: '名字（中文）',
    introPrimary: '儲存你最常使用的收件資料，之後申請商品時會自動帶入。',
    introSecondary: '每次領取申請仍各自獨立，你可以單獨修改地址；尺寸等商品選項也只套用於該商品。',
    lastName: '姓氏',
    lastNameChinese: '姓氏（中文）',
    noStoreSelected: '尚未選擇取件門市。',
    phone: '電話',
    pickupStore: '取件門市',
    postalCode: '郵遞區號',
    region: '州／省／地區',
    saveDefaults: '儲存預設資料',
    saving: '儲存中',
    selectStore: '選擇門市',
    statusDirty: '變更尚未儲存。',
    statusEmpty: '目前尚未儲存預設資料。',
    statusError: '目前無法讀取或儲存預設資料，請再試一次。',
    statusInvalid: '儲存前請更新標示的姓名與地址欄位。',
    statusLoading: '正在讀取已儲存的預設資料。',
    statusSaved: '預設資料已儲存，之後的領取申請會自動帶入。',
    statusSavedAt: (date: string) => `已於 ${date} 儲存。`,
    statusSaving: '正在儲存預設收件資料。',
    statusStoreDirty: '門市與收件資料尚未儲存。',
    statusStoreRequired: '請先選擇 7-ELEVEN 取件門市。',
    statusTaiwanInvalid: '請更新標示的中文姓名與台灣手機號碼。',
    title: '配送地址'
  }
} as const;
