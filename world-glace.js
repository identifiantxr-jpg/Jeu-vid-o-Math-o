// ============================================================
//  MONDE GLACE
//  Chargé AVANT game.js (voir index.html). Contient :
//   cfg   : réglages du monde (couleurs, brouillard, musique, forme…)
//   track : forme du parcours (distance, hauteur, taille, virage)
//   opts  : plateformes spéciales (mobiles, qui tombent, trampolines)
// ============================================================
(window.WORLDS=window.WORLDS||{}).glace={
  cfg:{n:'Glace',par:[80,115,170],li:.65,sky:0x4a90d0,lay:'ice',fric:2.2,tip:'sol glissant · traversée horizontale',bg:0x9fd0f0,fog:[25,130],hemi:[0xeaf6ff,0x6a8fb0],sun:0xffffff,h:[.55,.5,.6,.65,.45],sat:.6,lit:.55,shape:'hex',under:1,turn:i=>.55*Math.sin(i*.45),gap:.3,rise:.05,deco:'ice',sunc:0x9fe8ff,stars:150,fl:'sea',fc:0xdff0ff,wx:{vy:-2.5,c:0xffffff,s:.35},music:{bpm:92,root:50,scale:[0,2,4,7,9],wave:'sine',arp:'triangle',prog:[0,2,4,1],kick:0}},
  track(i,te,d){let{dd,rs,sz,tn}=d;dd=6.4+te*.5;rs=.05;sz=2.8;tn=.35*Math.sin(i*.7);return{dd,rs,sz,tn}},
  opts(i,kk,te){let o={};o=kk==1?{}:{mv:'h',amp:2.5+te*.4,sp:1+te*.2};if(te>=3&&kk==2)o={fall:1,st:0};return o},
};
