import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// Local product previews may read source fonts. Production must use an
// explicitly published content-versioned CDN release, with no local fallback.
export function publicProofMedia(mode: string, environment: Record<string, string>): Plugin {
  const local = ['local-preview', 'development'].includes(mode);
  const releaseBase = () => {
    const catalog = JSON.parse(readFileSync(new URL('../media/public-proof-asset-release.json', import.meta.url), 'utf8'));
    const base = environment.VITE_PUBLIC_PROOF_MEDIA_CDN_BASE_URL?.trim().replace(/\/+$/, '');
    if (catalog.release === 'unpublished' || !base) {
      throw new Error('Public proof fonts are not published. Use build:local for a local product preview; publish and verify the CDN catalog before a production build.');
    }
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !url.pathname.endsWith(`/${catalog.prefix}/${catalog.release}`)) throw new Error('Public proof CDN release mismatch.');
    return { base, catalog };
  };
  return { name: 'public-proof-media', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:public-proof-assets') return '\0public-proof-assets'; },
    load(id) {
      if (id !== '\0public-proof-assets') return;
      const names = ['fair-die.webp', 'fair-logo.svg'];
      if (local) return names.map((name, i) => `import a${i} from ${JSON.stringify(new URL('../src/components/PublicVerification/art/' + name, import.meta.url).pathname)};`).join('\n') +
        `\nconst assets={${names.map((name,i)=>`${JSON.stringify(name)}:a${i}`).join(',')}};export const publicProofMediaAsset=name=>assets[name];`;
      const { base } = releaseBase();
      return `export const publicProofMediaAsset=name=>${JSON.stringify(base + '/')}+name;`;
    },
    transform(source, id) {
    if (!/\/PublicVerification\/(reference|golden)\.css$/.test(id.split('?')[0]) || local) return;
    const { base, catalog } = releaseBase();
    return source.replace(/url\(['"]\.\/fonts\/([^'"]+)['"]\)/g, (_match, name: string) => {
      if (!Object.values(catalog.assets).some((asset: unknown) => (asset as { path: string }).path === name)) throw new Error('Uncatalogued public proof font.');
      return `url('${base}/${name}')`;
    });
  } };
}
