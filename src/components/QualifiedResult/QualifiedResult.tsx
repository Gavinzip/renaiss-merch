import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  type EligibleMerchEligibilityResult
} from '../../lib/merchEligibility';
import {
  applyChineseShippingFormValidity,
  emptyChineseShippingReview,
  focusFirstInvalidChineseShippingField,
  reviewChineseShippingDetails,
  type ChineseShippingReview
} from '../../lib/chineseShippingValidation';
import {
  hasPublicRevealMedia,
  type MerchProductId
} from '../../lib/merchProducts';
import {
  readStoredShippingClaim,
  saveShippingClaim,
  ShippingClaimError,
  type ShippingClaimIntent,
  type ShippingClaimPayload
} from '../../lib/shippingClaim';
import {
  braceletColors,
  readBraceletColor,
  type BraceletColor
} from '../../lib/merchVariants';
import { readRenaissLogoutReturnUrl } from '../../lib/renaissAuth';
import type { PreparedRevealMedia } from '../../lib/revealMediaPreload';
import { publicRevealMediaUrl } from '../../lib/publicRevealMedia';
import { readShippingCountries } from '../../lib/shippingCountries';
import { readStoredShippingProfile } from '../../lib/shippingProfile';
import {
  beginSevenElevenStoreSelection,
  consumeReturnedSevenElevenSelection,
  applyTaiwanMobileValidity,
  needsTaiwanMobileUpdate,
  readReturnedSevenElevenContext,
  readSevenElevenStore,
  readStoredShippingDeliveryMethod,
  resolveShippingDeliveryMethod,
  toSevenElevenShippingFields,
  type SevenElevenStore
} from '../../lib/sevenElevenStore';
import type { ShippingDeliveryMethod } from '../../lib/shippingClaim';
import {
  isChineseShippingErrorCode
} from '../../../shared/shipping-address-policy.js';
import { VipTicketClaimForm } from './VipTicketClaimForm';
import {
  type MerchRevealPhase,
  useMerchRevealAssistedCompletion
} from './useMerchRevealAssistedCompletion';
import './QualifiedResult.css';
import {
  readLocalizedProductName,
  useLocale,
  type AppLocale
} from '../../i18n/LocaleContext';
import { qualifiedResultCopy } from '../../i18n/qualifiedResultCopy';

const emailInputPattern = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';
const phoneInputPattern = '[+()0-9\\s.-]{6,32}';
const chineseShippingNoticeId = 'qualified-shipping-chinese-notice';
type ShippingActionState = 'idle' | 'saving' | 'submitting' | 'saved' | 'submitted' | 'error';
type ShippingLoadState = 'loading' | 'loaded' | 'empty' | 'error';
type ClaimDialog = 'size-chart' | 'submitted' | null;

type QualifiedResultProps = {
  onMediaReady?: () => void;
  productId?: MerchProductId;
  revealMedia?: Pick<
    PreparedRevealMedia,
    'forwardUrl' | 'reverseUrl'
  >;
  result: EligibleMerchEligibilityResult;
};

const merchSizes = [
  {
    size: 'S',
    length: '73',
    chest: '117',
    shoulder: '56',
    sleeve: '24',
    height: '155-175',
    weight: '82-129'
  },
  {
    size: 'M',
    length: '76',
    chest: '124',
    shoulder: '58',
    sleeve: '25',
    height: '175-190',
    weight: '139-165'
  },
  {
    size: 'L',
    length: '79',
    chest: '130',
    shoulder: '60',
    sleeve: '26',
    height: '175-201',
    weight: '165-206'
  },
  {
    size: 'XL',
    length: '82',
    chest: '136',
    shoulder: '62',
    sleeve: '27',
    height: '175-206',
    weight: '206-247'
  }
];

const shippingFieldNames: Array<keyof ShippingClaimPayload> = [
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
  'region',
  'sevenElevenSelectionToken',
  'sevenElevenStoreAddress',
  'sevenElevenStoreId',
  'sevenElevenStoreName',
  'sevenElevenStoreOutside',
  'size'
];

export function QualifiedResult({
  onMediaReady,
  productId = 'shirt',
  revealMedia,
  result
}: QualifiedResultProps) {
  const { locale } = useLocale();
  const copy = qualifiedResultCopy[locale];
  const productName = readLocalizedProductName(productId, locale);
  const shippingCountries = readShippingCountries(locale);
  const productConfig = result.reveal;
  const revealVideoSrc = readRevealVideoSource(
    productId,
    revealMedia?.forwardUrl,
    'forward'
  );
  const reverseVideoSrc = productConfig.hasReverseVideo
    ? readRevealVideoSource(
        productId,
        revealMedia?.reverseUrl,
        'reverse'
      )
    : undefined;
  const scrollerRef = useRef<HTMLElement | null>(null);
  const shippingFormRef = useRef<HTMLFormElement | null>(null);
  const forwardVideoRef = useRef<HTMLVideoElement | null>(null);
  const reverseVideoRef = useRef<HTMLVideoElement | null>(null);
  const [showShipping, setShowShipping] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [revealPlaybackError, setRevealPlaybackError] =
    useState<string | null>(null);
  const [revealPhase, setRevealPhase] =
    useState<MerchRevealPhase>('idle');
  const [shippingActionState, setShippingActionState] =
    useState<ShippingActionState>('idle');
  const [shippingLoadState, setShippingLoadState] =
    useState<ShippingLoadState>('loading');
  const [storedClaimStatus, setStoredClaimStatus] = useState<
    'draft' | 'submitted' | null
  >(null);
  const [hasSubmittedClaim, setHasSubmittedClaim] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ClaimDialog>(null);
  const [braceletColor, setBraceletColor] =
    useState<BraceletColor>('GOLD');
  const [shippingActionError, setShippingActionError] = useState<string | null>(
    null
  );
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
  const resumesSevenElevenSelection = useRef(
    readReturnedSevenElevenContext()?.context === 'claim' &&
      readReturnedSevenElevenContext()?.productId === productId
  ).current;

  useMerchRevealAssistedCompletion({
    forwardVideoRef,
    hasReverseVideo: productConfig.hasReverseVideo,
    journeyRef: scrollerRef,
    playbackErrors: copy.playbackErrors,
    productId,
    reverseVideoRef,
    setMediaReady,
    setPlaybackError: setRevealPlaybackError,
    setRevealPhase,
    setShowClaimForm: setShowShipping,
    startAtEnd: resumesSevenElevenSelection
  });

  useEffect(() => {
    if (mediaReady) {
      onMediaReady?.();
    }
  }, [mediaReady, onMediaReady]);

  useEffect(() => {
    let cancelled = false;

    if (productConfig.claimKind === 'email') {
      setShippingLoadState('loaded');
      return undefined;
    }

    async function loadStoredClaim() {
      try {
        setChineseShippingReview(emptyChineseShippingReview);
        const [storedClaim, returnedSelection] = await Promise.all([
          readStoredShippingClaim(productId),
          consumeReturnedSevenElevenSelection({
            context: 'claim',
            productId
          })
        ]);

        if (cancelled) {
          return;
        }

        setHasSubmittedClaim(storedClaim.hasSubmitted);
        setStoredClaimStatus(storedClaim.claim?.status || null);

        const returnedShipping = returnedSelection
          ? {
              ...(returnedSelection.draft || {}),
              ...toSevenElevenShippingFields(returnedSelection)
            }
          : null;

        if (storedClaim.claim || returnedShipping) {
          const shipping = {
            ...(storedClaim.claim?.shipping || {}),
            ...(returnedShipping || {})
          };

          if (productId === 'bracelet') {
            setBraceletColor(
              readBraceletColor(shipping.color)
            );
          }

          const country = shipping.country || 'US';
          const nextDeliveryMethod =
            storedClaim.hasSubmitted && !returnedShipping
              ? readStoredShippingDeliveryMethod(shipping.deliveryMethod)
              : resolveShippingDeliveryMethod(country);
          setShippingCountry(country);
          setDeliveryMethod(nextDeliveryMethod);
          setSevenElevenStore(readSevenElevenStore(shipping));
          setSevenElevenSelectionToken(
            shipping.sevenElevenSelectionToken || ''
          );
          setTaiwanMobileNeedsUpdate(
            needsTaiwanMobileUpdate(
              shipping.phone || '',
              nextDeliveryMethod
            )
          );

          setShippingLoadState('loaded');
          window.requestAnimationFrame(() => {
            if (!cancelled && shippingFormRef.current) {
              applyShippingFormValues(
                shippingFormRef.current,
                shipping
              );
              applyTaiwanMobileValidity(
                shippingFormRef.current,
                nextDeliveryMethod,
                chineseShippingNoticeId
              );

              if (storedClaim.hasSubmitted) {
                applyChineseShippingFormValidity(
                  shippingFormRef.current,
                  emptyChineseShippingReview,
                  chineseShippingNoticeId
                );
              } else {
                setChineseShippingReview(
                  syncClaimChineseShippingReview(shippingFormRef.current, {
                    ...shipping,
                    country,
                    deliveryMethod: nextDeliveryMethod
                  })
                );
              }
            }
          });
          return;
        }

        const storedProfile = await readStoredShippingProfile();

        if (cancelled) {
          return;
        }

        if (!storedProfile.profile) {
          setShippingLoadState('empty');
          return;
        }

        setShippingLoadState('loaded');
        const profileCountry = storedProfile.profile.country || 'US';
        const profileDeliveryMethod =
          resolveShippingDeliveryMethod(profileCountry);
        setShippingCountry(profileCountry);
        setDeliveryMethod(profileDeliveryMethod);
        setSevenElevenStore(readSevenElevenStore(storedProfile.profile));
        setSevenElevenSelectionToken(
          storedProfile.profile.sevenElevenSelectionToken || ''
        );
        setTaiwanMobileNeedsUpdate(
          needsTaiwanMobileUpdate(
            storedProfile.profile.phone || '',
            profileDeliveryMethod
          )
        );
        window.requestAnimationFrame(() => {
          if (!cancelled && shippingFormRef.current) {
            applyShippingFormValues(
              shippingFormRef.current,
              storedProfile.profile || {}
            );
            applyTaiwanMobileValidity(
              shippingFormRef.current,
              profileDeliveryMethod,
              chineseShippingNoticeId
            );
            setChineseShippingReview(
              syncClaimChineseShippingReview(shippingFormRef.current, {
                ...storedProfile.profile,
                country: profileCountry,
                deliveryMethod: profileDeliveryMethod
              })
            );
          }
        });
      } catch {
        if (!cancelled) {
          setShippingLoadState('error');
        }
      }
    }

    void loadStoredClaim();

    return () => {
      cancelled = true;
    };
  }, [productConfig.claimKind, productId]);

  function handleShippingFormChange(event: FormEvent<HTMLFormElement>) {
    if (hasSubmittedClaim) {
      return;
    }

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
    setChineseShippingReview(
      syncClaimChineseShippingReview(form, {
        ...readShippingClaimPayload(form),
        deliveryMethod: nextDeliveryMethod
      })
    );
  }

  function handleSelectSevenElevenStore() {
    const form = shippingFormRef.current;

    if (!form) {
      return;
    }

    beginSevenElevenStoreSelection({
      context: 'claim',
      draft: {
        ...readShippingClaimPayload(form),
        country: 'TW',
        deliveryMethod: 'seven_eleven_c2c'
      },
      productId
    });
  }

  async function handleShippingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      shippingActionState === 'saving' ||
      shippingActionState === 'submitting'
    ) {
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent: ShippingClaimIntent =
      submitter instanceof HTMLButtonElement && submitter.value === 'submit'
        ? 'submit'
        : 'save';
    const payload = readShippingClaimPayload(event.currentTarget);

    if (hasSubmittedClaim) {
      return;
    }

    applyTaiwanMobileValidity(
      event.currentTarget,
      deliveryMethod,
      chineseShippingNoticeId
    );
    setTaiwanMobileNeedsUpdate(
      needsTaiwanMobileUpdate(payload.phone, deliveryMethod)
    );

    if (
      deliveryMethod === 'seven_eleven_c2c' &&
      (!sevenElevenStore || !sevenElevenSelectionToken)
    ) {
      setShippingActionError(copy.selectStoreFirst);
      setShippingActionState('error');
      return;
    }

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }

    const review = syncClaimChineseShippingReview(
      event.currentTarget,
      payload
    );
    setChineseShippingReview(review);

    if (review.needsUpdate) {
      focusFirstInvalidChineseShippingField(event.currentTarget, review);
      return;
    }

    await persistShippingClaim(payload, intent);
  }

  async function persistShippingClaim(
    payload: ShippingClaimPayload,
    intent: ShippingClaimIntent
  ) {
    setShippingActionError(null);
    setShippingActionState(intent === 'submit' ? 'submitting' : 'saving');

    try {
      const claim = await saveShippingClaim(payload, intent, productId);
      setHasSubmittedClaim(claim.hasSubmitted);
      setStoredClaimStatus(claim.status);
      setShippingLoadState('loaded');
      setShippingActionState(intent === 'submit' ? 'submitted' : 'saved');

      if (intent === 'submit') {
        setActiveDialog('submitted');
      }
    } catch (error) {
      setShippingActionError(
        readShippingClaimErrorMessage(error, intent, locale)
      );
      setShippingActionState('error');
    }
  }

  const isPersisting =
    shippingActionState === 'saving' || shippingActionState === 'submitting';

  return (
    <section
      className={`qualified-result ${
        showShipping ? 'qualified-result--shipping' : ''
      } qualified-result--${revealPhase} ${
        mediaReady ? 'qualified-result--ready' : 'qualified-result--loading'
      } qualified-result--${productId}`}
      aria-labelledby="qualified-title"
      aria-live="polite"
      ref={scrollerRef}
    >
      <div className="qualified-result__scroll">
        <div className="qualified-result__stage">
          <video
            ref={forwardVideoRef}
            className="qualified-result__video qualified-result__video--forward"
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            src={revealVideoSrc}
          />
          <video
            ref={reverseVideoRef}
            className="qualified-result__video qualified-result__video--reverse"
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            src={
              reverseVideoSrc || revealVideoSrc
            }
            aria-hidden="true"
          />

          <div className="qualified-result__veil" aria-hidden="true" />

          <div
            className="qualified-result__scroll-hint"
            aria-hidden={revealPhase !== 'idle'}
          >
            <span />
          </div>

          <div className="qualified-result__status" aria-hidden={showShipping}>
            <p className="qualified-result__eyebrow">
              {copy.statusEyebrows[productId]}
            </p>
            <h2 id="qualified-title">{copy.qualified}</h2>
            <p>{copy.requirementMet(result.minimumSbtBalance)}</p>
          </div>

          {productConfig.claimKind === 'email' ? (
            <VipTicketClaimForm
              claimName={productConfig.claimName}
              minimumSbtBalance={result.minimumSbtBalance}
            />
          ) : (
          <form
            ref={shippingFormRef}
            className="qualified-result__shipping"
            onChange={handleShippingFormChange}
            onSubmit={handleShippingSubmit}
            aria-label={copy.shippingAria(productName)}
          >
            <p className="qualified-result__eyebrow">{copy.claimDetails}</p>
            <h2>{copy.shippingAddress}</h2>
            <p>
              {hasSubmittedClaim
                ? copy.shippingLocked
                : copy.shippingDescription(
                    result.minimumSbtBalance,
                    productName
                  )}
            </p>

            {!hasSubmittedClaim && chineseShippingReview.isRequired ? (
              <div
                className={`qualified-result__language-notice ${
                  chineseShippingReview.needsUpdate ||
                  taiwanMobileNeedsUpdate
                    ? 'is-invalid'
                    : ''
                }`}
                id={chineseShippingNoticeId}
                role={
                  chineseShippingReview.needsUpdate ||
                  taiwanMobileNeedsUpdate
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

            <fieldset
              className="qualified-result__fields"
              disabled={hasSubmittedClaim || isPersisting}
            >
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
              <label className="qualified-result__field-half">
                {chineseShippingReview.isRequired
                  ? copy.firstNameChinese
                  : copy.firstName}
                <input
                  autoComplete="shipping given-name"
                  name="firstName"
                  placeholder={copy.firstName}
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-half">
                {chineseShippingReview.isRequired
                  ? copy.lastNameChinese
                  : copy.lastName}
                <input
                  autoComplete="shipping family-name"
                  name="lastName"
                  placeholder={copy.lastName}
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-half">
                {copy.email}
                <input
                  autoComplete="email"
                  name="email"
                  pattern={emailInputPattern}
                  placeholder="name@example.com"
                  required
                  title={copy.emailTitle}
                  type="email"
                />
              </label>
              <label className="qualified-result__field-half">
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
                  title={copy.phoneTitle}
                  type="tel"
                />
              </label>
              {productConfig.requiresSize ? (
                <>
                  <div className="qualified-result__field-half qualified-result__field-control">
                    <div className="qualified-result__field-label">
                      <span>{copy.size}</span>
                      <button
                        aria-label={copy.openSizeChart}
                        className="qualified-result__size-chart-link"
                        type="button"
                        onClick={() => setActiveDialog('size-chart')}
                      >
                        {copy.sizeChart}
                      </button>
                    </div>
                    <select name="size" required defaultValue="">
                      <option value="" disabled>
                        {copy.selectSize}
                      </option>
                      {merchSizes.map((size) => (
                        <option key={size.size} value={size.size}>
                          {size.size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input name="color" type="hidden" value="BLACK" />
                </>
              ) : (
                <div className="qualified-result__field-half qualified-result__field-control">
                  <span className="qualified-result__field-label">{copy.color}</span>
                  <div
                    aria-label={copy.braceletColor}
                    className="qualified-result__color-options"
                    role="group"
                  >
                    {braceletColors.map((color) => (
                      <button
                        aria-pressed={braceletColor === color.id}
                        className={
                          braceletColor === color.id ? 'is-active' : ''
                        }
                        key={color.id}
                        onClick={() => setBraceletColor(color.id)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className={`qualified-result__color-swatch qualified-result__color-swatch--${color.id.toLowerCase()}`}
                        />
                        {copy.braceletColors[color.id]}
                      </button>
                    ))}
                  </div>
                  <input name="size" type="hidden" value="ONE_SIZE" />
                  <input name="color" type="hidden" value={braceletColor} />
                </div>
              )}
              <label className="qualified-result__field-half">
                {copy.countryRegion}
                <select
                  autoComplete="shipping country-name"
                  name="country"
                  required
                  defaultValue="US"
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
                <div className="qualified-result__store-picker qualified-result__field-wide">
                  <div>
                    <span className="qualified-result__field-label">
                      {copy.pickupStore}
                    </span>
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
                  <label className="qualified-result__field-wide">
                    {copy.addressLine1}
                    <input
                      autoComplete="shipping address-line1"
                      name="addressLine1"
                      placeholder={copy.addressLine1Placeholder}
                      required
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-wide">
                    {copy.addressLine2}
                    <input
                      autoComplete="shipping address-line2"
                      name="addressLine2"
                      placeholder={copy.addressLine2Placeholder}
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-third">
                    {copy.city}
                    <input
                      autoComplete="shipping address-level2"
                      name="city"
                      placeholder={copy.city}
                      required
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-third">
                    {copy.region}
                    <input
                      autoComplete="shipping address-level1"
                      name="region"
                      placeholder={copy.regionPlaceholder}
                      required
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-third">
                    {copy.postalCode}
                    <input
                      autoComplete="shipping postal-code"
                      name="postalCode"
                      placeholder={copy.postalCodePlaceholder}
                      required
                      type="text"
                    />
                  </label>
                </>
              )}
              <label className="qualified-result__field-wide">
                {copy.deliveryNotes}
                <textarea
                  name="deliveryNotes"
                  placeholder={copy.deliveryNotesPlaceholder}
                  rows={3}
                />
              </label>
            </fieldset>

            {hasSubmittedClaim ? (
              <p
                className="qualified-result__submit-status qualified-result__submit-status--locked"
                role="status"
              >
                {copy.claimLocked}
              </p>
            ) : (
              <>
                <div className="qualified-result__actions">
                  <button
                    type="submit"
                    name="intent"
                    value="submit"
                    disabled={isPersisting}
                  >
                    {shippingActionState === 'submitting'
                      ? copy.submitting
                      : copy.submitClaim}
                  </button>
                  <button
                    className="qualified-result__save-button"
                    type="submit"
                    name="intent"
                    value="save"
                    disabled={isPersisting}
                  >
                    {shippingActionState === 'saving'
                      ? copy.saving
                      : copy.saveShipping}
                  </button>
                </div>
                <p
                  className={`qualified-result__submit-status qualified-result__submit-status--${shippingActionState}`}
                  role="status"
                >
                  {readShippingSubmitStatus(
                    shippingActionState,
                    shippingLoadState,
                    storedClaimStatus,
                    shippingActionError,
                    locale
                  )}
                </p>
              </>
            )}
          </form>
          )}

          {activeDialog ? (
            <div className="qualified-result__modal-backdrop" role="presentation">
              {activeDialog === 'size-chart' ? (
                <div
                  aria-labelledby="qualified-size-chart-title"
                  aria-modal="true"
                  className="qualified-result__modal qualified-result__modal--chart"
                  role="dialog"
                >
                  <div className="qualified-result__modal-header">
                    <h3 id="qualified-size-chart-title">{copy.sizeChart}</h3>
                    <button
                      aria-label={copy.closeSizeChart}
                      className="qualified-result__modal-close"
                      type="button"
                      onClick={() => setActiveDialog(null)}
                    >
                      X
                    </button>
                  </div>
                  <p className="qualified-result__size-fit-note">
                    {copy.sizeFitNote}
                  </p>
                  <div className="qualified-result__size-chart-wrap">
                    <table className="qualified-result__size-chart">
                      <thead>
                        <tr>
                          <th>{copy.size}</th>
                          <th>{copy.length}</th>
                          <th>{copy.chest}</th>
                          <th>{copy.shoulder}</th>
                          <th>{copy.sleeve}</th>
                          <th>{copy.height}</th>
                          <th>{copy.weight}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {merchSizes.map((size) => (
                          <tr key={size.size}>
                            <th scope="row">{size.size}</th>
                            <td>{size.length}</td>
                            <td>{size.chest}</td>
                            <td>{size.shoulder}</td>
                            <td>{size.sleeve}</td>
                            <td>{size.height}</td>
                            <td>{size.weight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeDialog === 'submitted' ? (
                <div
                  aria-labelledby="qualified-submit-success-title"
                  aria-modal="true"
                  className="qualified-result__modal"
                  role="dialog"
                >
                  <p className="qualified-result__modal-eyebrow">
                    {copy.claimSubmitted}
                  </p>
                  <h3 id="qualified-submit-success-title">
                    {copy.shippingReceived}
                  </h3>
                  <p>
                    {copy.submittedDialog(productName)}
                  </p>
                  <div className="qualified-result__modal-actions">
                    <button type="button" onClick={() => setActiveDialog(null)}>
                      {copy.stayHere}
                    </button>
                    <a
                      className="qualified-result__reset-link"
                      href={readRenaissLogoutReturnUrl()}
                    >
                      {copy.checkAnotherWallet}
                    </a>
                  </div>
                </div>
              ) : null}

            </div>
          ) : null}

          {revealPlaybackError ? (
            <p className="qualified-result__media-error" role="alert">
              {revealPlaybackError}
            </p>
          ) : null}

          <div className="qualified-result__loader" aria-hidden={mediaReady}>
            <span />
          </div>
        </div>
      </div>
    </section>
  );
}

function readRevealVideoSource(
  productId: MerchProductId,
  preparedSource: string | undefined,
  direction: 'forward' | 'reverse'
) {
  if (preparedSource) {
    return preparedSource;
  }

  if (hasPublicRevealMedia(productId)) {
    return publicRevealMediaUrl(productId, direction);
  }

  throw new Error(`Private reveal media is required for ${productId}.`);
}

function readShippingClaimPayload(form: HTMLFormElement): ShippingClaimPayload {
  const formData = new FormData(form);
  const country = readFormValue(formData, 'country');

  return {
    addressLine1: readFormValue(formData, 'addressLine1'),
    addressLine2: readFormValue(formData, 'addressLine2'),
    city: readFormValue(formData, 'city'),
    color: readFormValue(formData, 'color'),
    country,
    deliveryMethod: resolveShippingDeliveryMethod(country),
    deliveryNotes: readFormValue(formData, 'deliveryNotes'),
    email: readFormValue(formData, 'email'),
    firstName: readFormValue(formData, 'firstName'),
    lastName: readFormValue(formData, 'lastName'),
    phone: readFormValue(formData, 'phone'),
    postalCode: readFormValue(formData, 'postalCode'),
    region: readFormValue(formData, 'region'),
    sevenElevenSelectionToken: readFormValue(
      formData,
      'sevenElevenSelectionToken'
    ),
    sevenElevenStoreAddress: readFormValue(
      formData,
      'sevenElevenStoreAddress'
    ),
    sevenElevenStoreId: readFormValue(formData, 'sevenElevenStoreId'),
    sevenElevenStoreName: readFormValue(formData, 'sevenElevenStoreName'),
    sevenElevenStoreOutside: readFormValue(
      formData,
      'sevenElevenStoreOutside'
    ),
    size: readFormValue(formData, 'size')
  };
}

function applyShippingFormValues(
  form: HTMLFormElement,
  shipping: Partial<ShippingClaimPayload>
) {
  for (const fieldName of shippingFieldNames) {
    const field = form.elements.namedItem(fieldName);
    const value = shipping[fieldName];

    if (
      typeof value === 'string' &&
      (field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement)
    ) {
      field.value = value;
    }
  }
}

function syncClaimChineseShippingReview(
  form: HTMLFormElement,
  shipping: Partial<ShippingClaimPayload> = readShippingClaimPayload(form)
) {
  const review = reviewChineseShippingDetails(shipping);
  applyChineseShippingFormValidity(form, review, chineseShippingNoticeId);
  return review;
}

function readFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === 'string' ? value.trim() : '';
}

function readShippingSubmitStatus(
  actionState: ShippingActionState,
  loadState: ShippingLoadState,
  storedStatus: 'draft' | 'submitted' | null,
  actionError: string | null,
  locale: AppLocale
) {
  const copy = qualifiedResultCopy[locale];

  switch (actionState) {
    case 'saving':
      return copy.statusSaving;
    case 'submitting':
      return copy.statusSubmitting;
    case 'saved':
      return copy.statusSaved;
    case 'submitted':
      return copy.statusSubmitted;
    case 'error':
      return actionError || copy.errors.saveFailed;
    default:
      break;
  }

  switch (loadState) {
    case 'loading':
      return copy.statusLoading;
    case 'loaded':
      return storedStatus === 'submitted'
        ? copy.statusSubmittedLoaded
        : copy.statusSavedLoaded;
    case 'error':
      return copy.statusLoadFailed;
    default:
      return '';
  }
}

function readShippingClaimErrorMessage(
  error: unknown,
  intent: ShippingClaimIntent,
  locale: AppLocale
) {
  const copy = qualifiedResultCopy[locale];

  if (!(error instanceof ShippingClaimError)) {
    return intent === 'submit'
      ? copy.errors.submitFailed
      : copy.errors.saveFailed;
  }

  if (isChineseShippingErrorCode(error.code)) {
    return copy.errors.chineseRequired;
  }

  switch (error.code) {
    case 'taiwan_mobile_invalid':
    case 'taiwan_mobile_required':
      return copy.errors.taiwanMobile;
    case 'seven_eleven_selection_required':
    case 'seven_eleven_selection_invalid':
    case 'seven_eleven_selection_not_found':
    case 'seven_eleven_selection_not_ready':
      return copy.errors.storeReselect;
    case 'email_invalid':
      return copy.errors.email;
    case 'phone_invalid':
    case 'phone_required':
      return copy.errors.phone;
    case 'size_required':
    case 'size_invalid':
      return copy.errors.size;
    case 'color_required':
    case 'color_invalid':
      return copy.errors.color;
    case 'country_invalid':
    case 'country_required':
      return copy.errors.country;
    case 'unauthenticated':
      return copy.errors.sessionExpired;
    case 'wallet_not_eligible':
      return copy.errors.walletNotEligible;
    case 'shipping_claim_already_submitted':
      return copy.errors.alreadySubmitted;
    case 'merch_inventory_sold_out':
      return copy.errors.soldOut;
    default:
      return error.status >= 400 && error.status < 500
        ? copy.errors.checkDetails
        : intent === 'submit'
          ? copy.errors.submitFailed
          : copy.errors.saveFailed;
  }
}
