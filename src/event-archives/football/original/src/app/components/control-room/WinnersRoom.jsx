import { Ticket, Sparkles, ChevronDown, ShieldCheck, Download, ExternalLink, Network } from 'lucide-react';
import { useMemo } from 'react';
import { getMatchPrizeImageByMatchId } from '../../data/matchPrizeImages';
import { canonicalMatchId } from '../../data/matchIds';
import { compactAddress, formatNumber } from '../../data/ticketMath';
import { useCampaignCopy } from '../../i18n/useCampaignCopy';
const FALLBACK_ROUND_ORDER = ['round16','quarterFinal','semiFinal','final'];
const WINNER_ROUND_LABEL_KEYS = { round16:'winnerReveal.roundGroupRound16', quarterFinal:'winnerReveal.roundGroupQuarterFinal', semiFinal:'winnerReveal.roundGroupSemiFinal', final:'winnerReveal.roundGroupFinal' };
function winnerWalletLabel(winner) {
  return compactAddress(winner.walletAddress || winner.userAddress || "");
}

function normalizeWalletAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : "";
}

function winnerWalletAddress(winner) {
  return normalizeWalletAddress(winner?.walletAddress || winner?.userAddress || winner?.profile?.walletAddress);
}

function isCurrentUserWinner(winner, currentWalletAddress) {
  const current = normalizeWalletAddress(currentWalletAddress);
  return Boolean(current && winnerWalletAddress(winner) === current);
}

function cleanWinnerTwitterUsername(winner) {
  return String(winner?.profile?.twitterUsername || "").trim().replace(/^@+/, "");
}

function winnerPrimaryLabel(winner, fallbackLabel) {
  const twitterUsername = cleanWinnerTwitterUsername(winner);
  if (twitterUsername) return `@${twitterUsername}`;
  const displayName = String(winner?.profile?.displayName || winner?.profile?.name || "").trim();
  return displayName || winnerWalletLabel(winner) || fallbackLabel;
}

function winnerSecondaryLabel(winner, prizeMeta) {
  const walletLabel = winnerWalletLabel(winner);
  const twitterUsername = cleanWinnerTwitterUsername(winner);
  if (walletLabel && twitterUsername) return `${walletLabel} · ${prizeMeta}`;
  return prizeMeta;
}

function winnerAvatarInitial(winner) {
  const source = cleanWinnerTwitterUsername(winner)
    || String(winner?.profile?.displayName || winner?.profile?.name || "").trim();
  if (source) return source.slice(0, 1).toUpperCase();
  return "";
}

function winnerRoundGroupLabel(roundId, round, t, roundLabel) {
  const labelKey = WINNER_ROUND_LABEL_KEYS[roundId];
  if (labelKey) {
    const label = t(labelKey);
    if (label !== labelKey) return label;
  }
  return round ? roundLabel(round, "label") : "";
}

function matchDisplayCode(match, fallbackMatchId = "") {
  return String(match?.displayCode || match?.id || fallbackMatchId || "").toUpperCase();
}

function normalizeHash(value) {
  const hash = String(value || "").trim();
  return /^0x[a-fA-F0-9]{64}$/.test(hash) ? hash : "";
}

function compactHash(value) {
  const hash = normalizeHash(value);
  return hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : "";
}

function bscScanBase(chainId) {
  return "https://bscscan.com";
}

function transactionHref(hash, chainId) {
  const txHash = normalizeHash(hash);
  return txHash ? `${bscScanBase(chainId)}/tx/${txHash}` : "";
}

function localApiEndpoint(path) { return path; }

function transactionStepLabel(step, t) {
  const key = `winnerReveal.onChainProofStep.${step || "transaction"}`;
  const label = t(key);
  return label === key ? step || t("winnerReveal.onChainProofStep.transaction") : label;
}

function rowTicketNumbers(draw) {
  const rows = Array.isArray(draw?.winners) && draw.winners.length
    ? draw.winners
    : (Array.isArray(draw?.prizeSlots) ? draw.prizeSlots.map((slot) => slot?.winner).filter(Boolean) : []);
  return rows.map((winner) => String(winner?.ticketNumber || "").trim()).filter(Boolean);
}

function buildProofMatchRows({ winnerRevealData, selectedRound, matches }) {
  const selectedRoundId = String(selectedRound?.id || "").trim();
  const matchById = new Map(matches.map((match) => [canonicalMatchId(match.id), match]));
  const proof = winnerRevealData?.proof || {};
  const matchTxById = new Map();

  (Array.isArray(proof.matchTransactions) ? proof.matchTransactions : []).forEach((tx) => {
    const matchId = canonicalMatchId(tx?.matchId);
    if (matchId && normalizeHash(tx?.hash || tx?.transactionHash)) matchTxById.set(matchId, tx);
  });

  (Array.isArray(proof.transactions) ? proof.transactions : []).forEach((tx) => {
    const hash = normalizeHash(tx?.hash || tx?.transactionHash);
    if (!hash || !Array.isArray(tx?.matchIds)) return;
    tx.matchIds.forEach((matchIdValue) => {
      const matchId = canonicalMatchId(matchIdValue);
      if (matchId && !matchTxById.has(matchId)) matchTxById.set(matchId, { ...tx, matchId, hash });
    });
  });

  return (Array.isArray(winnerRevealData?.draws) ? winnerRevealData.draws : [])
    .filter((draw) => {
      const drawRoundId = String(draw?.roundId || draw?.drawRoundId || "").trim();
      return !selectedRoundId || drawRoundId === selectedRoundId;
    })
    .map((draw) => {
      const matchId = canonicalMatchId(draw.matchId);
      const match = matchById.get(matchId) || null;
      const matchTx = matchTxById.get(matchId) || null;
      const transactionHash = normalizeHash(
        draw.transactionHash
          || draw.revealTransactionHash
          || matchTx?.hash
          || matchTx?.transactionHash,
      );
      return {
        matchId,
        label: matchDisplayCode(match, draw.matchId),
        ledgerHash: draw.ledgerHash || "",
        drawRoundId: draw.drawRoundId || draw.roundId || "",
        totalTickets: draw.totalTickets || "",
        prizeSlotCount: draw.prizeSlotCount || 0,
        ticketNumbers: rowTicketNumbers(draw),
        transactionHash,
        transactionStep: matchTx?.step || (transactionHash ? "revealRoundMatches" : ""),
      };
    });
}

function buildRoundProofSummary({ winnerRevealData, selectedRound, selectedActiveWinner, matches }) {
  const selectedRoundId = String(selectedRound?.id || "").trim();
  const proof = winnerRevealData?.proof || {};
  const matchRows = buildProofMatchRows({ winnerRevealData, selectedRound, matches });
  const drawRoundId = String(
    matchRows[0]?.drawRoundId
      || winnerRevealData?.drawRoundId
      || selectedRoundId
      || winnerRevealData?.roundId
      || "",
  ).trim();
  const proofDownloadUrl = String(proof.ledgerDownloadUrl || "").trim();
  const ledgerDownloadHref = proof.ledgerDownloadAvailable === true && /^[A-Za-z0-9_-]+$/.test(drawRoundId)
    ? localApiEndpoint(proofDownloadUrl || `/match-draw-ledgers/${encodeURIComponent(drawRoundId)}.json`)
    : "";
  const roundTransactions = (Array.isArray(proof.roundTransactions) && proof.roundTransactions.length
    ? proof.roundTransactions
    : (Array.isArray(proof.transactions) ? proof.transactions : []).filter((tx) => !Array.isArray(tx.matchIds) || tx.matchIds.length === 0))
    .filter((tx) => normalizeHash(tx?.hash || tx?.transactionHash));

  return {
    roundId: selectedRoundId,
    drawRoundId,
    ledgerHash: winnerRevealData?.ledgerHash || "",
    roundKey: winnerRevealData?.roundKey || "",
    chainId: winnerRevealData?.chainId || "",
    contract: winnerRevealData?.contract || "",
    ledgerDownloadHref,
    roundTransactions,
    matchRows,
    selectedWinner: selectedActiveWinner?.winner || null,
    selectedMatchLabel: selectedActiveWinner?.matchLabel || "",
  };
}

function buildWinnerRoundGroups(winners, rounds, matches, t, roundLabel) {
  const roundById = new Map(rounds.map((round) => [round.id, round]));
  const roundOrder = new Map(rounds.map((round, index) => [round.id, index]));
  const fallbackOrder = new Map(FALLBACK_ROUND_ORDER.map((roundId, index) => [roundId, index]));
  const matchById = new Map(matches.map((match) => [canonicalMatchId(match.id), match]));
  const groupsById = new Map();

  winners.forEach((winner, globalIndex) => {
    const roundId = winner.roundId || "unknown";
    const round = roundById.get(roundId) || null;
    const group = groupsById.get(roundId) || {
      id: roundId,
      label: winnerRoundGroupLabel(roundId, round, t, roundLabel),
      order: roundOrder.get(roundId) ?? fallbackOrder.get(roundId) ?? 999,
      winners: [],
    };
    const match = matchById.get(canonicalMatchId(winner.matchId)) || null;

    group.winners.push({
      winner,
      globalIndex,
      matchLabel: matchDisplayCode(match, winner.matchId),
      prizeImage: getMatchPrizeImageByMatchId(match?.id || winner.matchId, matches, roundId),
    });
    groupsById.set(roundId, group);
  });

  return Array.from(groupsById.values())
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((group) => ({
      ...group,
      winners: [...group.winners].sort((left, right) => left.globalIndex - right.globalIndex),
    }));
}

function buildWinnerRoundOptions(winnerRoundGroups, rounds, t, roundLabel) {
  const groupsById = new Map(winnerRoundGroups.map((group) => [group.id, group]));
  const roundById = new Map(rounds.map((round) => [round.id, round]));
  const sourceIds = rounds.length ? rounds.map((round) => round.id) : FALLBACK_ROUND_ORDER;
  const optionIds = sourceIds.filter((roundId) => FALLBACK_ROUND_ORDER.includes(roundId));

  return optionIds.map((roundId, index) => {
    const round = roundById.get(roundId) || null;
    const group = groupsById.get(roundId) || null;
    return {
      id: roundId,
      label: winnerRoundGroupLabel(roundId, round, t, roundLabel),
      count: group?.winners.length || 0,
      order: index,
      winners: group?.winners || [],
    };
  });
}

function WinnerRevealRow({ winner, index, visible, active, selected, matchLabel, prizeImage, currentUser, onSelect }) {
  const { t } = useCampaignCopy();
  const prizeSlot = t("winnerReveal.prizeSlot", { slot: formatNumber(winner.prizeSlotIndex + 1) });
  const prizeMeta = matchLabel
    ? t("winnerReveal.matchPrizeSlot", { match: matchLabel, slot: formatNumber(winner.prizeSlotIndex + 1) })
    : prizeSlot;
  const avatarUrl = String(winner.profile?.avatarUrl || winner.profile?.picture || "").trim();
  const twitterUsername = cleanWinnerTwitterUsername(winner);
  const hasProfileIdentity = Boolean(
    twitterUsername
    || avatarUrl
    || String(winner?.profile?.displayName || winner?.profile?.name || "").trim(),
  );
  const primaryLabel = winnerPrimaryLabel(winner, t("winnerReveal.walletPending"));
  const secondaryLabel = winnerSecondaryLabel(winner, prizeMeta);

  return (
    <li
      className={[
        "winner-reveal-row",
        visible ? "is-visible" : "",
        active ? "is-active" : "",
        currentUser ? "is-current-user" : "",
        twitterUsername ? "has-twitter-profile" : "is-wallet-only",
      ].filter(Boolean).join(" ")}
      style={{ "--winner-delay": `${Math.min(index, 5) * 40}ms`, "--winner-order": index }}
      role={visible ? "button" : undefined}
      tabIndex={visible ? 0 : undefined}
      aria-pressed={visible ? selected : undefined}
      onClick={visible ? onSelect : undefined}
      onKeyDown={visible ? (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect?.();
      } : undefined}
    >
      <span className="winner-reveal-row__rank">{String(index + 1).padStart(2, "0")}</span>
      <span className="winner-reveal-row__prize" aria-hidden="true">
        <img src={prizeImage} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="winner-reveal-row__identity">
        <span className={["winner-reveal-row__avatar", avatarUrl ? "has-image" : ""].filter(Boolean).join(" ")} aria-hidden="true">
          {hasProfileIdentity ? (
            <span>{winnerAvatarInitial(winner)}</span>
          ) : (
            <Ticket size={16} strokeWidth={2.25} />
          )}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
        </span>
        <span className="winner-reveal-row__main">
          <strong>{primaryLabel}</strong>
          <small>{secondaryLabel}</small>
        </span>
      </span>
      {currentUser ? (
        <span className="winner-reveal-row__self">
          <Sparkles size={14} strokeWidth={2.35} />
          {t("winnerReveal.currentUserBadge")}
        </span>
      ) : null}
      <span className="winner-reveal-row__ticket">
        <Ticket size={15} strokeWidth={2.25} />
        {t("winnerReveal.ticketNumber", { ticket: winner.ticketNumber })}
      </span>
    </li>
  );
}

function WinnerOnChainProof({ winnerRevealData, selectedRound, selectedActiveWinner, matches, open, onToggle }) {
  const { t } = useCampaignCopy();
  const proof = useMemo(
    () => buildRoundProofSummary({ winnerRevealData, selectedRound, selectedActiveWinner, matches }),
    [matches, selectedActiveWinner, selectedRound, winnerRevealData],
  );
  const selectedTicketNumber = String(proof.selectedWinner?.ticketNumber || "").trim();
  const hasMatchRows = proof.matchRows.length > 0;

  if (!hasMatchRows) return null;

  return (
    <section className={open ? "winner-proof is-open" : "winner-proof"} aria-label={t("winnerReveal.onChainProofAria")}>
      <button
        type="button"
        className="winner-proof__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <ShieldCheck size={15} strokeWidth={2.3} />
        <span>{t("winnerReveal.onChainProofButton")}</span>
        {proof.ledgerHash ? <code>{compactHash(proof.ledgerHash)}</code> : null}
        <ChevronDown size={15} strokeWidth={2.3} aria-hidden="true" />
      </button>

      {open ? (
        <div className="winner-proof__panel">
          <header className="winner-proof__head">
            <strong>{t("winnerReveal.onChainProofTitle", { round: selectedRound?.label || "" })}</strong>
            <p>{t("winnerReveal.onChainProofBody")}</p>
          </header>

          <div className="winner-proof__summary">
            <span>
              <em>{t("winnerReveal.onChainProofLedgerHash")}</em>
              <code>{proof.ledgerHash || "-"}</code>
            </span>
            <span>
              <em>{t("winnerReveal.onChainProofRoundKey")}</em>
              <code>{proof.roundKey || "-"}</code>
            </span>
            {proof.ledgerDownloadHref ? (
              <a href={proof.ledgerDownloadHref} download>
                <Download size={14} strokeWidth={2.3} />
                {t("winnerReveal.onChainProofDownloadLedger")}
              </a>
            ) : null}
          </div>

          <p className="winner-proof__explain">
            {selectedTicketNumber
              ? t("winnerReveal.onChainProofTicketExample", {
                ticket: selectedTicketNumber,
                match: proof.selectedMatchLabel || proof.selectedWinner?.matchId || "",
              })
              : t("winnerReveal.onChainProofTicketBody")}
          </p>

          {proof.roundTransactions.length > 0 ? (
            <section className="winner-proof__tx-group" aria-label={t("winnerReveal.onChainProofRoundTxAria")}>
              <span>{t("winnerReveal.onChainProofRoundTxTitle")}</span>
              <div>
                {proof.roundTransactions.map((tx) => {
                  const href = transactionHref(tx.hash || tx.transactionHash, proof.chainId);
                  return (
                    <a href={href} target="_blank" rel="noreferrer" key={tx.id || tx.hash}>
                      {transactionStepLabel(tx.step, t)}
                      <code>{compactHash(tx.hash || tx.transactionHash)}</code>
                      <ExternalLink size={13} strokeWidth={2.3} />
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="winner-proof__matches" aria-label={t("winnerReveal.onChainProofMatchTxAria")}>
            <span>{t("winnerReveal.onChainProofMatchTxTitle")}</span>
            <div className="winner-proof__match-list">
              {proof.matchRows.map((row) => {
                const href = transactionHref(row.transactionHash, proof.chainId);
                return (
                  <article className="winner-proof__match-row" key={row.matchId}>
                    <span>
                      <strong>{row.label}</strong>
                      <em>{t("winnerReveal.onChainProofTickets", { tickets: row.ticketNumbers.map((ticket) => `#${ticket}`).join(", ") || "-" })}</em>
                    </span>
                    <span className="winner-proof__match-hash">
                      <em>{t("winnerReveal.onChainProofMatchLedgerHash")}</em>
                      <code>{compactHash(row.ledgerHash) || "-"}</code>
                    </span>
                    {href ? (
                      <a className="winner-proof__match-tx" href={href} target="_blank" rel="noreferrer">
                        <em>{t("winnerReveal.onChainProofRevealTx")}</em>
                        <span>
                          <code>{compactHash(row.transactionHash)}</code>
                          <ExternalLink size={13} strokeWidth={2.3} />
                        </span>
                      </a>
                    ) : (
                      <small>{t("winnerReveal.onChainProofTxUnavailable")}</small>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}


export { buildWinnerRoundGroups, buildWinnerRoundOptions, WinnerRevealRow, WinnerOnChainProof };
