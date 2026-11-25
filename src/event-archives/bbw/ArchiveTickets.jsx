import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bbwArchiveWinners, bbwArchiveMedia } from './archiveData';
import { createTravelCardPrints } from './original/src/flagship/thailand/draw/presentation/artwork/travelCardArtwork';
import { drawCopy } from './original/src/flagship/thailand/draw/presentation/drawCopy';
import { useArchiveEntrance } from '../shared/useArchiveEntrance';

function decodeImage(url, signal) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); image.onload = image.onerror = null; };
    const fail = () => { cleanup(); image.src = ''; reject(new Error('Original BBW card media could not load.')); };
    const abort = () => fail();
    const timer = setTimeout(fail, 15000);
    image.onload = () => { void image.decode().then(() => { cleanup(); resolve(image); }, fail); };
    image.onerror = fail;
    signal.addEventListener('abort', abort, {once:true});
    image.src = url;
  });
}
export function useArchiveTicketPrints(locale) {
  const [attempt, setAttempt] = useState(0), [state, setState] = useState({status:'loading'});
  useEffect(() => {
    const controller = new AbortController();
    setState({status:'loading'});
    void Promise.all([
      decodeImage(bbwArchiveMedia.renaiss,controller.signal),
      decodeImage(bbwArchiveMedia.fourmeme,controller.signal),
      decodeImage(bbwArchiveMedia.venue,controller.signal),
    ]).then(([renaiss,four,photo]) => {
      if (controller.signal.aborted) return;
      setState({status:'ready',renaiss,four,photo});
    }).catch(() => { if (!controller.signal.aborted) setState({status:'error'}); });
    return () => controller.abort();
  }, [attempt]);
  // Language changes reuse decoded original media, keeping the same card area.
  const faces=useMemo(()=>state.status==='ready'?createTravelCardPrints(drawCopy[locale],
    bbwArchiveWinners.map(winner=>({...winner,rank:winner.displayNumber})),
    {renaiss:state.renaiss,four:state.four},state.photo).faces:[],[state,locale]);
  return {status:state.status,faces,retry:()=>setAttempt(value=>value+1)};
}
function Ticket({ winner, canvas, copy }) {
  const host = useRef(null);
  useLayoutEffect(() => { canvas.setAttribute('aria-hidden','true'); host.current.replaceChildren(canvas); return () => canvas.remove(); }, [canvas]);
  return <li className="bbw-archive-ticket">
    <figure>
      <div className="bbw-archive-ticket__print" ref={host}/>
      <a className="bbw-archive-ticket__name" href={'https://x.com/'+winner.xUsername} target="_blank" rel="noreferrer" aria-label={winner.name+' · X ↗'}><span className="bbw-archive-sr">{winner.name}</span></a>
      <figcaption><span>{copy.ticket} {winner.tickets.map(ticket=>'#'+String(ticket).padStart(6,'0')).join(' / ')}</span>{winner.tickets.length>1&&<span className="bbw-archive-ticket__wins">{copy.wins(winner.tickets.length)}</span>}</figcaption>
    </figure>
  </li>;
}
export function ArchiveTickets({ faces, copy }) {
  const entrance = useArchiveEntrance('.bbw-archive-ticket');
  return <ol ref={entrance} className="bbw-archive-tickets" aria-label={copy.winners}>
    {bbwArchiveWinners.map((winner,index)=><Ticket key={winner.participantId} winner={winner} canvas={faces[index]} copy={copy}/>)}
  </ol>;
}
