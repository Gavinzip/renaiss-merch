export type BinderPage = { id: string; size: 1 | 6 | 9; slots: (string | null)[] };
export type MemberBinder = { version: 1; pages: BinderPage[] };
export const BINDER_MAX_PAGES: number;
export const BINDER_LAYOUTS: readonly (1 | 6 | 9)[];
export function createEmptyBinder(): MemberBinder;
export function validateBinder(value: unknown): MemberBinder;
