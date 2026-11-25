// Explicit read-only capture; the archive page never connects to the draw DB/RPC.
import fs from 'node:fs/promises';
import {readSurfPublicResults} from '../server/surf-draw/public-results.mjs';
const result = await readSurfPublicResults();
if(result.status!=='complete'||result.winners.length!==27)throw new Error('Only the completed 27-slot Surf round can be archived.');
await fs.writeFile(new URL('../src/event-archives/data/surf.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log('Captured 27 verified Surf winner slots with display name and ticket only.');
