// ============================================================
//  MONDE CIEL
//  Chargé AVANT game.js (voir index.html). Contient :
//   cfg   : réglages du monde (couleurs, brouillard, musique, forme…)
//   track : forme du parcours (distance, hauteur, taille, virage)
//   opts  : plateformes spéciales (mobiles, qui tombent, trampolines)
//   scenery : décor (collines, village, îles flottantes) ; detail : dessous des plateformes
// ============================================================
(window.WORLDS=window.WORLDS||{}).ciel=(()=>{
// Parcours : C=île-relais (checkpoint, début, fin), H=grande île, M=moyenne, m=mini-île décorée,
//  s=îlot, S=îlot mobile, O=îlot orbitant, t=trampoline au bord d'une île. Un « segment » = 8 plateformes entre 2 relais.
const NN=117,CPS=36,hs=(i,s)=>{const x=Math.sin(i*127.1+s*311.7)*43758.5453;return x-Math.floor(x)},
 TPL=['ssmssMss','sSsmtMss','smssOsMt','sMssSsmt','sHssOsmt','mssSsHss','sOsmtMsS','sHsSsOmM'],ORD=[0,1,3,2,4,5,6,1,7,3,2,6,5],
 tk=i=>i==0||i==NN||i%9==0?'C':TPL[ORD[Math.floor(i/9)%ORD.length]][i%9-1],
 dif=i=>Math.min(1,i/NN)*1.2,
 sizeOf=i=>{if(i==NN)return 40;const c=tk(i),h=hs(i,1),D=dif(i);return c=='C'?CPS:c=='H'?30+h*16:c=='M'?Math.max(10,12+h*5-D*1.5):c=='m'?Math.max(7.5,8+h*2.5-D):c=='t'?2.4:c=='S'?Math.max(3.2,4.6-D*.9):c=='O'?Math.max(3.4,4.8-D*.9):Math.max(2.8,4.2+h*.7-D*1.3)},
 mov=(i,te)=>{const c=tk(i);return c=='S'||c=='O'||(c=='s'&&Math.max(te,i/12)>=4&&hs(i,3)>.65)},
 gapN=(i,d)=>{const g0=Math.min(4.4,Math.max(2.4,(d.dd-d.sz)||3));return Math.min(5.2,g0*(.62+.5*Math.min(1,i/80)))},
 trk=(i,te,d)=>{const c=tk(i),L=Math.max(te,i/12),sz=sizeOf(i),h=hs(i,2),pr=i?sizeOf(i-1)/2:0,pc=i?tk(i-1):'C';let dd,rs;
  if(!i){dd=d.dd;rs=0}
  else if(c=='t'){dd=pr+.55;rs=.4}
  else if(pc=='t'){dd=1.2+sz/2+Math.min(8.6,4.8+.5*L);rs=1.1+h*.4}
  else{const g=gapN(i,d)-(mov(i,te)?1:0)-(mov(i-1,te)?.8:0);dd=pr+sz/2+Math.max(1.6,g);rs=c=='C'||c=='H'?.2:c=='M'?.3:c=='m'?.35:(h>.9?-.4:.25+.25*h)}
  return{dd,rs,sz,tn:.4*Math.sin(i*.85)+.5*(Math.sin(i*.09)-Math.sin((i-1)*.09))}},
 opsF=(i,te)=>{const c=tk(i),L=Math.max(te,i/12),h=hs(i,3);let o={};
  if(c=='t'){o.bounce=17.5;if(i>=50&&h>.55)Object.assign(o,{mv:'h',amp:2,sp:1.1+.05*L})}
  else if(c=='S')o={mv:'h',amp:2+Math.min(1,L*.12),sp:.9+.1*L};
  else if(c=='O')o={mv:'o',amp:2,sp:.9+.1*L};
  else if(mov(i,te))o={mv:'h',amp:1.5,sp:1+.08*L};
  return o},
 PAR=(()=>{let len=0;for(let i=1;i<=NN;i++){const te=Math.min(4,Math.floor(i/9));len+=trk(i,te,{dd:5.3+te*.45,sz:Math.max(2.1,3.5-te*.35)}).dd}const g=Math.round(len/9.5*1.35/10)*10;return[g,Math.round(g*1.6/10)*10,Math.round(g*2.6/10)*10]})();
return{
  cfg:{n:'Ciel',par:PAR,li:.78,sky:0x1f6fd0,lay:'sky',tip:'îles et trampolines jaunes',bg:0xa8dcff,fog:[100,460],hemi:[0xffffff,0x99cc88],sun:0xfff2b0,h:[.33,.28,.4,.12,.95],sat:.6,lit:.5,shape:'round',under:1,turn:i=>-.25,gap:.5,rise:.1,deco:'cloud',sunc:0xffe680,stars:0,fl:'sea',fc:0xffffff,wx:{vy:.6,c:0xfff6c0,s:.4},music:{bpm:104,root:52,scale:[0,2,4,5,7,9,11],wave:'triangle',arp:'sine',prog:[0,4,5,3],kick:1}},
  cp:CPS,s0:CPS,sf:40,finDd:0,N:NN,  // relais tous les 9 ; 117 plateformes
  track(i,te,d){return trk(i,te,d)},
  opts(i,kk,te){return opsF(i,te)},
  init(C){
    const{T,mk,hdr,inst,GT,GFX}=C;
function grassTex(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#6fbf5a';x.fillRect(0,0,256,256);for(let i=0;i<2500;i++){x.fillStyle='hsla('+(85+Math.random()*30)+',55%,'+(38+Math.random()*22)+'%,.35)';x.fillRect(Math.random()*256,Math.random()*256,2+Math.random()*3,2+Math.random()*3)}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(150*(grassTex.z||1),150*(grassTex.z||1));t.anisotropy=4;return t}
const L3=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.85,metalness:0,envMapIntensity:.6}),GL3=new T.MeshBasicMaterial({vertexColors:true});
function envL3(){const t=GFX&&GFX.tex||null;if(L3.envMap!==t){L3.envMap=t;L3.needsUpdate=true}}
function skyGeo(){if(skyGeo.c)return skyGeo.c;const c4=new T.ConeGeometry(1,1,4);c4.rotateY(Math.PI/4);return skyGeo.c={CY:new T.CylinderGeometry(1,1,1,12),CT:new T.CylinderGeometry(1,.8,1,10),CO:new T.ConeGeometry(1,1,9),C4:c4,SP:new T.IcosahedronGeometry(1,1),BX:new T.BoxGeometry(1,1,1),DO:new T.DodecahedronGeometry(1,0),OC:new T.OctahedronGeometry(1,0),TR:new T.TorusGeometry(1,.14,6,14),CS:new T.ConeGeometry(1,1,4,1,true),CL:new T.CylinderGeometry(1,1,1,5,1),SL:new T.IcosahedronGeometry(1,0)}}
function mrg(P,mat){if(!P.length)return null;const pos=[],nor=[],col=[],c=new T.Color(),M=new T.Matrix4(),Q=new T.Quaternion(),E=new T.Euler(),V=new T.Vector3(),S=new T.Vector3();
 for(const p of P){const g=p[0].index?p[0].toNonIndexed():p[0].clone();M.compose(V.set(p[1],p[2],p[3]),Q.setFromEuler(E.set(p[9],p[8],p[10])),S.set(p[4],p[5],p[6]));g.applyMatrix4(M);c.set(p[7]);if(p[11])c.multiplyScalar(p[11]);const a=g.attributes.position.array,n=g.attributes.normal.array;for(let i=0;i<a.length;i+=3){pos.push(a[i],a[i+1],a[i+2]);nor.push(n[i],n[i+1],n[i+2]);col.push(c.r,c.g,c.b)}g.dispose()}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));{const me=new T.Mesh(g,mat);if(mat===L3)me.castShadow=me.receiveShadow=true;return me}}
function skyDetail(m,s,x,y,z,o){envL3();const g=skyGeo(),P=[],Gl=[],A=(h,x,y,z,sx,sy,sz,c,ry,rx,rz)=>P.push([h,x,y,z,sx,sy,sz,c,ry||0,rx||0,rz||0]),B=(h,x,y,z,sx,sy,sz,c)=>Gl.push([h,x,y,z,sx,sy,sz,c,0,0,0,2.2]),
 {CY,CT,CO,SP,BX,DO,TR,CS,CL,SL}=g,PI=Math.PI,rr=s/2,sd=Math.min(s,9)+Math.min(Math.max(s-12,0)*.25,9),{C4,OC}=g;let q=(Math.abs(Math.floor(x*13+y*7+z*5))%2147483646)+1;const rn=()=>(q=q*16807%2147483647)/2147483647,pk=a=>a[rn()*a.length|0];
 if(o.bounce){const sc=rr*.55;A(CT,0,-.5-s*.3,0,s*.13,s*.6,s*.13,0xe8e2d0);A(CY,0,-.55,0,rr*.72,.16,rr*.72,0xd9a400);for(let i=0;i<4;i++)A(TR,0,-.7-i*s*.12,0,sc,sc,sc,i%2?0xffffff:0xffd23a,0,PI/2);
  for(let i=0;i<6;i++){const a=i*1.047;A(CL,Math.cos(a)*rr*.8,.56,Math.sin(a)*rr*.8,.07,.12,.07,0xffffff)}}
 else{A(CY,0,.39,0,rr+.12,.2,rr+.12,0x5fc24a);
  A(CO,0,-.5-sd*.35,0,rr*.92,sd*.7,rr*.92,0x8a7258,0,PI);A(CO,rr*.1,-.5-sd*.85,0,rr*.55,sd*.8,rr*.55,0x75604a,0,PI);A(CO,-rr*.08,-.5-sd*1.35,0,rr*.25,sd*.7,rr*.25,0x645040,0,PI);
  for(let i=0;i<3;i++){const a=i*2.1+rn(),d=rr*.55;A(DO,Math.cos(a)*d,-.5-sd*.3,Math.sin(a)*d,rr*.22,rr*.2,rr*.22,pk([0x9a8a7a,0x8a7a6a]),rn()*3)}
  for(let i=0;i<7;i++){const a=i*.9+rn()*.4,l=.5+rn()*sd*.35,d=rr*.88;A(CL,Math.cos(a)*d,-.5-l/2,Math.sin(a)*d,.03,l,.03,pk([0x3f7f35,0x4b6a30]));if(i%2)A(SL,Math.cos(a)*d,-.5-l,Math.sin(a)*d,.09,.09,.09,0x5fc24a)}
  for(let i=0;i<6;i++){const a=i*1.05+rn()*.5,d=rr*(.95+rn()*.1),k=.1+rn()*.12;A(DO,Math.cos(a)*d,.55,Math.sin(a)*d,k,k*.7,k,pk([0xa8a298,0x95908a,0xb8b2a6]),rn()*3)}
  for(let i=0;i<Math.round(s*3.5);i++){const a=rn()*6.283,d=rr*(.5+rn()*.5),h=.22+rn()*.3;A(CS,Math.cos(a)*d,.5+h/2,Math.sin(a)*d,.06,h,.06,pk([0x4aa83a,0x5fc24a,0x3f9a35]))}
  for(let i=0;i<7;i++){const a=rn()*6.283,d=rr*(.55+rn()*.4),px=Math.cos(a)*d,pz=Math.sin(a)*d;A(CL,px,.68,pz,.015,.35,.015,0x3f9a35);A(SL,px,.9,pz,.09,.07,.09,pk([0xff6a8a,0xffe14a,0xffffff,0xc77dff,0xff9a3c]))}
  for(let i=0;i<(s>=3?2:1);i++){const a=rn()*6.283,d=rr*.82,px=Math.cos(a)*d,pz=Math.sin(a)*d;A(CL,px,.62,pz,.05,.24,.05,0xf4ead2);A(SL,px,.78,pz,.15,.09,.15,0xd9423a);A(SL,px,.86,pz,.04,.03,.04,0xffffff)}
  if(s>=4.4)for(let i=0;i<3;i++){const a=2.4+i*.5,d=rr*.82;A(SP,Math.cos(a)*d,.7+i%2*.1,Math.sin(a)*d,.32,.27,.32,pk([0x3f9a35,0x4da043,0x5fb54e]))}
  if(o.cp){A(CL,rr*.78,1.1,0,.05,1.2,.05,0x3a2a20);B(SL,rr*.78,1.8,0,.16,.2,.16,0xffd070)}}
 if(!o.bounce&&s>=3)for(let i=0;i<3;i++){const a=rn()*6.283,d=rr*(.3+rn()*.5);B(OC,Math.cos(a)*d,-.6-sd*(.35+rn()*.5),Math.sin(a)*d,.1+rn()*.08,.3+rn()*.35,.1+rn()*.08,pk([0x66ffee,0xff7ad9,0x9fb8ff]))}
 if(!o.bounce&&s>=7){const big=s>=22,bio=rn()*4|0,
  tree=(x,z,k,t)=>{if(t==0){A(CT,x,.5+.7*k,z,.28*k,1.4*k,.28*k,0x6a4a2a);[[1.5,1.7,1.8,0x2f7a3a],[1.15,2.6,1.6,0x3a8f45],[.8,3.4,1.4,0x46a24f]].forEach(q=>A(CO,x,.5+q[1]*k,z,q[0]*k,q[2]*k,q[0]*k,q[3]))}else{A(CT,x,.5+k,z,.36*k,2*k,.36*k,0x6a4a2a);(t==1?[[0,2.9,0,1.6,0x4da043],[.9,2.3,.3,1.15,0x5fb54e],[-.8,2.4,-.4,1.2,0x3f9a35]]:[[0,2.7,0,1.5,0xf6a3c0],[.9,2.3,.3,1.1,0xf08aa8],[-.8,2.4,-.5,1.15,0xffc2d6]]).forEach(q=>A(SP,x+q[0]*k,.5+q[1]*k,z+q[2]*k,q[3]*k,q[3]*k*.85,q[3]*k,q[4]))}};
  for(let i=0;i<3;i++){const r2=rr+.18-i*.04;A(CY,0,.08-i*.28,0,r2,.26,r2,[0xa38a6a,0x8a7258,0x967c5e][i])}
  for(let i=0,n=Math.round(rr*.9);i<n;i++){const a=rn()*6.283,d=Math.sqrt(rn())*rr*.85,k=Math.min(2+rn()*rr*.18,rr*.97-d);A(CY,Math.cos(a)*d,.5+i*.0015,Math.sin(a)*d,k,.02,k,pk([0x74cf55,0x62b84a,0x84d95f,0x58a843]))}
  for(let c=0,n=Math.round(rr*.35);c<n;c++){const a=rn()*6.283,d=Math.sqrt(rn())*rr*.8,cx2=Math.cos(a)*d,cz2=Math.sin(a)*d,col=pk([0xff6a8a,0xffe14a,0xffffff,0xc77dff,0xff9a3c]);for(let j=0;j<14;j++){const a2=rn()*6.283,d2=rn()*1.6,x=cx2+Math.cos(a2)*d2,z=cz2+Math.sin(a2)*d2;A(CL,x,.62,z,.015,.25,.015,0x3f9a35);A(SL,x,.78,z,.09,.07,.09,col)}}
  if(big){for(let i=0,n=Math.round(rr*1.5);i<n;i++){const a=i/n*6.283,d=rr*.58;A(BX,Math.cos(a)*d,.52,Math.sin(a)*d,.9,.04,.7,0xb8b2a6,-a+1.5708)}
   const R0=rr*.3;Gl.push([TR,0,.55,0,R0,R0,.3,0x66ffee,0,PI/2,0,2.2]);B(CY,0,.53,0,rr*.1,.02,rr*.1,0x66ffee);
   for(let i=0;i<2;i++){const a=rn()*6.283,x=Math.cos(a)*rr,z=Math.sin(a)*rr,len=sd*1.3;Gl.push([BX,x,-len/2,z,2.2,len,.25,0x9fe8ff,PI/2-a,0,0,2.2]);const sp=new T.Sprite(new T.SpriteMaterial({map:GT,opacity:.5,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));sp.scale.set(7,7,1);sp.position.set(x,-len,z);m.add(sp)}}
  for(let i=0,nr=Math.round(rr*1.1);i<nr;i++){const a=i/nr*6.283+rn()*.2,d=rr*(.9+rn()*.08),x=Math.cos(a)*d,z=Math.sin(a)*d,r0=rn();
   if(r0<.5)tree(x,z,(rr<6?.55:1)+rn()*(rr<6?.35:.9),bio==3?2:bio==0?0:rn()*3|0);
   else if(r0<.7){const k=.8+rn()*1.6;A(DO,x,.5+k*.3,z,k,k*.7,k,pk([0x9a958c,0x8a857c,0xa8a298]),rn()*3)}
   else if(r0<.82){B(OC,x,1.1,z,.35,1.5,.35,pk([0x66ffee,0xff7ad9,0x9fb8ff]));B(OC,x+.6,.8,z+.2,.22,.9,.22,0xc77dff)}
   else if(r0<.92){A(CL,x,1.2,z,.06,1.4,.06,0x3a2a20);B(SL,x,2,z,.22,.28,.22,0xffd070)}
   else{for(let j=0;j<3;j++)A(SP,x+j*.5,.9,z+(j%2)*.4,.9,.7,.9,pk([0x3f9a35,0x4da043,0x5fb54e]))}}}
 const a=mrg(P,L3),b=mrg(Gl,GL3);if(a)m.add(a);if(b)m.add(b)}
function isle(r,rn){envL3();const g=skyGeo(),P=[],Gl=[],A=(h,x,y,z,sx,sy,sz,c,ry,rx,rz)=>P.push([h,x,y,z,sx,sy,sz,c,ry||0,rx||0,rz||0]),B=(h,x,y,z,sx,sy,sz,c,ry)=>Gl.push([h,x,y,z,sx,sy,sz,c,ry||0,0,0,2.2]),pk=a=>a[rn()*a.length|0],{CY,CT,CO,C4,SP,BX,DO,OC,CS,CL,SL}=g,PI=Math.PI,occ=[[r*.95,0,2.2]],
 spot=rr=>{for(let t=0;t<40;t++){const a=rn()*6.283,d=Math.sqrt(rn())*(r*.85-rr);if(d<0)return null;const x=Math.cos(a)*d,z=Math.sin(a)*d;if(occ.every(o=>Math.hypot(o[0]-x,o[1]-z)>o[2]+rr))return[x,z]}return null};
 A(CY,0,-.65,0,r,1.3,r,0x78d452);for(let i=0;i<5;i++){const a=i*1.257+rn(),d=r*.72;A(CY,Math.cos(a)*d,-.7,Math.sin(a)*d,r*.42,1.3,r*.42,pk([0x6fcb4c,0x7fdc58]))}
 A(CT,0,-1.65,0,r*.98,.8,r*.98,0x8b6b4a);
 A(CO,0,-2.05-r*.55,0,r*.8,r*1.1,r*.8,0x806a58,0,PI);A(CO,r*.08,-2.05-r*1.15,0,r*.5,r,r*.5,0x6d5848,0,PI);A(CO,-r*.08,-2.05-r*1.75,r*.05,r*.24,r*.8,r*.24,0x5d4a3c,0,PI);
 for(let i=0;i<7;i++){const a=i*.9+rn(),d=r*.62,h=r*(.35+rn()*.4);A(CO,Math.cos(a)*d,-2.1-h/2-rn(),Math.sin(a)*d,r*.14,h,r*.14,pk([0x7a6552,0x8a7460,0x6d5848]),0,PI)}
 for(let i=0;i<14;i++){const a=i*.45+rn()*.3,d=r*.96,l=1+rn()*r*.35;A(CL,Math.cos(a)*d,-1.6-l/2,Math.sin(a)*d,.05,l,.05,pk([0x4b6a30,0x3f7f35,0x5a4630]));if(i%3==0)A(SL,Math.cos(a)*d,-1.6-l,Math.sin(a)*d,.14,.14,.14,0x5fc24a)}
 for(let i=0;i<10;i++){const a=i*.63+rn()*.4,d=r*(.9+rn()*.08),k=.2+rn()*.3;A(DO,Math.cos(a)*d,k*.3,Math.sin(a)*d,k,k*.7,k,pk([0xa8a298,0x95908a,0xb8b2a6]),rn()*3)}
 if(rn()>.25){const k=.75+rn()*.35,sp=spot(3.7*k);if(sp){const yaw=rn()*6.283,cs=Math.cos(yaw),sn=Math.sin(yaw),hx=sp[0],hz=sp[1],wc=pk([0xf4ead2,0xe9d7b5,0xdbe6f0,0xf2d9d4]),rc=pk([0xb8453a,0x3a6ea5,0x7a4a2a,0xc0762f]),wd=0x5a3a24,
  H=(h,lx,ly,lz,sx,sy,sz,c,gl)=>{const X=hx+(lx*cs+lz*sn)*k,Z=hz+(-lx*sn+lz*cs)*k;(gl?B:A)(h,X,ly*k,Z,sx*k,sy*k,sz*k,c,yaw)};
  H(BX,0,.25,0,4.3,.5,3.7,0x9a958c);H(BX,0,1.65,0,3.8,2.3,3.2,wc);
  for(const a of[-1,1])for(const b of[-1,1])H(BX,a*1.9,1.65,b*1.6,.22,2.35,.22,wd);
  for(const y of[1.1,2.5]){H(BX,0,y,1.62,3.85,.16,.1,wd);H(BX,0,y,-1.62,3.85,.16,.1,wd);H(BX,1.92,y,0,.1,.16,3.25,wd);H(BX,-1.92,y,0,.1,.16,3.25,wd)}
  H(C4,0,3.95,0,3.4,2,2.95,rc);H(BX,0,2.85,2.1,4.9,.12,.12,0x4a3a30);H(BX,0,2.85,-2.1,4.9,.12,.12,0x4a3a30);H(BX,2.4,2.85,0,.12,.12,4.2,0x4a3a30);H(BX,-2.4,2.85,0,.12,.12,4.2,0x4a3a30);
  H(BX,1.1,4.1,.4,.55,1.5,.55,0x8a8078);H(BX,1.1,4.9,.4,.72,.12,.72,0x4a4440);
  H(BX,0,1.25,1.64,.85,1.5,.14,0x6a4226);H(BX,0,2.05,1.66,1.15,.14,.14,wd);H(BX,0,.55,2.05,1.3,.12,.55,0xa8a29a);
  for(const sx of[-1.15,1.15]){H(BX,sx,1.9,1.64,.95,.95,.1,wd);H(BX,sx,1.9,1.7,.7,.7,.08,0xffd58a,1);H(BX,sx,1.4,1.78,1.05,.1,.25,wd)}
  H(BX,1.92,1.9,0,.1,.7,.7,0xffd58a,1);H(BX,-1.92,1.9,0,.1,.7,.7,0xffd58a,1);
  H(CL,-1.9,.9,2.5,.05,1.8,.05,0x3a2a20);H(SL,-1.9,1.95,2.5,.18,.22,.18,0xffd070,1);
  for(let f=-3;f<=3;f++)if(Math.abs(f)>.8)H(CL,f,.35,3.4,.06,.7,.06,0xb8975a);
  for(const sx of[-1,1]){H(BX,sx*1.9,.55,3.4,2.2,.07,.05,0xb8975a);H(BX,sx*1.9,.3,3.4,2.2,.07,.05,0xb8975a);H(CL,sx*3,.35,2.5,.06,.7,.06,0xb8975a);H(BX,sx*3,.55,2.45,.05,.07,1.9,0xb8975a)}
  for(let i=0;i<8;i++){const sx=(i<4?-1:1)*(.9+(i%4)*.35);H(SL,sx,.62,2.0,.13,.13,.13,pk([0xff6a8a,0xffe14a,0xffffff,0xc77dff]))}
  occ.push([hx,hz,3.7*k])}}
 if(rn()>.5){const sp=spot(1.4);if(sp){const[x,z]=sp;A(CY,x,.35,z,.75,.7,.75,0x9a958c);A(CY,x,.72,z,.55,.06,.55,0x3a7ab8);for(const d of[-.6,.6])A(BX,x+d,1.0,z,.08,1.3,.08,0x5a3a24);A(C4,x,1.85,z,1.2,.6,1,0x7a4a2a);occ.push([x,z,1])}}
 for(let i=0;i<2;i++){const sp=spot(.8);if(sp){const[x,z]=sp;if(i){A(CY,x,.3,z,.3,.6,.3,0x7a5a3a);A(CY,x,.3,z,.31,.06,.31,0x3a2a20)}else{A(BX,x,.25,z,.5,.5,.5,0xb8975a);A(BX,x+.5,.2,z+.1,.4,.4,.4,0xa8854a,.4)}occ.push([x,z,.6])}}
 for(let i=0,n=3+(r>9?2:1)+(rn()*2|0);i<n;i++){const s=.75+rn()*.55,sp=spot(1.5*s);if(!sp)continue;const[x,z]=sp,t=rn()*3|0;
  if(t==0){A(CT,x,.7*s,z,.28*s,1.4*s,.28*s,0x6a4a2a);[[1.5,1.7,1.8,0x2f7a3a],[1.15,2.6,1.6,0x3a8f45],[.8,3.4,1.4,0x46a24f]].forEach(a=>A(CO,x,a[1]*s,z,a[0]*s,a[2]*s,a[0]*s,a[3]))}
  else{A(CT,x,s,z,.36*s,2*s,.36*s,t==1?0x6a4a2a:0x7a5a3a,0,0,t==1?0:.12);(t==1?[[0,2.9,0,1.6,0x4da043],[.9,2.3,.3,1.15,0x5fb54e],[-.8,2.4,-.4,1.2,0x3f9a35],[.2,3.4,-.7,1,0x6fc65a]]:[[0,2.7,0,1.5,0xf6a3c0],[.9,2.3,.3,1.1,0xf08aa8],[-.8,2.4,-.5,1.15,0xffc2d6],[.1,3.3,-.6,.95,0xf9b4cc]]).forEach(a=>A(SP,x+a[0]*s,a[1]*s,z+a[2]*s,a[3]*s,a[3]*s*.85,a[3]*s,a[4]));
   if(t==2)for(let j=0;j<10;j++){const a=rn()*6.283,d=(1+rn()*1.4)*s;A(CL,x+Math.cos(a)*d,.03,z+Math.sin(a)*d,.12,.03,.12,0xf9b4cc)}}
  occ.push([x,z,1.4*s])}
 for(let i=0;i<2;i++){const sp=spot(1.2);if(!sp)continue;const[x,z]=sp;for(let j=0;j<3;j++)B(OC,x+(j-1)*.35,.5+j%2*.2,z+j*.1,.22,.8+j%2*.4,.22,pk([0x66ffee,0xff7ad9,0x9fb8ff]));occ.push([x,z,.9])}
 for(let i=0;i<3;i++){const sp=spot(1.2);if(!sp)continue;const[x,z]=sp,k=.8+rn()*1.2;A(DO,x,k*.35,z,k,k*.7,k,pk([0x9a958c,0x8a857c]),rn()*3);occ.push([x,z,k])}
 const ok=(x,z)=>occ.every(o=>Math.hypot(o[0]-x,o[1]-z)>o[2]*.85);
 for(let i=0;i<110;i++){const a=rn()*6.283,d=Math.sqrt(rn())*r*.95,x=Math.cos(a)*d,z=Math.sin(a)*d,h=.25+rn()*.35;if(ok(x,z))A(CS,x,h/2,z,.07,h,.07,pk([0x4aa83a,0x5fc24a,0x3f9a35]))}
 for(let i=0;i<50;i++){const a=rn()*6.283,d=Math.sqrt(rn())*r*.93,x=Math.cos(a)*d,z=Math.sin(a)*d;if(!ok(x,z))continue;A(CL,x,.18,z,.02,.36,.02,0x3f9a35);A(SL,x,.4,z,.1,.08,.1,pk([0xff6a8a,0xffe14a,0xffffff,0xc77dff,0xff9a3c]))}
 for(let i=0;i<5;i++){const a=rn()*6.283,d=r*(1.15+rn()*.6),k=.4+rn()*.8,yy=-1.2-rn()*r*.9,X0=Math.cos(a)*d,Z0=Math.sin(a)*d;A(DO,X0,yy,Z0,k,k*.75,k,pk([0x8a7a6a,0x9a8a7a,0x7a6a5a]),rn()*3);if(i%2)A(SP,X0,yy+k*.7,Z0,k*.7,k*.3,k*.7,0x6fcb4c)}
 for(let i=0;i<4;i++){const a=rn()*6.283,d=r*(.3+rn()*.5);B(OC,Math.cos(a)*d,-2.6-rn()*r*.8,Math.sin(a)*d,.25+rn()*.2,.9+rn()*.8,.25+rn()*.2,pk([0x66ffee,0xff7ad9,0x9fb8ff]))}
 const grp=new T.Group(),a=mrg(P,L3),b=mrg(Gl,GL3);grp.add(a);if(b)grp.add(b);
 const wf=new T.Mesh(new T.BoxGeometry(1.3,r*2.4,.22),new T.MeshBasicMaterial({color:hdr(0x9fe8ff,1.6),transparent:true,opacity:.8}));wf.position.set(r*.92,-r*1.2,0);grp.add(wf);
 const ms=new T.Sprite(new T.SpriteMaterial({map:GT,opacity:.55,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));ms.scale.set(r*1.3,r*1.3,1);ms.position.set(r*.92,-r*2.4,0);grp.add(ms);return grp}
    return{detail:skyDetail,scenery({k,pts,w,rn,n,G,SPN,FLT}){
  const GY=-60,Lp=pts.length,pick=()=>pts[rn()*Lp|0],rad=q=>q[4]||0,occ=[];let sx=0,sz=0;pts.forEach(q=>{sx+=q[0];sz+=q[2]});const cx=sx/Lp,cz=sz/Lp;
  grassTex.z=6;const gr=new T.Mesh(new T.PlaneGeometry(9000,9000),new T.MeshLambertMaterial({map:grassTex()}));gr.rotation.x=-Math.PI/2;gr.position.set(cx,GY,cz);G.add(gr);
  const riv=[];for(let i=0;i<Lp;i+=2){const q=pts[i],o=80+28*Math.sin(i*.17);riv.push([q[0]+Math.cos(q[3])*o,q[2]+Math.sin(q[3])*o])}
  const rv=[];for(let i=1;i<riv.length;i++){const a=riv[i-1],b=riv[i],dx=b[0]-a[0],dz=b[1]-a[1];rv.push([(a[0]+b[0])/2,GY+.12,(a[1]+b[1])/2,Math.hypot(dx,dz)+3,.2,10,Math.atan2(-dz,dx),0x4ab0f5])}
  inst(new T.BoxGeometry(1,1,1),mk(0xffffff),rv);
  const free=(x,z,r)=>riv.every(p=>Math.hypot(p[0]-x,p[1]-z)>r+12)&&occ.every(o=>Math.hypot(o[0]-x,o[1]-z)>o[2]+r),at=(a0,a1)=>{const q=pick(),a=rn()*6.283,d=a0+rn()*(a1-a0);return[q[0]+Math.cos(a)*d,q[2]+Math.sin(a)*d]};
  const hl=[];for(let i=0,tr=0;i<Math.round(Lp*.8)&&tr<800;tr++){const[x,z]=at(40,240),r=14+rn()*20;if(!free(x,z,r*.8))continue;i++;hl.push([x,GY,z,r,r*.4,r,0,rn()>.5?0x5fae4e:0x7cc45e]);occ.push([x,z,r*.8])}
  inst(new T.SphereGeometry(1,12,7),mk(0xffffff),hl);
  const T1=[],T2=[],T3=[];for(let i=0,tr=0,nt=Math.min(1000,Lp*7);i<nt&&tr<3000;tr++){const[x,z]=at(10,230);if(!free(x,z,3))continue;const s=.8+rn()*.9;T1.push([x,GY+1,z,.7,2,.7,0,0x6a4a2a]);T2.push([x,GY+2+s*2,z,2*s,5*s,2*s,rn()*3,[0x3f8f3a,0x4da043,0x2f7a3a][i%3]]);T3.push([x,GY+2+s*4.4,z,1.5*s,4*s,1.5*s,rn()*3,[0x4da043,0x5db84e,0x3f8f3a][i%3]]);i++}
  inst(new T.CylinderGeometry(1,1,1,6),mk(0xffffff),T1);inst(new T.ConeGeometry(1,1,7),mk(0xffffff),T2);inst(new T.ConeGeometry(1,1,7),mk(0xffffff),T3);
  const mt=[],sn=[];for(let i=0,tr=0,nm=Math.min(48,Math.round(Lp*.4));i<nm&&tr<900;tr++){const[x,z]=at(120,300),r=35+rn()*30,h=45+rn()*50;if(pts.some(q=>Math.hypot(q[0]-x,q[2]-z)<r+60+rad(q))||mt.some(m=>Math.hypot(m[0]-x,m[2]-z)<(m[3]+r)*.7))continue;i++;mt.push([x,GY+h/2,z,r,h,r,rn()*3,0x8a9cb0]);sn.push([x,GY+h*.8,z,r*.4,h*.4,r*.4,0,0xffffff])}
  inst(new T.ConeGeometry(1,1,7),mk(0xffffff),mt);inst(new T.ConeGeometry(1,1,7),mk(0xffffff),sn);
  const fw=[],fcs=[0xff6a8a,0xffe14a,0xffffff,0xc77dff,0xff9a3c];for(let i=0,tr=0,nf=Math.min(2800,Lp*22);i<nf&&tr<9000;tr++){const[x,z]=at(8,170);if(!free(x,z,1))continue;fw.push([x,GY+.4,z,.35,.5,.35,0,fcs[i%5]]);i++}
  inst(new T.BoxGeometry(1,1,1),mk(0xffffff),fw);
  const cs_=[];for(let i=0,nc=Math.round(Lp*2.4);i<nc;i++){const q=pick();cs_.push([q[0]+(rn()-.5)*340,Math.max(GY+12,q[1]-26-rn()*24),q[2]+(rn()-.5)*340,14+rn()*18,3+rn()*3,14+rn()*18,0,0xffffff])}
  inst(new T.SphereGeometry(1,10,7),new T.MeshLambertMaterial({color:0xffffff,emissive:0x6a7a99}),cs_);
  const iso=[];for(let i=0,tr=0,cnt=12+Math.round(Lp*.2);i<cnt&&tr<1500;tr++){const q=pick(),a=rn()*6.283,d=45+rn()*70,x=q[0]+Math.cos(a)*d,z=q[2]+Math.sin(a)*d,y=q[1]+(rn()-.4)*26,r=7+rn()*7;
   if(pts.some(u=>Math.hypot(u[0]-x,u[1]-y,u[2]-z)<r+18+rad(u))||iso.some(o=>Math.hypot(o[0]-x,o[1]-y,o[2]-z)<o[3]+r+10))continue;i++;iso.push([x,y,z,r]);
   const g=isle(r,rn);g.position.set(x,y,z);g.rotation.y=rn()*6;G.add(g);FLT.push({m:g,x0:x,y0:y,z0:z,ph:rn()*6,ax:0,ay:.8})}
    }};
  }
};})();
