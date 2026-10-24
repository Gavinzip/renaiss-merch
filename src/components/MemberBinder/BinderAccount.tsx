import { useId, type ReactNode } from "react";
import type { RenaissUser } from "../../lib/renaissAuth";

/** Keep the normal account actions behind the reference binder's profile pill. */
export function BinderAccount({
  user,
  children,
}: {
  user: RenaissUser;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <button type="button" className="binder-account" popoverTarget={id}>
        {user.picture ? <img src={user.picture} alt="" /> : null}
        <span>{user.name || "Renaiss"}</span>
      </button>
      <div id={id} popover="auto" className="binder-account-menu">
        {children}
      </div>
    </>
  );
}
