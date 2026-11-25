import { worlds2026Archive } from '../../event-archives/worlds2026';
import './WorldsArchiveCover.css';

export function WorldsArchiveCover() {
  const media = worlds2026Archive.media;
  return <div className="worlds-archive-cover" aria-hidden="true">
    <img className="worlds-archive-cover__background" src={media.background} alt="" width={2752} height={1536} loading="lazy" />
    <div className="worlds-archive-cover__copy">
      <img className="worlds-archive-cover__brand" src={media.wordmark} alt="" width={1000} height={247} loading="lazy" />
      <strong>WORLDS<span>2026</span></strong>
      <small>LEAGUE OF LEGENDS</small>
    </div>
    <img className="worlds-archive-cover__trophy" src={media.trophy} alt="" width={559} height={852} loading="lazy" />
  </div>;
}
