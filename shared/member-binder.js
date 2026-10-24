export const BINDER_MAX_PAGES = 24;
export const BINDER_LAYOUTS = [1, 6, 9];

export function createEmptyBinder() {
  return { version: 1, pages: [{ id: 'first-page', size: 9, slots: Array(9).fill(null) }] };
}

// Store token references only. Ownership and images always come from the server.
export function validateBinder(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.pages) ||
      value.pages.length < 1 || value.pages.length > BINDER_MAX_PAGES) throw new Error('invalid_binder');
  const pageIds = new Set(), tokenIds = new Set();
  const pages = value.pages.map(page => {
    if (!page || typeof page.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(page.id) ||
        pageIds.has(page.id) || !BINDER_LAYOUTS.includes(page.size) ||
        !Array.isArray(page.slots) || page.slots.length !== page.size) throw new Error('invalid_binder');
    pageIds.add(page.id);
    const slots = page.slots.map(token => {
      if (token === null) return null;
      if (typeof token !== 'string' || !/^(0|[1-9]\d{0,4})$/.test(token) ||
          Number(token) > 10000 || tokenIds.has(token)) throw new Error('invalid_binder');
      tokenIds.add(token);
      return token;
    });
    return { id: page.id, size: page.size, slots };
  });
  return { version: 1, pages };
}
