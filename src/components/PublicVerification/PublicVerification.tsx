import { useCallback, useEffect, useMemo, useState } from 'react';
import { FairProofSequence } from './fair/FairProofSequence';
import { proofLocation, readProofOverview, readRoundProof, readProofByIdentity } from './proofClient';
import { useProofVerification } from './useProofVerification';
import { proofCopy } from './proofCopy';
import { usePublicValueCopy } from './usePublicValueCopy';
import { useLocale } from '../../i18n/LocaleContext';
import { HubNavigation } from '../RenaissHub/HubNavigation';
import { HubNavigationProvider } from '../RenaissHub/HubNavigationState';
import { ArrowRight, Fingerprint, Menu, Search, ShieldCheck } from 'lucide-react';
import { publicProofMediaAsset } from 'virtual:public-proof-assets';
import type { LoadedProof, ProofOverview, ProofStage } from '../../../shared/public-proof/types';
import './golden.css';

export default function PublicVerification() {
  return <HubNavigationProvider busy={false}><PublicProofPage /></HubNavigationProvider>;
}
function PublicProofPage() {
  const { locale, setLocale } = useLocale();
  const copy = proofCopy[locale];
  // Display-only context supplied by the isolated local QA launcher. It never
  // grants chain authority or bypasses any verification check.
  const qaContext = document.documentElement.dataset.proofContext === 'mainnet-rehearsal';
  const location = useMemo(() => { try { return { target: proofLocation(window.location.search), error: null }; }
    catch (error) { return { target: null, error: error instanceof Error ? error.message : 'Invalid verification link.' }; } }, []);
  const [proof, setProof] = useState<LoadedProof | null>(null);
  const [overview, setOverview] = useState<ProofOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(location.error);
  const [lookup, setLookup] = useState<{tx: string; bundleHash: string; stage?: ProofStage; revision: number}>({
    tx: location.target?.tx ?? '', bundleHash: location.target?.bundleHash ?? '', stage: location.target?.stage, revision: 0 });
  const { copied, copyError, copy: copyRecordLink } = usePublicValueCopy();
  const [hash,setHash]=useState(location.target?.tx??'');
  const verification = useProofVerification(proof);
  const target = location.target;
  const mainnetRehearsal = qaContext || proof?.authority.context === 'rehearsal';
  const viewStage = proof?.bundle.manifest.stage ?? target?.stage;
  useEffect(() => { document.title = `${copy.title} · Renaiss Fair`; },[copy.title]);
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    setLoading(true); setError(null); setProof(null);
    void (async () => {
      try {
        const current = await readProofOverview(signal);
        const loaded = lookup.tx || lookup.bundleHash
          ? await readProofByIdentity(current, lookup.bundleHash, lookup.tx, signal, lookup.stage)
          : await readRoundProof(current, proofLocation(window.location.search).stage, '', '', signal);
        if (controller.signal.aborted) return;
        setOverview(current); setProof(loaded);
        const url = new URL(window.location.href);
        if (lookup.tx) url.searchParams.set('tx', lookup.tx); else url.searchParams.delete('tx');
        if (loaded) {
          url.searchParams.set('stage', loaded.bundle.manifest.stage);
          url.searchParams.set('tx', loaded.bundle.chain.requestTx);
          url.searchParams.set('bundleHash', loaded.bundleHash);
        }
        window.history.replaceState(null, '', url);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '公開 proof 讀取失敗。'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [target, lookup]);
  const go = useCallback((hash: string) => window.location.assign('/' + hash), []);
  const link = (updates: Record<string, string>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(updates)) url.searchParams.set(key, value);
    if (updates.stage) { url.searchParams.delete('tx'); url.searchParams.delete('bundleHash'); url.hash = ''; }
    return url.pathname + url.search;
  };
  const displayProps = { ...verification, locale };
  return <div className="fair-proof"><div className="vf-page">
    <header className="vf-header">
      <div style={{display:'flex',alignItems:'center',gap:12}}><HubNavigation drawerOnly locale={locale} setLocale={setLocale} current="verify" preparing={false} disabled={false}
        onGoHome={() => go('#portal-top')} onOpenCampaign={() => go('#campaign/surf')} onOpenArchive={() => go('#events')}
        onOpenBinder={() => go('#binder')} onEnterMerch={() => go('#store')} />
        <a className="vf-brand" href="/" aria-label="Renaiss Community"><img src={publicProofMediaAsset('fair-die.webp')} alt=""/><span><img src={publicProofMediaAsset('fair-logo.svg')} alt="renaiss fair"/><small>WORLDS 2026 · PUBLIC VERIFIER</small></span></a>
      </div>
      <nav className="vf-nav" aria-label={copy.title}><a className="is-current" href="#verify">Verify a draw</a><a href="#commitment">The round</a><a href="#method">How it works</a></nav>
      <details className="vf-mobile-menu"><summary aria-label="Open verification navigation"><Menu size={20} aria-hidden="true" /></summary><nav aria-label="Mobile verification navigation"><a href="#verify">Verify a draw</a><a href="#commitment">The round</a><a href="#method">How it works</a></nav></details>
      <a className="vf-back" href="/">Renaiss Community<ArrowRight size={16} aria-hidden="true"/></a>
    </header>
    <main className="vf-main">
      <section className="vf-hero" id="verify" aria-labelledby="vf-title">
        <div className="vf-kicker"><span className="vf-live-dot"/> {mainnetRehearsal ? 'MAINNET REHEARSAL' : 'WORLDS 2026 · PUBLIC DRAW VERIFIER'}</div>
        <h1 id="vf-title">Every draw.<br/><em>Open to verify.</em></h1>
        <p>A committed round. A public proof. Replay the exact Worlds ticket math and independently check its chain commitment, winner and ordered reserves.</p>
        <form className="vf-search-form" onSubmit={event=>{event.preventDefault(); if(loading)return;
          if(hash.trim()&&!/^0x[0-9a-f]{64}$/i.test(hash.trim())){setProof(null);setError('Enter a complete 0x transaction hash (64 hexadecimal characters).');return;}
          const nextUrl=new URL(window.location.href);
          nextUrl.searchParams.delete('bundleHash');
          if(hash.trim())nextUrl.searchParams.set('tx',hash.trim());else nextUrl.searchParams.delete('tx');
          window.history.replaceState(null,'',nextUrl);
          setLookup(old=>({tx:hash.trim(),bundleHash:'',stage:undefined,revision:old.revision+1}));}}>
          <label className="vf-sr-only" htmlFor="vf-transaction">BSC request transaction hash (optional)</label><Search size={20} aria-hidden="true"/>
          <input id="vf-transaction" value={hash} onChange={event=>setHash(event.target.value)} placeholder="Request transaction hash (0x...) · optional" spellCheck={false} autoComplete="off"/>
          <button type="submit" disabled={loading}>{loading?'Checking…':'Verify'}<ArrowRight size={17} aria-hidden="true"/></button>
        </form>
        <div className="vf-search-caption"><span>{mainnetRehearsal ? 'QA ROSTER / NO REAL PRIZES' : 'NO LOGIN REQUIRED'}</span><span className={overview?.authority.configured?'vf-status is-ready':'vf-status'}><span className="vf-live-dot"/>{overview?.authority.configured?'Approved event authority':error?'Status unavailable':'Awaiting approved commitment'}</span></div>
        {error?<p className="vf-error" role="alert">{error}</p>:null}
      </section>
      {target?<div className="proof-round-tools"><label>{copy.stage} <select aria-label={copy.stage} value={viewStage} onChange={event=>window.location.assign(link({stage:event.target.value}))}>
        {(['quarter','semi','final'] as const).map(stage=><option key={stage} value={stage}>{copy[stage]}</option>)}</select></label>
        <button type="button" onClick={()=>void copyRecordLink(window.location.href)}>{copied?copy.copied:copy.copy}</button>
      </div>:null}
      {copyError ? <p className="vf-error" role="alert">{copyError}</p> : null}
      {loading?<p role="status">{copy.loading}</p>:null}
      {!loading&&!proof&&!error?<section className="proof-waiting" id="proof-waiting" role="status"><p>{copy.waiting}</p>
        {overview?.authority.reason?<p>{overview.authority.reason}</p>:null}
        <button className="vf-step-action" type="button" onClick={()=>setLookup(old=>({...old,revision:old.revision+1}))}>{copy.refresh}</button>
      </section>:null}
      {target && proof ? <FairProofSequence key={proof.bundleHash} proof={proof} {...displayProps} /> : null}
      <section className="vf-overview" aria-label="Current round summary">
        <div><span>PUBLISHED TICKETS</span><strong>{proof?.bundle.commitment.ticketCount ?? '—'}</strong></div>
        <div><span>EVENT STAGES</span><strong>{overview?.rounds.length ?? '—'}</strong></div>
        <div><span>APPROVED NETWORK</span><strong>{overview?.authority.configured ? `BSC ${overview.authority.chainId === 97 ? 'TESTNET' : 'MAINNET'}` : 'PENDING'}</strong></div>
      </section>
      <section className="vf-bottom-grid" aria-label="Verification details">
        <div className="vf-info-card" id="commitment"><div className="vf-section-top"><span>01 / THE ROUND</span><Fingerprint size={20} aria-hidden="true" /></div>
          <h2>Fixed before the request.</h2><p>The ticket roster, prize plan and ECVRF key must be committed on the approved chain before the entropy-producing request block.</p>
          <div className="vf-links">{overview?.rounds.map(round => <a key={round.stage} href={link({stage:round.stage})}>{round.name} · {round.status}</a>)}</div>
          {proof ? <div className="vf-links"><a href={`/api/public-proofs/worlds-2026/${proof.bundle.manifest.stage}/bundle?download=1&bundleHash=${proof.bundleHash}&tx=${proof.bundle.chain.requestTx}`}>{copy.download}</a></div> : null}
        </div>
        <div className="vf-info-card" id="method"><div className="vf-section-top"><span>02 / THE PROOF</span><ShieldCheck size={20} aria-hidden="true" /></div>
          <h2>Check each step.</h2><ol>{copy.steps.map(([title]) => <li key={title}>{title}</li>)}</ol>
          <p className="vf-disclaimer">{copy.boundary} Worlds retains SHA-512 rejection sampling, forward Fisher–Yates, and one winner plus two ordered reserves per match.</p>
        </div>
      </section>
    </main>
    <footer className="vf-footer"><span><img src={publicProofMediaAsset('fair-die.webp')} alt="" />WORLDS 2026 · PUBLIC VERIFICATION</span><span>Committed tickets · Public proof · Ordered reserves</span></footer>
  </div></div>;
}
