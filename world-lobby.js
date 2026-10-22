// ============================================================
//  MONDE LOBBY
//  Chargé AVANT game.js (voir index.html). Contient :
//   cfg   : réglages du monde (couleurs, brouillard, musique, forme…)
//   track : forme du parcours (distance, hauteur, taille, virage)
//   opts  : plateformes spéciales (mobiles, qui tombent, trampolines)
//   themes : variantes de couleurs du lobby (boutique)
// ============================================================
(window.WORLDS=window.WORLDS||{}).lobby={
  cfg:{n:'Lobby',lobby:1,li:1,sky:0x3a2a7a,bg:0xf6a878,fog:[60,260],hemi:[0xffe6c8,0x8a5a48],sun:0xffc890,h:[.08,.08,.08,.08,.08],sat:.2,lit:.82,shape:'round',under:1,turn:i=>0,gap:0,rise:0,deco:'cloud',sunc:0xffd890,stars:0,fl:'sea',fc:0xffd8b8,wx:{vy:-.8,c:0xffb0c8,s:.5},music:{bpm:84,root:53,scale:[0,2,4,7,9],wave:'triangle',arp:'sine',prog:[0,3,4,2],kick:0}},
  s0:40,
  themes:{def:{bg:0xf6a878,sky:0x3a2a7a,sunc:0xffd890,hemi:[0xffe6c8,0x8a5a48],sun:0xffc890,fc:0xffd8b8},aurore:{bg:0x7ad0c8,sky:0x0a2a4a,sunc:0x9affd0,hemi:[0xd0fff0,0x305a5a],sun:0xb0ffe0,fc:0xc8fff0},sunset:{bg:0xd05060,sky:0x1a0a2a,sunc:0xff7a50,hemi:[0xffc0b0,0x602030],sun:0xff9a70,fc:0xffb0a0}}
};
