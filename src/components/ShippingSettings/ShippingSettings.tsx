import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  readStoredShippingProfile,
  saveShippingProfile,
  type ShippingProfilePayload
} from '../../lib/shippingProfile';
import { shippingCountries } from '../../lib/shippingCountries';
import './ShippingSettings.css';

type ShippingSettingsProps = {
  accountLabel: string;
  onClose: () => void;
};

type SettingsState = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

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
  onClose
}: ShippingSettingsProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [settingsState, setSettingsState] =
    useState<SettingsState>('loading');
  const [savedAt, setSavedAt] = useState<string | null>(null);

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
        const storedProfile = await readStoredShippingProfile();

        if (cancelled) {
          return;
        }

        setSavedAt(storedProfile.savedAt);
        setSettingsState('idle');

        const profile = storedProfile.profile;

        if (profile) {
          window.requestAnimationFrame(() => {
            if (!cancelled && formRef.current) {
              applyProfileValues(formRef.current, profile);
            }
          });
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
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (settingsState === 'saving') {
      return;
    }

    setSettingsState('saving');

    try {
      const savedProfile = await saveShippingProfile(
        readProfileValues(event.currentTarget)
      );
      setSavedAt(savedProfile.savedAt);
      setSettingsState('saved');
    } catch {
      setSettingsState('error');
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

        <form ref={formRef} onSubmit={handleSubmit}>
          <fieldset disabled={isLoading || isSaving}>
            <label className="shipping-settings__field-half">
              First name
              <input
                autoComplete="shipping given-name"
                name="firstName"
                required
                type="text"
              />
            </label>
            <label className="shipping-settings__field-half">
              Last name
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
                placeholder="+1 555 000 0000"
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
            <p role="status">{readSettingsStatus(settingsState, savedAt)}</p>
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

  return {
    addressLine1: readFormValue(data, 'addressLine1'),
    addressLine2: readFormValue(data, 'addressLine2'),
    city: readFormValue(data, 'city'),
    country: readFormValue(data, 'country'),
    deliveryNotes: readFormValue(data, 'deliveryNotes'),
    email: readFormValue(data, 'email'),
    firstName: readFormValue(data, 'firstName'),
    lastName: readFormValue(data, 'lastName'),
    phone: readFormValue(data, 'phone'),
    postalCode: readFormValue(data, 'postalCode'),
    region: readFormValue(data, 'region')
  };
}

function readFormValue(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function applyProfileValues(
  form: HTMLFormElement,
  profile: ShippingProfilePayload
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

function readSettingsStatus(
  settingsState: SettingsState,
  savedAt: string | null
) {
  switch (settingsState) {
    case 'loading':
      return 'Loading your saved defaults.';
    case 'saving':
      return 'Saving your default recipient details.';
    case 'saved':
      return 'Defaults saved. Future claims will be prefilled.';
    case 'error':
      return 'Your defaults could not be loaded or saved. Please try again.';
    default:
      return savedAt
        ? `Saved ${new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(new Date(savedAt))}.`
        : 'No defaults saved yet.';
  }
}
