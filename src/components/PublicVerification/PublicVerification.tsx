import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Fingerprint, Menu, Search, ShieldCheck } from 'lucide-react';
import { publicProofMediaAsset } from 'virtual:public-proof-assets';
import { useLocale } from '../../i18n/LocaleContext';
import { HubNavigation } from '../RenaissHub/HubNavigation';
import { HubNavigationProvider } from '../RenaissHub/HubNavigationState';
import type { LoadedProof, ProofOverview, ResolvedProofRecord } from '../../../shared/public-proof/types';
import { FairProofSequence } from './fair/FairProofSequence';
import { MatchCommitmentPanel } from './MatchCommitmentPanel';
import { proofLocation } from './proofClient';
import { loadResolvedRecord, proofDownloadPath, ProofLookupError, resolveProofRecord, worldsEvent } from './recordClient';
import { proofCopy } from './proofCopy';
import { entryCopy } from './entryCopy';
import { useProofVerification } from './useProofVerification';
import { usePublicValueCopy } from './usePublicValueCopy';
import './golden.css';

export default function PublicVerification() {
  return <HubNavigationProvider busy={false}><PublicProofPage /></HubNavigationProvider>;
}
function PublicProofPage() {
  const {locale,setLocale}=useLocale(),copy=proofCopy[locale],entry=entryCopy[locale];
  const initial=useMemo(()=>{
    try{return {target:proofLocation(window.location.search),error:null};}
    catch(error){return {target:null,error:error instanceof Error?error.message:'Invalid verification link.'};}
  },[]);
  const [target,setTarget]=useState(initial.target),[revision,setRevision]=useState(0);
  const [hash,setHash]=useState(initial.target?.tx??'');
  const [proof,setProof]=useState<LoadedProof|null>(null),[overview,setOverview]=useState<ProofOverview|null>(null);
  const [resolved,setResolved]=useState<ResolvedProofRecord|null>(null),[loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(initial.error),[errorCode,setErrorCode]=useState<string|null>(null);
  const {copied,copyError,copy:copyRecordLink}=usePublicValueCopy();
  const verification=useProofVerification(proof);
  const roster=resolved?.record.kind==='roster'?resolved.record:null;
  const rehearsal=proof?.authority.context==='rehearsal';
  const visibleError=errorCode?entry.errors[errorCode as keyof typeof entry.errors]??entry.errors.proof_lookup_unavailable:error;
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
        else setError(cause instanceof Error?cause.message:'Public proof unavailable.');
      }}finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[target,revision]);
  const go=useCallback((hash:string)=>window.location.assign('/'+hash),[]);
  const authority=proof?.authority??overview?.authority;
  return <div className="fair-proof"><div className="vf-page">
    <header className="vf-header">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <HubNavigation drawerOnly locale={locale} setLocale={setLocale} current="verify" preparing={false} disabled={false}
          onGoHome={()=>go('#portal-top')} onOpenCampaign={()=>go('#campaign/surf')} onOpenArchive={()=>go('#events')}
          onOpenBinder={()=>go('#binder')} onEnterMerch={()=>go('#store')}/>
        <a className="vf-brand" href="/" aria-label="Renaiss Community"><img src={publicProofMediaAsset('fair-die.webp')} alt=""/><span><img src={publicProofMediaAsset('fair-logo.svg')} alt="renaiss fair"/><small>PUBLIC VERIFIER</small></span></a>
      </div>
      <nav className="vf-nav" aria-label={copy.title}><a className="is-current" href="#verify">Verify a draw</a><a href="#commitment">The record</a><a href="#method">How it works</a></nav>
      <details className="vf-mobile-menu"><summary aria-label="Open verification navigation"><Menu size={20} aria-hidden="true"/></summary><nav aria-label="Mobile verification navigation"><a href="#verify">Verify a draw</a><a href="#commitment">The record</a><a href="#method">How it works</a></nav></details>
      <a className="vf-back" href="/">Renaiss Community<ArrowRight size={16} aria-hidden="true"/></a>
    </header>
    <main className="vf-main">
      <section className="vf-hero" id="verify" aria-labelledby="vf-title">
        <div className="vf-kicker"><span className="vf-live-dot"/>{rehearsal?'REHEARSAL · NO REAL PRIZES':'RENAISS FAIR · PUBLIC VERIFICATION'}</div>
        <h1 id="vf-title">Every draw.<br/><em>Open to verify.</em></h1>
        <p>{entry.description}</p>
        <form className="vf-search-form" onSubmit={event=>{
          event.preventDefault();if(loading)return;
          const value=hash.trim();
          if(!/^0x[0-9a-f]{64}$/i.test(value)){setProof(null);setOverview(null);setResolved(null);setErrorCode(null);setError(entry.invalid);return;}
          const url=new URL('/verify',window.location.origin);
          url.searchParams.set('lang',locale);url.searchParams.set('tx',value);
          window.history.replaceState(null,'',url);
          setTarget(proofLocation(url.search));setRevision(v=>v+1);
        }}>
          <label className="vf-sr-only" htmlFor="vf-transaction">{entry.label}</label><Search size={20} aria-hidden="true"/>
          <input id="vf-transaction" value={hash} onChange={event=>setHash(event.target.value)} placeholder={entry.placeholder} spellCheck={false} autoComplete="off"/>
          <button type="submit" disabled={loading}>{loading?entry.checking:entry.verify}<ArrowRight size={17} aria-hidden="true"/></button>
        </form>
        <div className="vf-search-caption"><span>{rehearsal?'TEST RECORD / NO REAL PRIZES':'NO LOGIN REQUIRED'}</span><span>{entry.caption}</span></div>
        {visibleError?<p className="vf-error" role="alert">{visibleError}</p>:null}
        {!resolved&&!loading&&!visibleError?<p className="vf-entry-hint">{entry.hint}</p>:null}
      </section>
      {loading?<p role="status">{entry.checking}</p>:null}
      {resolved?<div className="proof-round-tools"><p>{resolved.event.name} · {roster?entry.roster:entry.draw}</p><button type="button" onClick={()=>void copyRecordLink(window.location.href)}>{copied?copy.copied:copy.copy}</button></div>:null}
      {copyError?<p className="vf-error" role="alert">{copyError}</p>:null}
      {roster&&overview?<MatchCommitmentPanel key={roster.snapshotHash+roster.transaction} matchId={roster.match} snapshotHash={roster.snapshotHash} expectedTransaction={roster.transaction} overview={overview} locale={locale}/>:null}
      {proof?<FairProofSequence key={proof.bundleHash} proof={proof} {...verification} locale={locale}/>:null}
      {resolved?<section className="vf-overview" aria-label="Resolved record">
        <div><span>{entry.event}</span><strong>{resolved.event.name}</strong></div>
        <div><span>{entry.record}</span><strong>{roster?roster.match.toUpperCase():proof?.bundle.commitment.ticketCount??'—'}</strong></div>
        <div><span>{entry.network}</span><strong>{authority?.configured?`BSC ${authority.chainId===97?'TESTNET':'MAINNET'}`:'—'}</strong></div>
      </section>:null}
      <section className="vf-bottom-grid" aria-label="Verification details">
        <div className="vf-info-card" id="commitment"><div className="vf-section-top"><span>01 / THE RECORD</span><Fingerprint size={20} aria-hidden="true"/></div>
          <h2>Fixed before the request.</h2><p>{entry.source}</p>
          {proof?<div className="vf-links"><a href={proofDownloadPath(proof)}>{copy.download}</a></div>:null}
        </div>
        <div className="vf-info-card" id="method"><div className="vf-section-top"><span>02 / THE PROOF</span><ShieldCheck size={20} aria-hidden="true"/></div>
          <h2>Check each step.</h2><ol>{(proof?copy.steps.map(([title])=>title):entry.steps).map(title=><li key={title}>{title}</li>)}</ol>
          <p className="vf-disclaimer">{proof?copy.boundary:entry.method}</p>
        </div>
      </section>
    </main>
    <footer className="vf-footer"><span><img src={publicProofMediaAsset('fair-die.webp')} alt=""/>RENAISS FAIR · PUBLIC VERIFICATION</span><span>Committed records · Public proofs · Independent checks</span></footer>
  </div></div>;
}
