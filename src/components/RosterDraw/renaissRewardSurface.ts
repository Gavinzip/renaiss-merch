// One procedural print substrate for the DOM card and its moving Three.js face.
const surface = `<svg xmlns="http://www.w3.org/2000/svg" width="832" height="520" viewBox="0 0 832 520">
<defs>
  <linearGradient id="paper" x2="1" y2="1"><stop stop-color="#f7f8f8"/><stop offset=".52" stop-color="#fffdf8"/><stop offset="1" stop-color="#ecebf0"/></linearGradient>
  <linearGradient id="spectrum"><stop stop-color="#5370a5"/><stop offset=".3" stop-color="#79aeb7"/><stop offset=".55" stop-color="#a4b68a"/><stop offset=".8" stop-color="#d1bc91"/><stop offset="1" stop-color="#c6929e"/></linearGradient>
</defs>
<rect width="832" height="520" rx="25" fill="url(#paper)"/>
<rect x=".5" y=".5" width="831" height="519" rx="24.5" fill="none" stroke="#fff" stroke-opacity=".75"/>
<path d="M64 414H768" stroke="#9c99a6" stroke-opacity=".25"/>
<path d="M64 414H193" stroke="url(#spectrum)" stroke-width="1.8"/>
</svg>`;
export const renaissRewardSurfaceUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(surface)}`;

// A non-chain draw has a branded reverse, never a ticket or roster identifier.
const backSurface = `<svg xmlns="http://www.w3.org/2000/svg" width="832" height="520" viewBox="0 0 832 520">
<defs>
  <linearGradient id="paper" x2="1" y2="1"><stop stop-color="#f5f6f8"/><stop offset=".5" stop-color="#fffcf6"/><stop offset="1" stop-color="#eae9f0"/></linearGradient>
  <linearGradient id="foil" x2="1" y2="1"><stop stop-color="#7994ad"/><stop offset=".35" stop-color="#85b3a6"/><stop offset=".65" stop-color="#c4b089"/><stop offset="1" stop-color="#b59aac"/></linearGradient>
</defs>
<rect width="832" height="520" rx="25" fill="url(#paper)"/>
<path d="M389 426H443" stroke="url(#foil)" stroke-width="2"/>
<rect x=".5" y=".5" width="831" height="519" rx="24.5" fill="none" stroke="#fff" stroke-opacity=".75"/>
</svg>`;
export const renaissRewardBackSurfaceUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(backSurface)}`;
