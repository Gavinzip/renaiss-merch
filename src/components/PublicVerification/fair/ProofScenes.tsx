import {type CSSProperties,type ReactNode} from 'react';
import {usePublicValueCopy} from '../usePublicValueCopy';
import {Check,CircleCheck,Copy,Fingerprint,Layers3,MonitorCheck,ReceiptText,ShieldCheck} from 'lucide-react';
import {focusStyle,motionPhase,ProofFlowArrow} from './proof-flow';
import type {ProofPick} from '../../../../shared/public-proof/types';
import {publicProofMediaAsset} from 'virtual:public-proof-assets';
import './proof-scenes.css';
export interface ProofStoryData {
 verification:{transactionHash:string;chainId:number;contractAddress:string;commitmentTransactionHash:string;roundId:string;stage:string;bundleHash:string;ticket:{position:number;ticketNumber:number;participantId:string;role:string;prizeName:string;matchId:string;rank:number};witness:{proof:string;blockNumber:number};merkleProof:string[]};
 completed:number;working:number;sealed:boolean;error:string;
 facts:{root:string;manifestHash:string;publicKey:string;blockHash:string;ticketCount:number}|null;
 seed:string|null;beta:string|null;replay:{picks:ProofPick[];wordsConsumed:string}|null;merkleRoot:string|null;
}
type Evidence = { label: string; value: string | number | null | undefined; source: "chain" | "site" | "browser" };
const short = (value: string) => value.length > 28 ? value.slice(0, 12) + "…" + value.slice(-10) : value;

function CopyValue({ label, value }: { label: string; value: Evidence["value"] }) {
  const {copied,copyError,copy}=usePublicValueCopy();
  if (value === undefined || value === null || value === "") return <span className="ps-value-pending">Not verified</span>;
  const full = String(value);
  return <span className="ps-copy-value"><code title={full}>{short(full)}</code><button type="button" aria-label={copyError??"Copy " + label} title={copyError??(copied ? "Copied" : "Copy full " + label)}
    onClick={() => void copy(full)}>
    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}</button>{copyError?<span className="vf-sr-only" role="alert">{copyError}</span>:null}</span>;
}

function EvidenceTape({ items }: { items: Evidence[] }) {
  return <div className="ps-evidence-tape" aria-label="Copyable proof values">
    {items.map(({ label, value, source }) => <div className={"ps-evidence ps-evidence-" + source} key={label}>
      <span>{label}<i>{source === "chain" ? "BSC" : source === "site" ? "SITE" : "BROWSER"}</i></span>
      <CopyValue label={label} value={value} />
    </div>)}
  </div>;
}

function SceneHeading({ source, title, description }: { source: string; title: string; description: string }) {
  return <div className="ps-scene-heading"><span>{source}</span><h4>{title}</h4><p>{description}</p></div>;
}

function SceneNote({ children, checked = false }: { children: ReactNode; checked?: boolean }) {
  return <p className="ps-scene-note">{checked && <CircleCheck size={15} aria-hidden="true" />}{children}</p>;
}

function ChainScene({ data, progress }: { data: ProofStoryData; progress: number }) {
  const value = data.verification;
  const total = data.facts?.ticketCount;
  return <div className="ps-scene ps-chain-scene">
    <SceneHeading source="01 · ON BSC" title="The roster came first." description="The on-chain commitment fixed the ticket root, manifest, prize plan and key before this round request." />
    <div className="ps-chain-show">
      <div className="ps-deck" aria-label={(total ?? "Unknown") + " precommitted tickets"}>
        <i className="ps-deck-card ps-deck-card-back" /><i className="ps-deck-card ps-deck-card-mid" />
        <div className="ps-deck-card ps-deck-card-front"><Layers3 size={30} strokeWidth={1.3} aria-hidden="true" /><small>SET COMMITTED</small><strong>{total ?? "—"}</strong><span>fixed tickets</span></div>
      </div>
      <ProofFlowArrow className="ps-chain-arrow" progress={progress} start={.42} end={.68} label="BEFORE" />
      <div className="ps-receipt" style={focusStyle(progress, .64, .92)}><ReceiptText size={29} strokeWidth={1.3} aria-hidden="true" /><small>FINALIZED ON BSC</small><strong>Round {value.stage}</strong><span>Block {value.witness?.blockNumber ?? "—"}</span><em>YOUR DRAW REQUEST</em></div>
    </div>
    <EvidenceTape items={[{ label: "Merkle root", value: data.facts?.root, source: "chain" }, { label: "Manifest SHA-256", value: data.facts?.manifestHash, source: "browser" }, { label: "Public VRF key", value: data.facts?.publicKey, source: "chain" }, { label: "Request tx", value: data.facts ? value.transactionHash : null, source: "chain" }]} />
  </div>;
}

function SeedScene({ data, progress }: { data: ProofStoryData; progress: number }) {
  const born = motionPhase(progress, .65, .96);
  return <div className="ps-scene ps-seed-scene">
    <SceneHeading source={data.seed ? "02 · CALCULATED IN YOUR BROWSER" : "02 · INPUT NOT YET VERIFIED"} title="One committed round makes one input." description="The Worlds ABI recipe binds the protocol, chain, contract, round, ticket root, manifest, prizes, count, key and finalized request block." />
    <div className="ps-seed-show">
      <div className="ps-input-recipe" aria-label="Public inputs for VRF seed alpha">
        <div><small>FINALIZED BLOCK</small><strong>Block hash</strong><span>BSC</span></div>
        <div><small>FIXED ROUND</small><strong>Round ID</strong><span>BSC</span></div>
        <div><small>YOUR REQUEST</small><strong>Round {data.verification.stage}</strong><span>BSC</span></div>
        <div><small>PUBLIC RECIPE</small><strong>Protocol</strong><span>SITE</span></div>
      </div>
      <ProofFlowArrow className="ps-seed-arrow" progress={progress} start={.5} end={.76} label="COMBINE" />
      <div className="ps-alpha" style={{ opacity: .72 + born * .28, transform: "translateY(" + ((1 - born) * 15) + "px) scale(" + (.94 + born * .06) + ")" }}><Fingerprint size={35} strokeWidth={1.25} aria-hidden="true" /><small>RECOMPUTED HERE</small><strong>α</strong><span>ONE VRF INPUT</span></div>
    </div>
    <EvidenceTape items={[{ label: "Block hash", value: data.facts?.blockHash, source: "chain" }, { label: "Round ID", value: data.facts ? data.verification.roundId : null, source: "chain" }, { label: "Protocol", value: "renaiss-worlds-ticket-ecvrf-v1", source: "site" }, { label: "VRF input α", value: data.seed, source: "browser" }]} />
  </div>;
}

function VrfScene({ data, progress }: { data: ProofStoryData; progress: number }) {
  const checked = data.beta ? motionPhase(progress, .72, .98) : 0;
  return <div className="ps-scene ps-vrf-scene">
    <SceneHeading source={data.beta ? "03 · CHECKED IN YOUR BROWSER" : "03 · PROOF NOT YET VERIFIED"} title="A valid proof unlocks β." description="The published proof must agree with the key fixed before the draw and this round's α." />
    <div className="ps-vrf-show">
      <div className="ps-vrf-token ps-vrf-key"><ShieldCheck size={32} strokeWidth={1.25} aria-hidden="true" /><small>ON BSC + CALCULATED HERE</small><strong>Key + α</strong><span>Fixed key · your input</span></div>
      <span className="ps-vrf-plus" aria-hidden="true">+</span>
      <div className="ps-vrf-token ps-vrf-proof" style={focusStyle(progress, .38, .65)}><Fingerprint size={32} strokeWidth={1.25} aria-hidden="true" /><small>SITE PUBLISHED</small><strong>Proof π</strong><span>Witness for this round</span></div>
      <ProofFlowArrow className="ps-vrf-arrow" progress={progress} start={.6} end={.82} label="VERIFY" />
      <div className="ps-vrf-verified" style={{ opacity: .72 + checked * .28, transform: "translateY(" + ((1 - checked) * 12) + "px)" }}><div className="ps-verification-seal"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="31" /><circle className="ps-verification-ring" cx="36" cy="36" r="31" style={{ strokeDashoffset: 195 * (1 - checked) }} /></svg><MonitorCheck size={29} strokeWidth={1.35} aria-hidden="true" /></div><small>{data.beta ? "BROWSER VERIFIED" : "CHECKING IN BROWSER"}</small><strong>{data.beta ? "Random output β" : "Checking proof…"}</strong><span>One checkable result</span></div>
    </div>
    <EvidenceTape items={[{ label: "Public VRF key", value: data.facts?.publicKey, source: "chain" }, { label: "Seed α", value: data.seed, source: "browser" }, { label: "Proof π", value: data.verification.witness?.proof, source: "site" }, { label: "Output β", value: data.beta, source: "browser" }]} />
  </div>;
}

function PoolScene({ data, progress }: { data: ProofStoryData; progress: number }) {
  const used=data.replay?.picks.length;
  const total=data.facts?.ticketCount;
  const left=total!==undefined&&used!==undefined?total-used:null;
  const shifted = motionPhase(progress, .42, .76);
  return <div className="ps-scene ps-pool-scene">
    <SceneHeading source={data.replay ? "04 · REPLAYED IN YOUR BROWSER" : "04 · SELECTION NOT YET VERIFIED"} title="One stream. Ordered tickets." description="Worlds uses SHA-512, rejection sampling and forward Fisher–Yates: one winner and two ordered reserves per match." />
    <div className="ps-pool-show">
      <div className="ps-pool-stack"><div className="ps-pool-card ps-pool-card-back" /><div className="ps-pool-card ps-pool-card-middle" /><div className="ps-pool-card ps-pool-card-front"><Layers3 size={27} strokeWidth={1.25} aria-hidden="true" /><small>SEALED SET</small><strong>{total || "—"}</strong><span>fixed tickets</span></div></div>
      <div className="ps-pool-flight" aria-hidden="true">
        <i style={{ left: `${8 * shifted}%`, top: `${35 - 22 * shifted}%`, transform: `rotate(${-17 * shifted}deg)`, opacity: shifted }} />
        <i style={{ left: `${40 * shifted}%`, top: "40%", transform: `rotate(${5 * shifted}deg)`, opacity: shifted }} />
        <i style={{ left: `${70 * shifted}%`, top: `${45 + 20 * shifted}%`, transform: `rotate(${18 * shifted}deg)`, opacity: shifted }} />
      </div>
      <div className="ps-pool-count" style={focusStyle(progress, .53, .78)}><small>SELECTED TICKETS</small><strong>{used??"—"}</strong><span>browser replay</span></div>
      <ProofFlowArrow className="ps-pool-arrow" progress={progress} start={.68} end={.86} label="LEAVE" />
      <div className="ps-pool-left" style={focusStyle(progress, .79, 1)}><small>STILL AVAILABLE</small><strong>{left??"—"}</strong><span>unselected committed tickets</span></div>
    </div>
    <SceneNote>The stream counter advances on every word, including rejected words. The exact committed match and reserve order are preserved.</SceneNote>
  </div>;
}

function CardScene({ data, progress }: { data: ProofStoryData; progress: number }) {
  const slot = data.verification.ticket;
  const roleCode = slot.rank === 0 ? 'W' : `R${slot.rank}`;
  const arrive = motionPhase(progress, .39, .84);
  return <div className="ps-scene ps-card-scene">
    <SceneHeading source="05 · SITE PUBLISHED" title="Here is the published ticket." description="The event publishes each ticket, match and participant commitment. Browser replay independently checks the same winner and reserve order." />
    <div className="ps-publish-show"><div className="ps-publication-mark" style={{ opacity: .65 + motionPhase(progress, .2, .52) * .35 }}><span>RENAISS FAIR</span><strong>Published result</strong><small>THIS WEBSITE</small></div><ProofFlowArrow className="ps-publish-arrow" progress={progress} start={.35} end={.62} label="PUBLISH" />
      <div className="ps-card-artifact" style={{ transform: "perspective(900px) rotateY(" + ((1 - arrive) * -12) + "deg) translateY(" + ((1 - arrive) * 18) + "px) scale(" + (.91 + arrive * .09) + ")", opacity: .75 + arrive * .25 } as CSSProperties}><div className="ps-card-sheen" style={{ transform: "translateX(" + (-140 + 275 * arrive) + "%) skewX(-24deg)" }} /><div className="ps-card-top"><img src={publicProofMediaAsset("fair-die.webp")} alt="" /><span>RENAISS FAIR<br />WORLDS 2026 · PUBLIC PROOF</span></div><div className="ps-card-tier"><small>{slot.role}</small><strong aria-label={slot.role}>{roleCode}</strong><span>{slot.prizeName}</span></div><div className="ps-card-bottom"><span>TICKET #{slot.ticketNumber}</span><code>{slot.participantId}</code></div></div>
    </div>
    <EvidenceTape items={[{ label: "Ticket", value: slot.ticketNumber, source: "site" }, { label: "Participant commitment", value: slot.participantId, source: "site" }, { label: "Role", value: slot.role, source: "site" }]} />
    <SceneNote>Published ticket values are separate from browser verification; only completed checks receive a verified status.</SceneNote>
  </div>;
}

function MerkleScene({ data, progress }: { data: ProofStoryData; progress: number }) {
  const slot = data.verification.ticket;
  const steps = data.verification.merkleProof?.length ?? 0;
  const matched = data.merkleRoot ? motionPhase(progress, .77, 1) : 0;
  return <div className="ps-scene ps-merkle-scene">
    <SceneHeading source={data.merkleRoot ? "06 · CHECKED IN YOUR BROWSER" : "06 · PATH NOT YET VERIFIED"} title={data.merkleRoot ? "The ticket fits the committed roster." : "Checking the committed roster."} description="The browser hashes all six Worlds ABI leaf fields through the published path and compares the root with independently checked chain state." />
    <div className="ps-merkle-show">
      <div className="ps-merkle-leaf"><small>PUBLISHED TICKET</small><strong>Ticket #{slot.ticketNumber}</strong><span>One leaf in the set</span></div>
      <div className="ps-merkle-journey" aria-label={steps + " Merkle sibling checks"}><span className="ps-merkle-journey-line" style={{ transform: "scaleX(" + motionPhase(progress, .25, .78) + ")" }} />{Array.from({ length: Math.min(steps, 12) }, (_, index) => <i key={index} className={data.merkleRoot && progress >= .28 + index * (.49 / Math.max(1, steps)) ? "is-checked" : ""} />)}<small>{steps} SIBLING CHECKS</small></div>
      <div className="ps-merkle-seal" style={{ opacity: .68 + matched * .32, transform: "scale(" + (.94 + matched * .06) + ")" }}><div><ShieldCheck size={34} strokeWidth={1.3} aria-hidden="true" /></div><small>ON-CHAIN ROOT</small><strong>{data.merkleRoot ? "Root matches" : "Checking…"}</strong></div>
    </div>
    <EvidenceTape items={[{ label: "Participant commitment", value: slot.participantId, source: "site" }, { label: "Path checks", value: steps, source: "site" }, { label: "Verified Merkle root", value: data.merkleRoot, source: "browser" }, { label: "Committed root", value: data.facts?.root, source: "chain" }]} />
    <SceneNote checked={Boolean(data.merkleRoot)}>{data.merkleRoot ? "This proves committed roster membership. " : "Checking committed roster membership. "}Winner and reserve selection is independently checked in step 4.</SceneNote>
  </div>;
}

export function ProofScene({ data, chapter, progress }: { data: ProofStoryData; chapter: number; progress: number }) {
  return chapter === 1 ? <ChainScene data={data} progress={progress} />
    : chapter === 2 ? <SeedScene data={data} progress={progress} />
    : chapter === 3 ? <VrfScene data={data} progress={progress} />
    : chapter === 4 ? <PoolScene data={data} progress={progress} />
    : chapter === 5 ? <CardScene data={data} progress={progress} />
    : <MerkleScene data={data} progress={progress} />;
}
