import type { HubWidget } from "../../../shared/hub-preferences.js";
import type { AppLocale } from "../../i18n/LocaleContext";
import { renaissHubCopy } from "./RenaissHubCopy";
import { hubWidgetCopy } from "./HubWidgetCopy";
import { HubQuestline, HubMerch, type AccountState } from "./RenaissHubFeatures";
import { HubMember } from "./HubMember";
import { HubSurfQuest } from "./HubSurfQuest";
import { HubCommunityWidget } from "./HubCommunityWidget";
import type { CommunityFeedState } from "./useCommunityFeed";

export type HubWidgetContentProps = {
  widget: HubWidget; locale: AppLocale; account: AccountState; feed: CommunityFeedState;
  onRetryFeed: () => void; onRetryAccount: () => void; onLogin: () => void;
  onOpenCampaign: () => void; onEnter: () => void; loadProgress: number; loadState: "idle" | "loading" | "error";
  enterRequested: boolean; preview?: boolean; editing?: boolean;
};

// Home and collection share their renderer, data and styles. The preview's
// inert parent prevents login, Store navigation and AI submissions.
export function HubWidgetContent(props: HubWidgetContentProps) {
  const { widget, locale, preview, account } = props;
  const copy = renaissHubCopy[locale];
  switch (widget.type) {
    case "member": return <HubMember account={account} copy={copy.member} preview={preview} onLogin={props.onLogin} onRetry={props.onRetryAccount} />;
    case "questline": return <HubQuestline copy={copy.questline} preview={preview} />;
    case "merch": return <HubMerch locale={locale} copy={copy.merch} preview={preview} enterRequested={props.enterRequested} loadProgress={props.loadProgress} loadState={props.loadState} onEnter={props.onEnter} />;
    case "partner": return <HubSurfQuest locale={locale} preview={preview} onOpenCampaign={props.onOpenCampaign} />;
    case "feed": return <HubCommunityWidget settings={widget} feed={props.feed} locale={locale} copy={hubWidgetCopy[locale]} editing={props.editing} preview={preview} onRetry={props.onRetryFeed} />;
  }
}
