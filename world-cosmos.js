// ============================================================
//  MONDE COSMOS
//  Chargé AVANT game.js (voir index.html). Contient :
//   cfg   : réglages du monde (couleurs, brouillard, musique, forme…)
//   track : forme du parcours (distance, hauteur, taille, virage)
//   opts  : plateformes spéciales (mobiles, qui tombent, trampolines)
// ============================================================
(window.WORLDS=window.WORLDS||{}).cosmos={
  cfg:{n:'Cosmos',par:[85,125,180],price:200,sky:0x000005,lay:'space',gr:11,tip:'faible gravité · orbites',bg:0x05030f,fog:[40,200],hemi:[0x8888ff,0x110033],sun:0x88aaff,h:[.5,.6,.7,.8,.9],sat:.7,lit:.5,shape:'oct',under:0,turn:i=>.7*Math.sin(i*1.3)+.1,gap:.4,rise:0,deco:'planet',sunc:0x66ffee,stars:1500,fl:'',wx:{vy:0,c:0xffffff,s:.25},music:{bpm:76,root:43,scale:[0,2,3,7,8],wave:'sine',arp:'triangle',prog:[0,3,4,2],kick:0}},
  cp:4,
  track(i,te,d){let{dd,rs,sz,tn}=d;dd=6.4+te*.5;rs=.5+2*Math.sin(i*1.7);sz=2.5;tn=.8*Math.sin(i*2.3+1);return{dd,rs,sz,tn}},
  opts(i,kk,te){let o={};o=kk==0?{mv:'o',amp:2,sp:.9+te*.2}:kk==1?{mv:'m',amp:2.2,sp:1.2+te*.2}:{mv:'v',amp:2.5,sp:1.1};if(te>=2&&kk==2)o={fall:1,st:0};return o},
};
