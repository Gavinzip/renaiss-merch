import type { MemberBinder } from "../../../shared/member-binder.js";
import { validateBinder } from "../../../shared/member-binder.js";

export type BinderBadge = {
  tokenId: string;
  name: string;
  description: string;
  howToEarn: string;
  imageUrl: string;
  balance: number;
  card?: { tokenId: string; setName: string; gradingCompany: string; grade: string };
};
export type BinderLibrary = {
  badges: BinderBadge[];
  walletAddress: string;
  checkedAt: string;
};
export type BinderSnapshot = {
  binder: MemberBinder;
  revision: number;
  updatedAt: string | null;
};
export class BinderApiError extends Error {
  constructor(public status: number) {
    super("Binder request failed");
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...init.headers },
  });
  if (!response.ok) throw new BinderApiError(response.status);
  return response.json() as Promise<T>;
}
export async function readBinder(signal: AbortSignal) {
  const value = await request<BinderSnapshot>("/api/binder", { signal });
  validateBinder(value.binder);
  if (!Number.isSafeInteger(value.revision) || value.revision < 0)
    throw new Error("Invalid binder revision");
  return value;
}
export function readLibrary(signal: AbortSignal, refresh = false) {
  return request<BinderLibrary>(
    "/api/binder/library" + (refresh ? "?refresh=1" : ""),
    { signal },
  );
}
export function saveBinder(snapshot: BinderSnapshot, signal: AbortSignal) {
  return request<BinderSnapshot>("/api/binder", {
    method: "PUT",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      binder: snapshot.binder,
      revision: snapshot.revision,
    }),
  });
}
