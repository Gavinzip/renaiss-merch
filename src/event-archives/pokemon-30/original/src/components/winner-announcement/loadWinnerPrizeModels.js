import { archiveAssetUrl } from "../../../../../shared/archiveAssets.js";
import * as THREE from 'three'
import { loadCharizardModel } from '../../draw/bonus-prize/loadCharizardModel'
import { createGiftBoxModel } from '../../draw/bonus-prize/createGiftBoxModel'
import { disposeScene } from '../../draw/bonus-prize/disposeScene'
const printUrl = archiveAssetUrl("pokemon-30/src/draw/bonus-prize/assets/gift-box-print.jpg");const cardUrl = archiveAssetUrl("pokemon-30/src/draw/bonus-prize/assets/jumbo-charizard-card.jpg");export async function loadBonusPrizeModel() {
  const results = await Promise.allSettled([
    new THREE.TextureLoader().loadAsync(printUrl), loadCharizardModel(), new THREE.TextureLoader().loadAsync(cardUrl),
  ])
  if (results.some(result => result.status === 'rejected')) {
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') index === 1 ? disposeScene(result.value) : result.value.dispose()
    })
    throw new Error('Existing gift box assets failed to load.')
  }
  const [print, figure, card] = results.map(result => result.value)
  print.colorSpace = card.colorSpace = THREE.SRGBColorSpace
  print.anisotropy = card.anisotropy = 4
  try {
    const model = createGiftBoxModel(print, figure, card)
    model.name = 'announcement-existing-charizard-gift-box'
    return model
  } catch (error) {
    print.dispose(); card.dispose(); disposeScene(figure)
    throw error
  }
}
