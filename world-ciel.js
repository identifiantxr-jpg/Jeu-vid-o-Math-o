// ============================================================
//  MONDE CIEL
//  Chargé AVANT game.js (voir index.html). Contient :
//   cfg   : réglages du monde (couleurs, brouillard, musique, forme…)
//   track : forme du parcours (distance, hauteur, taille, virage)
//   opts  : plateformes spéciales (mobiles, qui tombent, trampolines)
//   scenery : décor (collines, village, îles flottantes) ; detail : dessous des plateformes
// ============================================================
(window.WORLDS=window.WORLDS||{}).ciel={
  cfg:{n:'Ciel',par:[70,105,150],li:.78,sky:0x1f6fd0,lay:'sky',tip:'îles et trampolines jaunes',bg:0xa8dcff,fog:[90,380],hemi:[0xffffff,0x99cc88],sun:0xfff2b0,h:[.33,.28,.4,.12,.95],sat:.6,lit:.5,shape:'round',under:1,turn:i=>-.25,gap:.5,rise:.1,deco:'cloud',sunc:0xffe680,stars:0,fl:'sea',fc:0xffffff,wx:{vy:.6,c:0xfff6c0,s:.4},music:{bpm:104,root:52,scale:[0,2,4,5,7,9,11],wave:'triangle',arp:'sine',prog:[0,4,5,3],kick:1}},
  cp:7,   // taille des checkpoints
  track(i,te,d){let{dd,rs,sz,tn}=d;const pd=i%2==1;dd=pd?3.8:9.5+te*.5;rs=pd?.4:1.1;sz=pd?2.4:Math.max(4,6.5-te*.5);tn=.45*Math.sin(i*.9);return{dd,rs,sz,tn}},
  opts(i,kk,te){let o={};if(i%2==1){o={bounce:17.5};if(te>=3)Object.assign(o,{mv:'h',amp:2,sp:1.2})}else if(te>=2)o={mv:'o',amp:2,sp:1};return o},
  init(C){
    const{T,mk,hdr,inst,GT}=C;
function grassTex(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#6fbf5a';x.fillRect(0,0,256,256);for(let i=0;i<2500;i++){x.fillStyle='hsla('+(85+Math.random()*30)+',55%,'+(38+Math.random()*22)+'%,.35)';x.fillRect(Math.random()*256,Math.random()*256,2+Math.random()*3,2+Math.random()*3)}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(150,150);t.anisotropy=4;return t}
const L3=new T.MeshLambertMaterial({vertexColors:true,flatShading:true}),GL3=new T.MeshBasicMaterial({vertexColors:true});
function skyGeo(){if(skyGeo.c)return skyGeo.c;const c4=new T.ConeGeometry(1,1,4);c4.rotateY(Math.PI/4);return skyGeo.c={CY:new T.CylinderGeometry(1,1,1,12),CT:new T.CylinderGeometry(1,.8,1,10),CO:new T.ConeGeometry(1,1,9),C4:c4,SP:new T.IcosahedronGeometry(1,1),BX:new T.BoxGeometry(1,1,1),DO:new T.DodecahedronGeometry(1,0),OC:new T.OctahedronGeometry(1,0),TR:new T.TorusGeometry(1,.14,6,14),CS:new T.ConeGeometry(1,1,4,1,true),CL:new T.CylinderGeometry(1,1,1,5,1),SL:new T.IcosahedronGeometry(1,0)}}
function mrg(P,mat){if(!P.length)return null;const pos=[],nor=[],col=[],c=new T.Color(),M=new T.Matrix4(),Q=new T.Quaternion(),E=new T.Euler(),V=new T.Vector3(),S=new T.Vector3();
 for(const p of P){const g=p[0].index?p[0].toNonIndexed():p[0].clone();M.compose(V.set(p[1],p[2],p[3]),Q.setFromEuler(E.set(p[9],p[8],p[10])),S.set(p[4],p[5],p[6]));g.applyMatrix4(M);c.set(p[7]);if(p[11])c.multiplyScalar(p[11]);const a=g.attributes.position.array,n=g.attributes.normal.array;for(let i=0;i<a.length;i+=3){pos.push(a[i],a[i+1],a[i+2]);nor.push(n[i],n[i+1],n[i+2]);col.push(c.r,c.g,c.b)}g.dispose()}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));return new T.Mesh(g,mat)}
function skyDetail(m,s,x,y,z,o){const g=skyGeo(),P=[],Gl=[],A=(h,x,y,z,sx,sy,sz,c,ry,rx,rz)=>P.push([h,x,y,z,sx,sy,sz,c,ry||0,rx||0,rz||0]),B=(h,x,y,z,sx,sy,sz,c)=>Gl.push([h,x,y,z,sx,sy,sz,c,0,0,0,2.2]),
 {CY,CT,CO,SP,BX,DO,TR,CS,CL,SL}=g,PI=Math.PI,rr=s/2;let q=(Math.abs(Math.floor(x*13+y*7+z*5))%2147483646)+1;const rn=()=>(q=q*16807%2147483647)/2147483647,pk=a=>a[rn()*a.length|0];
 if(o.bounce){const sc=rr*.55;A(CT,0,-.5-s*.3,0,s*.13,s*.6,s*.13,0xe8e2d0);A(CY,0,-.55,0,rr*.72,.16,rr*.72,0xd9a400);for(let i=0;i<4;i++)A(TR,0,-.7-i*s*.12,0,sc,sc,sc,i%2?0xffffff:0xffd23a,0,PI/2);
  for(let i=0;i<6;i++){const a=i*1.047;A(CL,Math.cos(a)*rr*.8,.56,Math.sin(a)*rr*.8,.07,.12,.07,0xffffff)}}
 else{A(CY,0,.39,0,rr+.12,.2,rr+.12,0x5fc24a);
  A(CO,0,-.5-s*.35,0,rr*.92,s*.7,rr*.92,0x8a7258,0,PI);A(CO,rr*.1,-.5-s*.85,0,rr*.55,s*.8,rr*.55,0x75604a,0,PI);A(CO,-rr*.08,-.5-s*1.35,0,rr*.25,s*.7,rr*.25,0x645040,0,PI);
  for(let i=0;i<3;i++){const a=i*2.1+rn(),d=rr*.55;A(DO,Math.cos(a)*d,-.5-s*.3,Math.sin(a)*d,rr*.22,rr*.2,rr*.22,pk([0x9a8a7a,0x8a7a6a]),rn()*3)}
  for(let i=0;i<7;i++){const a=i*.9+rn()*.4,l=.5+rn()*s*.35,d=rr*.88;A(CL,Math.cos(a)*d,-.5-l/2,Math.sin(a)*d,.03,l,.03,pk([0x3f7f35,0x4b6a30]));if(i%2)A(SL,Math.cos(a)*d,-.5-l,Math.sin(a)*d,.09,.09,.09,0x5fc24a)}
  for(let i=0;i<6;i++){const a=i*1.05+rn()*.5,d=rr*(.95+rn()*.1),k=.1+rn()*.12;A(DO,Math.cos(a)*d,.55,Math.sin(a)*d,k,k*.7,k,pk([0xa8a298,0x95908a,0xb8b2a6]),rn()*3)}
  for(let i=0;i<Math.round(s*3.5);i++){const a=rn()*6.283,d=rr*(.5+rn()*.5),h=.22+rn()*.3;A(CS,Math.cos(a)*d,.5+h/2,Math.sin(a)*d,.06,h,.06,pk([0x4aa83a,0x5fc24a,0x3f9a35]))}
  for(let i=0;i<7;i++){const a=rn()*6.283,d=rr*(.55+rn()*.4),px=Math.cos(a)*d,pz=Math.sin(a)*d;A(CL,px,.68,pz,.015,.35,.015,0x3f9a35);A(SL,px,.9,pz,.09,.07,.09,pk([0xff6a8a,0xffe14a,0xffffff,0xc77dff,0xff9a3c]))}
  for(let i=0;i<(s>=3?2:1);i++){const a=rn()*6.283,d=rr*.82,px=Math.cos(a)*d,pz=Math.sin(a)*d;A(CL,px,.62,pz,.05,.24,.05,0xf4ead2);A(SL,px,.78,pz,.15,.09,.15,0xd9423a);A(SL,px,.86,pz,.04,.03,.04,0xffffff)}
  if(s>=4.4)for(let i=0;i<3;i++){const a=2.4+i*.5,d=rr*.82;A(SP,Math.cos(a)*d,.7+i%2*.1,Math.sin(a)*d,.32,.27,.32,pk([0x3f9a35,0x4da043,0x5fb54e]))}
  if(o.cp){A(CL,rr*.78,1.1,0,.05,1.2,.05,0x3a2a20);B(SL,rr*.78,1.8,0,.16,.2,.16,0xffd070)}}
 const a=mrg(P,L3),b=mrg(Gl,GL3);if(a)m.add(a);if(b)m.add(b)}
function isle(r,rn){const g=skyGeo(),P=[],Gl=[],A=(h,x,y,z,sx,sy,sz,c,ry,rx,rz)=>P.push([h,x,y,z,sx,sy,sz,c,ry||0,rx||0,rz||0]),B=(h,x,y,z,sx,sy,sz,c,ry)=>Gl.push([h,x,y,z,sx,sy,sz,c,ry||0,0,0,2.2]),pk=a=>a[rn()*a.length|0],{CY,CT,CO,C4,SP,BX,DO,OC,CS,CL,SL}=g,PI=Math.PI,occ=[[r*.95,0,2.2]],
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
 const grp=new T.Group(),a=mrg(P,L3),b=mrg(Gl,GL3);grp.add(a);if(b)grp.add(b);
 const wf=new T.Mesh(new T.BoxGeometry(1.3,r*2.4,.22),new T.MeshBasicMaterial({color:hdr(0x9fe8ff,1.6),transparent:true,opacity:.8}));wf.position.set(r*.92,-r*1.2,0);grp.add(wf);
 const ms=new T.Sprite(new T.SpriteMaterial({map:GT,opacity:.55,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));ms.scale.set(r*1.3,r*1.3,1);ms.position.set(r*.92,-r*2.4,0);grp.add(ms);return grp}
    return{detail:skyDetail,scenery({k,pts,w,rn,n,cx,cz,G,SPN,FLT}){
  const GY=-60,occ=[],rz=x=>cz+35*Math.sin(x/50),free=(x,z,r)=>Math.abs(z-rz(x))>r+5&&occ.every(o=>Math.hypot(o[0]-x,o[1]-z)>o[2]+r);
  const gr=new T.Mesh(new T.PlaneGeometry(1500,1500),new T.MeshLambertMaterial({map:grassTex()}));gr.rotation.x=-Math.PI/2;gr.position.set(cx,GY,cz);G.add(gr);
  const rv=[];for(let x=cx-260;x<cx+260;x+=9){const z=rz(x),sl=Math.atan2(35/50*Math.cos(x/50)*9,9);rv.push([x,GY+.12,z,11,.2,7,-sl,0x4ab0f5])}inst(new T.BoxGeometry(1,1,1),mk(0xffffff),rv);
  const hl=[];for(let i=0;i<34;i++){const a=rn()*6.283,d=35+rn()*190,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,r=14+rn()*20;if(Math.abs(z-rz(x))<r+8)continue;hl.push([x,GY,z,r,r*.4,r,0,rn()>.5?0x5fae4e:0x7cc45e]);occ.push([x,z,r*.8])}
  inst(new T.SphereGeometry(1,12,7),mk(0xffffff),hl);
  const cs=pts[22],ch=cs[3],cs2=1,cco=70,cX=cs[0]+Math.cos(ch)*cco*cs2,cZ=cs[2]+Math.sin(ch)*cco*cs2;
  
  const H=[],R=[],Dd=[],F=[],wc=[0xf4ead2,0xe8d8b8,0xfff8e8,0xd9c7a0],rc=[0xc0392b,0xd35400,0x2e6fb5,0x7a4a2a,0xb03a48],fc=[0xd8c050,0x8fcf5a,0x9b6a3c,0xe6d36a];
  [].forEach(v=>{const q=pts[v[0]],vx=q[0]+Math.cos(q[3])*(12+rn()*30)*v[1],vz=q[2]+Math.sin(q[3])*(12+rn()*30)*v[1],ho=[];
   if(Math.hypot(vx-cX,vz-cZ)<55||Math.abs(vz-rz(vx))<12)return;
   Dd.push([vx,GY+.08,vz,23,.15,23,0,0xc9b28a]);occ.push([vx,vz,24]);
   let tr=0;while(ho.length<v[2]&&tr++<300){const a=rn()*6.283,r=3+rn()*17,x=vx+Math.cos(a)*r,z=vz+Math.sin(a)*r;if(ho.some(o=>Math.hypot(o[0]-x,o[1]-z)<7.5))continue;ho.push([x,z]);
    const hw=3+rn()*2.5,hh=2.4+rn()*1.6,hd=3.5+rn()*2.5,ry=Math.round(rn()*4)*1.5708+(rn()-.5)*.25,rh=2+rn()*1.2;
    H.push([x,GY+.15+hh/2,z,hw,hh,hd,ry,wc[rn()*wc.length|0]]);R.push([x,GY+.15+hh+rh/2,z,hw*.85,rh,hd*.85,ry,rc[rn()*rc.length|0]])}
   for(let i=0;i<5;i++){const a=i*1.257+rn()*.5,d=30+rn()*14,x=vx+Math.cos(a)*d,z=vz+Math.sin(a)*d;if(!free(x,z,9))continue;F.push([x,GY+.12,z,13+rn()*6,.2,9+rn()*5,rn()*3.14,fc[rn()*fc.length|0]]);occ.push([x,z,9])}
   const wg=new T.Group(),wt=new T.Mesh(new T.CylinderGeometry(1.5,2.3,10,8),mk(0xf0e6d0)),wr=new T.Mesh(new T.ConeGeometry(2.6,3.2,8),mk(0x7a4a2a)),bl=new T.Group();wt.position.y=5;wr.position.y=11.6;bl.position.set(0,9.2,2);
   for(let i=0;i<4;i++){const b=new T.Mesh(new T.BoxGeometry(1.1,7.5,.15),mk(0xffffff));b.position.y=3.75;const p=new T.Group();p.rotation.z=i*1.5708;p.add(b);bl.add(p)}
   wg.add(wt,wr,bl);wg.position.set(vx+26,GY,vz-8);wg.rotation.y=rn()*6;G.add(wg);SPN.push(bl);occ.push([vx+26,vz-8,5])});
  const bg=new T.BoxGeometry(1,1,1),cg=new T.ConeGeometry(1,1,4);cg.rotateY(Math.PI/4);
  inst(bg,mk(0xffffff),Dd);inst(bg,mk(0xffffff),H);inst(bg,mk(0xffffff),F);
  const cr=R.map(q=>[q[0],q[1],q[2],q[3]*.707*1.2,q[4],q[5]*.707*1.2,q[6],q[7]]);inst(cg,mk(0xffffff),cr);
  const T1=[],T2=[],T3=[];for(let i=0;i<260;i++){const a=rn()*6.283,d=8+rn()*230,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(!free(x,z,3))continue;const s=.8+rn()*.9;T1.push([x,GY+1,z,.7,2,.7,0,0x6a4a2a]);T2.push([x,GY+2+s*2,z,2*s,5*s,2*s,rn()*3,[0x3f8f3a,0x4da043,0x2f7a3a][i%3]]);T3.push([x,GY+2+s*4.4,z,1.5*s,4*s,1.5*s,rn()*3,[0x4da043,0x5db84e,0x3f8f3a][i%3]])}
  inst(new T.CylinderGeometry(1,1,1,6),mk(0xffffff),T1);inst(new T.ConeGeometry(1,1,7),mk(0xffffff),T2);
  const mt=[],sn=[];for(let i=0,k=0;i<18&&k<400;k++){const a=rn()*6.283,d=90+rn()*130,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,r=35+rn()*30,h=45+rn()*50;if(pts.some(q=>Math.hypot(q[0]-x,q[2]-z)<r+55))continue;i++;mt.push([x,GY+h/2,z,r,h,r,rn()*3,0x8a9cb0]);sn.push([x,GY+h*.8,z,r*.4,h*.4,r*.4,0,0xffffff])}
  inst(new T.ConeGeometry(1,1,7),mk(0xffffff),mt);inst(new T.ConeGeometry(1,1,7),mk(0xffffff),sn);
  inst(new T.ConeGeometry(1,1,7),mk(0xffffff),T3);
  const fw=[],fcs=[0xff6a8a,0xffe14a,0xffffff,0xc77dff,0xff9a3c];for(let i=0;i<900;i++){const a=rn()*6.283,d=6+rn()*200,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(!free(x,z,1))continue;fw.push([x,GY+.4,z,.35,.5,.35,0,fcs[i%5]])}
  inst(new T.BoxGeometry(1,1,1),mk(0xffffff),fw);
  const cs_=[];for(let i=0;i<220;i++){const a=rn()*6.283,d=rn()*300;cs_.push([cx+Math.cos(a)*d,GY+22+rn()*10,cz+Math.sin(a)*d,14+rn()*18,3+rn()*3,14+rn()*18,0,0xffffff])}
  inst(new T.SphereGeometry(1,10,7),new T.MeshLambertMaterial({color:0xffffff,emissive:0x6a7a99}),cs_);
  for(let i=0,tr=0;i<14&&tr<500;tr++){const q=pts[rn()*pts.length|0],a=rn()*6.283,d=24+rn()*40,x=q[0]+Math.cos(a)*d,z=q[2]+Math.sin(a)*d,y=q[1]+(rn()-.4)*26,r=7+rn()*7;if(pts.some(u=>Math.hypot(u[0]-x,u[1]-y,u[2]-z)<r+15))continue;i++;
   const g=isle(r,rn);g.position.set(x,y,z);g.rotation.y=rn()*6;G.add(g);FLT.push({m:g,x0:x,y0:y,z0:z,ph:rn()*6,ax:0,ay:.8})}
    }};
  }
};
