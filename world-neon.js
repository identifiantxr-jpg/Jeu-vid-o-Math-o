// ============================================================
//  MONDE NÉON
//  Chargé AVANT game.js (voir index.html). Contient :
//   cfg   : réglages du monde (couleurs, brouillard, musique, forme…)
//   track : forme du parcours (distance, hauteur, taille, virage)
//   opts  : plateformes spéciales (mobiles, qui tombent, trampolines)
// ============================================================
(window.WORLDS=window.WORLDS||{}).neon={
  cfg:{n:'Néon',par:[75,110,160],sky:0x07031a,tip:'spirale classique',bg:0x1a1040,fog:[30,150],hemi:[0xaab0ff,0x331155],sun:0xff9de0,h:[.75,.85,.92,.55,.08],sat:.65,lit:.45,shape:'box',under:0,turn:i=>.36,gap:0,rise:0,deco:'oct',sunc:0xff4fd8,stars:700,fl:'grid',wx:{vy:.5,c:0xff9de0,s:.5},music:{bpm:112,root:45,scale:[0,3,5,7,10],wave:'sawtooth',arp:'square',prog:[0,3,2,4],kick:1}},
  opts(i,kk,te){let o={};if(te==1)o=kk==0?{mv:'v',amp:1.6,sp:1.4}:kk==1?{mv:'h',amp:1.8,sp:1.3}:{};else if(te==2)o=kk==2?{mv:'v',amp:2,sp:1.6}:{mv:'o',amp:1.8,sp:1.2};else if(te==3)o=kk==0?{fall:1,st:0}:kk==1?{mv:'o',amp:2.2,sp:1.7}:{mv:'v',amp:2.4,sp:1.9};else if(te==4)o=kk==0?{fall:1,st:0}:kk==1?{mv:'m',amp:2.6,sp:2}:{mv:'o',amp:2.4,sp:2.2};else if(i%4==3)o={mv:'v',amp:1,sp:1.2};return o},
};
