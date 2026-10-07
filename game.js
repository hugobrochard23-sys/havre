/* HAVRE — réinterprétation tactile d'un constructeur de villages sur l'eau.
   Moteur 3D maison (Canvas 2D, algorithme du peintre), grille organique de quadrilatères. */
(() => {
'use strict';

/* ---------- utilitaires ---------- */
const TAU = Math.PI * 2;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash3(a,b,c){let h=(a*374761393+b*668265263+c*1442695041)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
function hexRGB(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function rgb(c,f=1,tint=0){ // c = [r,g,b]; f = luminosité ; tint = mélange vers bleu froid
  let r=c[0]*f,g=c[1]*f,b=c[2]*f;
  if(tint>0){r=lerp(r,48,tint);g=lerp(g,92,tint);b=lerp(b,118,tint);}
  return 'rgb('+(clamp(r,0,255)|0)+','+(clamp(g,0,255)|0)+','+(clamp(b,0,255)|0)+')';
}
function mix(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];}

/* ---------- constantes de jeu ---------- */
const PALETTE_HEX=['#e2433d','#f28c3a','#f6cf48','#d9e870','#a9c47c','#6fcf5c','#2fbf72','#3fc8a9','#36b7ca','#4a8ef2','#6e70d2','#c94b6c','#d7a67c','#aaa5a0','#e6e6e8'];
const PAL=PALETTE_HEX.map(hexRGB);
const ROOFS=[[222,120,60],[232,170,76],[200,92,68],[140,152,168],[214,140,82],[182,92,60]];
const STONE=[126,112,122];
const QH=0.5;           // hauteur du quai au-dessus de l'eau
const FH=1.3;           // hauteur d'un étage
const MAXL=11;          // niveau max
const BOTTOM=-1.3;      // fond visible sous l'eau
const LIGHT=norm3([-0.55,0.8,-0.45]);
function norm3(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}

/* ---------- grille organique (triangles → quads → relaxation) ---------- */
const GRID_SEED=1337;
function buildGrid(){
  const N=11,S=3.4,rnd=mulberry32(GRID_SEED);
  const key=(q,r)=>q+','+r;
  const inR=(q,r)=>Math.max(Math.abs(q),Math.abs(r),Math.abs(-q-r))<=N;
  const P=[],vid=new Map();
  for(let q=-N;q<=N;q++)for(let r=-N;r<=N;r++)if(inR(q,r)){vid.set(key(q,r),P.length);P.push([S*(q+r/2),S*r*Math.sqrt(3)/2]);}
  const tris=[];
  for(let q=-N;q<=N;q++)for(let r=-N;r<=N;r++){
    const a=vid.get(key(q,r)),b=vid.get(key(q+1,r)),c=vid.get(key(q,r+1)),d=vid.get(key(q+1,r+1));
    if(a!==undefined&&b!==undefined&&c!==undefined)tris.push([a,b,c]);
    if(b!==undefined&&d!==undefined&&c!==undefined)tris.push([b,d,c]);
  }
  const area=(f)=>{let s=0;for(let i=0;i<f.length;i++){const p=P[f[i]],q=P[f[(i+1)%f.length]];s+=p[0]*q[1]-q[0]*p[1];}return s/2;};
  tris.forEach(t=>{if(area(t)<0){const x=t[1];t[1]=t[2];t[2]=x;}});
  // arêtes partagées
  const emap=new Map();
  tris.forEach((t,ti)=>{for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],k=a<b?a+'_'+b:b+'_'+a;if(!emap.has(k))emap.set(k,[]);emap.get(k).push([ti,i]);}});
  const inner=[...emap.values()].filter(v=>v.length===2);
  for(let i=inner.length-1;i>0;i--){const j=(rnd()*(i+1))|0;[inner[i],inner[j]]=[inner[j],inner[i]];}
  const used=new Array(tris.length).fill(false),faces=[];
  for(const [[t1,i1],[t2,i2]] of inner){
    if(used[t1]||used[t2])continue;
    if(rnd()<0.12)continue; // garde quelques triangles → irrégularité
    used[t1]=used[t2]=true;
    const A=tris[t1],B=tris[t2];
    const a=A[i1],b=A[(i1+1)%3],c=A[(i1+2)%3],d=B[(i2+2)%3];
    faces.push([c,a,d,b]); // tourne autour du quad
  }
  tris.forEach((t,i)=>{if(!used[i])faces.push(t.slice());});
  faces.forEach(f=>{if(area(f)<0)f.reverse();});
  // subdivision
  const mid=new Map();
  const midOf=(a,b)=>{const k=a<b?a+'_'+b:b+'_'+a;let m=mid.get(k);if(m===undefined){m=P.length;P.push([(P[a][0]+P[b][0])/2,(P[a][1]+P[b][1])/2]);mid.set(k,m);}return m;};
  const quads=[];
  for(const f of faces){
    let cx=0,cz=0;f.forEach(i=>{cx+=P[i][0];cz+=P[i][1];});
    const ci=P.length;P.push([cx/f.length,cz/f.length]);
    const n=f.length,m=f.map((v,i)=>midOf(v,f[(i+1)%n]));
    for(let i=0;i<n;i++)quads.push([f[i],m[i],ci,m[(i+n-1)%n]]);
  }
  // relaxation vers des carrés
  for(let it=0;it<18;it++){
    const acc=P.map(()=>[0,0,0]);
    for(const q of quads){
      let cx=0,cz=0;q.forEach(i=>{cx+=P[i][0];cz+=P[i][1];});cx/=4;cz/=4;
      let ex=0,ez=0;
      for(let i=0;i<4;i++){const dx=P[q[i]][0]-cx,dz=P[q[i]][1]-cz;const a=-i*Math.PI/2,c=Math.cos(a),s=Math.sin(a);ex+=dx*c-dz*s;ez+=dx*s+dz*c;}
      ex/=4;ez/=4;
      for(let i=0;i<4;i++){const a=i*Math.PI/2,c=Math.cos(a),s=Math.sin(a);const tx=cx+ex*c-ez*s,tz=cz+ex*s+ez*c;const A=acc[q[i]];A[0]+=tx;A[1]+=tz;A[2]++;}
    }
    for(let i=0;i<P.length;i++){const A=acc[i];if(!A[2])continue;P[i][0]=lerp(P[i][0],A[0]/A[2],0.55);P[i][1]=lerp(P[i][1],A[1]/A[2],0.55);}
  }
  // cellules + voisinage
  const cells=quads.map(v=>{let cx=0,cz=0;v.forEach(i=>{cx+=P[i][0];cz+=P[i][1];});return {v,cx:cx/4,cz:cz/4,nb:[-1,-1,-1,-1]};});
  const em=new Map();
  cells.forEach((c,ci)=>{for(let e=0;e<4;e++){const a=c.v[e],b=c.v[(e+1)%4],k=a<b?a+'_'+b:b+'_'+a;const o=em.get(k);if(o){c.nb[e]=o[0];cells[o[0]].nb[o[1]]=ci;}else em.set(k,[ci,e]);}});
  return {V:P,cells};
}
const GRID=buildGrid(),V=GRID.V,cells=GRID.cells;
const cols=cells.map(()=>[]);       // cols[c][niveau] = index couleur

/* ---------- état ---------- */
const view={yaw:0.78,pitch:0.62,zoom:1,tx:0,tz:0,yawV:0};
const D=90;                              // distance caméra (quasi-orthographique)
let W=0,Hh=0,dpr=1,PXU=36;
let selColor=0,mode='build',showGrid=false,vol=0.6;
const undoStack=[],redoStack=[];
const spawn=new Map();                   // animation d'apparition
const ripples=[],parts=[];
let faces=[];
let ghost=null,press=null,holdRing=null;
let lastAmbient=0;

const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);

/* ---------- caméra ---------- */
let cs,sn,cp,sp,Cw;
function setupCam(){
  cs=Math.cos(view.yaw);sn=Math.sin(view.yaw);cp=Math.cos(view.pitch);sp=Math.sin(view.pitch);
  PXU=Math.min(W,Hh)*0.092*view.zoom;
  Cw=[view.tx-D*cp*sn,D*sp,view.tz-D*cp*cs];
}
function P3(x,y,z){
  x-=view.tx;z-=view.tz;
  const x1=x*cs-z*sn,z1=x*sn+z*cs;
  const yv=y*cp+z1*sp,zv=-y*sp+z1*cp+D;
  const k=PXU*D/zv;
  return [W/2+x1*k,Hh*0.54-yv*k,zv,k];
}
function unproject(sx,sy,planeY){
  const F=PXU*D;
  const a=(sx-W/2)/F,b=-(sy-Hh*0.54)/F; // direction vue (a,b,1)
  // base : x=a, yv=b, zv=1  → pré-pitch
  const x1=a,y1=b*cp-1*sp,z1=b*sp+1*cp;
  // direction monde
  const dx=x1*cs+z1*sn,dz=-x1*sn+z1*cs,dy=y1;
  if(dy>=-1e-4)return null;
  const t=(planeY-Cw[1])/dy;
  return [Cw[0]+dx*t,Cw[2]+dz*t];
}

/* ---------- audio ---------- */
let AC=null,master=null,ambGain=null;
function initAudio(){
  if(AC){if(AC.state==='suspended')AC.resume();return;}
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain();master.gain.value=vol;master.connect(AC.destination);
    // ambiance : bruit filtré + houle
    const len=AC.sampleRate*3,buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);
    let b0=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=0.985*b0+0.015*w;d[i]=b0*9;}
    const src=AC.createBufferSource();src.buffer=buf;src.loop=true;
    const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=520;
    ambGain=AC.createGain();ambGain.gain.value=0.06;
    const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=0.13;lg.gain.value=0.035;lfo.connect(lg);lg.connect(ambGain.gain);lfo.start();
    src.connect(lp);lp.connect(ambGain);ambGain.connect(master);src.start();
  }catch(e){AC=null;}
}
function noiseBurst(t,dur,freq,q,gain,type){
  const n=Math.floor(AC.sampleRate*dur),buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  const s=AC.createBufferSource();s.buffer=buf;
  const f=AC.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq;f.Q.value=q;
  const g=AC.createGain();g.gain.value=gain;s.connect(f);f.connect(g);g.connect(master);s.start(t);
}
function tone(t,freq,dur,gain,type){
  const o=AC.createOscillator(),g=AC.createGain();o.type=type||'triangle';o.frequency.value=freq;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+0.006);g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.05);
}
const PENTA=[0,2,4,7,9,12,14,16,19,21];
function sndPlace(level){
  if(!AC)return;const t=AC.currentTime;
  const note=PENTA[(level*2+((Math.random()*3)|0))%PENTA.length];
  const f=392*Math.pow(2,note/12)*(level===0?0.5:1);
  tone(t,f,0.5,0.22,'triangle');tone(t,f*2,0.3,0.06,'sine');
  if(level===0){noiseBurst(t,0.35,900,0.8,0.5);tone(t,120,0.25,0.25,'sine');}
  else noiseBurst(t,0.08,2400,1.2,0.18);
}
function sndRemove(){
  if(!AC)return;const t=AC.currentTime;
  const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.setValueAtTime(320,t);o.frequency.exponentialRampToValueAtTime(90,t+0.22);
  g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.26);o.connect(g);g.connect(master);o.start(t);o.stop(t+0.3);
  noiseBurst(t,0.25,700,0.7,0.35);
}
function sndTick(up){if(!AC)return;const t=AC.currentTime;tone(t,up?660:440,0.12,0.12,'sine');}

/* ---------- données / actions ---------- */
function applyChanges(chs,forward){
  if(forward)for(const ch of chs){const col=cols[ch.c];if(ch.nw===undefined){if(col.length>ch.l)col.length=ch.l;}else col[ch.l]=ch.nw;}
  else for(let i=chs.length-1;i>=0;i--){const ch=chs[i],col=cols[ch.c];if(ch.old===undefined){if(col.length>ch.l)col.length=ch.l;}else col[ch.l]=ch.old;}
  for(const c of new Set(chs.map(x=>x.c))){const col=cols[c];for(let l=0;l<col.length;l++)if(col[l]===undefined)col[l]=0;}
}
function doAdd(cell,level,color){
  const col=cols[cell];if(level<col.length||level>MAXL)return false;
  const chs=[];
  for(let l=col.length;l<=level;l++)chs.push({c:cell,l,old:undefined,nw:color});
  applyChanges(chs,true);
  const now=performance.now();chs.forEach((ch,i)=>spawn.set(ch.c*32+ch.l,now+i*60));
  commit(chs);
  const c=cells[cell];
  effectsPlace(c,level);sndPlace(level);
  return true;
}
function doRemove(cell,level){
  const col=cols[cell];if(level>=col.length)return false;
  const chs=[];for(let l=level;l<col.length;l++)chs.push({c:cell,l,old:col[l],nw:undefined});
  const c=cells[cell];
  chs.forEach(ch=>dust(c,ch.l,PAL[ch.old||0]));
  applyChanges(chs,true);
  commit(chs);sndRemove();
  if(navigator.vibrate)try{navigator.vibrate(12);}catch(e){}
  return true;
}
function commit(chs){undoStack.push(chs);if(undoStack.length>300)undoStack.shift();redoStack.length=0;updateUI();save();hideHint();}
function undo(){const chs=undoStack.pop();if(!chs){return;}applyChanges(chs,false);redoStack.push(chs);chs.forEach(ch=>spawn.delete(ch.c*32+ch.l));sndTick(false);updateUI();save();}
function redo(){const chs=redoStack.pop();if(!chs)return;applyChanges(chs,true);undoStack.push(chs);const now=performance.now();chs.forEach(ch=>{if(ch.nw!==undefined)spawn.set(ch.c*32+ch.l,now);});sndTick(true);updateUI();save();}

/* ---------- effets ---------- */
function blockY(l){return l===0?QH:QH+l*FH;}
function effectsPlace(c,level){
  const y=blockY(level);
  if(level===0){
    ripples.push({x:c.cx,z:c.cz,t:performance.now(),r:1.4});
    for(let i=0;i<14;i++){const a=Math.random()*TAU,s=1.2+Math.random()*2;parts.push({x:c.cx,y:QH,z:c.cz,vx:Math.cos(a)*s*0.7,vy:2.5+Math.random()*3,vz:Math.sin(a)*s*0.7,t:performance.now(),life:900,size:0.07+Math.random()*0.06,col:[235,250,255],g:9});}
  }else{
    for(let i=0;i<8;i++){const a=Math.random()*TAU;parts.push({x:c.cx,y:y-0.2,z:c.cz,vx:Math.cos(a)*0.9,vy:0.6+Math.random()*1.2,vz:Math.sin(a)*0.9,t:performance.now(),life:700,size:0.1+Math.random()*0.08,col:[255,255,255],g:1.5,fade:1});}
  }
}
function dust(c,l,col){
  const y=blockY(l)-FH*0.5;
  for(let i=0;i<10;i++){const a=Math.random()*TAU;parts.push({x:c.cx+Math.cos(a)*0.5,y:y+Math.random()*0.8,z:c.cz+Math.sin(a)*0.5,vx:Math.cos(a)*0.8,vy:0.8+Math.random(),vz:Math.sin(a)*0.8,t:performance.now(),life:800,size:0.12+Math.random()*0.1,col:mix(col,[255,255,255],0.4),g:1,fade:1});}
  if(l===0)ripples.push({x:c.cx,z:c.cz,t:performance.now(),r:1.2});
}

/* ---------- dessin : primitives ---------- */
function poly(pts,fill,stroke,lw){
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.lineJoin='round';ctx.stroke();}
}
function inPoly(pts,x,y){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function addFace(pts,cell,level,kind,edge){faces.push({pts,cell,level,kind,edge});}
function cellCenterDepth(c){return (c.cx-view.tx)*sn+(c.cz-view.tz)*cs;}
function facing(mx,mz,nx,nz){return (Cw[0]-mx)*nx+(Cw[2]-mz)*nz>0;}
function wallNormal(a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return [dz/l,-dx/l,l];}
function haze(f,z){return f;}

/* ---------- eau & fond ---------- */
function drawWater(now){
  let g=ctx.createLinearGradient(0,0,0,Hh);
  g.addColorStop(0,'#86b4b0');g.addColorStop(0.35,'#5aa0a2');g.addColorStop(0.7,'#348189');g.addColorStop(1,'#216069');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,Hh);
  g=ctx.createRadialGradient(W*0.5,Hh*0.3,0,W*0.5,Hh*0.3,Math.max(W,Hh)*0.75);
  g.addColorStop(0,'rgba(200,232,222,0.26)');g.addColorStop(1,'rgba(200,232,222,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,Hh);
  // reflets lents
  for(let i=0;i<5;i++){
    const t=now/1000*0.05+i*1.7,x=W*(0.5+0.42*Math.sin(t*1.3+i)),y=Hh*(0.4+0.35*Math.cos(t*0.9+i*2));
    const r=Math.min(W,Hh)*(0.35+0.1*Math.sin(t*2+i));
    const gg=ctx.createRadialGradient(x,y,0,x,y,r);gg.addColorStop(0,'rgba(255,255,255,0.045)');gg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gg;ctx.fillRect(0,0,W,Hh);
  }
}
function quadPts(c,scale,y,dx,dz){
  const out=[];
  for(let i=0;i<4;i++){const p=V[c.v[i]];out.push(P3(c.cx+(p[0]-c.cx)*scale+(dx||0),y,c.cz+(p[1]-c.cz)*scale+(dz||0)));}
  return out;
}
function drawWaterDecor(occ,now){
  if(!occ.length)return;
  // ombre claire sous l'eau
  ctx.beginPath();
  for(const ci of occ){const q=quadPts(cells[ci],1.1,-2.4,0.7,0.5);ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();}
  ctx.fillStyle='rgba(205,235,205,0.13)';ctx.fill();
  ctx.beginPath();
  for(const ci of occ){const q=quadPts(cells[ci],1.1,-1.2,0.3,0.2);ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();}
  ctx.fillStyle='rgba(200,235,215,0.10)';ctx.fill();
  // anneau de sable
  ctx.beginPath();
  for(const ci of occ){const q=quadPts(cells[ci],1.42,-0.02);ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();}
  ctx.fillStyle='rgba(222,214,172,0.42)';ctx.fill();
  ctx.beginPath();
  for(const ci of occ){const q=quadPts(cells[ci],1.2,-0.02);ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();}
  ctx.fillStyle='rgba(246,240,214,0.38)';ctx.fill();
  // ondes
  for(let i=ripples.length-1;i>=0;i--){
    const r=ripples[i],age=(now-r.t)/1700;
    if(age>1){ripples.splice(i,1);continue;}
    for(let k=0;k<2;k++){
      const a=clamp(age-k*0.18,0,1);if(a<=0)continue;
      const rad=0.6+a*(r.r+1.8),al=(1-a)*0.5;
      ctx.beginPath();
      for(let s=0;s<=28;s++){const t=s/28*TAU;const p=P3(r.x+Math.cos(t)*rad,0,r.z+Math.sin(t)*rad);if(s)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}
      ctx.strokeStyle='rgba(255,255,255,'+al.toFixed(3)+')';ctx.lineWidth=Math.max(1,PXU*0.06*(1-a));ctx.stroke();
    }
  }
  // ondes d'ambiance
  if(now-lastAmbient>1300){
    lastAmbient=now;const ci=occ[(Math.random()*occ.length)|0],c=cells[ci];
    if(cols[ci].length&&Math.random()<0.8){const e=(Math.random()*4)|0;const a=V[c.v[e]],b=V[c.v[(e+1)%4]];ripples.push({x:(a[0]+b[0])/2+(Math.random()-.5)*.5,z:(a[1]+b[1])/2+(Math.random()-.5)*.5,t:now,r:0.5});}
  }
}
function drawGrid(){
  const ext=[];
  ctx.beginPath();
  for(let ci=0;ci<cells.length;ci++){
    const c=cells[ci];const p=P3(c.cx,0,c.cz);
    if(p[0]<-80||p[0]>W+80||p[1]<-80||p[1]>Hh+80)continue;
    const q=quadPts(c,1,0);
    ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();
    const s=PXU*0.09;ctx.moveTo(p[0]-s,p[1]);ctx.lineTo(p[0]+s,p[1]);ctx.moveTo(p[0],p[1]-s*0.6);ctx.lineTo(p[0],p[1]+s*0.6);
  }
  ctx.strokeStyle='rgba(20,60,70,0.35)';ctx.lineWidth=1;ctx.stroke();
}

/* ---------- blocs ---------- */
function blockScale(ci,l,now){
  const t0=spawn.get(ci*32+l);if(t0===undefined)return 1;
  const a=(now-t0)/420;if(a>=1){spawn.delete(ci*32+l);return 1;}if(a<=0)return 0.0001;
  const c1=1.9,c3=c1+1;return Math.max(0.0001,1+c3*Math.pow(a-1,3)+c1*Math.pow(a-1,2));
}
function drawBox(x,z,w,y0,y1,col,ys){
  const hs=w/2,pts=[[x-hs,z-hs],[x+hs,z-hs],[x+hs,z+hs],[x-hs,z+hs]];
  for(let e=0;e<4;e++){
    const a=pts[e],b=pts[(e+1)%4];const nx=[0,1,0,-1][e],nz=[-1,0,1,0][e];
    if(!facing((a[0]+b[0])/2,(a[1]+b[1])/2,nx,nz))continue;
    const f=0.62+0.38*Math.max(0,nx*LIGHT[0]+nz*LIGHT[2]);
    poly([P3(a[0],ys(y0),a[1]),P3(b[0],ys(y0),b[1]),P3(b[0],ys(y1),b[1]),P3(a[0],ys(y1),a[1])],rgb(col,f));
  }
  poly(pts.map(p=>P3(p[0],ys(y1),p[1])),rgb(col,1.02));
}
function drawTree(c,ys,seed){
  const bx=c.cx+(hash3(seed,1,2)-0.5)*0.3,bz=c.cz+(hash3(seed,2,3)-0.5)*0.3;
  const base=P3(bx,ys(QH),bz),k=base[3];
  // tronc
  const top=P3(bx,ys(QH+0.45),bz);
  ctx.strokeStyle='#5a3f2c';ctx.lineWidth=Math.max(2,k*0.1);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base[0],base[1]);ctx.lineTo(top[0],top[1]);ctx.stroke();
  const gcol=[[74,160,84],[92,176,88],[64,140,92]][(hash3(seed,5,1)*3)|0];
  const R=k*(0.5+hash3(seed,4,4)*0.12);
  const blobs=[[0,-R*1.3,R],[-R*0.5,-R*0.8,R*0.78],[R*0.5,-R*0.85,R*0.78]];
  for(const [ox,oy,r] of blobs){
    const gx=top[0]+ox,gy=top[1]+oy;
    const g=ctx.createRadialGradient(gx-r*0.3,gy-r*0.35,r*0.1,gx,gy,r);
    g.addColorStop(0,rgb(gcol,1.25));g.addColorStop(1,rgb(gcol,0.72));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(gx,gy,r,0,TAU);ctx.fill();
  }
}
function drawWindow(a,b,y0,y1,u,wU,v0,v1,ys,ci,l,e,wallCol,lampLit){
  { const A=P3(a[0],y0,a[1]),B=P3(b[0],y0,b[1]); if(Math.abs(A[0]-B[0])<PXU*0.55) return; }
  const p=(uu,vv)=>P3(lerp(a[0],b[0],uu),ys(lerp(y0,y1,vv)),lerp(a[1],b[1],uu));
  const u0=u-wU/2,u1=u+wU/2;
  const q=[p(u0,v0),p(u1,v0),p(u1,v1),p(u0,v1)];
  const k=q[0][3];
  poly(q,rgb([44,64,80],1),null);
  // reflet
  poly([p(u0,lerp(v0,v1,0.5)),p(u1,lerp(v0,v1,0.5)),p(u1,v1),p(u0,v1)],'rgba(150,190,215,0.28)',null);
  ctx.strokeStyle='#f6efe2';ctx.lineWidth=Math.max(1.2,k*0.07);ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();ctx.stroke();
  // croisillon
  const m1=p(u,v0),m2=p(u,v1),m3=p(u0,(v0+v1)/2),m4=p(u1,(v0+v1)/2);
  ctx.lineWidth=Math.max(1,k*0.04);ctx.beginPath();ctx.moveTo(m1[0],m1[1]);ctx.lineTo(m2[0],m2[1]);ctx.moveTo(m3[0],m3[1]);ctx.lineTo(m4[0],m4[1]);ctx.stroke();
  // volets
  if(hash3(ci,l,e+40)<0.45){
    const sc=mix(wallCol,[40,100,110],0.55);
    const s1=[p(u0-0.1,v0),p(u0-0.01,v0),p(u0-0.01,v1),p(u0-0.1,v1)],s2=[p(u1+0.01,v0),p(u1+0.1,v0),p(u1+0.1,v1),p(u1+0.01,v1)];
    poly(s1,rgb(sc,0.9));poly(s2,rgb(sc,0.9));
  }
}
function drawDoor(a,b,y0,y1,u,ys){
  const p=(uu,vv)=>P3(lerp(a[0],b[0],uu),ys(lerp(y0,y1,vv)),lerp(a[1],b[1],uu));
  const q=[p(u-0.17,0.0),p(u+0.17,0.0),p(u+0.17,0.66),p(u,0.78),p(u-0.17,0.66)];
  poly(q,'#7a4a30',null);
  const k=q[0][3];ctx.strokeStyle='#f6efe2';ctx.lineWidth=Math.max(1.2,k*0.07);ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<5;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();ctx.stroke();
  const kn=p(u+0.1,0.34);ctx.fillStyle='#f3d27a';ctx.beginPath();ctx.arc(kn[0],kn[1],Math.max(1,k*0.04),0,TAU);ctx.fill();
  // marche
  poly([p(u-0.2,0),p(u+0.2,0),p(u+0.2,-0.08),p(u-0.2,-0.08)],'#b9b0a8',null);
}

function drawBlock(ci,l,now){
  const c=cells[ci],col=cols[ci],color=PAL[col[l]||0],top=l===col.length-1;
  const s=blockScale(ci,l,now);
  const yb=l===0?BOTTOM:QH+(l-1)*FH;
  const ys=s===1?(y=>y):(y=>yb+(y-yb)*s);
  const y0=l===0?BOTTOM:QH+(l-1)*FH,y1=l===0?QH:QH+l*FH;
  const q=c.v.map(i=>V[i]);
  for(let e=0;e<4;e++){
    const n=c.nb[e];if(n>=0&&cols[n].length>l)continue;
    const a=q[e],b=q[(e+1)%4];
    const [nx,nz,len]=wallNormal(a,b);
    if(!facing((a[0]+b[0])/2,(a[1]+b[1])/2,nx,nz))continue;
    const f=0.6+0.4*Math.max(0,nx*LIGHT[0]+nz*LIGHT[2]);
    if(l===0){
      // sous l'eau (fondu)
      const w0=P3(a[0],ys(BOTTOM),a[1]),w1=P3(b[0],ys(BOTTOM),b[1]),w2=P3(b[0],ys(0),b[1]),w3=P3(a[0],ys(0),a[1]);
      let g=ctx.createLinearGradient(0,(w0[1]+w1[1])/2,0,(w2[1]+w3[1])/2);
      g.addColorStop(0,'rgba('+STONE.map(v=>v*f|0).join(',')+',0)');g.addColorStop(1,'rgba('+STONE.map(v=>v*f*0.75|0).join(',')+',0.8)');
      poly([w0,w1,w2,w3],g);
      // pierre émergée
      const bandY=QH-0.17;
      const s0=P3(a[0],ys(0),a[1]),s1=P3(b[0],ys(0),b[1]),s2=P3(b[0],ys(bandY),b[1]),s3=P3(a[0],ys(bandY),a[1]);
      g=ctx.createLinearGradient(0,s3[1],0,s0[1]);g.addColorStop(0,rgb(STONE,f*1.05));g.addColorStop(1,rgb(STONE,f*0.72,0.15));
      poly([s0,s1,s2,s3],g);
      // briques
      ctx.strokeStyle='rgba(40,28,40,0.22)';ctx.lineWidth=1;ctx.beginPath();
      for(let r=1;r<3;r++){const yy=lerp(0,bandY,r/3);const p1=P3(a[0],ys(yy),a[1]),p2=P3(b[0],ys(yy),b[1]);ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);}
      for(let r=0;r<3;r++)for(let u=0.2+(r%2)*0.25;u<1;u+=0.5){const p1=P3(lerp(a[0],b[0],u),ys(lerp(0,bandY,r/3)),lerp(a[1],b[1],u)),p2=P3(lerp(a[0],b[0],u),ys(lerp(0,bandY,(r+1)/3)),lerp(a[1],b[1],u));ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);}
      ctx.stroke();
      // bandeau coloré
      const t0=P3(a[0],ys(bandY),a[1]),t1=P3(b[0],ys(bandY),b[1]),t2=P3(b[0],ys(QH),b[1]),t3=P3(a[0],ys(QH),a[1]);
      poly([t0,t1,t2,t3],rgb(color,f*1.0),'rgba(0,0,0,0.12)',1);
      addFace([s0,s1,t2,t3],ci,l,'side',e);
    }else{
      const p0=P3(a[0],ys(y0),a[1]),p1=P3(b[0],ys(y0),b[1]),p2=P3(b[0],ys(y1),b[1]),p3=P3(a[0],ys(y1),a[1]);
      const g=ctx.createLinearGradient(0,p3[1],0,p0[1]);g.addColorStop(0,rgb(color,f*1.03));g.addColorStop(1,rgb(color,f*0.86,0.08));
      poly([p0,p1,p2,p3],g);
      // pied de mur / corniche
      ctx.strokeStyle='rgba(0,0,0,0.16)';ctx.lineWidth=Math.max(1,p0[3]*0.035);ctx.beginPath();ctx.moveTo(p3[0],p3[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();
      if(l>1){ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke();}
      // fenêtres / portes
      const h=hash3(ci,l,e+7);
      const door=l===1&&hash3(ci,e,99)<0.4;
      if(len>0.9){
        if(door&&hash3(ci,l,5)<0.6)drawDoor(a,b,y0,y1,0.5,ys);
        else if(h<0.42)drawWindow(a,b,y0,y1,0.5,0.34*1.5/Math.max(len,1.2),0.3,0.78,ys,ci,l,e,color);
        else if(h<0.72){const w=0.22*1.5/Math.max(len,1.2);drawWindow(a,b,y0,y1,0.29,w,0.3,0.78,ys,ci,l,e,color);drawWindow(a,b,y0,y1,0.71,w,0.3,0.78,ys,ci,l,e,color);}
        else if(h<0.86){drawWindow(a,b,y0,y1,0.5,0.3*1.5/Math.max(len,1.2),0.34,0.82,ys,ci,l,e,color);
          // jardinière
          const pf=(u,v)=>P3(lerp(a[0],b[0],u),ys(lerp(y0,y1,v)),lerp(a[1],b[1],u));poly([pf(0.34,0.24),pf(0.66,0.24),pf(0.66,0.33),pf(0.34,0.33)],'#7a5a44');poly([pf(0.34,0.33),pf(0.66,0.33),pf(0.64,0.4),pf(0.36,0.4)],'#e46c8c');}
      }
      addFace([p0,p1,p2,p3],ci,l,'side',e);
    }
  }
  if(!top)return;
  if(l===0){
    // dessus du quai
    const tp=q.map(p=>P3(p[0],ys(QH),p[1]));
    poly(tp,rgb([164,154,166],1),'rgba(50,40,60,0.35)',1);
    // pavage
    ctx.strokeStyle='rgba(60,50,70,0.18)';ctx.lineWidth=1;ctx.beginPath();
    const m=[0,1].map(i=>[(q[i][0]+q[i+2][0])/2,(q[i][1]+q[i+2][1])/2]);
    for(let i=0;i<2;i++){const a=P3((q[i][0]+q[i+1][0])/2,ys(QH),(q[i][1]+q[i+1][1])/2),b=P3((q[i+2][0]+q[(i+3)%4][0])/2,ys(QH),(q[i+2][1]+q[(i+3)%4][1])/2);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
    ctx.stroke();
    addFace(tp,ci,l,'top');
    // garde-corps sur les bords libres
    for(let e=0;e<4;e++){
      const n=c.nb[e];if(n>=0&&cols[n].length>0)continue;
      const a=q[e],b=q[(e+1)%4];
      const [nx,nz]=wallNormal(a,b);
      const ia=[lerp(a[0],c.cx,0.07),lerp(a[1],c.cz,0.07)],ib=[lerp(b[0],c.cx,0.07),lerp(b[1],c.cz,0.07)];
      const r0=P3(ia[0],ys(QH+0.32),ia[1]),r1=P3(ib[0],ys(QH+0.32),ib[1]),g0=P3(ia[0],ys(QH),ia[1]),g1=P3(ib[0],ys(QH),ib[1]);
      const k=r0[3];ctx.strokeStyle='rgba(38,42,52,0.95)';ctx.lineCap='round';
      ctx.lineWidth=Math.max(1.2,k*0.045);ctx.beginPath();ctx.moveTo(r0[0],r0[1]);ctx.lineTo(r1[0],r1[1]);ctx.stroke();
      ctx.lineWidth=Math.max(1,k*0.03);ctx.beginPath();
      for(let t=0;t<=1.001;t+=0.25){const x=lerp(ia[0],ib[0],t),z=lerp(ia[1],ib[1],t);const pb=P3(x,ys(QH),z),pt=P3(x,ys(QH+0.32),z);ctx.moveTo(pb[0],pb[1]);ctx.lineTo(pt[0],pt[1]);}
      ctx.stroke();
    }
    // végétation
    const hasHouseNb=c.nb.some(n=>n>=0&&cols[n].length>1);
    if(hasHouseNb&&hash3(ci,3,3)<0.62)drawTree(c,ys,ci);
    else if(hash3(ci,8,8)<0.16){drawBox(c.cx,c.cz,0.34,QH,QH+0.28,[160,112,70],ys);}
  }else drawRoof(ci,l,y1,color,ys);
}

function drawRoof(ci,l,y1,wallCol,ys){
  const c=cells[ci],q=c.v.map(i=>V[i]),floors=l;
  const rc=ROOFS[(hash3(ci,l,11)*ROOFS.length)|0];
  const ex=q.map(p=>[c.cx+(p[0]-c.cx)*1.08,c.cz+(p[1]-c.cz)*1.08]);
  const yE=y1-0.05;
  const L01=Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]),L12=Math.hypot(q[2][0]-q[1][0],q[2][1]-q[1][1]);
  const tower=floors>=4;
  const hip=tower||hash3(ci,l,13)<0.2;
  const draw3=(pts3,base,id,kind,faceEdge)=>{
    // normal
    const A=pts3[0],B=pts3[1],C=pts3[2];
    let ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],vx=C[0]-A[0],vy=C[1]-A[1],vz=C[2]-A[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
    // orienter vers l'extérieur
    const cxm=(A[0]+B[0]+C[0])/3,cym=(A[1]+B[1]+C[1])/3,czm=(A[2]+B[2]+C[2])/3;
    if(nx*(cxm-c.cx)+ny*(cym-(y1))+nz*(czm-c.cz)<0){nx=-nx;ny=-ny;nz=-nz;}
    if((Cw[0]-cxm)*nx+(Cw[1]-cym)*ny+(Cw[2]-czm)*nz<=0)return null;
    const f=0.52+0.48*Math.max(0,nx*LIGHT[0]+ny*LIGHT[1]+nz*LIGHT[2]);
    const sp=pts3.map(p=>P3(p[0],ys(p[1]),p[2]));
    poly(sp,rgb(base,f),'rgba(0,0,0,0.14)',1);
    addFace(sp,ci,l,'top');
    return sp;
  };
  if(hip){
    const RH=tower?1.55:0.85;
    const ap=[c.cx,y1+RH,c.cz];
    for(let e=0;e<4;e++){
      const a=ex[e],b=ex[(e+1)%4];
      const sp=draw3([[a[0],yE,a[1]],[b[0],yE,b[1]],ap],rc,0);
      if(sp){ctx.strokeStyle='rgba(0,0,0,0.12)';ctx.lineWidth=Math.max(1,sp[0][3]*0.03);ctx.beginPath();for(let t=0.3;t<0.95;t+=0.22){const p1=P3(lerp(a[0],ap[0],t),ys(lerp(yE,ap[1],t)),lerp(a[1],ap[2],t)),p2=P3(lerp(b[0],ap[0],t),ys(lerp(yE,ap[1],t)),lerp(b[1],ap[2],t));ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);}ctx.stroke();}
    }
    return;
  }
  const shift=L01>=L12?0:1;
  const I=k=>(shift+k)%4;
  const a=ex[I(0)],b=ex[I(1)],cc=ex[I(2)],d=ex[I(3)];
  const wmin=Math.min(L01,L12);
  const RH=0.42*wmin+0.2;
  const R1=[(b[0]+cc[0])/2,y1+RH,(b[1]+cc[1])/2],R2=[(d[0]+a[0])/2,y1+RH,(d[1]+a[1])/2];
  // pignons
  const gA=I(1),gB=I(3);
  const gab=(e,Ra)=>{
    const nb=c.nb[e];if(nb>=0&&cols[nb].length>=l)return;
    const p=q[e],r=q[(e+1)%4];
    const [nx,nz]=wallNormal(p,r);
    if(!facing((p[0]+r[0])/2,(p[1]+r[1])/2,nx,nz))return;
    const sp=[P3(p[0],ys(y1),p[1]),P3(r[0],ys(y1),r[1]),P3(Ra[0],ys(Ra[1]),Ra[2])];
    const f=0.6+0.4*Math.max(0,nx*LIGHT[0]+nz*LIGHT[2]);
    poly(sp,rgb(wallCol,f),'rgba(0,0,0,0.12)',1);addFace(sp,ci,l,'top');
  };
  gab(gA,R1);gab(gB,R2);
  const sl=(p0,p1,p2,p3)=>{
    const sp=draw3([[p0[0],yE,p0[1]],[p1[0],yE,p1[1]],[p2[0],p2[1],p2[2]]],rc,0);
    // 4e point : refait le polygone complet
    return sp;
  };
  // pentes (quad) : on dessine comme deux triangles pour la normale, mais en un seul polygone
  const slope=(p0,p1,r1,r2)=>{
    const A=[p0[0],yE,p0[1]],B=[p1[0],yE,p1[1]];
    let ux=B[0]-A[0],uy=0,uz=B[2]-A[2],vx=r2[0]-A[0],vy=r2[1]-A[1],vz=r2[2]-A[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
    if(ny<0){nx=-nx;ny=-ny;nz=-nz;}
    const mx=(p0[0]+p1[0]+r1[0]+r2[0])/4,my=(yE*2+r1[1]+r2[1])/4,mz=(p0[1]+p1[1]+r1[2]+r2[2])/4;
    if((Cw[0]-mx)*nx+(Cw[1]-my)*ny+(Cw[2]-mz)*nz<=0)return;
    const f=0.52+0.48*Math.max(0,nx*LIGHT[0]+ny*LIGHT[1]+nz*LIGHT[2]);
    const sp=[P3(p0[0],ys(yE),p0[1]),P3(p1[0],ys(yE),p1[1]),P3(r1[0],ys(r1[1]),r1[2]),P3(r2[0],ys(r2[1]),r2[2])];
    poly(sp,rgb(rc,f),'rgba(0,0,0,0.14)',1);addFace(sp,ci,l,'top');
    // tuiles
    ctx.strokeStyle='rgba(60,25,10,0.16)';ctx.lineWidth=Math.max(1,sp[0][3]*0.03);ctx.beginPath();
    for(let t=0.25;t<0.9;t+=0.25){const e1=P3(lerp(p0[0],r2[0],t),ys(lerp(yE,r2[1],t)),lerp(p0[1],r2[2],t)),e2=P3(lerp(p1[0],r1[0],t),ys(lerp(yE,r1[1],t)),lerp(p1[1],r1[2],t));ctx.moveTo(e1[0],e1[1]);ctx.lineTo(e2[0],e2[1]);}
    ctx.stroke();
    // bord d'avant-toit
    ctx.strokeStyle=rgb(rc,f*0.7);ctx.lineWidth=Math.max(1.5,sp[0][3]*0.06);ctx.beginPath();ctx.moveTo(sp[0][0],sp[0][1]);ctx.lineTo(sp[1][0],sp[1][1]);ctx.stroke();
  };
  slope(a,b,R1,R2);
  slope(cc,d,R2,R1);
  // cheminée
  if(hash3(ci,l,21)>0.72){
    const cxp=lerp(R1[0],R2[0],0.35),czp=lerp(R1[2],R2[2],0.35);
    drawBox(cxp,czp,0.3,y1+RH*0.7,y1+RH+0.4,[150,90,80],ys);
  }
}

/* ---------- fantôme / aperçu ---------- */
function drawGhost(now){
  if(!ghost)return;
  const rem=ghost.type==='remove';
  const ci=ghost.cell,l=ghost.level,c=cells[ci];
  const fill=rem?'rgba(255,80,70,0.38)':rgb(PAL[selColor],1).replace('rgb','rgba').replace(')',',0.55)');
  const y0=l===0?0:QH+(l-1)*FH,y1=l===0?QH:QH+l*FH;
  const q=c.v.map(i=>V[i]);
  ctx.save();
  for(let e=0;e<4;e++){
    const a=q[e],b=q[(e+1)%4];const [nx,nz]=wallNormal(a,b);
    if(!facing((a[0]+b[0])/2,(a[1]+b[1])/2,nx,nz))continue;
    poly([P3(a[0],y0,a[1]),P3(b[0],y0,b[1]),P3(b[0],y1,b[1]),P3(a[0],y1,a[1])],fill,'rgba(255,255,255,0.9)',2);
  }
  const yt=rem&&l>0?y1:y1;
  poly(q.map(p=>P3(p[0],yt,p[1])),fill,'rgba(255,255,255,0.95)',2);
  ctx.restore();
}

/* ---------- particules ---------- */
function drawParticles(now){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i],age=now-p.t;
    if(age>p.life){parts.splice(i,1);continue;}
    const t=age/1000;
    const x=p.x+p.vx*t,y=p.y+p.vy*t-0.5*p.g*t*t,z=p.z+p.vz*t;
    if(y<0&&!p.fade&&p.g>5){parts.splice(i,1);continue;}
    const s=P3(x,y,z),a=1-age/p.life;
    ctx.fillStyle='rgba('+(p.col[0]|0)+','+(p.col[1]|0)+','+(p.col[2]|0)+','+(p.fade?a*0.55:Math.min(1,a*1.6)).toFixed(3)+')';
    ctx.beginPath();ctx.arc(s[0],s[1],Math.max(1,s[3]*p.size*(p.fade?(1.4-a*0.4):1)),0,TAU);ctx.fill();
  }
}

/* ---------- frame ---------- */
function frame(now){
  requestAnimationFrame(frame);
  // inertie de rotation
  if(Math.abs(view.yawV)>1e-4&&!(press&&press.drag)){view.yaw+=view.yawV;view.yawV*=0.93;}
  setupCam();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawWater(now);
  const occ=[];for(let i=0;i<cells.length;i++)if(cols[i].length)occ.push(i);
  if(showGrid)drawGrid();
  drawWaterDecor(occ,now);
  faces=[];
  occ.sort((a,b)=>cellCenterDepth(cells[b])-cellCenterDepth(cells[a]));
  for(const ci of occ){const n=cols[ci].length;for(let l=0;l<n;l++)drawBlock(ci,l,now);}
  drawGhost(now);
  drawParticles(now);
  if(holdRing){
    const a=clamp((now-holdRing.t)/holdRing.d,0,1);
    ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(holdRing.x,holdRing.y,22,-Math.PI/2,-Math.PI/2+a*TAU);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(holdRing.x,holdRing.y,22,0,TAU);ctx.stroke();
  }
  // vignette
  const g=ctx.createRadialGradient(W/2,Hh*0.5,Math.min(W,Hh)*0.45,W/2,Hh*0.5,Math.max(W,Hh)*0.85);
  g.addColorStop(0,'rgba(8,40,52,0)');g.addColorStop(1,'rgba(8,40,52,0.28)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,Hh);
}

/* ---------- sélection (picking) ---------- */
function findCell(x,z){
  let best=-1;
  for(let i=0;i<cells.length;i++){
    const c=cells[i];if(Math.abs(c.cx-x)>2.6||Math.abs(c.cz-z)>2.6)continue;
    const pts=c.v.map(k=>V[k]);let inside=true,sgn=0;
    for(let e=0;e<4;e++){const a=pts[e],b=pts[(e+1)%4];const cr=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);if(cr<0){inside=false;break;}}
    if(inside){best=i;break;}
  }
  return best;
}
function pickTarget(sx,sy){
  for(let i=faces.length-1;i>=0;i--){
    const f=faces[i];
    if(!inPoly(f.pts,sx,sy))continue;
    const res={rem:{cell:f.cell,level:f.level}};
    if(f.kind==='top'){res.add={cell:f.cell,level:f.level+1};}
    else{const n=cells[f.cell].nb[f.edge];if(n>=0)res.add={cell:n,level:f.level};}
    if(res.add&&(res.add.level>MAXL||cols[res.add.cell].length>res.add.level))res.add=null;
    return res;
  }
  const g=unproject(sx,sy,0);
  if(g){const ci=findCell(g[0],g[1]);if(ci>=0&&cols[ci].length===0)return {add:{cell:ci,level:0},rem:null};}
  return null;
}
function setGhost(t){
  if(!t){ghost=null;return;}
  if(mode==='demolish'){ghost=t.rem?{type:'remove',cell:t.rem.cell,level:t.rem.level}:null;}
  else ghost=t.add?{type:'add',cell:t.add.cell,level:t.add.level}:null;
}
function act(t,forceRemove){
  if(!t)return;
  if(forceRemove||mode==='demolish'){if(t.rem)doRemove(t.rem.cell,t.rem.level);}
  else if(t.add)doAdd(t.add.cell,t.add.level,selColor);
}

/* ---------- entrées tactiles / souris ---------- */
const pointers=new Map();
let pinch=null,holdTimer=null;
function pos(e){return {x:e.clientX,y:e.clientY};}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);initAudio();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,t:e.timeStamp});
  if(pointers.size===1){
    const t=pickTarget(e.clientX,e.clientY);
    press={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,drag:false,done:false,target:t,right:e.button===2,pt:e.pointerType};
    setGhost(t);
    clearTimeout(holdTimer);
    if(e.pointerType!=='mouse'||e.button===0){
      holdRing=null;
      const delay=520;
      setTimeout(()=>{if(press&&!press.drag&&!press.done&&pointers.size===1){holdRing={x:press.sx,y:press.sy,t:performance.now(),d:delay-120};}},120);
      holdTimer=setTimeout(()=>{
        if(press&&!press.drag&&!press.done&&pointers.size===1){press.done=true;holdRing=null;
          if(mode==='build'){act(press.target,true);}else{/* en démolition l'appui long bâtit */const t=press.target;if(t&&t.add)doAdd(t.add.cell,t.add.level,selColor);}
          ghost=null;}
      },delay);
    }
  }else if(pointers.size===2){
    if(press){press.drag=true;press.done=true;}
    clearTimeout(holdTimer);holdRing=null;ghost=null;
    const [a,b]=[...pointers.values()];
    pinch={d:Math.hypot(a.x-b.x,a.y-b.y),zoom:view.zoom,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,ang:Math.atan2(b.y-a.y,b.x-a.x),yaw:view.yaw};
  }
});
cv.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);
  if(!p){ // survol souris
    if(e.pointerType==='mouse'&&!e.buttons){faces&&setGhost(pickTarget(e.clientX,e.clientY));}
    return;
  }
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(pointers.size===1&&press){
    if(!press.drag&&Math.hypot(e.clientX-press.sx,e.clientY-press.sy)>(press.pt==='mouse'?5:10)){press.drag=true;clearTimeout(holdTimer);holdRing=null;ghost=null;}
    if(press.drag&&!press.done||press.drag&&press.done&&pointers.size===1&&press.moved){}
    if(press.drag){
      view.yaw-=dx*0.0085;view.yawV=-dx*0.0085*0.6;
      view.pitch=clamp(view.pitch+dy*0.0045,0.3,1.2);
      press.moved=true;
    }else{ghost&&setGhost(pickTarget(e.clientX,e.clientY));press.target=pickTarget(e.clientX,e.clientY);setGhost(press.target);}
  }else if(pointers.size===2&&pinch){
    const [a,b]=[...pointers.values()];
    const d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    view.zoom=clamp(pinch.zoom*d/Math.max(d,1)*(d/pinch.d),0.35,2.6);
    // déplacement (pan) selon le centre
    const dxs=mx-pinch.mx,dys=my-pinch.my,sc=1/PXU,sf=1/(PXU*Math.max(sp,0.3));
    view.tx+=-cs*dxs*sc+sn*dys*sf;
    view.tz+=sn*dxs*sc+cs*dys*sf;
    view.tx=clamp(view.tx,-32,32);view.tz=clamp(view.tz,-32,32);
    pinch.mx=mx;pinch.my=my;
    // rotation à deux doigts
    const ang=Math.atan2(b.y-a.y,b.x-a.x);let da=ang-pinch.ang;while(da>Math.PI)da-=TAU;while(da<-Math.PI)da+=TAU;
    view.yaw=pinch.yaw-da;
  }
});
function endPointer(e){
  const had=pointers.has(e.pointerId);if(!had)return;
  pointers.delete(e.pointerId);
  if(pointers.size===0&&press){
    clearTimeout(holdTimer);holdRing=null;
    if(!press.drag&&!press.done){
      if(press.right||e.button===2){act(press.target,true);}
      else if(e.type!=='pointercancel')act(press.target,false);
    }
    press=null;ghost=null;
    if(e.pointerType==='mouse')setGhost(pickTarget(e.clientX,e.clientY));
  }
  if(pointers.size<2)pinch=null;
  if(pointers.size===1){const r=[...pointers.values()][0];press=null;}
}
cv.addEventListener('pointerup',endPointer);cv.addEventListener('pointercancel',endPointer);
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!press)ghost=null;});
cv.addEventListener('wheel',e=>{e.preventDefault();view.zoom=clamp(view.zoom*Math.exp(-e.deltaY*0.0012),0.35,2.6);},{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('touchmove',e=>{if(e.target===cv)e.preventDefault();},{passive:false});
window.addEventListener('keydown',e=>{
  if(e.key==='z'&&(e.ctrlKey||e.metaKey)){e.shiftKey?redo():undo();}
  else if(e.key==='y'&&(e.ctrlKey||e.metaKey))redo();
  else if(e.key==='ArrowLeft')view.yaw-=0.15;else if(e.key==='ArrowRight')view.yaw+=0.15;
  else if(e.key==='g')toggleGrid();else if(e.key==='x')toggleMode();
});

/* ---------- interface ---------- */
function updateUI(){
  $('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;
  $('undoN').textContent=undoStack.length;$('pUndoN').textContent=undoStack.length||'–';$('pRedoN').textContent=redoStack.length||'–';
  $('pUndo').classList.toggle('dis',!undoStack.length);$('pRedo').classList.toggle('dis',!redoStack.length);
}
function toggleGrid(){showGrid=!showGrid;$('tGrid').classList.toggle('on',showGrid);}
function toggleMode(){mode=mode==='build'?'demolish':'build';$('mode').classList.toggle('on',mode==='demolish');$('tMode').classList.toggle('on',mode==='demolish');ghost=null;}
function hideHint(){$('hint').classList.add('gone');}
const pal=$('palette');
PALETTE_HEX.forEach((h,i)=>{
  const b=document.createElement('button');b.className='chip'+(i===0?' sel':'');b.style.background=h;b.setAttribute('aria-label','Couleur '+(i+1));
  b.addEventListener('click',()=>{selColor=i;initAudio();[...pal.children].forEach((c,j)=>c.classList.toggle('sel',j===i));b.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});if(AC)tone(AC.currentTime,300*Math.pow(2,PENTA[i%10]/12),0.2,0.08,'sine');if(mode==='demolish')toggleMode();});
  pal.appendChild(b);
});
$('undo').onclick=undo;$('redo').onclick=redo;$('pUndo').onclick=undo;$('pRedo').onclick=redo;
$('mode').onclick=toggleMode;$('tMode').onclick=toggleMode;$('tGrid').onclick=toggleGrid;
$('gear').onclick=()=>{document.body.classList.add('open');$('panel').setAttribute('aria-hidden','false');initAudio();};
$('close').onclick=()=>{document.body.classList.remove('open');$('panel').setAttribute('aria-hidden','true');};
$('rotL').onclick=()=>{view.yaw-=Math.PI/4;};$('rotR').onclick=()=>{view.yaw+=Math.PI/4;};
$('zoomIn').onclick=()=>{view.zoom=clamp(view.zoom*1.25,0.35,2.6);};$('zoomOut').onclick=()=>{view.zoom=clamp(view.zoom/1.25,0.35,2.6);};
$('camReset').onclick=()=>{view.yaw=0.78;view.pitch=0.62;view.zoom=1;centerView();};
$('vol').oninput=e=>{vol=+e.target.value;if(master)master.gain.value=vol;$('volIco').textContent=vol===0?'🔇':'🔊';try{localStorage.setItem('havre_vol',vol);}catch(_){}};
$('shot').onclick=()=>{cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='havre.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);});};
$('clear').onclick=()=>{if(!confirm("Effacer l'île et recommencer ?"))return;cols.forEach(c=>c.length=0);undoStack.length=0;redoStack.length=0;seedTown();updateUI();save();$('close').click();};

/* ---------- sauvegarde / ville de départ ---------- */
function save(){try{const o={};cols.forEach((c,i)=>{if(c.length)o[i]=c;});localStorage.setItem('havre_save_v1',JSON.stringify(o));}catch(_){}}
function load(){try{const s=localStorage.getItem('havre_save_v1');if(!s)return false;const o=JSON.parse(s);let n=0;for(const k in o){if(cols[k]){cols[k]=o[k];n++;}}return n>0;}catch(_){return false;}}
function nearestCell(x,z){let b=0,bd=1e9;cells.forEach((c,i)=>{const d=(c.cx-x)**2+(c.cz-z)**2;if(d<bd){bd=d;b=i;}});return b;}
function seedTown(){
  const c0=nearestCell(0,0),c=cells[c0];
  const sy=Math.sin(0.78),cy=Math.cos(0.78);
  const dep=n=>(cells[n].cx*sy+cells[n].cz*cy);
  const nbs=c.nb.filter(n=>n>=0).sort((a,b)=>dep(a)-dep(b)); // plus proches de la caméra d'abord
  cols[c0]=[0,0,0,0];
  if(nbs[0]!==undefined)cols[nbs[0]]=[2,2,2];
  if(nbs[1]!==undefined)cols[nbs[1]]=[0];
  if(nbs[2]!==undefined)cols[nbs[2]]=[0,2];
}
function centerView(){
  let sx=0,sz=0,n=0;cols.forEach((c,i)=>{if(c.length){sx+=cells[i].cx;sz+=cells[i].cz;n++;}});
  if(n){view.tx=sx/n;view.tz=sz/n;}else{view.tx=0;view.tz=0;}
}

/* ---------- init ---------- */
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;Hh=window.innerHeight;
  cv.width=Math.round(W*dpr);cv.height=Math.round(Hh*dpr);
}
window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,200));
resize();
try{const v=localStorage.getItem('havre_vol');if(v!==null){vol=+v;$('vol').value=vol;}}catch(_){}
if(!load())seedTown(); else hideHint();
centerView();updateUI();
window.__havre={cols,cells,view,doAdd,doRemove,undo,redo,get faces(){return faces;},pickTarget};
requestAnimationFrame(frame);
})();
