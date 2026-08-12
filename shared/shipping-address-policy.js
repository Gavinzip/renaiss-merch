const hanCharacterPattern = /\p{Script=Han}/u;

export const CHINESE_SHIPPING_COUNTRY_CODES = Object.freeze(['CN', 'TW']);

export const CHINESE_SHIPPING_FIELD_NAMES = Object.freeze([
  'firstName',
  'lastName',
  'addressLine1',
  'addressLine2',
  'city',
  'region'
]);

const SEVEN_ELEVEN_CHINESE_FIELD_NAMES = Object.freeze([
  'firstName',
  'lastName'
]);

const errorCodeByField = Object.freeze({
  addressLine1: 'address_line_1_chinese_required',
  addressLine2: 'address_line_2_chinese_required',
  city: 'city_chinese_required',
  firstName: 'first_name_chinese_required',
  lastName: 'last_name_chinese_required',
  region: 'region_chinese_required'
});

const chineseShippingErrorCodes = Object.freeze([
  ...Object.values(errorCodeByField)
]);

export function requiresChineseShippingDetails(country) {
  return CHINESE_SHIPPING_COUNTRY_CODES.includes(
    typeof country === 'string' ? country.trim().toUpperCase() : ''
  );
}

export function findShippingFieldsMissingChinese(details) {
  if (!requiresChineseShippingDetails(details?.country)) {
    return [];
  }

  const fieldNames =
    details?.country === 'TW' &&
    details?.deliveryMethod === 'seven_eleven_c2c'
      ? SEVEN_ELEVEN_CHINESE_FIELD_NAMES
      : CHINESE_SHIPPING_FIELD_NAMES;

  return fieldNames.filter((fieldName) => {
    const value = details?.[fieldName];
    const text = typeof value === 'string' ? value.trim() : '';

    if (fieldName === 'addressLine2' && !text) {
      return false;
    }

    return !hanCharacterPattern.test(text);
  });
}

export function readChineseShippingFieldErrorCode(fieldName) {
  const errorCode = errorCodeByField[fieldName];

  if (!errorCode) {
    throw new Error(`Unsupported Chinese shipping field: ${fieldName}`);
  }

  return errorCode;
}

export function isChineseShippingErrorCode(code) {
  return chineseShippingErrorCodes.includes(code);
}
