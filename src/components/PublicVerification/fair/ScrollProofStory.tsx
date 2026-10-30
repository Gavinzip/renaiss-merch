import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, ExternalLink, LockKeyhole } from "lucide-react";
import { ProofScene, type ProofStoryData } from "./ProofScenes";
import "./scroll-proof-story.css";

const chapters = [
 {title:'On-chain facts',eyebrow:'01 / THE RECORD',headline:'What did BSC actually record?',body:'The ticket roster, prize plan and key were committed before the finalized round request. The browser checks both receipts and the approved contract.',source:'ON BSC · COMMITMENT + ROUND REQUEST'},
 {title:'VRF input α',eyebrow:'02 / THE INPUT',headline:'One round. One seed.',body:'The Worlds ABI recipe binds the protocol, chain, contract, round, root, manifest, prizes, ticket count, key and finalized request block.',source:'RECOMPUTED IN THIS BROWSER'},
 {title:'ECVRF proof π',eyebrow:'03 / THE RANDOMNESS',headline:'Verify the random output.',body:'The published witness must validate against the key committed before the request. A valid proof yields one β, checked in your browser.',source:'RFC 9381 · RECOMPUTED HERE'},
 {title:'Ticket selection',eyebrow:'04 / WITHOUT REPLACEMENT',headline:'Replay the ordered tickets.',body:'SHA-512, rejection sampling and forward Fisher–Yates select one winner and two ordered reserves for every match. Different tickets of one person remain eligible.',source:'BROWSER REPLAY · ORIGINAL WORLDS RULES'},
 {title:'Winners + reserves',eyebrow:'05 / THE PUBLISHED OUTCOME',headline:'Match the published tickets.',body:'Compare every published winner and ordered reserve with browser-derived ticket selection. A reserve replaces a winner; it is not an extra prize.',source:'PUBLISHED RECORD · INDEPENDENTLY COMPARED'},
 {title:'Merkle inclusion',eyebrow:'06 / THE COMMITMENT',headline:'Do the tickets belong to the roster?',body:'The six-word ticket leaves and all selected paths must fold to the same Merkle root that was fixed on chain before the request.',source:'BROWSER CHECK · AGAINST ON-CHAIN ROOT'},
] as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
type EvidenceLink = { label: string; href: string };

function chapterLinks(data:ProofStoryData,chapter:number):EvidenceLink[]{
 const value=data.verification,explorer=value.chainId===97?'https://testnet.bscscan.com':'https://bscscan.com';
 const raw={label:'Published proof JSON',href:`/api/public-proofs/worlds-2026/${value.stage}/bundle?download=1&bundleHash=${value.bundleHash}`};
 if(chapter===1)return [{label:'Published request transaction',href:`${explorer}/tx/${value.transactionHash}`},{label:'Commitment transaction',href:`${explorer}/tx/${value.commitmentTransactionHash}`}];
 if(chapter===2)return [{label:'Finalized request block',href:`${explorer}/block/${value.witness.blockNumber}`}];
 return [raw];
}

function Chapter({ data, chapter, progress, setRef }: {
  data: ProofStoryData; chapter: number; progress: number; setRef: (node: HTMLElement | null) => void;
}) {
  const copy = chapters[chapter - 1]!;
  const locked = data.sealed && (chapter === 4 || chapter === 5);
  const checked = data.completed >= chapter && !locked;
  const status = locked && chapter === 5 ? "CARD PUBLISHED · INDEX REPLAY SEALED"
    : locked ? "SEALED UNTIL THE SET COMPLETES"
    : data.error && data.completed < chapter ? "CHECK STOPPED"
    : checked ? "CHECKED IN YOUR BROWSER"
    : data.working === chapter ? "CHECKING LIVE EVIDENCE" : "AWAITING BROWSER CHECK";
  return <article ref={setRef} className="sp-chapter" id={`proof-step-${chapter}`} aria-labelledby={`proof-heading-${chapter}`}>
    <div className="sp-chapter-heading">
      <div className="sp-chapter-kicker"><span className="sp-eyebrow">{copy.eyebrow}</span><span className="sp-count">{String(chapter).padStart(2, "0")} <i>/ 06</i></span></div>
      <h3 id={`proof-heading-${chapter}`}>{copy.headline}</h3>
      <p>{copy.body}</p>
      <div className="sp-chapter-evidence">
        <span className={`sp-state ${locked ? "is-sealed" : checked ? "is-checked" : ""}`}><i />{status}</span>
        <span className="sp-source">{checked ? copy.source : 'AWAITING BROWSER VERIFICATION'}</span>
        <div className="sp-evidence-links">
          {chapterLinks(data, chapter).map(({ label, href }) => <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={13} aria-hidden="true" /></a>)}
        </div>
      </div>
    </div>
    <div className="sp-stage" aria-label={`${copy.title} animated proof scene`}>
      <div className="sp-stage-head"><span>RENAISS FAIR <i /> {copy.title.toUpperCase()}</span><span>SCROLL TO EXPLORE <ArrowDown size={13} aria-hidden="true" /></span></div>
      <div className="sp-stage-body"><ProofScene data={data} chapter={chapter} progress={progress} /></div>
    </div>
  </article>;
}

export function ScrollProofStory(data: ProofStoryData) {
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);
  const [progresses, setProgresses] = useState<number[]>(() => chapters.map(() => 0));

  useEffect(() => {
    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const measure = () => {
      frame = 0;
      const next = chapterRefs.current.map((element) => {
        if (!element || reduced.matches) return 1;
        const top = element.querySelector(".sp-stage")?.getBoundingClientRect().top ?? element.getBoundingClientRect().top;
        // The scene becomes fully emphasized as it enters view; no evidence is hidden.
        return clamp((window.innerHeight * 0.9 - top) / (window.innerHeight * 0.85));
      });
      setProgresses((previous) => previous.every((value, index) => Math.abs(value - next[index]!) < 0.004) ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const explorer = data.verification.chainId === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com";
  return <section className="sp-story" aria-label="Six-stage verification story">
    <div className="sp-story-intro"><span>RENAISS FAIR <i /> PROOF SEQUENCE</span><span>SIX STAGES · AVAILABLE CHECKS SHOWN</span></div>
    <div className="sp-facts" aria-labelledby="sp-facts-heading">
      <div className="sp-facts-heading"><span>THE FACTS / SOURCE MAP</span><h2 id="sp-facts-heading">Where does each fact live?</h2><p>Follow the evidence from the chain record to published tickets. The source label tells you what you can verify today.</p></div>
      <div className="sp-facts-grid">
        <div className="sp-fact-card is-chain"><span>01 / ON BSC</span><strong>Roster + round request</strong><p>A fixed Merkle root, manifest fingerprint, prize plan and VRF key; then this round request in a finalized block.</p><a href={`${explorer}/tx/${data.verification.transactionHash}`} target="_blank" rel="noopener noreferrer">Open round request transaction <ExternalLink size={12} aria-hidden="true" /></a></div>
        <div className="sp-fact-card is-site"><span>02 / SITE PUBLISHED</span><strong>Tickets + proof</strong><p>The winning tickets, ordered reserves, participant commitments and VRF witness are published by the event.</p>{data.verification.bundleHash && <a href={`/api/public-proofs/worlds-2026/${data.verification.stage}/bundle?download=1&bundleHash=${data.verification.bundleHash}`} target="_blank" rel="noopener noreferrer">Open published result <ExternalLink size={12} aria-hidden="true" /></a>}</div>
        <div className="sp-fact-card is-browser"><span>03 / CHECKED HERE</span><strong>Browser checks</strong><p>Your browser checks chain facts, ECVRF, the original Worlds selector, published results and every ticket inclusion path.</p><span className="sp-fact-status">{data.completed === 6 ? "AVAILABLE CHECKS PASSED" : data.error ? "CHECK NEEDS ATTENTION" : "CHECKING THE EVIDENCE"}</span></div>
      </div>
      <p className="sp-facts-boundary"><strong>Proof boundary</strong> These checks do not prove the operator could not choose transaction timing or delay publishing a proof. They show which committed inputs and published results can be checked.</p>
    </div>
    <nav className="sp-index" aria-label="Jump to a proof step">
      {chapters.map((item, index) => <a key={item.title} href={`#proof-step-${index + 1}`}>
        <span>{data.sealed && (index === 3 || index === 4) ? <LockKeyhole size={12} aria-hidden="true" /> : data.completed >= index + 1 ? <Check size={13} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span>{item.title}
      </a>)}
    </nav>
    {chapters.map((_, index) => <Chapter key={index} data={data} chapter={index + 1} progress={progresses[index] ?? 0} setRef={(node) => { chapterRefs.current[index] = node; }} />)}
  </section>;
}
