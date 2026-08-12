import {
  CHINESE_SHIPPING_FIELD_NAMES,
  findShippingFieldsMissingChinese,
  requiresChineseShippingDetails,
  type ChineseShippingFieldName
} from '../../shared/shipping-address-policy.js';

export type ChineseShippingReview = {
  invalidFields: ChineseShippingFieldName[];
  isRequired: boolean;
  needsUpdate: boolean;
};

export const emptyChineseShippingReview: ChineseShippingReview = {
  invalidFields: [],
  isRequired: false,
  needsUpdate: false
};

const chineseShippingInputMessage =
  'Taiwan and China shipping details must include Chinese characters.';

export function reviewChineseShippingDetails(
  details: Record<string, unknown> | null | undefined
): ChineseShippingReview {
  const isRequired = requiresChineseShippingDetails(details?.country);
  const invalidFields = findShippingFieldsMissingChinese(details);

  return {
    invalidFields,
    isRequired,
    needsUpdate: isRequired && invalidFields.length > 0
  };
}

export function applyChineseShippingFormValidity(
  form: HTMLFormElement,
  review: ChineseShippingReview,
  noticeId: string
) {
  const invalidFieldNames = new Set(review.invalidFields);

  for (const fieldName of CHINESE_SHIPPING_FIELD_NAMES) {
    const field = form.elements.namedItem(fieldName);

    if (!(field instanceof HTMLInputElement)) {
      continue;
    }

    const isInvalid = invalidFieldNames.has(fieldName);
    field.setCustomValidity(isInvalid ? chineseShippingInputMessage : '');

    if (isInvalid) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', noticeId);
    } else {
      field.removeAttribute('aria-invalid');
      if (field.getAttribute('aria-describedby') === noticeId) {
        field.removeAttribute('aria-describedby');
      }
    }
  }
}

export function focusFirstInvalidChineseShippingField(
  form: HTMLFormElement,
  review: ChineseShippingReview
) {
  const firstInvalidFieldName = review.invalidFields[0];

  if (!firstInvalidFieldName) {
    return;
  }

  const field = form.elements.namedItem(firstInvalidFieldName);

  if (field instanceof HTMLInputElement) {
    field.focus();
    field.reportValidity();
  }
}
