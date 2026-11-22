import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import { staticMerchAssetCssUrl } from "../../lib/staticAssets";
import { useDrawRoomAccess } from "./useDrawRoomAccess";
import { DrawRoomAccessGate } from "./DrawRoomAccessGate";
import { useDrawNavigationLock } from "./useDrawNavigationLock";
import { isFieldDrawRosterPath } from "../../../shared/site-routes.js";
import { useRosterDraw } from "../RosterDraw/useRosterDraw";
import { RosterDrawRoom } from "../RosterDraw/RosterDrawRoom";
import { RosterManagementPage } from "../RosterDraw/RosterManagementPage";
import { SurfDrawMotionAssets } from "../RenaissHub/SurfDrawMotionAssets";
import "../RenaissHub/SurfDrawPage.css";
import "./FieldDrawPage.css";

function FieldDrawContent({
  locale,
  onActive,
}: {
  locale: AppLocale;
  onActive: (value: boolean) => void;
}) {
  const draw = useRosterDraw("/api/field-draw/roster");
  const managing = isFieldDrawRosterPath(window.location.pathname);
  if (managing) return <RosterManagementPage draw={draw} field />;
  return (
    <SurfDrawMotionAssets>
      <div className="draw-room-panels">
        <div className="draw-room-panel" data-active="true">
          <RosterDrawRoom
            kind="other"
            field
            locale={locale}
            visible={true}
            draw={draw}
            onActive={onActive}
          />
        </div>
      </div>
    </SurfDrawMotionAssets>
  );
}

export function FieldDrawPage({ locale }: { locale: AppLocale }) {
  const access = useDrawRoomAccess("/api/auth/field-draw");
  const [active, setActive] = useState(false);
  const onActive = useCallback((value: boolean) => setActive(value), []);
  useDrawNavigationLock(active);
  useEffect(() => {
    const previous = document.title;
    document.title = "Renaiss | 現場開獎室";
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    if (access.state.status !== "ready") setActive(false);
  }, [access.state.status]);
  return (
    <main
      className="surf-draw-page draw-site field-draw-page"
      lang={locale}
      style={
        {
          "--draw-site-background": staticMerchAssetCssUrl("storeBackground"),
        } as CSSProperties
      }
    >
      <div className="surf-draw-page__shell">
        {access.state.status === "ready" ? (
          <>
            <button
              className="draw-site-exit"
              type="button"
              disabled={access.busy || active}
              onClick={() => void access.logout()}
            >
              退出開獎室 ↗
            </button>
            {access.error ? (
              <p role="alert" className="roster-error">
                無法登出，請重試。
              </p>
            ) : null}
            <FieldDrawContent
              key={access.state.username}
              locale={locale}
              onActive={onActive}
            />
          </>
        ) : (
          <DrawRoomAccessGate
            locale={locale}
            access={access}
            eyebrow="RENAISS / PRIVATE FIELD DRAW"
            title="現場開獎室"
          />
        )}
      </div>
    </main>
  );
}
