import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Euler, Vector3 } from 'three';

// Compile the actual production motion/foil modules in memory; no browser,
// renderer mock, application data or generated fixture files are involved.
const result = await build({
  stdin: { contents: `export * from './src/components/RenaissHub/draw-effects/batch-ceremony/proBoosterTimeline.ts';
    export {foilGeometry,deformFoil} from './src/components/RenaissHub/draw-effects/batch-ceremony/proBoosterGeometry.ts';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, minify: true,
});
const motion = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const cases = [
  { name: 'current desktop', width: 1108, height: 678 },
  { name: 'narrow desktop', width: 637, height: 678 },
  { name: '4:3', width: 960, height: 592 },
  { name: 'phone', width: 362, height: 636 },
  { name: 'tall narrow viewport', width: 292, height: 1824 },
];
function fixture({width,height}) {
  const cardWidth = Math.min(680, width - 32, (height - 112) * 1.6);
  const target = {x:width/2,y:height/2-14,width:cardWidth,height:cardWidth/1.6};
  const layout = {width,height,safeTop:20,safeBottom:72,viewportCenterY:height/2,
    center:{x:width/2,y:height/2},emitter:{x:width/2,y:height/2,z:500},unit:1,cards:[target]};
  const base = motion.proBoosterLayout(layout);
  return {layout,target,pack:{...base,width:base.width*.88,height:base.height*.88}};
}
function lowestCardPoint(age,target,layout) {
  const pose = motion.proCardFlight(age,0,target,layout), rotation=new Euler(pose.rx,pose.ry,pose.rz);
  let lowest=-Infinity;
  for (const x of [-target.width/2,target.width/2]) for(const y of [-target.height/2,target.height/2]) for(const z of [-.42,.42]) {
    const corner=new Vector3(x*pose.scale,y*pose.scale,z*pose.scale*pose.depthScale).applyEuler(rotation);
    lowest=Math.max(lowest,pose.y-corner.y);
  }
  return lowest;
}
for (const scenario of cases) test(`${scenario.name}: card clears the real foil before it rotates or grows`,()=>{
  const {layout,target,pack}=fixture(scenario), front=motion.foilGeometry(false), back=motion.foilGeometry(false);
  let minimumGap=Infinity;
  try {
    for(let age=motion.PRO_BOOSTER.clear+.001;age<=motion.PRO_BOOSTER.deal;age+=1/120) {
      const pose=motion.proBoosterMotion(age);
      motion.deformFoil(front,1,pose.tear,pose.mouth,false,pose.stripExit);
      motion.deformFoil(back,-1,pose.tear,pose.mouth,false,pose.stripExit);
      let highestFoil=-Infinity;
      for(const geometry of [front,back]) {
        const points=geometry.attributes.position;
        for(let i=0;i<points.count;i++)highestFoil=Math.max(highestFoil,points.getY(i));
      }
      const foilTop=pack.y+motion.proBoosterReleaseOffset(pack,pose,layout.height+32)-highestFoil*pack.width;
      minimumGap=Math.min(minimumGap,foilTop-lowestCardPoint(age,target,layout));
    }
    assert.ok(minimumGap>1,`Card intersects foil by ${(-minimumGap).toFixed(2)}px`);
    const end=motion.proBoosterMotion(motion.proDealDuration(1));
    const topAtExit=pack.y+motion.proBoosterReleaseOffset(pack,end,layout.height+32)-pack.height/2;
    assert.ok(topAtExit>layout.height+32,'Pouch must leave the complete drawing surface');
  } finally {front.dispose();back.dispose();}
});
test('negative control: the former shortened single-card withdrawal intersects during presentation',()=>{
  const {layout,target,pack}=fixture(cases[1]),age=motion.PRO_BOOSTER.clear+.01,pose=motion.proBoosterMotion(age);
  const shortened=(pose.sleeveY-(1.08*(1.86/1.48)-.18)*pose.withdraw+.22*pose.drop)*pack.width;
  const oldFoilTop=pack.y+shortened-.78*pack.width;
  assert.ok(oldFoilTop<lowestCardPoint(age,target,layout),'Regression fixture must detect the former intersection');
});
