import { GiftBoxCanvas } from './GiftBoxCanvas.jsx';
import { rosterDrawAsset } from '../rosterDrawAssets';
import './bonusPrize.css';

const ignoreWinner = () => {};

/** Product inspection only: no winner, audio, playback, or draw request. */
export default function CharizardPrizePreview({ active = true }) {
  return <GiftBoxCanvas active={active}
    textureUrl={rosterDrawAsset('box')}
    cardTextureUrl={rosterDrawAsset('card')}
    playing={false}
    runId={0}
    view="front"
    onWinnerVisible={ignoreWinner}
  />;
}
