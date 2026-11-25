import { bbwArchiveMedia } from '../../event-archives/bbw/archiveData';
import './BbwArchiveCover.css';

export function BbwArchiveCover() {
  return <div className="bbw-archive-cover" aria-hidden="true">
    <img className="bbw-archive-cover__venue" src={bbwArchiveMedia.venue} alt="" width={2560} height={1440} loading="lazy"/>
    <div className="bbw-archive-cover__copy">
      <div><img src={bbwArchiveMedia.renaiss} alt=""/><span>×</span><img src={bbwArchiveMedia.fourmeme} alt=""/></div>
      <strong>Next stop,<br/>Bangkok.</strong>
      <span>BBW 2026 / COMMUNITY COLLECTION</span>
    </div>
  </div>;
}
