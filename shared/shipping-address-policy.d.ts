export type ChineseShippingFieldName =
  | 'firstName'
  | 'lastName'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'region';

export const CHINESE_SHIPPING_COUNTRY_CODES: readonly ['CN', 'TW'];
export const CHINESE_SHIPPING_FIELD_NAMES: readonly ChineseShippingFieldName[];

export function requiresChineseShippingDetails(country: unknown): boolean;

export function findShippingFieldsMissingChinese(
  details: Record<string, unknown> | null | undefined
): ChineseShippingFieldName[];

export function readChineseShippingFieldErrorCode(
  fieldName: ChineseShippingFieldName
): string;

export function isChineseShippingErrorCode(code: unknown): boolean;
