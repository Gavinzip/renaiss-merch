import { HttpError } from './http.mjs';
import {
  findShippingFieldsMissingChinese,
  readChineseShippingFieldErrorCode
} from '../shared/shipping-address-policy.js';

const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const countryPattern = /^[A-Z]{2}$/;
const phonePattern = /^[+()\d\s.-]{6,32}$/;
const taiwanMobilePattern = /^(?:09\d{8}|\+8869\d{8})$/;
const sevenElevenSelectionTokenPattern = /^[A-Za-z0-9]{20}$/;
const sizePattern = /^(S|M|L|XL|ONE_SIZE)$/;
const braceletColorPattern = /^(GOLD|SILVER)$/;

export async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > MAX_REQUEST_BODY_BYTES) {
      throw new HttpError(413, 'request_too_large');
    }

    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new HttpError(400, 'request_body_required');
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function normalizeShippingProfilePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'invalid_shipping_payload');
  }

  const country = readCountry(payload.country);
  const deliveryMethod = readDeliveryMethod(payload.deliveryMethod, country);
  const usesSevenEleven = deliveryMethod === 'seven_eleven_c2c';
  const profile = {
    addressLine1: usesSevenEleven
      ? ''
      : readRequiredText(
          payload.addressLine1,
          'address_line_1_required',
          160
        ),
    addressLine2: usesSevenEleven
      ? ''
      : readOptionalText(payload.addressLine2, 160),
    city: usesSevenEleven
      ? ''
      : readRequiredText(payload.city, 'city_required', 80),
    country,
    deliveryMethod,
    deliveryNotes: readOptionalText(payload.deliveryNotes, 600),
    email: readEmail(payload.email, 'email_invalid'),
    firstName: readRequiredText(
      payload.firstName,
      'first_name_required',
      80
    ),
    lastName: readRequiredText(payload.lastName, 'last_name_required', 80),
    phone: usesSevenEleven
      ? readTaiwanMobile(payload.phone)
      : readPhone(payload.phone),
    postalCode: usesSevenEleven
      ? ''
      : readRequiredText(
          payload.postalCode,
          'postal_code_required',
          32
        ),
    region: usesSevenEleven
      ? ''
      : readRequiredText(payload.region, 'region_required', 80),
    sevenElevenSelectionToken: usesSevenEleven
      ? readSevenElevenSelectionToken(payload.sevenElevenSelectionToken)
      : '',
    sevenElevenStoreAddress: usesSevenEleven
      ? readOptionalText(payload.sevenElevenStoreAddress, 60)
      : '',
    sevenElevenStoreId: usesSevenEleven
      ? readOptionalText(payload.sevenElevenStoreId, 9)
      : '',
    sevenElevenStoreName: usesSevenEleven
      ? readOptionalText(payload.sevenElevenStoreName, 10)
      : '',
    sevenElevenStoreOutside: usesSevenEleven
      ? readOptionalText(payload.sevenElevenStoreOutside, 1)
      : ''
  };

  requireChineseShippingDetails(profile);
  return profile;
}

export function normalizeShippingPayload(payload, productId) {
  return {
    ...normalizeShippingProfilePayload(payload),
    color: productId === 'bracelet' ? readBraceletColor(payload.color) : 'BLACK',
    size: productId === 'bracelet' ? 'ONE_SIZE' : readSize(payload.size)
  };
}

function readRequiredText(value, code, maxLength) {
  const text = readOptionalText(value, maxLength);

  if (!text) {
    throw new HttpError(400, code);
  }

  return text;
}

function readOptionalText(value, maxLength) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'invalid_field_type');
  }

  const text = value.trim().replace(/\s+/g, ' ');

  if (text.length > maxLength) {
    throw new HttpError(400, 'field_too_long');
  }

  return text;
}

function readEmail(value, code) {
  const email = readRequiredText(value, code, 160).toLowerCase();

  if (!emailPattern.test(email)) {
    throw new HttpError(400, code);
  }

  return email;
}

function readPhone(value) {
  const phone = readRequiredText(value, 'phone_required', 32);

  if (!phonePattern.test(phone)) {
    throw new HttpError(400, 'phone_invalid');
  }

  return phone;
}

function readTaiwanMobile(value) {
  const phone = readRequiredText(value, 'taiwan_mobile_required', 32)
    .replace(/[\s().-]/g, '');

  if (!taiwanMobilePattern.test(phone)) {
    throw new HttpError(400, 'taiwan_mobile_invalid');
  }

  return phone;
}

function readCountry(value) {
  const country = readRequiredText(value, 'country_required', 2).toUpperCase();

  if (!countryPattern.test(country)) {
    throw new HttpError(400, 'country_invalid');
  }

  return country;
}

function readDeliveryMethod(value, country) {
  const method =
    value === undefined || value === null || value === ''
      ? 'home_delivery'
      : readRequiredText(value, 'delivery_method_required', 32);

  if (country === 'TW') {
    if (method !== 'seven_eleven_c2c') {
      throw new HttpError(400, 'seven_eleven_required_for_taiwan');
    }

    return method;
  }

  if (method === 'home_delivery') {
    return method;
  }

  if (method === 'seven_eleven_c2c') {
    throw new HttpError(400, 'seven_eleven_taiwan_only');
  }

  throw new HttpError(400, 'delivery_method_invalid');
}

function readSevenElevenSelectionToken(value) {
  const token = readRequiredText(
    value,
    'seven_eleven_selection_required',
    20
  );

  if (!sevenElevenSelectionTokenPattern.test(token)) {
    throw new HttpError(400, 'seven_eleven_selection_invalid');
  }

  return token;
}

function requireChineseShippingDetails(profile) {
  const firstInvalidField = findShippingFieldsMissingChinese(profile)[0];

  if (firstInvalidField) {
    throw new HttpError(
      400,
      readChineseShippingFieldErrorCode(firstInvalidField)
    );
  }
}

function readSize(value) {
  const size = readRequiredText(value, 'size_required', 8).toUpperCase();

  if (!sizePattern.test(size)) {
    throw new HttpError(400, 'size_invalid');
  }

  return size;
}

function readBraceletColor(value) {
  const color = readRequiredText(value, 'color_required', 8).toUpperCase();

  if (!braceletColorPattern.test(color)) {
    throw new HttpError(400, 'color_invalid');
  }

  return color;
}
