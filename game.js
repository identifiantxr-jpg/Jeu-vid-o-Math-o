(function(){

const T=THREE,sc=new T.Scene(),$=id=>document.getElementById(id);
const cam=new T.PerspectiveCamera(75,innerWidth/innerHeight,.1,400);const AVg=AV(T,sc),SPg=mkSprint();let KX=0,KZ=0;const pushCd={};
const ren=new T.WebGLRenderer({antialias:true});ren.setSize(innerWidth,innerHeight);ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.shadowMap.enabled=true;ren.shadowMap.type=T.PCFSoftShadowMap;
document.body.appendChild(ren.domElement);
const GFX={r:Math.min(devicePixelRatio,2),f:.0167,c:0,w:0,tex:null,rt:null,pm:null,bl:null,fx:null,ray:0,v:new T.Vector3(),d:new T.Vector3(),s:new T.Vector3()};GFX.max=GFX.r;
const hemi=new T.HemisphereLight(0xffffff,0x333333,1),sun=new T.DirectionalLight(0xffffff,.95);sun.position.set(20,40,-10);sc.add(hemi,sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);{const c=sun.shadow.camera;c.left=c.bottom=-45;c.right=c.top=45;c.near=1;c.far=220}sun.shadow.bias=-.0006;sun.shadow.normalBias=.04;
if(!window.WORLDS)throw new Error('Charge les fichiers world-*.js AVANT game.js dans index.html');
const WORLD_ORDER=['neon','glace','lave','ciel','cosmos','lobby'],W=WORLD_ORDER.map(id=>WORLDS[id].cfg);  // les mondes vivent dans world-*.js
// ---------- audio ----------
let AC,mg,step=0,nextT=0,muted=false;
function startAudio(){if(AC){AC.resume();return}AC=new(window.AudioContext||window.webkitAudioContext)();mg=AC.createGain();mg.gain.value=.3;mg.connect(AC.destination);
 const nb=AC.createBuffer(1,AC.sampleRate*.2,AC.sampleRate),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AC.nb=nb;nextT=AC.currentTime+.1;setInterval(sched,30)}
const mf=m=>440*Math.pow(2,(m-69)/12),deg=(s,d)=>s[((d%s.length)+s.length)%s.length]+12*Math.floor(d/s.length);
function note(m,t,d,type,v){const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=mf(m);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(mg);o.start(t);o.stop(t+d+.05)}
function kick(t){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(40,t+.15);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(mg);o.start(t);o.stop(t+.25)}
function hat(t,v){const s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();s.buffer=AC.nb;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);s.connect(f);f.connect(g);g.connect(mg);s.start(t);s.stop(t+.06)}
function sched(){if(!active){nextT=AC.currentTime+.1;return}const m=W[wi].music,A=[0,2,4,7,4,2,5,3];
 while(nextT<AC.currentTime+.15){const s=step,c=m.prog[Math.floor(s/16)%4],t=nextT;
  if(m.kick&&s%4==0)kick(t);if(m.kick&&s%2==1)hat(t,.1);
  if(s%2==0)note(m.root+deg(m.scale,c)-12,t,.28,m.wave,.26);
  if(s%2==0&&(m.kick||s%4==0))note(m.root+12+deg(m.scale,c+A[s%8]),t,.25,m.arp,.1);
  if(s%16==0)for(const q of[0,2,4])note(m.root+deg(m.scale,c+q),t,60/m.bpm*4,'triangle',.07);
  nextT+=60/m.bpm/4;step++}}
const sfx=(ms,d,ty,v,dl)=>{if(AC)ms.forEach((m,k)=>note(m,AC.currentTime+k*(dl||.07),d,ty,v))};
// ---------- monde ----------
const R=.35,H=1.7,N=44,mk=c=>new T.MeshLambertMaterial({color:c,flatShading:true});
const hdr=(c,k)=>new T.Color(c).multiplyScalar(k);
function cvs(){const c=document.createElement('canvas');c.width=c.height=128;return c}
function glowTex(){const c=cvs(),x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)}
function panelTex(){const c=cvs(),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,128,128);for(let i=0;i<500;i++){x.fillStyle='rgba(0,0,0,'+Math.random()*.08+')';x.fillRect(Math.random()*128,Math.random()*128,2,2)}x.strokeStyle='rgba(0,0,0,.28)';x.lineWidth=3;x.strokeRect(1.5,1.5,125,125);x.lineWidth=1.5;x.beginPath();x.moveTo(64,0);x.lineTo(64,128);x.moveTo(0,64);x.lineTo(128,64);x.stroke();const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t}
function lavaTex(){const c=cvs();c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#5a0a00';x.fillRect(0,0,256,256);for(let i=0;i<60;i++){const px=Math.random()*256,py=Math.random()*256,r=10+Math.random()*30,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,190,40,.9)');g.addColorStop(.5,'rgba(255,80,10,.5)');g.addColorStop(1,'rgba(255,60,0,0)');x.fillStyle=g;x.fillRect(px-r,py-r,2*r,2*r)}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;return t}
const GT=glowTex(),PT=panelTex();
const mkp=c=>new T.MeshStandardMaterial({color:c,roughness:.5,metalness:.25,map:PT,envMap:GFX.tex,envMapIntensity:.6,emissive:new T.Color(c).multiplyScalar(.12)});
function skyMat(w){const hc=h=>new T.Color().setHSL(h%1,.8,.5);return new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{a:{value:new T.Color(w.sky)},b:{value:new T.Color(w.bg)},sc:{value:new T.Color(w.sunc)},na:{value:hc(w.h[1])},nc:{value:hc(w.h[3])},t:{value:0},cl:{value:w.lay=='sky'?1:0},nb:{value:w.stars>=700?1:0},sd:{value:new T.Vector3(-110,w.lobby?20:70,-200).normalize()}},
vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
fragmentShader:`uniform vec3 a,b,sc,na,nc,sd;uniform float t,cl,nb;varying vec3 p;
float hs(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float nz(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}
float fb(vec2 q){float s=0.,m=.5;for(int i=0;i<5;i++){s+=m*nz(q);q*=2.03;m*=.5;}return s;}
void main(){vec3 d=normalize(p);float h=d.y;vec3 c=mix(b,a,pow(clamp(h*1.3+.05,0.,1.),.55));
float s=max(dot(d,sd),0.);c+=sc*(pow(s,8.)*.18+pow(s,64.)*.25+pow(s,900.)*2.);
c=mix(c,b*1.05,pow(1.-clamp(abs(h),0.,1.),6.)*.5);
if(nb>.5){float n=fb((d.xz+d.y*.7)*2.2+t*.004);c+=mix(na,nc,fb(d.xy*3.))*smoothstep(.42,.85,n)*.35;}
if(cl>.5&&h>0.){vec2 uv=d.xz/(h+.3)*1.5+vec2(t*.012,t*.005);float n=fb(uv),n2=fb(uv+sd.xz*.12);float k=smoothstep(.48,.78,n)*smoothstep(0.,.18,h);
vec3 cc=mix(vec3(.62,.72,.9),vec3(1.,.97,.92),clamp((n-n2)*5.+.65,0.,1.));c=mix(c,cc,k*.92);}
gl_FragColor=vec4(c,1.);}`})}
function waterMat(w){return new T.ShaderMaterial({transparent:true,uniforms:{t:{value:0},col:{value:new T.Color(w.fc)},fogc:{value:new T.Color(w.bg)},sc:{value:new T.Color(w.sunc)},fr:{value:new T.Vector2(w.fog[0],w.fog[1])}},
vertexShader:'varying vec3 wp;void main(){vec4 q=modelMatrix*vec4(position,1.);wp=q.xyz;gl_Position=projectionMatrix*viewMatrix*q;}',
fragmentShader:`uniform float t;uniform vec3 col,fogc,sc;uniform vec2 fr;varying vec3 wp;
void main(){vec3 vd=normalize(cameraPosition-wp);float dist=length(cameraPosition-wp);vec2 p=wp.xz*.35;
float n=(sin(p.x*2.1+t*1.3)+sin(p.y*1.7-t*1.1)+sin((p.x+p.y)*3.1+t*2.)+sin((p.x-p.y)*4.3-t*1.7))*.25;
vec3 nm=normalize(vec3(n*.3,1.,cos(p.x*2.3+t)*.12+n*.2));float f=pow(1.-max(dot(vd,nm),0.),3.);
vec3 c=mix(col*.8,col*1.1,f);c+=sc*pow(max(dot(reflect(-vd,nm),normalize(vec3(-.45,.3,-.8))),0.),48.)*1.1;
c=mix(c,fogc,smoothstep(fr.x,fr.y,dist));gl_FragColor=vec4(c,.88);}`})}
function skyBow(){for(let k=0;k<7;k++){const m=new T.Mesh(new T.RingGeometry(150-k*3.2,153-k*3.2,72,1,0,Math.PI),new T.MeshBasicMaterial({color:new T.Color().setHSL(k*.115,.9,.6),transparent:true,opacity:.28,side:T.DoubleSide,fog:false,depthWrite:false}));m.position.set(90,-25,-215);SK.add(m)}}
function skyExtras(w){const d=new T.Mesh(new T.SphereGeometry(320,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{a:{value:new T.Color(w.sky)},b:{value:new T.Color(w.bg)}},vertexShader:'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 a,b;varying float h;void main(){gl_FragColor=vec4(mix(b,a,pow(clamp(h*1.4+.1,0.,1.),.7)),1.);}'}));d.renderOrder=-10;SK.add(d);if(w.lay=='sky'){d.material=skyMat(w);SKT=d.material.uniforms.t}
 const g=new T.Sprite(new T.SpriteMaterial({map:GT,color:w.sunc,opacity:.5,transparent:true,blending:T.AdditiveBlending,depthWrite:false,fog:false}));g.scale.set(110,110,1);g.position.set(-110,w.lobby?20:70,-200);SK.add(g)}
let SAVE={coins:0,best:{},tiers:{},gems:{},own:{},eq:{lobby:'def',ch:'dot'},mode:0};try{SAVE=Object.assign(SAVE,JSON.parse(localStorage.getItem('pw1')||'{}'))}catch(e){}
const sv=()=>{try{localStorage.setItem('pw1',JSON.stringify(SAVE))}catch(e){}};
let shopOpen=false,gems=[],wt=0,touchOn=false,wi=0,lvl=0,G,SK,WXp,FL,spawnT=0,lavaY=-14,bob=0,stp=0,shk=0,PL=[],coins=[],parts=[],pulses=[],portals=[],cp,cpTier=0,score=SAVE.coins|0,t0=null,trans=false;
let active=false;const live=()=>active&&(document.pointerLockElement||touchOn);
const P={buf:0,coy:0,x:0,y:0,z:0,vx:0,vz:0,vy:0,yaw:0,pit:0,g:null,jumps:0};
function upd(p,t){const s=p.sp||1,a=p.amp||0,q=t*s+p.ph;let ox=0,oy=0,oz=0;
 if(p.mv=='v')oy=Math.sin(q)*a;else if(p.mv=='h')ox=Math.sin(q)*a;
 else if(p.mv=='o'){ox=Math.cos(q)*a;oz=Math.sin(q)*a}else if(p.mv=='m'){oy=Math.sin(q)*a*.6;ox=Math.cos(q*.8)*a}
 const nx=p.bx+ox,ny=p.by+oy,nz=p.bz+oz;
 p.dx=p.cx===undefined?0:nx-p.cx;p.dy=p.cy===undefined?0:ny-p.cy;p.dz=p.cz===undefined?0:nz-p.cz;p.cx=nx;p.cy=ny;p.cz=nz;
 p.m.position.set(nx,ny-.5,nz);p.x0=nx-p.w/2;p.x1=nx+p.w/2;p.z0=nz-p.d/2;p.z1=nz+p.d/2;p.top=ny;p.bot=ny-1}
const SKT_={};function skyTex(k){if(SKT_[k])return SKT_[k];const c=cvs();c.width=c.height=256;const x=c.getContext('2d');
 if(k){x.fillStyle='#74d052';x.fillRect(0,0,256,256);for(let i=0;i<2200;i++){x.fillStyle='hsla('+(88+Math.random()*28)+',55%,'+(38+Math.random()*24)+'%,.4)';x.fillRect(Math.random()*256,Math.random()*256,2+Math.random()*3,3+Math.random()*5)}}
 else{x.fillStyle='#8a6a48';x.fillRect(0,0,256,256);for(let b=0;b<8;b++){x.fillStyle='hsla(28,'+(25+Math.random()*15)+'%,'+(28+Math.random()*18)+'%,.55)';x.fillRect(0,b*32+Math.random()*8,256,10+Math.random()*18)}for(let i=0;i<900;i++){x.fillStyle='rgba(0,0,0,'+Math.random()*.12+')';x.fillRect(Math.random()*256,Math.random()*256,3,2)}}
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return SKT_[k]=t}
const skyM=(s,k)=>{const t=skyTex(k).clone();t.needsUpdate=true;t.repeat.set(k?Math.max(1,s/4):Math.max(2,s*.8),k?Math.max(1,s/4):1);return new T.MeshStandardMaterial({map:t,roughness:.85,metalness:0,flatShading:true,envMap:GFX.tex,envMapIntensity:.5})};
function plat(x,y,z,s,hue,o){const w=W[wi],sh=w.shape,hh=hue%1;
 const g=sh=='box'?new T.BoxGeometry(s,1,s):new T.CylinderGeometry(s/2,s/2*.92,1,sh=='hex'?6:sh=='oct'?8:28);
 const SKY=w.lay=='sky'&&!o.fall&&!o.bounce,L_=c=>new T.MeshLambertMaterial({color:c,flatShading:true}),m=new T.Mesh(g,SKY?[skyM(s,0),skyM(s,1),L_(0x6a4a30)]:mkp(o.fall?0x8a4a3a:o.bounce?0xffcc22:new T.Color().setHSL(hh,w.sat,w.lit)));
 if(!SKY)m.add(new T.LineSegments(new T.EdgesGeometry(g,30),new T.LineBasicMaterial({color:o.fall?0xff5533:o.bounce?0xffffff:new T.Color().setHSL(hh,1,.75)})));
 const rm=new T.MeshBasicMaterial({color:hdr(o.fall?0xff5533:o.bounce?0xffffff:new T.Color().setHSL(hh,1,.6),2.4),side:T.DoubleSide});
 if(sh=='box'){const e=.08;[[s,e,e,0,s/2],[s,e,e,0,-s/2],[e,e,s,s/2,0],[e,e,s,-s/2,0]].forEach(a=>{const b=new T.Mesh(new T.BoxGeometry(a[0],a[1],a[2]),rm);b.position.set(a[3],.5,a[4]);m.add(b)})}
 else if(!SKY){const b=new T.Mesh(new T.CylinderGeometry(s/2+.02,s/2+.02,.1,sh=='hex'?6:sh=='oct'?8:40,1,true),rm);b.position.y=.48;m.add(b)}
 m.castShadow=m.receiveShadow=true;
 if(w.under&&!o.fall){if(w.lay=='sky')WD[wi].detail(m,s,x,y,z,o);else{const u=new T.Mesh(new T.ConeGeometry(s*.42,s*.9,sh=='box'?4:6),mk(new T.Color().setHSL(hh,.25,.28)));u.rotation.x=Math.PI;u.position.y=-.5-s*.45;m.add(u)}}
 G.add(m);const p=Object.assign({m,w:s,d:s,bx:x,by:y,bz:z,on:true,ph:PL.length*2.39996%6.28318,rr:sh=='box'?0:s/2*(sh=='hex'?.92:sh=='oct'?.97:1)},o);
 PL.push(p);upd(p,0);
 if(p.cp){const ring=new T.Mesh(new T.TorusGeometry(1.4,.07,8,40),new T.MeshBasicMaterial({color:hdr(p.ok?0x5dff9a:0x43f5ff,2)}));ring.rotation.x=Math.PI/2;ring.position.y=.55;m.add(ring);p.ring=ring}
 return p}
function coin(x,y,z){const m=new T.Mesh(new T.CylinderGeometry(.35,.35,.08,16),new T.MeshBasicMaterial({color:hdr(0xffc830,2)}));m.rotation.x=Math.PI/2;m.position.set(x,y,z);G.add(m);coins.push(m)}
function plabel(sp,d){const lock=!owned(d),c=lock?0x666677:W[d].sunc,cv=document.createElement('canvas');cv.width=512;cv.height=160;const x=cv.getContext('2d');x.textAlign='center';x.shadowColor='#'+new T.Color(c).getHexString();x.shadowBlur=14;x.fillStyle='#fff';x.font='bold 56px sans-serif';x.fillText((lock?'🔒 ':'')+W[d].n,256,62);x.font='bold 30px sans-serif';
 let l2='',l3='';if(d==5)l2='Retour au lobby';else if(lock)l2=W[d].price+' 🪙 · à la boutique';else{const b=SAVE.best[d];l2=SAVE.mode?'🥇'+W[d].par[0]+'s  🥈'+W[d].par[1]+'s  🥉'+W[d].par[2]+'s':(b?'Record '+b+' s':'Jamais terminé');l3=W[d].tip+(SAVE.tiers[d]?' · '+medal[SAVE.tiers[d]]:'')}
 x.fillText(l2,256,104);x.font='24px sans-serif';x.fillText(l3,256,140);sp.material.map=new T.CanvasTexture(cv);sp.material.needsUpdate=true}
function portal(cx,cy,cz,o,rad,pos){
 o.forEach((d,k)=>{const th=k*6.2832/o.length,x=pos?pos[k][0]:cx+Math.sin(th)*rad,z=pos?pos[k][1]:cz+Math.cos(th)*rad,g=new T.Group(),lock=!owned(d),c=lock?0x666677:W[d].sunc;
  g.add(new T.Mesh(new T.TorusGeometry(1.3,.14,10,40),new T.MeshBasicMaterial({color:hdr(c,2)})));
  const disc=new T.Mesh(new T.CircleGeometry(1.2,32),new T.MeshBasicMaterial({color:hdr(c,1.5),transparent:true,opacity:.45,side:T.DoubleSide}));g.add(disc);
  const sw=new T.Mesh(new T.TorusGeometry(.7,.06,8,30,4.5),new T.MeshBasicMaterial({color:hdr(0xffffff,2)}));g.add(sw);
  const sp=new T.Sprite(new T.SpriteMaterial({fog:false}));sp.scale.set(4.2,1.31,1);sp.position.y=2.1;g.add(sp);plabel(sp,d);
  g.position.set(x,cy+(pos?2.4:1.7),z);g.rotation.y=pos?Math.atan2(-x,-z):th;if(pos)g.scale.setScalar(1.35);G.add(g);portals.push({g,d,x,y:cy,z,sw,disc,lock,sp,big:!!pos})})}
function deco(t){const c=new T.Color().setHSL(Math.random(),.6,.55),r=Math.random();let m;
 if(t=='oct')m=new T.Mesh(new T.OctahedronGeometry(1+r*3),new T.MeshLambertMaterial({color:c,flatShading:true,transparent:true,opacity:.7}));
 else if(t=='ice')m=new T.Mesh(new T.IcosahedronGeometry(1.5+r*3.5),new T.MeshLambertMaterial({color:0xcfeeff,flatShading:true,transparent:true,opacity:.85}));
 else if(t=='rock'){m=new T.Mesh(new T.DodecahedronGeometry(2+r*4),mk(0x2a1a18));m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry),new T.LineBasicMaterial({color:0xff6a20})));m.scale.y=1.5}
 else if(t=='cloud'){m=new T.Group();const cm=new T.MeshLambertMaterial({color:0xffffff,emissive:0x7788aa,transparent:true,opacity:.96});for(let i=0;i<9;i++){const s=new T.Mesh(new T.SphereGeometry(1.8+Math.random()*2.6,12,9),cm);s.position.set(i*1.9-8+Math.random(),Math.random()*1.6+(i%3==1?1.4:0),(Math.random()-.5)*3);s.scale.y=.7;m.add(s)}m.scale.setScalar(1+Math.random()*.8)}
 else{m=new T.Mesh(new T.SphereGeometry(2+r*6,16,12),mk(c));if(r>.5){const rg=new T.Mesh(new T.TorusGeometry(4+r*8,.2,6,40),new T.MeshBasicMaterial({color:c}));rg.rotation.x=1.2;m.add(rg)}}
 return m}
let SPN=[],FLT=[],BRD=[],SKT=null;
function inst(geo,mat,a){const m=new T.InstancedMesh(geo,mat,a.length),d=new T.Object3D(),c=new T.Color();
 a.forEach((q,i)=>{d.position.set(q[0],q[1],q[2]);d.scale.set(q[3],q[4],q[5]);d.rotation.set(0,q[6]||0,0);d.updateMatrix();m.setMatrixAt(i,d.matrix);if(q[7]!=null)m.setColorAt(i,c.set(q[7]))});
 m.frustumCulled=false;G.add(m);return m}
function worldScenery(k,pts,w){
 const rn=(s=>()=>(s=s*16807%2147483647)/2147483647)(k*97+13),n=pts.length;let cx=0,cz=0;pts.forEach(q=>{cx+=q[0];cz+=q[2]});cx/=n;cz/=n;
  const wd=WD[k];if(wd.scenery)wd.scenery({k,pts,w,rn,n,cx,cz,G,SPN,FLT})}
// ---------- pont vers les fichiers world-*.js ----------
const CTX={T,mk,hdr,inst,GT,GFX};
const WD=WORLD_ORDER.map(id=>{const d=WORLDS[id];return Object.assign({},d,d.init?d.init(CTX):{})});
function build(k){wi=k;const w=W[k],wd=WD[k];if(w.lobby)Object.assign(w,TH[SAVE.eq.lobby]||TH.def);if(G){sc.remove(G);sc.remove(SK)}G=new T.Group();SK=new T.Group();sc.add(G,SK);
 PL=[];coins=[];gems=[];parts=[];SPN=[];FLT=[];BRD=[];SKT=null;pads.length=0;pulses=[];portals=[];step=0;wt=0;
 sc.background=new T.Color(w.bg);sc.fog=new T.Fog(w.bg,w.fog[0],w.fog[1]);
 hemi.intensity=w.li||1;sun.intensity=(w.li||1)*.95;hemi.color.set(w.hemi[0]);hemi.groundColor.set(w.hemi[1]);sun.color.set(w.sun);GFX.env(w);GFX.world(w);
 {const a=[];for(let i=0;i<w.stars;i++){const v=new T.Vector3(Math.random()-.5,Math.random()-.3,Math.random()-.5).normalize().multiplyScalar(250);a.push(v.x,v.y,v.z)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));SK.add(new T.Points(g,new T.PointsMaterial({size:1.3,color:0xffffff,fog:false})));
  const s=new T.Mesh(new T.SphereGeometry(26,24,16),new T.MeshBasicMaterial({color:w.sunc,fog:false}));s.position.set(-110,w.lobby?20:70,-200);SK.add(s);skyExtras(w)}
 let h=0,x=0,z=0,y=0,px=0,py=0,pz=0;const pts=[],te0=Math.floor(lvl/2),L=w.lay;
 const NN_=wd.N||N;for(let i=0;i<=(w.lobby?0:NN_);i++){const tr=Math.floor(i/9),te=Math.min(4,tr+te0),kk=i%3,fin=i==NN_;
  let dd=4.8+te*.45+w.gap,rs=.55+te*.04+w.rise,sz=Math.max(2.1,3.5-te*.35),tn=w.turn(i),o={};
  if(wd.track){const t=wd.track(i,te,{dd,rs,sz,tn});dd=t.dd;rs=t.rs;sz=t.sz;tn=t.tn}
  if(fin)dd+=wd.finDd||1.5;
  if(i>0){h+=tn;x+=Math.sin(h)*dd;z-=Math.cos(h)*dd;y+=rs}
  const hue=w.h[tr%w.h.length]+(i%9)*.006;let p;
  if(i==0){p=plat(0,0,0,wd.s0||8,hue,w.lobby?{tier:0}:{cp:1,ok:1,tier:0});if(w.lobby){portal(0,0,0,[0,1,2,3,4].sort((a,b)=>(owned(b)?1:0)-(owned(a)?1:0)),0,[[-13.3,-4.3],[-8.2,-11.3],[0,-14],[8.2,-11.3],[13.3,-4.3]]);lobbyExtras()}}
  else if(fin){p=plat(x,y,z,wd.sf||10,hue,{});portal(x,y,z,SAVE.mode?[5]:[5].concat(W.map((_,j)=>j).filter(j=>j!=wi&&j<5&&owned(j)).sort(()=>Math.random()-.5).slice(0,2)),wd.pr||3.4)}
  else if(i%9==0)p=plat(x,y,z,wd.cp||5,hue,{cp:1,tier:tr});
  else{
   if(wd.opts)o=wd.opts(i,kk,te);
   p=plat(x,y,z,sz,hue,o);
   if(kk==1&&!o.mv&&!o.fall&&!o.bounce)coin(x,y+1.4,z);else if(kk==2)coin((x+px)/2,(y+py)/2+2.3,(z+pz)/2)}
  pts.push([x,y,z,h,p.rr||0]);px=x;py=y;pz=z}
 if(!w.lobby)[14,31].forEach(ix=>{const q=pts[ix],id=wi+'-'+ix;if(!q||SAVE.gems[id])return;const a=ix==14?1:-1,hx=Math.cos(q[3])*6.5*a,hz=Math.sin(q[3])*6.5*a;plat(q[0]+hx,q[1]+1.6,q[2]+hz,2.6,w.h[2],{});gem(q[0]+hx,q[1]+3,q[2]+hz,id)});
 for(let i=0;i<(w.lobby?0:w.lay=='sky'?Math.max(70,Math.round(NN_*1.1)):45);i++){const b=pts[Math.floor(Math.random()*pts.length)],a=Math.random()*6.28,d=14+Math.random()*40,m=deco(w.deco);
  const cx_=b[0]+Math.cos(a)*d,cy_=b[1]+Math.random()*40-25,cz_=b[2]+Math.sin(a)*d;if(w.lay=='sky'&&pts.some(q=>Math.hypot(q[0]-cx_,q[1]-cy_,q[2]-cz_)<30+(q[4]||0)))continue;m.position.set(cx_,cy_,cz_);if(w.deco=='cloud'){m.rotation.set(0,Math.random()*3,0);FLT.push({m,x0:cx_,y0:cy_,z0:cz_,ph:Math.random()*6,ax:8,ay:.8})}else m.rotation.set(Math.random()*3,Math.random()*3,0);G.add(m)}
 if(w.lay=='sky'||w.lay=='tower')worldScenery(k,pts,w);
 FL=null;if(w.fl=='grid')FL=new T.GridHelper(500,75,0xff3ec8,0x6a2a9a);
 else if(w.fl&&w.lay!='sky'){FL=new T.Mesh(new T.PlaneGeometry(900,900),new T.MeshBasicMaterial({color:w.fl=='lava'?0xff4a10:w.fc,transparent:w.fl=='sea',opacity:.85}));FL.rotation.x=-Math.PI/2;if(w.fl=='lava'){const lt=lavaTex();lt.repeat.set(60,60);FL.material.map=lt;FL.material.color.set(0xffffff)}}
 WAT=FL&&FL.material.uniforms?FL.material.uniforms.t:null;if(FL){FL.position.y=-28;G.add(FL)}
 {const n=350,a=new Float32Array(n*3);for(let i=0;i<a.length;i++)a[i]=(Math.random()-.5)*80;WXp=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({size:w.wx.s*3,map:GT,color:w.wx.c,transparent:true,opacity:.9,depthWrite:false,blending:w.fl=='sea'?T.NormalBlending:T.AdditiveBlending}));
  WXp.geometry.setAttribute('position',new T.BufferAttribute(a,3));WXp.frustumCulled=false;G.add(WXp)}
 P.x=0;P.y=PL[0].top;P.z=w.lobby?15:0;P.vy=0;P.yaw=0;P.pit=0;P.g=PL[0];P.vx=P.vz=0;P.jumps=0;P.buf=0;P.coy=.12;P.wasG=true;spawnT=.7;KX=KZ=0;lavaY=-14;cp={x:0,y:0,z:P.z};cpTier=0;
 $('w').textContent=w.lobby?'🏠 Lobby':'🌍 '+(lvl+1)+' · '+w.n;$('p').textContent='🏁 Palier 1';banner(w.lobby?'① Choisis un mode · ② Entre dans un portail':'MONDE '+(lvl+1)+' — '+w.n.toUpperCase()+' · '+w.tip,'#fff')}
function banner(t,c){const b=$('ban');b.textContent=t;b.style.opacity=1;clearTimeout(banner.id);banner.id=setTimeout(()=>b.style.opacity=0,t.length>35?3800:2000)}
const TH=WORLDS.lobby.themes;
const SHOP=[{id:'w2',n:'Monde Lave',d:'Tour verticale · la lave monte !',p:120,c:'m'},{id:'w4',n:'Monde Cosmos',d:'Faible gravité · plateformes en orbite',p:200,c:'m'},{id:'thd',n:'Lobby Doré',d:'Coucher de soleil (par défaut)',p:0,c:'l',k:'lobby',v:'def'},{id:'tha',n:'Lobby Aurore',d:'Ambiance vert-bleu',p:60,c:'l',k:'lobby',v:'aurore'},{id:'ths',n:'Lobby Crépuscule',d:'Ambiance rouge-violet',p:100,c:'l',k:'lobby',v:'sunset'},{id:'chd',n:'Point •',d:'Viseur par défaut',p:0,c:'v',k:'ch',v:'dot'},{id:'chr',n:'Anneau ◯',d:'Viseur rond',p:25,c:'v',k:'ch',v:'ring'},{id:'chc',n:'Croix +',d:'Viseur en croix',p:25,c:'v',k:'ch',v:'cross'}];
SAVE.eq=SAVE.eq||{};if(SAVE.eq.skin==null)SAVE.eq.skin=0;SHOP.push(...SKN.map((s,j)=>({id:'sk'+j,n:s.e+' '+s.n,d:s.rec!=null?'Skin Champion · record du monde '+W[s.rec].n:s.p?'Visible par tes amis en ligne':'Gratuit · visible par tes amis en ligne',p:s.p,c:'s',k:'skin',v:j})));
const owned=d=>true,pads=[],medal=['','🥉','🥈','🥇'];
const recOk=i=>{const b=SAVE.best[i],w=W[i];return !!(b&&w&&w.par&&b<=w.par[0])};
function applyCH(){const x=$('xh'),c=SAVE.eq.ch;x.textContent=c=='cross'?'+':'';x.style.cssText=c=='ring'?'width:16px;height:16px;border-radius:50%;border:2px solid #fff':c=='cross'?'font:700 24px sans-serif;line-height:1':'width:5px;height:5px;border-radius:50%;background:#fff'}
let shopCb=null;
const CAT=[['🎭 Skins (visibles par tes amis)','s'],['🌍 Nouveaux mondes','m'],['🏠 Ambiance du lobby (décor seulement)','l'],['🎯 Viseur','v']];
function shopHTML(){const sec=(t,k)=>'<h2>'+t+'</h2><section class="sh">'+SHOP.filter(i=>i.c==k).map(i=>{const rc=i.c=='s'&&SKN[i.v].rec!=null,own=rc?recOk(SKN[i.v].rec):(i.p==0||SAVE.own[i.id]),eq=i.k&&SAVE.eq[i.k]==i.v,ok=!rc&&score>=i.p,buyt=rc?'🔒 Bats '+W[SKN[i.v].rec].par[0]+' s en '+W[SKN[i.v].rec].n:ok?'Acheter · '+i.p+' 🪙':i.p+' 🪙 · il te manque '+(i.p-score);let st,col;
 if(i.k){st=eq?'✔ Équipé':own?'Équiper':buyt;col=eq?'#5dff9a':own?'#43f5ff':ok?'#ffc830':'#888'}else{st=own?'✔ Débloqué : va dans son portail':buyt;col=own?'#5dff9a':ok?'#ffc830':'#888'}
 return '<button class="card" style="--c:'+col+'" data-buy="'+i.id+'">'+(i.c=='s'?'<img class="sp'+(rc&&!own?' lk':'')+'" src="'+AV.preview(T,i.v)+'">':'')+'<b>'+i.n+'</b><i>'+i.d+'</i><span class="st" style="color:'+col+'">'+st+'</span></button>'}).join('')+'</section>';
 return '<div class="pn"><h1>🛒 BOUTIQUE</h1><b style="font-size:22px">🪙 '+score+'</b><br><small>Gagne des pièces : ramasse-les, trouve les 💎 cachés, décroche des médailles en mode Classé.<br>Rien ici n’aide pour le parcours.</small>'+CAT.map(c=>sec(c[0],c[1])).join('')+'<button data-close="1" style="--c:#ff4466">✕ Fermer</button></div>'}
function openShop(){shopCb=null;ov.style.zIndex='';shopOpen=true;ov.innerHTML=shopHTML();ov.style.display='flex';document.exitPointerLock()}
function buy(id){const i=SHOP.find(x=>x.id==id);if(!i)return;if(i.c=='s'&&SKN[i.v].rec!=null&&!recOk(SKN[i.v].rec)){banner('Bats le record du monde '+W[SKN[i.v].rec].n+' pour débloquer ce skin');return}if(!(i.p==0||SAVE.own[id])){if(score<i.p){banner('Pas assez de pièces');return}score-=i.p;SAVE.coins=score;SAVE.own[id]=1;sfx([72,79,84],.2,'triangle',.18)}if(i.k){SAVE.eq[i.k]=i.v;applyCH();if(i.k=='skin'&&window.NET&&NET.setSkin)NET.setSkin(i.v)}sv();ov.innerHTML=shopHTML()}
function setLab(sp,txt,col){const cv=document.createElement('canvas');cv.width=512;cv.height=96;const x=cv.getContext('2d');x.font='bold 40px sans-serif';x.textAlign='center';x.shadowColor=col;x.shadowBlur=14;x.fillStyle='#fff';x.fillText(txt,256,60);sp.material.map=new T.CanvasTexture(cv);sp.material.needsUpdate=true}
function drawMode(sp,m,a){const cv=document.createElement('canvas');cv.width=640;cv.height=160;const x=cv.getContext('2d');x.fillStyle='rgba(30,14,36,.85)';x.fillRect(0,0,640,160);x.strokeStyle=m?'#ff4466':'#44ff88';x.lineWidth=6;x.strokeRect(3,3,634,154);x.textAlign='center';x.fillStyle=a?'#fff':'#bbb';x.shadowColor=m?'#ff4466':'#44ff88';x.shadowBlur=a?16:0;x.font='bold 58px sans-serif';x.fillText(m?'CLASSÉ ⏱':'NORMAL 🌿',320,56);x.shadowBlur=0;x.font='28px sans-serif';x.fillText(m?'chrono · médailles · gros bonus':'sans chrono · explore · gemmes',320,98);x.font='bold 32px sans-serif';x.fillStyle=a?'#5dff9a':'#888';x.fillText(a?'✔ ACTIF':'marche dessus pour choisir',320,140);sp.material.map=new T.CanvasTexture(cv);sp.material.needsUpdate=true}
function pad(x,z,col,r,fn){const g=new T.Group(),d=new T.Mesh(new T.CircleGeometry(r,40),new T.MeshBasicMaterial({color:hdr(col,1.6),transparent:true,opacity:.8}));d.rotation.x=-Math.PI/2;d.position.y=.04;g.add(d);
 const rg=new T.Mesh(new T.TorusGeometry(r,.07,8,48),new T.MeshBasicMaterial({color:hdr(col,2.4)}));rg.rotation.x=Math.PI/2;rg.position.y=.07;g.add(rg);g.position.set(x,0,z);G.add(g);const p={x,z,r,fn,d,in:false};pads.push(p);return p}
function board(x,y,z,fx,fz,w,h,lines,col){const cv=document.createElement('canvas');cv.width=1024;cv.height=Math.round(1024*h/w);const c=cv.getContext('2d');c.fillStyle='rgba(30,14,36,.88)';c.fillRect(0,0,cv.width,cv.height);c.strokeStyle=col;c.lineWidth=10;c.strokeRect(5,5,cv.width-10,cv.height-10);c.textAlign='center';
 const tot=lines.reduce((a,l)=>a+l[1]*1.3,0);let yy=(cv.height-tot)/2;lines.forEach(l=>{yy+=l[1]*1.3;c.font='bold '+l[1]+'px sans-serif';c.fillStyle=l[2]||'#fff';c.fillText(l[0],512,yy-l[1]*.25)});
 const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:new T.CanvasTexture(cv),transparent:true,side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.y=Math.atan2(fx-x,fz-z);G.add(m)}
const bx=(w,h,d,x,y,z,c)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mk(c));m.position.set(x,y,z);G.add(m);return m};
function scenery(){const cream=mk(0xf0e0c8);
 for(let i=0;i<12;i++){const a=i*Math.PI/6,g=new T.Group(),pl=new T.Mesh(new T.CylinderGeometry(.35,.45,3.2,8),cream),lt=new T.Mesh(new T.SphereGeometry(.38,10,8),new T.MeshBasicMaterial({color:hdr(0xffa040,3)}));pl.position.y=1.6;lt.position.y=3.5;g.add(pl,lt);g.position.set(Math.sin(a)*19,0,Math.cos(a)*19);G.add(g)}
 for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/6,g=new T.Group(),pot=new T.Mesh(new T.CylinderGeometry(.9,.7,.7,10),mk(0xb07a50)),tr=new T.Mesh(new T.CylinderGeometry(.12,.16,1.8,6),mk(0x6a4a30)),fo=new T.Mesh(new T.IcosahedronGeometry(1.1,0),mk(i%2?0xf08aa8:0x7ac070));pot.position.y=.35;tr.position.y=1.5;fo.position.y=2.9;g.add(pot,tr,fo);g.position.set(Math.sin(a)*18,0,Math.cos(a)*18);G.add(g)}
 for(let i=0;i<26;i++){const a=i/26*6.283+Math.random()*.2,d=230+Math.random()*50,hh=50+Math.random()*90,m=new T.Mesh(new T.ConeGeometry(hh*(.7+Math.random()*.4),hh,5+Math.floor(Math.random()*3)),new T.MeshBasicMaterial({color:new T.Color().setHSL(.78-.08*Math.random(),.35,.28+.1*Math.random())}));m.position.set(Math.sin(a)*d,hh/2-50,Math.cos(a)*d);G.add(m)}
 for(let i=0;i<18;i++){const a=Math.random()*6.283,d=70+Math.random()*70,m=deco('cloud');m.position.set(Math.cos(a)*d,Math.random()*40-20,Math.sin(a)*d);G.add(m)}
 for(let k=0;k<4;k++){const ar=new T.Mesh(new T.ConeGeometry(.55,1.1,3),new T.MeshBasicMaterial({color:hdr(0xffc060,1.8)}));ar.scale.z=.12;ar.rotation.x=-Math.PI/2;ar.position.set(0,.06,6-3*k);G.add(ar)}}
function lobbyExtras(){const mc=m=>m?0xff4466:0x44ff88;
 const mp=[0,1].map(m=>{const x=m?4.2:-4.2,p=pad(x,11,mc(m),1.7,()=>{SAVE.mode=m;sv();refMode();banner(m?'⏱ CLASSÉ : bats le chrono, gagne médailles et pièces':'🌿 NORMAL : sans chrono, explore et trouve les 💎')});
  p.m=m;p.sp=new T.Sprite(new T.SpriteMaterial({fog:false}));p.sp.scale.set(7,1.75,1);p.sp.position.set(x,2.6,11);G.add(p.sp);return p});
 function refMode(){mp.forEach(p=>{const a=SAVE.mode==p.m;p.d.material.opacity=a?.95:.3;p.d.material.color.copy(hdr(mc(p.m),a?1.8:.7));drawMode(p.sp,p.m,a)});portals.forEach(q=>plabel(q.sp,q.d))}
 refMode();
 board(0,6,11,0,15,10.5,1.9,[['CHOISIS TON MODE',68,'#ffe6a8'],['marche sur un plot pour l’activer',34]],'#ffc080');
 
 board(11.5,3.4,11,0,15,7,5,[['COMMENT JOUER',52,'#ffe6a8'],['Va jusqu’au portail tout en haut',30],['🪙 pièces · 💎 gemmes cachées',30],['Espace ×2 : double saut',30],['Maj : courir · R : respawn',30],['Échap : pause · retour au lobby',30]],'#ffc080');
 const kx=-13,kz=4;bx(5,1.2,2.2,kx,.6,kz,0xb07040);bx(6.4,.3,3.4,kx,3.8,kz,0xe05a5a);
 [[-2.9,-1.5],[2.9,-1.5],[-2.9,1.5],[2.9,1.5]].forEach(c=>bx(.2,3.6,.2,kx+c[0],1.8,kz+c[1],0xe8d8c0));
 board(kx,6,kz,0,15,7,2.6,[['BOUTIQUE 🛒',64,'#ffd060'],['🪙 '+score+' pièces · mondes & décor',30]],'#ffd060');
 const sp=new T.Sprite(new T.SpriteMaterial({fog:false}));sp.scale.set(6,1.1,1);sp.position.set(kx+3.4,2.2,kz+3.2);G.add(sp);setLab(sp,'BOUTIQUE','#ffc830');
 pad(kx+3.4,kz+3.2,0xffc830,1.5,openShop);scenery()}
function gem(x,y,z,id){const m=new T.Mesh(new T.OctahedronGeometry(.5),new T.MeshBasicMaterial({color:hdr(0x66ffee,2.4)}));m.position.set(x,y,z);m.userData.id=id;G.add(m);gems.push(m)}
function fail(){trans=true;banner('⏱ Temps écoulé !');setTimeout(()=>$('fade').style.opacity=1,900);setTimeout(()=>{lvl=0;leave();trans=false},1500)}
function go(d){trans=true;let msg='';const w0=W[wi];
 if(!w0.lobby){const b=SAVE.best[wi],rec=!b||wt<b;if(rec)SAVE.best[wi]=+wt.toFixed(1);if(SAVE.mode){SAVE.lb=SAVE.lb||{};const o_=SAVE.lb[wi];if(!o_||wt<o_.t)SAVE.lb[wi]={n:(window.NET&&NET.want()&&NET.name())||(function(){try{return localStorage.getItem('pwn')}catch(e){return null}})()||'Joueur',t:+wt.toFixed(1)}}msg='✔ '+w0.n+' terminé en '+wt.toFixed(1)+' s'+(rec?' — RECORD !':'');
  if(SAVE.mode&&w0.par){const tier=wt<=w0.par[0]?3:wt<=w0.par[1]?2:wt<=w0.par[2]?1:0,old=SAVE.tiers[wi]|0,RW=[0,30,60,120];let g=0;for(let q=old+1;q<=tier;q++)g+=RW[q];if(tier>old)SAVE.tiers[wi]=tier;if(g){score+=g;SAVE.coins=score}msg+=' · '+medal[tier]+(g?' +'+g+' 🪙':'')}
  sv();banner(msg)}
 lvl=w0.lobby||SAVE.mode||d==5?0:lvl+1;sfx([60,67,72,79,84],.5,'sine',.15,.06);setTimeout(()=>$('fade').style.opacity=1,msg?1100:0);setTimeout(()=>{if(d==5)leave();else{build(d);$('fade').style.opacity=0}trans=false},msg?1700:600)}
function reach(p){if(p.tier<cpTier)return;cpTier=p.tier;cp={x:p.bx,y:p.top,z:p.bz};if(p.ok)return;p.ok=true;p.ring.material.color.copy(hdr(0x5dff9a,2));
 const pm=new T.Mesh(new T.TorusGeometry(1.4,.1,8,40),new T.MeshBasicMaterial({color:0x5dff9a,transparent:true}));pm.rotation.x=Math.PI/2;pm.position.set(p.bx,p.top+.1,p.bz);G.add(pm);pulses.push({m:pm,l:1});
 for(let i=0;i<20;i++){const m=new T.Mesh(new T.BoxGeometry(.15,.15,.15),new T.MeshBasicMaterial({color:0x5dff9a}));m.position.set(p.bx,p.top+.3,p.bz);
  parts.push({m,v:new T.Vector3((Math.random()-.5)*5,3+Math.random()*4,(Math.random()-.5)*5),life:1.2});G.add(m)}
 sfx([72,76,79,84],.3,'triangle',.18);$('p').textContent='🏁 Palier '+(p.tier+1);banner('✔ CHECKPOINT — PALIER '+(p.tier+1))}
NET.on('push',m=>{if(active&&m.to===NET.id){KX=Math.max(-12,Math.min(12,KX+m.kx));KZ=Math.max(-12,Math.min(12,KZ+m.kz))}});
function respawn(){KX=KZ=0;P.x=cp.x;P.y=cp.y+.2;P.z=cp.z;P.vy=0;P.vx=P.vz=0;lavaY=cp.y-14;const f=$('fade');f.style.transition='none';f.style.background='#f22';f.style.opacity=.45;setTimeout(()=>{f.style.transition='opacity .4s';f.style.opacity=0;setTimeout(()=>f.style.background='#fff',450)},30)}
function land(v){shk=Math.min(.12,-v*.005);sfx([43],.12,'sine',.3);for(let i=0;i<8;i++){const m=new T.Mesh(new T.BoxGeometry(.12,.12,.12),new T.MeshBasicMaterial({color:0xdddddd}));m.position.set(P.x,P.y+.1,P.z);parts.push({m,v:new T.Vector3((Math.random()-.5)*3,1+Math.random()*1.5,(Math.random()-.5)*3),life:.5});G.add(m)}}
// ---------- entrées ----------
const K={};
addEventListener('keydown',e=>{K[e.code]=1;if(!active)return;if(e.code=='Space'&&document.pointerLockElement)P.buf=.12;
 if(e.code=='KeyR')respawn();if(e.code=='KeyM'&&mg){muted=!muted;mg.gain.value=muted?0:.3}});
addEventListener('keyup',e=>K[e.code]=0);
const ov=$('ov');function closeShop(){shopOpen=false;ov.style.display='none';ov.style.zIndex='';if(shopCb){const f=shopCb;shopCb=null;f();return}if(W[wi].lobby)build(5);ren.domElement.requestPointerLock()}
ov.onclick=e=>{if(!shopCb)startAudio();const b=e.target.closest('button');if(b&&b.dataset.buy){buy(b.dataset.buy);return}if(e.target===ov||(b&&b.dataset.close))closeShop()};
addEventListener('keydown',e=>{if(e.code=='Escape'&&shopOpen)closeShop()});
let paused=false;
document.addEventListener('pointerlockchange',()=>{if(!active)return;const l=document.pointerLockElement;$('hint').style.display=l?'none':'block';
 if(l){paused=false;PAUSE.hide();return}
 if(!trans&&!touchOn&&!window.CHATTING&&!progExit()&&!shopOpen){paused=true;PAUSE.show([['▶ Reprendre',()=>{try{ren.domElement.requestPointerLock()}catch(e){}}],['🏠 Retourner au lobby',()=>{paused=false;leave()},'#8a3a3a']])}});
ren.domElement.onclick=()=>{startAudio();document.body.requestPointerLock()};
addEventListener('mousemove',e=>{if(active&&document.pointerLockElement){P.yaw-=e.movementX*.002;P.pit=Math.max(-1.5,Math.min(1.5,P.pit-e.movementY*.002))}});
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();ren.setSize(innerWidth,innerHeight);if(comp)comp.setSize(innerWidth,innerHeight)});
function hit(p,x,y,z){if(!p.on||y+H<=p.bot||y>=p.top)return false;
 if(p.rr){const ex=x-p.cx,ez=z-p.cz,r=p.rr+R;return ex*ex+ez*ez<r*r}
 return x+R>p.x0&&x-R<p.x1&&z+R>p.z0&&z-R<p.z1}
// ---------- moteur graphique GFX ----------
let comp=null,WAT=null;
const GR={'Néon':{ex:1.02,sat:1.15,con:1.08,gs:[.9,.8,1.15],gh:[1.1,.95,1.1],bl:[.85,.5,.9],ray:.35},'Glace':{ex:1.03,sat:1.06,con:1.05,gs:[.85,.95,1.1],gh:[1.05,1.03,1],bl:[.5,.4,1],ray:.4},'Lave':{ex:1.03,sat:1.15,con:1.12,gs:[1.1,.85,.8],gh:[1.15,1,.85],bl:[.95,.55,.85],ray:.25},'Ciel':{ex:1.05,sat:1.12,con:1.06,gs:[.92,.97,1.1],gh:[1.08,1.04,.96],bl:[.55,.45,1],ray:.5},'Cosmos':{ex:1,sat:1.15,con:1.12,gs:[.9,.9,1.2],gh:[1,1,1.1],bl:[.9,.6,.8],ray:.2},'Lobby':{ex:1.03,sat:1.1,con:1.05,gs:[.95,.88,1.05],gh:[1.1,1,.9],bl:[.6,.45,1],ray:.5}};
GFX.env=w=>{try{if(!GFX.pm||w.lay!='sky'){GFX.tex=null;return}const e=new T.Scene();e.add(new T.Mesh(new T.SphereGeometry(10,32,16),new T.ShaderMaterial({side:T.BackSide,uniforms:{a:{value:new T.Color(w.sky)},b:{value:new T.Color(w.bg)},c:{value:new T.Color(w.sun)}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 a,b,c;varying vec3 p;void main(){vec3 d=normalize(p);vec3 k=mix(b,a,smoothstep(-.2,.9,d.y));k+=c*pow(max(dot(d,normalize(vec3(-.5,.4,-.8))),0.),12.)*1.5;gl_FragColor=vec4(k,1.);}'})));const r=GFX.pm.fromScene(e,.04);if(GFX.rt)GFX.rt.dispose();GFX.rt=r;GFX.tex=r.texture}catch(e){}};
GFX.world=w=>{if(!GFX.fx)return;const sk=w.lay=='sky',g=sk?GR['Ciel']:{ex:1,sat:1,con:1,gs:[1,1,1],gh:[1,1,1],bl:[.7,.4,1],ray:0},u=GFX.fx.uniforms,c=new T.Color(w.sunc);u.on.value=sk?1:0;u.ex.value=g.ex;u.sat.value=g.sat;u.con.value=g.con;u.gs.value.set(...g.gs);u.gh.value.set(...g.gh);u.rc.value.set(c.r,c.g,c.b);GFX.ray=g.ray;GFX.bl.strength=g.bl[0];GFX.bl.radius=g.bl[1];GFX.bl.threshold=g.bl[2]};
GFX.update=(t,dt)=>{if(!comp||!GFX.fx)return;const u=GFX.fx.uniforms,w=W[wi],sd=GFX.s.set(-110,w.lobby?20:70,-200).normalize();cam.updateMatrixWorld();cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
 const v=GFX.v.copy(sd).multiplyScalar(100).add(cam.position).project(cam),fw=cam.getWorldDirection(GFX.d).dot(sd);
 u.t.value=t;u.sun.value.set(v.x*.5+.5,v.y*.5+.5);u.ray.value=GFX.ray*Math.max(0,Math.min(1,fw*2.5));u.res.value.set(innerWidth*GFX.r,innerHeight*GFX.r);
 GFX.f=GFX.f*.95+dt*.05;GFX.w+=dt;GFX.c+=dt;if(GFX.w>4&&GFX.c>2){GFX.c=0;if(GFX.f>.024&&GFX.r>.7){GFX.r=Math.max(.7,GFX.r-.15);ren.setPixelRatio(GFX.r);if(comp.setPixelRatio)comp.setPixelRatio(GFX.r);comp.setSize(innerWidth,innerHeight)}}};
try{GFX.pm=new T.PMREMGenerator(ren)}catch(e){}
try{if(T.EffectComposer&&T.UnrealBloomPass&&T.ShaderPass&&T.RenderPass){comp=new T.EffectComposer(ren);comp.addPass(new T.RenderPass(sc,cam));GFX.bl=new T.UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.7,.4,1.0);comp.addPass(GFX.bl);
 GFX.fx=new T.ShaderPass({uniforms:{tDiffuse:{value:null},on:{value:0},res:{value:new T.Vector2(innerWidth,innerHeight)},sun:{value:new T.Vector2(.5,.5)},t:{value:0},ray:{value:0},ex:{value:1},sat:{value:1.08},con:{value:1.05},vig:{value:1.2},grain:{value:.022},gs:{value:new T.Vector3(1,1,1)},gh:{value:new T.Vector3(1,1,1)},rc:{value:new T.Vector3(1,.9,.7)}},
 vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 res,sun;uniform float on,t,ray,ex,sat,con,vig,grain;uniform vec3 gs,gh,rc;varying vec2 v;
vec3 T(vec2 u){return texture2D(tDiffuse,u).rgb;}
float L(vec3 c){c=c/(1.+c);return dot(c,vec3(.299,.587,.114));}
float hs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 r=1./res,c=v-.5;float d=dot(c,c);vec3 m=T(v);
if(on<.5){vec3 o=vec3(T(v+c*d*.035).r,T(v+c*d*.02).g,m.b);o*=1.-d*1.2;vec3 q0=o*1.1;gl_FragColor=vec4(clamp((q0*(2.51*q0+.03))/(q0*(2.43*q0+.59)+.14),0.,1.),1.);return;}
vec3 nw=T(v+vec2(-1.,-1.)*r),ne=T(v+vec2(1.,-1.)*r),sw=T(v+vec2(-1.,1.)*r),se=T(v+vec2(1.,1.)*r);
float lm=L(m),a=L(nw),b=L(ne),e=L(sw),f=L(se),lo=min(lm,min(min(a,b),min(e,f))),hx=max(lm,max(max(a,b),max(e,f)));
vec2 dir=vec2(-((a+b)-(e+f)),(a+e)-(b+f));float dr=max((a+b+e+f)*.03125,.0078125),rcp=1./(min(abs(dir.x),abs(dir.y))+dr);dir=clamp(dir*rcp,vec2(-8.),vec2(8.))*r;
vec3 s1=.5*(T(v-dir*.1667)+T(v+dir*.1667)),s2=s1*.5+.25*(T(v-dir*.5)+T(v+dir*.5));float l2=L(s2);
vec3 col=(l2<lo||l2>hx)?s1:s2;if(hx-lo<max(.0312,hx*.125))col=m;
col.r+=T(v+c*d*.035).r-m.r;col.g+=T(v+c*d*.02).g-m.g;
if(ray>.001){vec2 sd=(sun-v)*.9/24.,p=v;float acc=0.,w=1.;for(int i=0;i<24;i++){p+=sd;acc+=max(dot(T(p),vec3(.333))-.8,0.)*w;w*=.95;}col+=rc*acc*ray*.08;}
col*=ex;float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,sat);col=mix(col*gs,col*gh,smoothstep(0.,1.,l));col=max((col-.18)*con+.18,0.);col*=1.-d*vig;
vec3 q=col*1.1;col=clamp((q*(2.51*q+.03))/(q*(2.43*q+.59)+.14),0.,1.);col+=(hs(v*res+t)-.5)*grain;gl_FragColor=vec4(col,1.);}`});comp.addPass(GFX.fx)}}catch(e){comp=null}
if(!comp)ren.toneMapping=T.ACESFilmicToneMapping;
const TJ={x:0,y:0};
if('ontouchstart' in window){touchOn=true;$('hint').style.display='none';
 const mkd=(css,txt)=>{const d=document.createElement('div');d.style.cssText='position:fixed;z-index:5;touch-action:none;user-select:none;color:#fff;display:flex;align-items:center;justify-content:center;font:700 22px sans-serif;'+css;d.textContent=txt||'';document.body.appendChild(d);return d};
 const js=mkd('left:24px;bottom:34px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.1);border:2px solid #43f5ff'),kn=mkd('left:59px;bottom:69px;width:60px;height:60px;border-radius:50%;background:rgba(67,245,255,.5);pointer-events:none');
 const mv2=e=>{const r=js.getBoundingClientRect(),dx=e.clientX-(r.left+65),dy=e.clientY-(r.top+65),d=Math.min(1,Math.hypot(dx,dy)/55),a=Math.atan2(dy,dx);TJ.x=Math.cos(a)*d;TJ.y=Math.sin(a)*d;kn.style.transform='translate('+TJ.x*45+'px,'+TJ.y*45+'px)'};
 js.onpointerdown=e=>{js.setPointerCapture(e.pointerId);mv2(e)};js.onpointermove=e=>{if(e.buttons)mv2(e)};js.onpointerup=js.onpointercancel=()=>{TJ.x=TJ.y=0;kn.style.transform=''};
 mkd('right:24px;bottom:44px;width:90px;height:90px;border-radius:50%;background:rgba(255,79,216,.35);border:2px solid #ff4fd8','⤒').onpointerdown=()=>{P.buf=.12};
 mkd('right:130px;bottom:44px;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.15);border:2px solid #fff','R').onpointerdown=()=>respawn();
 mkd('right:16px;top:12px;width:48px;height:48px;border-radius:12px;background:rgba(10,5,30,.6);border:2px solid #43f5ff','☰').onpointerdown=()=>{if(active&&!trans){lvl=0;leave()}};
 let lp=null;const cv=ren.domElement;cv.addEventListener('pointerdown',e=>{lp={x:e.clientX,y:e.clientY,id:e.pointerId}});
 cv.addEventListener('pointermove',e=>{if(lp&&lp.id==e.pointerId){P.yaw-=(e.clientX-lp.x)*.005;P.pit=Math.max(-1.5,Math.min(1.5,P.pit-(e.clientY-lp.y)*.005));lp.x=e.clientX;lp.y=e.clientY}});
 cv.addEventListener('pointerup',()=>lp=null)}
applyCH();
let last=performance.now();
function loop(now){requestAnimationFrame(loop);if(!active||paused){last=now;return}const dt=Math.min(.033,(now-last)/1000);last=now;const t=now/1000,ts=(Date.now()+NET.toff)/1000;
 if(W[wi].lr&&live())lavaY+=.3*dt;if(live()&&!W[wi].lobby&&!trans)wt+=dt;if(SAVE.mode&&W[wi].par&&wt>W[wi].par[2]&&!trans)fail();
 for(const p of PL)upd(p,ts);
 for(const p of PL){if(p.ring)p.ring.rotation.z+=dt*1.5;
  if(p.fall){if(p.st==0){if(P.g===p){p.st=1;p.tm=.7}}else if(p.st==1){p.tm-=dt;p.m.position.x+=(Math.random()-.5)*.1;if(p.tm<=0){p.st=2;p.on=false;p.m.visible=false;p.tm=3}}else{p.tm-=dt;if(p.tm<=0){p.st=0;p.on=true;p.m.visible=true}}}}
 for(let i=pulses.length-1;i>=0;i--){const q=pulses[i];q.l-=dt*1.1;q.m.scale.setScalar(1+(1-q.l)*2.5);q.m.material.opacity=Math.max(0,q.l);if(q.l<=0){G.remove(q.m);pulses.splice(i,1)}}
 if(live()&&t0===null)t0=now;
 if(P.g){P.x+=P.g.dx;P.y+=P.g.dy;P.z+=P.g.dz}
 const f=(K.KeyW||K.KeyZ?1:0)-(K.KeyS?1:0)-TJ.y,s=(K.KeyD?1:0)-(K.KeyA||K.KeyQ?1:0)+TJ.x;
 const l=Math.max(1,Math.hypot(f,s)),run=SPg.run(dt,K.KeyW||K.KeyZ,K.ShiftLeft||Math.hypot(TJ.x,TJ.y)>.92,!!(f||s)),spd=(run?9.5:5)/l,sy=Math.sin(P.yaw),cy=Math.cos(P.yaw),fr=W[wi].fric||40,kf=Math.min(1,(P.g?fr:fr>10?fr:1.2)*dt);
 P.vx+=((-sy*f+cy*s)*spd-P.vx)*kf;P.vz+=((-cy*f-sy*s)*spd-P.vz)*kf;
 const dx=(P.vx+KX)*dt,dz=(P.vz+KZ)*dt;KX*=Math.exp(-5*dt);KZ*=Math.exp(-5*dt);
 for(const ax of[0,1]){const nx=P.x+(ax?0:dx),nz=P.z+(ax?dz:0);let bl=false;
  for(const p of PL)if(hit(p,nx,P.y,nz)){if(p.top-P.y<=.4)P.y=p.top;else bl=true}
  if(!bl){P.x=nx;P.z=nz}}
 P.buf-=dt;if(P.g)P.coy=.12;else P.coy-=dt;
 if(P.buf>0){if(P.g||P.coy>0){P.vy=9;P.jumps=1;P.buf=0;P.coy=0;P.g=null;sfx([72,79],.12,'square',.1,.05)}else if(P.jumps<2&&P.buf>.1){P.vy=8.5;P.jumps=2;P.buf=0;sfx([79,86],.12,'square',.1,.05)}}
 P.vy=Math.max(-40,P.vy-(W[wi].gr||25)*dt);let ny=P.y+P.vy*dt;P.wasG=!!P.g;P.g=null;
 for(const p of PL)if(hit(p,P.x,ny,P.z)){if(P.vy<=0&&P.y>=p.top-.5){if(!P.wasG&&P.vy<-7)land(P.vy);ny=p.top;P.vy=0;P.g=p;P.jumps=0;if(p.cp)reach(p);if(p.bounce){P.vy=p.bounce;P.jumps=1;P.g=null;sfx([76,83,91],.15,'sine',.15,.05)}}else if(P.vy>0){ny=p.bot-H;P.vy=0}}
 P.y=ny;if(spawnT>0){spawnT-=dt;const q=PL[0];if(P.y<q.top+.3&&Math.hypot(P.x-q.cx,P.z-q.cz)<q.w){P.y=q.top;P.vy=0;P.g=q;P.jumps=0}}if(P.y<cp.y-30||(W[wi].lr&&P.y<lavaY+.1))respawn();
 for(const p of PL)if(P.g!==p&&hit(p,P.x,P.y,P.z)){if(p.top-P.y<1)P.y=p.top;else if(p.rr){const a=Math.atan2(P.z-p.cz,P.x-p.cx);P.x=p.cx+Math.cos(a)*(p.rr+R+.01);P.z=p.cz+Math.sin(a)*(p.rr+R+.01)}else{const ex=P.x<p.bx?p.x0-R-P.x:p.x1+R-P.x,ez=P.z<p.bz?p.z0-R-P.z:p.z1+R-P.z;if(Math.abs(ex)<Math.abs(ez))P.x+=ex;else P.z+=ez}}
 for(const p of NET.list()){if(p.loc!==wi+':'+lvl)continue;const ux=p.x-P.x,uz=p.z-P.z,d=Math.hypot(ux,uz);if(d<.95&&d>.001&&Math.abs(p.y-P.y)<1.4){const nx=ux/d,nz=uz/d,v=P.vx*nx+P.vz*nz;if(v>1.5&&t>(pushCd[p.id]||0)){pushCd[p.id]=t+.35;const k=4+Math.min(v,9.5)*.55;NET.send({t:'push',to:p.id,kx:+(nx*k).toFixed(2),kz:+(nz*k).toFixed(2)});KX-=nx*1.5;KZ-=nz*1.5}}}
 const mv=Math.hypot(P.vx,P.vz);if(P.g&&mv>1){bob+=dt*(mv>6?13:9);if(Math.sin(bob)<-.98&&!stp){stp=1;sfx([38],.05,'triangle',.07)}if(Math.sin(bob)>0)stp=0}shk*=.88;
 cam.position.set(P.x,P.y+1.6+(P.g&&mv>1?Math.sin(bob)*.035:0)+Math.sin(t*70)*shk,P.z);sun.position.set(P.x+25,P.y+55,P.z-15);sun.target.position.set(P.x,P.y,P.z);sun.target.updateMatrixWorld();cam.rotation.set(P.pit,P.yaw,0,'YXZ');
 cam.fov+=((run&&(f||s)?85:75)-cam.fov)*.1;cam.updateProjectionMatrix();
 SK.position.copy(cam.position);SPN.forEach(m=>m.rotation.z+=dt*.9);if(SKT)SKT.value=t;if(WAT)WAT.value=t;FLT.forEach(o=>o.m.position.set(o.x0+Math.sin(t*.12+o.ph)*o.ax,o.y0+Math.sin(t*.4+o.ph)*o.ay,o.z0));
 BRD.forEach(o=>{o.a+=o.s*dt;o.g.position.set(o.cx+Math.cos(o.a)*o.r,o.y+Math.sin(t+o.ph)*1.5,o.cz+Math.sin(o.a)*o.r);o.g.rotation.y=-o.a;const f=Math.sin(t*9+o.ph)*.6;o.g.userData.b1.rotation.z=f;o.g.userData.b2.rotation.z=-f});
 if(FL){const g=W[wi].fl=='grid';FL.position.x=g?Math.round(P.x/6.67)*6.67:P.x;FL.position.z=g?Math.round(P.z/6.67)*6.67:P.z;FL.position.y+=((W[wi].lr?lavaY:cp.y-28)-FL.position.y)*.2;
  if(W[wi].fl=='lava'){const c=1.2+.4*Math.sin(t*2);FL.material.color.setRGB(c,c*.8,c*.7);FL.material.map.offset.x=t*.01;FL.material.map.offset.y=t*.006}}
 {const a=WXp.geometry.attributes.position.array,vy=W[wi].wx.vy;for(let j=0;j<a.length;j+=3){
  let x=a[j]-P.x,y=a[j+1]-(P.y+10)+vy*dt,z=a[j+2]-P.z;
  a[j]=((x+40)%80+80)%80-40+P.x;a[j+1]=((y+30)%60+60)%60-30+P.y+10;a[j+2]=((z+40)%80+80)%80-40+P.z}
  WXp.geometry.attributes.position.needsUpdate=true}
 for(let i=coins.length-1;i>=0;i--){const c=coins[i];c.rotation.z+=dt*3;c.position.y+=Math.sin(t*3+i)*.003;
  if(Math.hypot(P.x-c.position.x,P.z-c.position.z)<1&&Math.abs(P.y+.9-c.position.y)<1.3){G.remove(c);coins.splice(i,1);score++;SAVE.coins=score;sv();sfx([88,95],.15,'sine',.18,.06)}}
 for(const p of pads){const dd=Math.hypot(P.x-p.x,P.z-p.z);if(dd<p.r&&P.y<1.5){if(!p.in&&!trans)p.fn(p);p.in=true}else if(dd>p.r+.4)p.in=false}
 for(let i=gems.length-1;i>=0;i--){const g=gems[i];g.rotation.y+=dt*2;g.position.y+=Math.sin(t*3)*.004;if(Math.hypot(P.x-g.position.x,P.z-g.position.z)<1.1&&Math.abs(P.y+.9-g.position.y)<1.5){G.remove(g);gems.splice(i,1);SAVE.gems[g.userData.id]=1;score+=25;SAVE.coins=score;sv();sfx([84,91,96],.2,'sine',.2,.07);banner('💎 Gemme secrète : +25 🪙')}}
 for(const q of portals){q.sw.rotation.z+=dt*3;q.disc.material.opacity=.4+.15*Math.sin(t*4);
  if(!trans&&Math.hypot(P.x-q.x,P.z-q.z)<(q.big?1.8:1.2)&&Math.abs(P.y-q.y)<2.5){if(q.lock){if(now-(q.nt||0)>2500){q.nt=now;banner('🔒 '+W[q.d].n+' : '+W[q.d].price+' 🪙 à la boutique')}}else go(q.d)}}
 for(let i=parts.length-1;i>=0;i--){const q=parts[i];q.v.y-=12*dt;q.m.position.addScaledVector(q.v,dt);q.m.rotation.x+=dt*6;q.life-=dt;if(q.life<=0){G.remove(q.m);parts.splice(i,1)}}
 NET.setMe(wi+':'+lvl,P.x,P.y,P.z,P.yaw);AVg.sync(dt,NET.list().filter(p=>p.loc==wi+':'+lvl));
 $('c').textContent='🪙 '+score;if(!W[wi].lobby){const w=W[wi],b=SAVE.best[wi];if(SAVE.mode&&w.par){const q=w.par,tg=wt<=q[0]?['🥇',q[0]]:wt<=q[1]?['🥈',q[1]]:['🥉',q[2]];$('t').textContent='⏱ '+wt.toFixed(1)+' · '+tg[0]+' reste '+(tg[1]-wt).toFixed(1)+'s'}else $('t').textContent='⏱ '+wt.toFixed(1)+'s'+(b?' · 🏆 '+b+'s':'')}else $('t').textContent=(SAVE.mode?'⏱ CLASSÉ':'🌿 NORMAL')+' · choisis un portail';
 if(comp){try{GFX.update(t,dt);comp.render(dt)}catch(e){comp=null;ren.toneMapping=T.ACESFilmicToneMapping;ren.render(sc,cam)}}else ren.render(sc,cam)}
requestAnimationFrame(loop);
function showUI(v){['hud','ban','hint','xh'].forEach(i=>$(i).style.display=v?'':'none');ren.domElement.style.display=v?'block':'none'}
function enter(w,mode){paused=false;PAUSE.hide();SAVE.mode=mode?1:0;sv();lvl=0;trans=false;active=true;showUI(true);$('hint').style.display=document.pointerLockElement?'none':'block';build(w);for(const k in K)K[k]=0;t0=null;last=performance.now();
 const f=$('fade');f.style.transition='none';f.style.opacity=1;f.offsetWidth;f.style.transition='opacity .5s';f.style.opacity=0}
function leave(){paused=false;PAUSE.hide();active=false;showUI(false);const f=$('fade');f.style.transition='none';f.style.opacity=0;for(const k in K)K[k]=0;window.Village.enter()}
window.PK={enter,startAudio,recs:()=>[0,1,2,3,4].map(i=>({n:W[i].n,best:SAVE.best[i]||0,gold:W[i].par[0],ok:recOk(i),sk:SKN.find(q=>q.rec===i).n})),shop:cb=>{openShop();shopCb=typeof cb=='function'?cb:null;ov.style.zIndex=20}};showUI(false);

})();
addEventListener("launch",e=>{Village.leave();PK.enter(e.detail.world,e.detail.mode)});
