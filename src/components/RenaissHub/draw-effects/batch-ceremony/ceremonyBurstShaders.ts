// Adapted from 30th ann / standard-prizes/particleBloomShaders.js.
// A small handful of pearl and warm silver glints replaces a screen-wide spray.
/** White-hot nuclei, velocity-aligned plasma tails, then cooling gold embers.
 * All particles use one finite analytic clock; no looping flicker or smoke. */
export const bloomVertex = /* glsl */`
  attribute vec4 aSeed;
  attribute float aKind;
  uniform float uAge, uPixelRatio;
  uniform vec2 uExtent;
  varying float vAlpha, vKind, vAngle, vHeat, vSize, vTint;
  void main() {
    float delay = aSeed.w * .028;
    float t = max(0., uAge - delay);
    float angle = aSeed.x * 6.283185;
    float reach = .17 + pow(aSeed.y, .5) * .88;
    float drag = 6.5 + aSeed.z * 4.;
    float release = 1. - exp(-t * drag);
    vec2 direction = vec2(cos(angle), sin(angle));
    vec2 point = direction * reach * release * uExtent;
    point *= .86 + aSeed.z * .27;
    point += vec2(-direction.y,direction.x) * sin(t*3.+aSeed.y*9.) * t*9.;
    point.y -= t*t*(55.+aSeed.w*60.);
    vec2 velocity = direction * reach * drag * exp(-t*drag) * uExtent;
    velocity.y -= t * (110.+aSeed.w*120.);
    float life = .28 + pow(aSeed.z,2.)*.79;
    if(aKind > .5) life = .36 + aSeed.z*.53;
    vAlpha = step(delay,uAge) * (1.-smoothstep(life*.32,life,t));
    vHeat = exp(-t*(3.4+aSeed.w*2.));
    vKind = aKind; vTint = aSeed.x;
    vAngle = atan(-velocity.y,velocity.x);
    float stretch = min(1.,length(velocity)/1900.);
    float size = (4.+aSeed.w*6.) * (.72+.28*vHeat);
    if(aKind>.5) size = 18. + stretch*(28.+aSeed.y*36.);
    if(aKind>1.5) size = 18.+vHeat*17.;
    vSize = size;
    gl_PointSize = size*uPixelRatio;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(point,40.+aSeed.z*100.,1.);
  }
`;
export const bloomFragment = /* glsl */`
  varying float vAlpha, vKind, vAngle, vHeat, vSize, vTint;
  void main(){
    vec2 p=gl_PointCoord*2.-1.;
    float c=cos(vAngle),s=sin(vAngle);
    vec2 q=vec2(c*p.x+s*p.y,-s*p.x+c*p.y);
    float edge=1.-smoothstep(.80,1.,length(p));
    float core,corona,halo;
    if(vKind>.5 && vKind<1.5){
      // A luminous head with a tapering, curved tail, not a stroked line.
      float head=.40;
      float headR=length(vec2((q.x-head)*1.05,q.y)*vSize/3.8);
      float behind=clamp((head-q.x)/1.15,0.,1.);
      float width=(1.9+vHeat*1.6)*(1.-behind*.79)/vSize;
      float curve=q.y-sin(behind*2.4)*behind*.025;
      float tailMask=step(q.x,head)*(1.-smoothstep(.72,1.,behind));
      float tail=exp(-pow(curve/max(.008,width),2.))*tailMask*(1.-behind);
      core=exp(-headR*headR*2.5)+tail*.95;
      corona=exp(-headR*headR*.38)+pow(tail,.42)*.64;
      halo=exp(-headR*headR*.075)*.34+pow(tail,.15)*tailMask*.12;
    }else{
      float r=length(p);
      core=exp(-r*r*34.);
      corona=exp(-r*r*11.);
      halo=exp(-r*r*3.5)*.32;
      if(vKind>1.5){
        float glint=exp(-abs(p.x)*80.-abs(p.y)*5.)+exp(-abs(p.y)*80.-abs(p.x)*5.);
        core+=glint*.65*vHeat;corona+=glint*.32;
      }
    }
    float heat=clamp(core*2.5+corona*.13,0.,1.);
    vec3 amber=mix(vec3(.76,.85,.89),vec3(.97,.83,.72),vTint);
    vec3 hot=mix(vec3(.80,.88,1.),vec3(1.,.997,.96),vHeat);
    vec3 color=mix(amber,hot,heat);
    float alpha=min(1.,core*1.8+corona*.72+halo*.45)*vAlpha*edge;
    if(alpha<.003)discard;
    gl_FragColor=vec4(color,alpha);
  }
`;
