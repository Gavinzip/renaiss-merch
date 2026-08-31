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
import { shippingCountries } from '../../lib/shippingCountries';
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

const emailInputPattern = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';
const phoneInputPattern = '[+()0-9\\s.-]{6,32}';
const chineseShippingNoticeId = 'qualified-shipping-chinese-notice';
type ShippingActionState = 'idle' | 'saving' | 'submitting' | 'saved' | 'submitted' | 'error';
type ShippingLoadState = 'loading' | 'loaded' | 'empty' | 'error';
type ClaimDialog = 'size-chart' | 'submitted' | null;

type QualifiedResultProps = {
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
  productId = 'shirt',
  revealMedia,
  result
}: QualifiedResultProps) {
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
    productId,
    reverseVideoRef,
    setMediaReady,
    setPlaybackError: setRevealPlaybackError,
    setRevealPhase,
    setShowClaimForm: setShowShipping,
    startAtEnd: resumesSevenElevenSelection
  });

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
      setShippingActionError('請先選擇 7-ELEVEN 取件門市。');
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
      setShippingActionError(readShippingClaimErrorMessage(error, intent));
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
              {productConfig.statusEyebrow}
            </p>
            <h2 id="qualified-title">Qualified</h2>
            <p>
              {result.minimumSbtBalance} SBT access requirement met.
            </p>
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
            aria-label={`Shipping address for ${productConfig.claimName}`}
          >
            <p className="qualified-result__eyebrow">Claim details</p>
            <h2>Shipping address</h2>
            <p>
              {hasSubmittedClaim
                ? 'Shipping details have been submitted and are locked.'
                : `${result.minimumSbtBalance} SBT access requirement met. Add the recipient details for this ${productConfig.claimName} claim.`}
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
                  ? 'First name (中文)'
                  : 'First name'}
                <input
                  autoComplete="shipping given-name"
                  name="firstName"
                  placeholder="First name"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-half">
                {chineseShippingReview.isRequired
                  ? 'Last name (中文)'
                  : 'Last name'}
                <input
                  autoComplete="shipping family-name"
                  name="lastName"
                  placeholder="Last name"
                  required
                  type="text"
                />
              </label>
              <label className="qualified-result__field-half">
                Email
                <input
                  autoComplete="email"
                  name="email"
                  pattern={emailInputPattern}
                  placeholder="name@example.com"
                  required
                  title="Enter a complete email address, for example name@example.com."
                  type="email"
                />
              </label>
              <label className="qualified-result__field-half">
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
                  title="Enter a valid phone number using digits, spaces, +, -, ., or parentheses."
                  type="tel"
                />
              </label>
              {productConfig.requiresSize ? (
                <>
                  <div className="qualified-result__field-half qualified-result__field-control">
                    <div className="qualified-result__field-label">
                      <span>Size</span>
                      <button
                        aria-label="Open size chart"
                        className="qualified-result__size-chart-link"
                        type="button"
                        onClick={() => setActiveDialog('size-chart')}
                      >
                        Size chart
                      </button>
                    </div>
                    <select name="size" required defaultValue="">
                      <option value="" disabled>
                        Select size
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
                  <span className="qualified-result__field-label">Color</span>
                  <div
                    aria-label="Bracelet color"
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
                        {color.label}
                      </button>
                    ))}
                  </div>
                  <input name="size" type="hidden" value="ONE_SIZE" />
                  <input name="color" type="hidden" value={braceletColor} />
                </div>
              )}
              <label className="qualified-result__field-half">
                Country / region
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
                      Pickup store
                    </span>
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
                  <label className="qualified-result__field-wide">
                    Address line 1
                    <input
                      autoComplete="shipping address-line1"
                      name="addressLine1"
                      placeholder="Street address or PO box"
                      required
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-wide">
                    Address line 2
                    <input
                      autoComplete="shipping address-line2"
                      name="addressLine2"
                      placeholder="Apartment, suite, unit, building (optional)"
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-third">
                    City
                    <input
                      autoComplete="shipping address-level2"
                      name="city"
                      placeholder="City"
                      required
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-third">
                    State / province
                    <input
                      autoComplete="shipping address-level1"
                      name="region"
                      placeholder="State"
                      required
                      type="text"
                    />
                  </label>
                  <label className="qualified-result__field-third">
                    ZIP / postal code
                    <input
                      autoComplete="shipping postal-code"
                      name="postalCode"
                      placeholder="Postal code"
                      required
                      type="text"
                    />
                  </label>
                </>
              )}
              <label className="qualified-result__field-wide">
                Delivery notes
                <textarea
                  name="deliveryNotes"
                  placeholder="Gate code, preferred delivery detail, or local instructions (optional)"
                  rows={3}
                />
              </label>
            </fieldset>

            {hasSubmittedClaim ? (
              <p
                className="qualified-result__submit-status qualified-result__submit-status--locked"
                role="status"
              >
                Claim submitted. Shipping details cannot be changed.
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
                      ? 'Submitting'
                      : 'Submit claim'}
                  </button>
                  <button
                    className="qualified-result__save-button"
                    type="submit"
                    name="intent"
                    value="save"
                    disabled={isPersisting}
                  >
                    {shippingActionState === 'saving'
                      ? 'Saving'
                      : 'Save shipping details'}
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
                    shippingActionError
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
                    <h3 id="qualified-size-chart-title">Size chart</h3>
                    <button
                      aria-label="Close size chart"
                      className="qualified-result__modal-close"
                      type="button"
                      onClick={() => setActiveDialog(null)}
                    >
                      X
                    </button>
                  </div>
                  <p className="qualified-result__size-fit-note">
                    Oversized fit. Size down is recommended.
                  </p>
                  <div className="qualified-result__size-chart-wrap">
                    <table className="qualified-result__size-chart">
                      <thead>
                        <tr>
                          <th>Size</th>
                          <th>Length</th>
                          <th>Chest</th>
                          <th>Shoulder</th>
                          <th>Sleeve</th>
                          <th>Height</th>
                          <th>Weight</th>
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
                    Claim submitted
                  </p>
                  <h3 id="qualified-submit-success-title">
                    Shipping details received.
                  </h3>
                  <p>
                    Your {productConfig.claimName} claim has been submitted and
                    the shipping details are now locked.
                  </p>
                  <div className="qualified-result__modal-actions">
                    <button type="button" onClick={() => setActiveDialog(null)}>
                      Stay here
                    </button>
                    <a
                      className="qualified-result__reset-link"
                      href={readRenaissLogoutReturnUrl()}
                    >
                      Check another wallet
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
  actionError: string | null
) {
  switch (actionState) {
    case 'saving':
      return 'Saving shipping details.';
    case 'submitting':
      return 'Submitting claim.';
    case 'saved':
      return 'Shipping details saved.';
    case 'submitted':
      return 'Claim submitted.';
    case 'error':
      return actionError || 'Could not save shipping details.';
    default:
      break;
  }

  switch (loadState) {
    case 'loading':
      return 'Checking saved details.';
    case 'loaded':
      return storedStatus === 'submitted'
        ? 'Submitted details loaded.'
        : 'Saved details loaded.';
    case 'error':
      return 'Could not load saved details.';
    default:
      return '';
  }
}

function readShippingClaimErrorMessage(
  error: unknown,
  intent: ShippingClaimIntent
) {
  if (!(error instanceof ShippingClaimError)) {
    return intent === 'submit'
      ? 'Could not submit claim.'
      : 'Could not save shipping details.';
  }

  if (isChineseShippingErrorCode(error.code)) {
    return 'Taiwan and China shipping names and addresses must include Chinese characters.';
  }

  switch (error.code) {
    case 'taiwan_mobile_invalid':
    case 'taiwan_mobile_required':
      return '7-ELEVEN 取件請填寫台灣手機號碼。';
    case 'seven_eleven_selection_required':
    case 'seven_eleven_selection_invalid':
    case 'seven_eleven_selection_not_found':
    case 'seven_eleven_selection_not_ready':
      return '請重新選擇 7-ELEVEN 取件門市。';
    case 'email_invalid':
      return 'Enter a complete email address, for example name@example.com.';
    case 'phone_invalid':
    case 'phone_required':
      return 'Enter a valid phone number using digits, spaces, +, -, ., or parentheses.';
    case 'size_required':
    case 'size_invalid':
      return 'Select a merch size before saving.';
    case 'color_required':
    case 'color_invalid':
      return 'Select Gold or Silver before saving.';
    case 'country_invalid':
    case 'country_required':
      return 'Select a valid country or region.';
    case 'unauthenticated':
      return 'Session expired. Please sign in again.';
    case 'wallet_not_eligible':
      return 'This wallet is not eligible to submit a merch claim.';
    case 'shipping_claim_already_submitted':
      return 'Shipping details have already been submitted and are locked.';
    case 'merch_inventory_sold_out':
      return 'The Renaiss Bracelet release is fully claimed.';
    default:
      return error.status >= 400 && error.status < 500
        ? 'Check the shipping details and try again.'
        : intent === 'submit'
          ? 'Could not submit claim.'
          : 'Could not save shipping details.';
  }
}
