// ============================================================
//  MONDE LAVE
//  Chargé AVANT game.js (voir index.html). Contient :
//   cfg   : réglages du monde (couleurs, brouillard, musique, forme…)
//   track : forme du parcours (distance, hauteur, taille, virage)
//   opts  : plateformes spéciales (mobiles, qui tombent, trampolines)
//   scenery : décor autour de la tour (volcans, château, lave)
// ============================================================
(window.WORLDS=window.WORLDS||{}).lave={
  cfg:{n:'Lave',par:[85,120,170],price:120,sky:0x0e0200,lay:'tower',lr:1,tip:'tour verticale · la lave monte !',bg:0x2a0a08,fog:[20,110],hemi:[0xff8040,0x401005],sun:0xff6a30,h:[.04,.06,.02,.0,.08],sat:.8,lit:.4,shape:'box',under:1,turn:i=>(Math.floor(i/4)%2?1:-1)*.35,gap:.2,rise:0,deco:'rock',sunc:0xff5522,stars:0,fl:'lava',wx:{vy:2.2,c:0xffa030,s:.45},music:{bpm:132,root:40,scale:[0,1,3,5,7,8,10],wave:'square',arp:'sawtooth',prog:[0,0,5,4],kick:1}},
  s0:4.5, cp:3.6, sf:6, pr:2.2, finDd:2,   // taille départ / checkpoints / arrivée, rayon portail, écart final
  track(i,te,d){let{dd,rs,sz,tn}=d;dd=4.3;rs=1.05+te*.03;sz=3.1;tn=.95;return{dd,rs,sz,tn}},
  opts(i,kk,te){let o={};if(kk==0)o={fall:1,st:0};else if(te>=2&&kk==1)o={mv:'o',amp:1.2,sp:1.5};return o},
  init(C){
    const{T,mk,hdr,inst,GT}=C;
function castle(x,y,z,ry,P,G){const g=new T.Group(),bx=(w,h,d,px,py,pz,c)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mk(c));m.position.set(px,py,pz);g.add(m);return m},
 tw=(px,pz,r,h,c,rc)=>{const t=new T.Mesh(new T.CylinderGeometry(r,r*1.1,h,8),mk(c));t.position.set(px,h/2,pz);g.add(t);const f=new T.Mesh(new T.ConeGeometry(r*1.4,r*2.4,8),mk(rc));f.position.set(px,h+r*1.2,pz);g.add(f)},S=15;
 bx(S*2,6,2,0,3,-S,P.wall);bx(S*2,6,2,0,3,S,P.wall);bx(2,6,S*2,-S,3,0,P.wall);bx(2,6,S*2,S,3,0,P.wall);
 for(let i=-S+2;i<=S-2;i+=4){[[i,-S],[i,S],[-S,i],[S,i]].forEach(a=>bx(1.4,1.2,1.4,a[0],6.6,a[1],P.wall))}
 [[-S,-S],[S,-S],[-S,S],[S,S]].forEach(a=>tw(a[0],a[1],2.7,12,P.wall,P.roof));
 bx(5,5.5,.6,0,2.75,S+1.1,P.gate||0x4a3020);
 bx(11,15,11,0,7.5,0,P.wall);[[-5.5,-5.5],[5.5,-5.5],[-5.5,5.5],[5.5,5.5]].forEach(a=>tw(a[0],a[1],1.7,20,P.wall,P.roof));
 tw(0,0,3.3,27,P.wall,P.roof);
 const fl=bx(.2,.2,0,0,0,0,P.flag);fl.geometry=new T.BoxGeometry(3,1.6,.15);fl.position.set(1.5,27+3.3*2.4+2.4,0);g.add(bx(.2,5,.2,0,27+3.3*2.4+1,0,0x3a2a20));
 if(P.glow){const wm=new T.MeshBasicMaterial({color:hdr(P.glow,2.4),fog:false});[[0,-5.6],[0,5.6]].forEach(a=>{for(let i=-3;i<=3;i+=3)for(let j=0;j<2;j++){const w=new T.Mesh(new T.BoxGeometry(1,1.7,.2),wm);w.position.set(i,6+j*4.5,a[1]);g.add(w)}});
  [[-5.6,0],[5.6,0]].forEach(a=>{for(let i=-3;i<=3;i+=3){const w=new T.Mesh(new T.BoxGeometry(.2,1.7,1),wm);w.position.set(a[0],6+(i>0?4.5:0),i);g.add(w)}});
  const w=new T.Mesh(new T.BoxGeometry(1,2,.2),wm);w.position.set(0,20,3.4);g.add(w)}
 g.position.set(x,y,z);g.rotation.y=ry;G.add(g);return g}
    return{scenery({k,pts,w,rn,n,cx,cz,G,SPN,FLT}){
  const BY=-46,top=(h,rt,rb,c,x,z,y)=>{const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,12),mk(c));m.position.set(x,y,z);G.add(m);return m};
  for(let i=0;i<6;i++){const a=i/6*6.283+rn()*.5,d=62+rn()*30,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,r=24+rn()*16,h=55+rn()*35,rt=6+rn()*3;
   top(h,rt,r,0x2e1a14,x,z,BY+h/2);
   const cd=new T.Mesh(new T.CircleGeometry(rt*.85,12),new T.MeshBasicMaterial({color:hdr(0xff5a10,2.6),fog:false}));cd.rotation.x=-Math.PI/2;cd.position.set(x,BY+h+.15,z);G.add(cd);
   const sp=new T.Sprite(new T.SpriteMaterial({map:GT,color:0xff6a20,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false,fog:false}));sp.scale.set(60,60,1);sp.position.set(x,BY+h+8,z);G.add(sp);
   const dx=rt-r,L=Math.hypot(dx,h),sm=new T.MeshBasicMaterial({color:hdr(0xff6a1a,2.2),fog:false});
   for(let j=0;j<3;j++){const az=rn()*6.283,gp=new T.Group(),b=new T.Mesh(new T.BoxGeometry(1.6+rn(),L*(.5+rn()*.4),.3),sm);b.position.set((r+rt)/2+1.3,BY+h/2,0);b.position.x-=0;b.rotation.z=Math.atan2(-dx,h);gp.add(b);gp.position.set(x,0,z);gp.rotation.y=az;G.add(gp)}}
  const cl=[];for(let i=0;i<80;i++){const a=rn()*6.283,d=22+rn()*58,ty=-4+rn()*54,r=2+rn()*3.2,hh=46+ty,s=rn()*.1;cl.push([cx+Math.cos(a)*d,BY+hh/2,cz+Math.sin(a)*d,r,hh,r,rn()*3,new T.Color().setRGB(.16+s,.1+s*.6,.09+s*.5).getHex()])}
  inst(new T.CylinderGeometry(1,1.15,1,6),mk(0xffffff),cl);
  const fa=rn()*6.283,fd=56,fx=cx+Math.cos(fa)*fd,fz=cz+Math.sin(fa)*fd;top(46,17,21,0x2a1a18,fx,fz,BY+23);
  castle(fx,0,fz,-fa+1.5708,{wall:0x3a2c34,roof:0x1c0f14,flag:0xff3a1a,glow:0xff8a30,gate:0x120808},G);
    }};
  }
};
