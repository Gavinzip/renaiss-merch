import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Fingerprint, Menu, Search, ShieldCheck } from 'lucide-react';
import { publicProofMediaAsset } from 'virtual:public-proof-assets';
import { useLocale, type AppLocale } from '../../i18n/LocaleContext';
import { HubNavigation } from '../RenaissHub/HubNavigation';
import { HubNavigationProvider } from '../RenaissHub/HubNavigationState';
import type { LoadedProof, ProofOverview, ResolvedProofRecord } from '../../../shared/public-proof/types';
import { DrawResultSummary } from './DrawResultSummary';
import { FairProofSequence } from './fair/FairProofSequence';
import { MatchCommitmentPanel } from './MatchCommitmentPanel';
import { ProofLookupError, proofLocation } from './proofClient';
import { loadResolvedRecord, proofDownloadPath, resolveProofRecord, worldsEvent } from './recordClient';
import { proofCopy } from './proofCopy';
import { fairCopy } from './fairCopy';
import { entryCopy } from './entryCopy';
import { useProofVerification } from './useProofVerification';
import { usePublicValueCopy } from './usePublicValueCopy';
import './golden.css';

export default function PublicVerification() {
  return <HubNavigationProvider busy={false}><PublicProofPage /></HubNavigationProvider>;
}
function PublicProofPage() {
  const {locale,setLocale}=useLocale(),copy=proofCopy[locale],entry=entryCopy[locale],t=fairCopy(locale);
  const initial=useMemo(()=>{
    try{return {target:proofLocation(window.location.search),invalid:false};}
    catch{return {target:null,invalid:true};}
  },[]);
  const [target,setTarget]=useState(initial.target),[revision,setRevision]=useState(0);
  const [submitted,setSubmitted]=useState(false);
  const [hash,setHash]=useState(initial.target?.tx??'');
  const [proof,setProof]=useState<LoadedProof|null>(null),[overview,setOverview]=useState<ProofOverview|null>(null);
  const [resolved,setResolved]=useState<ResolvedProofRecord|null>(null),[loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(initial.invalid?'invalid_link':null),[errorCode,setErrorCode]=useState<string|null>(null);
  const {copied,copyError,copy:copyRecordLink}=usePublicValueCopy(locale);
  const roster=resolved?.record.kind==='roster'?resolved.record:null;
  const visibleError=errorCode?entry.errors[errorCode as keyof typeof entry.errors]??entry.errors.proof_lookup_unavailable:error==='invalid_link'?t("Invalid verification link."):error;
  useEffect(()=>{document.title=`${copy.title} · Renaiss Fair`;},[copy.title]);
  useEffect(()=>{
    if(!target)return;
    setProof(null);setOverview(null);setResolved(null);setError(null);setErrorCode(null);
    if(!target.tx&&!target.bundleHash&&!target.match){
      // Event/stage-only links open the neutral entry, never the latest proof.
      const url=new URL(window.location.href);
      url.searchParams.delete('event');url.searchParams.delete('stage');
      window.history.replaceState(null,'',url);setLoading(false);return;
    }
    const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]);
    setLoading(true);
    void(async()=>{
      try{
        const result:ResolvedProofRecord=target.match?
          {event:worldsEvent,record:{kind:'roster',match:target.match,stage:target.stage!,snapshotHash:target.snapshotHash!}}:
          await resolveProofRecord(target,signal);
        const loaded=await loadResolvedRecord(result,signal);
        if(controller.signal.aborted)return;
        setResolved(result);setOverview(loaded.overview);setProof(loaded.proof);
        if(result.record.kind==='draw'){
          const url=new URL(window.location.href);
          for(const key of ['event','stage','match','snapshotHash'])url.searchParams.delete(key);
          url.searchParams.set('tx',result.record.transaction??result.record.tx);
          url.searchParams.set('bundleHash',result.record.bundleHash);
          window.history.replaceState(null,'',url);
        }
      }catch(cause){if(!controller.signal.aborted){
        if(cause instanceof ProofLookupError)setErrorCode(cause.code);
        else setErrorCode('proof_lookup_unavailable');
      }}finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[target,revision]);
  const go=useCallback((hash:string)=>window.location.assign('/'+hash),[]);
  const authority=overview?.authority;
  const lookupForm = (
    <form className="vf-search-form" onSubmit={event=>{
      event.preventDefault();if(loading)return;
      const value=hash.trim();
      if(!/^0x[0-9a-f]{64}$/i.test(value)){setProof(null);setOverview(null);setResolved(null);setErrorCode(null);setError(entry.invalid);return;}
      const url=new URL('/verify',window.location.origin);
      url.searchParams.set('lang',locale);url.searchParams.set('tx',value);
      window.history.replaceState(null,'',url);
      setSubmitted(true);setTarget(proofLocation(url.search));setRevision(v=>v+1);
      window.scrollTo(0,0);
    }}>
      <label className="vf-sr-only" htmlFor="vf-transaction">{entry.label}</label><Search size={20} aria-hidden="true"/>
      <input id="vf-transaction" value={hash} onChange={event=>setHash(event.target.value)} placeholder={entry.placeholder} spellCheck={false} autoComplete="off"/>
      <button type="submit" disabled={loading}>{loading?entry.checking:entry.verify}<ArrowRight size={17} aria-hidden="true"/></button>
    </form>
  );
  return <div className="fair-proof"><div className="vf-page">
    <header className="vf-header">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <HubNavigation drawerOnly locale={locale} setLocale={setLocale} current="verify" preparing={false} disabled={false}
          onGoHome={()=>go('#portal-top')} onOpenCampaign={()=>go('#campaign/surf')} onOpenArchive={()=>go('#events')}
          onOpenBinder={()=>go('#binder')} onEnterMerch={()=>go('#store')}/>
        <a className="vf-brand" href="/" aria-label={t("Renaiss Community")}><img src={publicProofMediaAsset('fair-die.webp')} alt=""/><span><img src={publicProofMediaAsset('fair-logo.svg')} alt="renaiss fair"/><small>{t("PUBLIC VERIFIER")}</small></span></a>
      </div>
      <nav className="vf-nav" aria-label={copy.title}><a className="is-current" href="#verify">{t("Verify a draw")}</a><a href="#commitment">{t("The record")}</a><a href="#method">{t("How it works")}</a></nav>
      <details className="vf-mobile-menu"><summary aria-label={t("Open verification navigation")}><Menu size={20} aria-hidden="true"/></summary><nav aria-label={t("Mobile verification navigation")}><a href="#verify">{t("Verify a draw")}</a><a href="#commitment">{t("The record")}</a><a href="#method">{t("How it works")}</a></nav></details>
      <a className="vf-back" href="/">{t("Renaiss Community")}<ArrowRight size={16} aria-hidden="true"/></a>
    </header>
    <main className="vf-main">
      {!resolved ? <section className="vf-hero" id="verify" aria-labelledby="vf-title">
        <div className="vf-kicker"><span className="vf-live-dot"/>RENAISS FAIR · {t("PUBLIC VERIFICATION")}</div>
        <h1 id="vf-title">{t("Every draw.")}<br/><em>{t("Open to verify.")}</em></h1>
        <p>{entry.description}</p>
        {lookupForm}
        <div className="vf-search-caption"><span>{t("NO LOGIN REQUIRED")}</span><span>{entry.caption}</span></div>
        {visibleError?<p className="vf-error" role="alert">{visibleError}</p>:null}
        {!loading&&!visibleError?<p className="vf-entry-hint">{entry.hint}</p>:null}
      </section>:null}
      {loading?<p role="status">{entry.checking}</p>:null}
      {proof && resolved?.record.kind==='draw' ?
        <ResolvedDraw key={proof.bundleHash} proof={proof} eventName={resolved.event.name} locale={locale}
          transaction={resolved.record.transaction ?? resolved.record.tx} copied={copied} copyError={copyError}
          onCopy={()=>void copyRecordLink(window.location.href)} lookupForm={lookupForm} submitted={submitted}/> : null}
      {roster&&resolved?<section className="vf-result-lookup" id="verify" aria-label={entry.label}>{lookupForm}</section>:null}
      {roster&&resolved?<div className="proof-round-tools"><p>{resolved.event.name} · {entry.roster}</p><button type="button" onClick={()=>void copyRecordLink(window.location.href)}>{copied?copy.copied:copy.copy}</button></div>:null}
      {!proof&&copyError?<p className="vf-error" role="alert">{copyError}</p>:null}
      {roster&&overview?<MatchCommitmentPanel key={roster.snapshotHash+roster.transaction} matchId={roster.match} snapshotHash={roster.snapshotHash} expectedTransaction={roster.transaction} overview={overview} locale={locale}/>:null}
      {roster&&resolved?<section className="vf-overview" aria-label={t("Resolved record")}>
        <div><span>{entry.event}</span><strong>{resolved.event.name}</strong></div>
        <div><span>{entry.record}</span><strong>{roster.match.toUpperCase()}</strong></div>
        <div><span>{entry.network}</span><strong>{authority?.configured?t(authority.chainId===97?"BSC TESTNET":"BSC MAINNET"):'—'}</strong></div>
      </section>:null}
      <section className="vf-bottom-grid" aria-label={t("Verification details")}>
        <div className="vf-info-card" id="commitment"><div className="vf-section-top"><span>{t("01 / THE RECORD")}</span><Fingerprint size={20} aria-hidden="true"/></div>
          <h2>{t("Fixed before the request.")}</h2><p>{entry.source}</p>
          {proof?<div className="vf-links"><a href={proofDownloadPath(proof)}>{copy.download}</a></div>:null}
        </div>
        <div className="vf-info-card" id="method"><div className="vf-section-top"><span>{t("02 / THE PROOF")}</span><ShieldCheck size={20} aria-hidden="true"/></div>
          <h2>{t("Check each step.")}</h2><ol>{(proof?copy.steps.map(([title])=>title):entry.steps).map(title=><li key={title}>{title}</li>)}</ol>
          <p className="vf-disclaimer">{proof?copy.boundary:entry.method}</p>
        </div>
      </section>
    </main>
    <footer className="vf-footer"><span><img src={publicProofMediaAsset('fair-die.webp')} alt=""/>RENAISS FAIR · {t("PUBLIC VERIFICATION")}</span><span>{t("Committed records · Public proofs · Independent checks")}</span></footer>
  </div></div>;
}

function ResolvedDraw({proof,eventName,locale,transaction,copied,copyError,onCopy,lookupForm,submitted}: {
  proof: LoadedProof; eventName: string; locale: AppLocale; transaction: string; copied: boolean;
  copyError: string | null; onCopy: () => void; lookupForm: ReactNode; submitted: boolean;
}) {
  const verification = useProofVerification(proof);
  const search = <section className="vf-result-lookup" data-submitted={submitted} id="verify"
    aria-label={entryCopy[locale].label}>{lookupForm}</section>;
  return <>
    {submitted && search}
    <DrawResultSummary transaction={transaction} proof={proof} eventName={eventName} locale={locale} completed={verification.checks.length}
      error={verification.error} copied={copied} copyError={copyError} onCopy={onCopy}/>
    {!submitted && search}
    <FairProofSequence proof={proof} eventName={eventName} {...verification} locale={locale}/>
  </>;
}
