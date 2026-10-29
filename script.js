(function ensureDom(){
  const hud = document.getElementById('hud') || document.body;
  const make = (id, tag, parent, html) => {
    if(document.getElementById(id)) return null;
    const el = document.createElement(tag);
    el.id = id; el.className = 'hidden';
    if(html) el.innerHTML = html;
    parent.appendChild(el);
    return el;
  };
  make('oxyBox', 'div', hud, '<div>🫧 Oxygène</div><div class="bar" id="oxy"><div></div></div>');
  make('under', 'div', hud);
  const mm = make('minimap', 'canvas', hud);
  if(mm){ mm.width = 200; mm.height = 200; }
  make('errbox', 'div', document.body);
})();

// Retire l'option flatShading, que cette version de three.js ne connaît pas
const _MLM = THREE.MeshLambertMaterial;
THREE.MeshLambertMaterial = function(opts = {}){
  const o = Object.assign({}, opts);
  delete o.flatShading;
  return new _MLM(o);
};

/* =====================================================================
   GREG & LES DINOSAURES — V2 — script.js
   Partie 1A : base, données, sons, musique, textures, terrain
   ===================================================================== */

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp = (a,b,t) => a + (b-a)*t;
const rnd = (a,b) => a + Math.random()*(b-a);
const hyp = (ax,az,bx,bz) => Math.hypot(ax-bx, az-bz);
const jit = (hex,a=0.06) => { const c=new THREE.Color(hex); c.offsetHSL(0,0,rnd(-a,a)); return c.getHex(); };
const mat = (c,o={}) => new THREE.MeshLambertMaterial(Object.assign({color:c, flatShading:true}, o));

// Affiche les erreurs en rouge à l'écran
window.addEventListener('error', e => {
  const b = $('errbox'); if(!b) return;
  b.textContent = 'Erreur : ' + e.message + ' (ligne ' + e.lineno + ')';
  b.classList.remove('hidden');
});

/* ---------- CONSTANTES DU MONDE ---------- */
const WL = -2.2;                                   // surface de l'eau
const SKY = 0x9ed9ff;
const VIL = {x:-25, z:25, r:30};                   // village
const MOUNT = {x:-90, z:-90};                      // montagne
const MOUTH = {x:-69, z:-69};                      // entrée de la grotte (monde)
const ROOM = {x:600, z:600, r:34};                 // salle de la grotte (autre carte)
const EXIT = {x:ROOM.x, z:ROOM.z+ROOM.r-1};        // sortie de la grotte
const LAKES = [{x:60,z:-40,r:22},{x:30,z:72,r:15},{x:-118,z:38,r:14}];

/* ---------- ÉTAT DU JEU ---------- */
let state = 'menu';             // menu | cine | play | pause | inv | dialog | mini | set | custom
let zone = 'world';             // world | cave
const keys = {};
let playerHP = 100, food = 80, oxygen = 100, weapon = 'baton';
let yaw = 0, pitch = 0.35, camBase = 6, camDist = 6, aiming = false;
let heading = 0, walkT = 0, crouchS = 1, vy = 0, onGround = true;
let atkT = 0, atkDur = 0.35, atkKind = 'baton', reachT = 0;
let swimK = 0, underwater = false, stepDist = 0, combatT = 0;
let settingsFrom = 'menu';
let sunW = null, fireLight = null, caveLight = null, crystal = null;

/* ---------- OBJETS, INVENTAIRE, MISSIONS ---------- */
const ITEMS = [
  ['baton','🪵','Bâton'], ['bow','🏹','Arc'], ['rock','🪨','Pierre'],
  ['axe','🪓','Hache'], ['pickaxe','⛏️','Pioche en pierre'],
  ['arrow','🪶','Flèches'], ['apple','🍎','Pomme'], ['meat','🍖','Viande'],
  ['wood','🪵','Bois'], ['bigrock','🪨','Gros rocher']
];
const NAME = {}; ITEMS.forEach(i => NAME[i[0]] = i[2]);
const inv = {baton:1,bow:0,rock:0,axe:0,pickaxe:0,arrow:0,apple:0,meat:0,wood:0,bigrock:0};
const HOTBAR = ['baton','bow','rock','axe','pickaxe'];          // touches 1 à 5
const quest = {stage:0, trees:0, flash:false};
const MISSION = [
  "Va voir le chef Akela au centre du village.",
  "Coupe 6 arbres avec ta hache (clic gauche face à un arbre). ({trees}/6)",
  "Retourne voir le chef Akela.",
  "Ramasse 6 pommes et apporte-les au chef. ({apples}/6)",
  "Entre dans la grotte (E devant l'entrée de la montagne) et casse 8 gros rochers à la pioche. ({rocks}/8)",
  "Rapporte les 8 gros rochers au chef pour construire le village.",
  "Mission terminée : le village est construit ! Explore le monde."
];

/* ---------- LISTES DU JEU ---------- */
const pickups = [], monsters = [], projectiles = [], npcs = [], COL = [], TREES = [];
const SWAYS = [], FISH = [], WATERS = [], flowerMats = [], butterflies = [], clouds = [];
const caveWalls = [], debris = [], growHouses = [], TALLZ = [];

/* ---------- SONS (générés par le code, aucun fichier) ---------- */
const SND = {
  ctx:null, sfx:null, mus:null,
  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.ctx.destination);
    this.mus = this.ctx.createGain(); this.mus.connect(this.ctx.destination);
    this.setVol(+$('sSfx').value, +$('sMus').value);
  },
  setVol(s,m){ if(this.ctx){ this.sfx.gain.value = s; this.mus.gain.value = m*0.7; } },
  tone(f,d,type='sine',v=0.2,dest=null,slide=0,delay=0){
    if(!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide), t+d);
    g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(0.0005, t+d);
    o.connect(g); g.connect(dest||this.sfx);
    o.start(t); o.stop(t+d+0.05);
  },
  noise(d,v=0.3,freq=1000,type='lowpass',delay=0,dest=null){
    if(!this.ctx) return;
    const c = this.ctx, len = Math.floor(c.sampleRate*d);
    const buf = c.createBuffer(1,len,c.sampleRate), a = buf.getChannelData(0);
    for(let i=0;i<len;i++) a[i] = (Math.random()*2-1)*(1-i/len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(dest||this.sfx);
    s.start(c.currentTime + delay);
  },
  swing(){ this.noise(0.14,0.25,2500,'bandpass'); },
  chop(){ this.noise(0.06,0.6,900,'bandpass'); this.tone(170,0.12,'square',0.12,null,-70); },
  clink(){ this.tone(1700,0.14,'triangle',0.16,null,-500); this.noise(0.04,0.35,5000,'highpass'); },
  crack(){ this.noise(0.9,0.7,450); this.noise(0.25,0.4,2000,'highpass',0.05); },
  hit(){ this.noise(0.12,0.5,500); this.tone(160,0.15,'square',0.12,null,-80); },
  hurt(){ this.tone(260,0.35,'sawtooth',0.18,null,-150); },
  roar(){ this.tone(110,1.4,'sawtooth',0.22,null,-70); this.noise(1.2,0.2,300); },
  pick(){ this.tone(880,0.1,'sine',0.22); this.tone(1320,0.15,'sine',0.22,null,0,0.08); },
  quest(){ [523,659,784,1046].forEach((f,i)=>this.tone(f,0.25,'triangle',0.18,null,0,i*0.1)); },
  build(){ [220,330,440].forEach((f,i)=>this.tone(f,0.12,'square',0.08,null,0,i*0.12)); },
  shoot(){ this.noise(0.2,0.2,3000,'bandpass'); this.tone(700,0.25,'triangle',0.12,null,-500); },
  step(run){ this.noise(0.05, run?0.22:0.12, rnd(500,900)); },
  splash(){ this.noise(0.6,0.45,3000,'highpass'); this.noise(0.3,0.25,800,'lowpass',0.1); },
  bubble(){ this.tone(rnd(700,1300),0.12,'sine',0.05,null,400); },
  echo(){ this.noise(0.5,0.35,500); this.noise(0.5,0.2,500,'lowpass',0.35); }
};

/* ---------- MUSIQUE (une ambiance par situation) ---------- */
const TRACKS = {
  menu:    {bpm:70, ch:[[261.6,329.6,392],[220,277.2,329.6],[174.6,220,261.6],[196,246.9,293.7]], lead:'sine',     perc:0, lv:0.5},
  world:   {bpm:92, ch:[[196,246.9,293.7],[164.8,207.7,246.9],[146.8,185,220],[174.6,220,261.6]], lead:'triangle', perc:0, lv:0.5},
  village: {bpm:118,ch:[[261.6,329.6,392],[293.7,370,440],[220,277.2,329.6],[246.9,311.1,370]], lead:'triangle', perc:1, lv:0.6},
  combat:  {bpm:150,ch:[[146.8,174.6,220],[130.8,164.8,196],[116.5,146.8,174.6],[123.5,155.6,185]], lead:'sawtooth', perc:2, lv:0.35},
  water:   {bpm:48, ch:[[130.8,164.8,196],[110,138.6,164.8],[98,123.5,146.8],[87.3,110,130.8]], lead:'sine',     perc:3, lv:0.5},
  cave:    {bpm:60, ch:[[65.4,98,130.8],[58.3,87.3,116.5],[55,82.4,110],[61.7,92.5,123.5]], lead:'sine',     perc:4, lv:0.5}
};
const MUS = {
  name:null, timer:null, n:0,
  play(name){
    if(!SND.ctx || this.name===name) return;
    this.name = name;
    clearInterval(this.timer);
    const tr = TRACKS[name], beat = 60/tr.bpm, M = SND.mus;
    const bar = () => {
      const ch = tr.ch[this.n++ % tr.ch.length];
      ch.forEach(f => SND.tone(f, beat*4, 'sine', 0.05, M));
      for(let i=0;i<8;i++){
        if(Math.random()<0.7) SND.tone(ch[Math.floor(Math.random()*3)]*2, beat*0.8, tr.lead, tr.lv*0.12, M, 0, i*beat*0.5);
      }
      for(let i=0;i<4;i++){
        const t = i*beat;
        if(tr.perc===1 && i%2===1) SND.noise(0.05, 0.12, 6000, 'highpass', t, M);
        if(tr.perc===2){
          if(i%2===0) SND.tone(90, 0.2, 'sine', 0.35, M, -50, t);
          else SND.noise(0.1, 0.2, 2500, 'highpass', t, M);
        }
        if(tr.perc===3 && Math.random()<0.6) SND.tone(rnd(600,1200), 0.12, 'sine', 0.05, M, 300, t+rnd(0,beat));
        if(tr.perc===4 && Math.random()<0.4) SND.tone(rnd(1200,2000), 0.2, 'sine', 0.05, M, -600, t+rnd(0,beat*3));
      }
    };
    bar();
    this.timer = setInterval(bar, beat*4000);
  }
};

/* ---------- TEXTURES (créées par le code) ---------- */
function makeTex(size, draw, rep=1){
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  return t;
}
const TEX = {};
// Grain de terre et d'herbe
TEX.ground = makeTex(256, (g,s) => {
  g.fillStyle = '#b8b8b8'; g.fillRect(0,0,s,s);
  for(let i=0;i<3000;i++){
    const v = Math.floor(rnd(140,255));
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rnd(0,s), rnd(0,s), rnd(1,2), rnd(2,6));
  }
  for(let i=0;i<120;i++){
    g.fillStyle = 'rgba(60,60,60,0.25)';
    g.beginPath(); g.arc(rnd(0,s), rnd(0,s), rnd(4,12), 0, Math.PI*2); g.fill();
  }
}, 30);
// Roche avec fissures
TEX.rock = makeTex(256, (g,s) => {
  g.fillStyle = '#8f8a84'; g.fillRect(0,0,s,s);
  for(let i=0;i<1500;i++){
    const v = Math.floor(rnd(90,190));
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(rnd(0,s), rnd(0,s), rnd(2,6), rnd(2,6));
  }
  g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 2;
  for(let i=0;i<18;i++){
    g.beginPath();
    let x = rnd(0,s), y = rnd(0,s); g.moveTo(x,y);
    for(let k=0;k<5;k++){ x += rnd(-20,20); y += rnd(-20,20); g.lineTo(x,y); }
    g.stroke();
  }
});
// Écorce : stries verticales
TEX.bark = makeTex(128, (g,s) => {
  g.fillStyle = '#6b4a2b'; g.fillRect(0,0,s,s);
  for(let i=0;i<90;i++){
    g.fillStyle = `rgba(${Math.floor(rnd(0,40))},${Math.floor(rnd(0,30))},0,0.35)`;
    g.fillRect(rnd(0,s), 0, rnd(1,3), s);
  }
});

/* ---------- RENDU & SCÈNES ---------- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const worldScene = new THREE.Scene();
const caveScene = new THREE.Scene();
worldScene.background = new THREE.Color(SKY);
worldScene.fog = new THREE.Fog(SKY, 80, 260);
caveScene.background = new THREE.Color(0x0d0a08);
caveScene.fog = new THREE.Fog(0x0d0a08, 18, 80);

const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 700);
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Lumière du monde : soleil fort et ombres marquées
worldScene.add(new THREE.HemisphereLight(0xdff3ff, 0x3d5e25, 0.5));
sunW = new THREE.DirectionalLight(0xfff0cc, 1.9);
sunW.castShadow = true;
sunW.shadow.mapSize.set(4096, 4096);
Object.assign(sunW.shadow.camera, {left:-80, right:80, top:80, bottom:-80, near:1, far:400});
sunW.shadow.camera.updateProjectionMatrix();
sunW.shadow.bias = -0.0006;
sunW.shadow.normalBias = 0.05;
worldScene.add(sunW, sunW.target);

/* ---------- HAUTEUR DU MONDE ---------- */
function getHeight(x,z){
  let h = Math.sin(x*0.02)*6 + Math.cos(z*0.025)*5 + Math.sin((x+z)*0.05)*2.5 + Math.sin(x*0.11+z*0.07)*1.2;
  h += Math.max(0, 38 - Math.hypot(x-MOUNT.x, z-MOUNT.z)*0.36);
  for(const L of LAKES){
    const d = Math.hypot(x-L.x, z-L.z);
    if(d < L.r+6){
      const bowl = -4.5 + 2.5*Math.pow(clamp(d/L.r,0,1), 4);     // cuvette du lac
      h = d < L.r ? bowl : lerp(-2.0, h, clamp((d-L.r)/6,0,1));
    }
  }
  const dv = Math.hypot(x-VIL.x, z-VIL.z);
  if(dv < VIL.r+8) h = lerp(2, h, clamp((dv-VIL.r)/8, 0, 1));   // village plat
  return h;
}
// Hauteur du sol selon la zone (la grotte a un sol plat)
function groundY(x,z){ return zone==='cave' ? 0 : getHeight(x,z); }

/* ---------- TERRAIN ---------- */
const tgeo = new THREE.PlaneGeometry(460, 460, 160, 160);
tgeo.rotateX(-Math.PI/2);
const tp = tgeo.attributes.position, tcol = [];
const CL = {
  g1:new THREE.Color(0x5fa83a), g2:new THREE.Color(0x4a8f30), dirt:new THREE.Color(0x9c7b4b),
  sand:new THREE.Color(0xe6d28e), rock:new THREE.Color(0x8a847b), mud:new THREE.Color(0x5e4a2c)
};
for(let i=0;i<tp.count;i++){
  const x = tp.getX(i), z = tp.getZ(i), h = getHeight(x,z);
  tp.setY(i, h);
  let c = h < -1.2 ? CL.sand : h > 24 ? CL.rock : h > 17 ? CL.dirt
        : (Math.sin(x*0.3)*Math.cos(z*0.27) > 0.2 ? CL.g2 : CL.g1);
  if(h >= -1.2 && h < 0.5) c = c.clone().lerp(CL.mud, 0.45);   // berges boueuses
  const n = 0.9 + Math.random()*0.2;
  tcol.push(c.r*n, c.g*n, c.b*n);
}
tgeo.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3));
tgeo.computeVertexNormals();
const terrain = new THREE.Mesh(tgeo, new THREE.MeshLambertMaterial({vertexColors:true, map:TEX.ground}));
terrain.receiveShadow = true;
worldScene.add(terrain);

/* =====================================================================
   Partie 1B : monde extérieur (lacs, poissons, village, maisons,
   arbres, rochers, herbe haute, fleurs, dinosaures, pommes)
   ===================================================================== */

/* ---------- OUTILS DE MODÉLISATION ---------- */
function part(parent,w,h,d,color,x=0,y=0,z=0){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color));
  m.position.set(x,y,z); m.castShadow = m.receiveShadow = true;
  parent.add(m); return m;
}
function limb(parent,x,y,z,w,len,d,color,foot=false){
  const piv = new THREE.Group(); piv.position.set(x,y,z); parent.add(piv);
  part(piv,w,len,d,color,0,-len/2,0);
  if(foot) part(piv,w*1.3,0.18,d*1.8,0x2a2118,0,-len-0.05,-d*0.3);
  return piv;
}
function buildHuman(shirt,pants,hair,skin){
  const g = new THREE.Group();
  const legs = [limb(g,-0.2,0.9,0,0.28,0.9,0.3,pants), limb(g,0.2,0.9,0,0.28,0.9,0.3,pants)];
  part(g,0.6,0.7,0.36,shirt,0,1.25,0);
  const arms = [limb(g,-0.42,1.6,0,0.2,0.7,0.2,shirt), limb(g,0.42,1.6,0,0.2,0.7,0.2,shirt)];
  part(g,0.42,0.42,0.42,skin,0,1.8,0);
  part(g,0.46,0.14,0.44,hair,0,2.02,0);
  return {g,legs,arms};
}

// Formes de base partagées
const BOX   = new THREE.BoxGeometry(1,1,1);
const CONE  = new THREE.ConeGeometry(1,1,7);
const SPH   = new THREE.SphereGeometry(1,8,6);
const DODEC = new THREE.DodecahedronGeometry(1,0);
const BLOB  = new THREE.IcosahedronGeometry(1,0);
const CYL   = new THREE.CylinderGeometry(1,1,1,8);
const bladeGeo = new THREE.BoxGeometry(0.07,1,0.07); bladeGeo.translate(0,0.5,0);   // base à l'origine
const leafGeo  = new THREE.BoxGeometry(0.28,1,0.04); leafGeo.translate(0,0.5,0);

// Matériaux partagés
const grassMat = new THREE.MeshLambertMaterial({color:0x5aa838, flatShading:true});
const seaMat   = new THREE.MeshLambertMaterial({color:0x2f9e6a, flatShading:true});
const algaeMat = new THREE.MeshLambertMaterial({color:0x2f7d3a, flatShading:true, side:THREE.DoubleSide});
const reedMat  = new THREE.MeshLambertMaterial({color:0x8fbf4a, flatShading:true});
const rockMat  = new THREE.MeshLambertMaterial({map:TEX.rock, flatShading:true});
const barkMat  = new THREE.MeshLambertMaterial({map:TEX.bark, flatShading:true});
const birchMat = new THREE.MeshLambertMaterial({color:0xeeeade, flatShading:true});
const darkMat  = new THREE.MeshLambertMaterial({color:0x2a2a2a, flatShading:true});
const appleMat = new THREE.MeshLambertMaterial({color:0xd42a2a, flatShading:true});
const waterMat = new THREE.MeshPhongMaterial({color:0x2a9fd6, transparent:true, opacity:0.68, shininess:110, specular:0x88ccff});
const coralMats = [0xff5c8a,0xff8c42,0xc86bff,0xffd166,0xff4d4d]
  .map(c => new THREE.MeshLambertMaterial({color:c, flatShading:true}));
const FISH_COLS = [0xffa62b,0xffe14d,0x3ab0ff,0xff5ea8,0xf5f5f5];
const TREE_MAT = {
  pin:     new THREE.MeshLambertMaterial({color:0x2e6b2e, flatShading:true}),
  chene:   new THREE.MeshLambertMaterial({color:0x3f8f3a, flatShading:true}),
  bouleau: new THREE.MeshLambertMaterial({color:0xa6d85e, flatShading:true}),
  palmier: new THREE.MeshLambertMaterial({color:0x3fa34d, flatShading:true}),
  pommier: new THREE.MeshLambertMaterial({color:0x4a9a3a, flatShading:true})
};

/* ---------- OUTILS DE ZONE ---------- */
function nearVillage(x,z){ return hyp(x,z,VIL.x,VIL.z) < VIL.r+4; }
function nearLake(x,z){ return LAKES.some(L => hyp(x,z,L.x,L.z) < L.r+6); }
function nearMouth(x,z){ return hyp(x,z,MOUTH.x,MOUTH.z) < 9; }
// Vrai si on peut poser un objet ici (pas dans l'eau, pas sur un autre objet)
function free(x,z,r=1){
  const h = getHeight(x,z);
  return !nearVillage(x,z) && !nearLake(x,z) && !nearMouth(x,z) &&
         h > -1 && h < 24 && COL.every(c => hyp(c.x,c.z,x,z) > c.r + r);
}
// Vrai si (x,z) est dans l'herbe haute (pour se cacher)
function inTallGrass(x,z){ return TALLZ.some(p => hyp(x,z,p.x,p.z) < p.r); }

/* ---------- LACS, POISSONS, CORAUX ---------- */
function lakeSpot(L,margin){
  const a = rnd(0,Math.PI*2), d = Math.sqrt(Math.random())*(L.r-margin);
  return {x:L.x+Math.cos(a)*d, z:L.z+Math.sin(a)*d};
}
// Une lame d'herbe / algue dont la base est (x,y,z). Elle ondule grâce à SWAYS.
function addBlade(geo,m,x,y,z,h,scn,amp=0.08){
  const b = new THREE.Mesh(geo,m);
  b.position.set(x,y,z); b.scale.set(1,h,1); b.rotation.y = rnd(0,6.28);
  scn.add(b); SWAYS.push({m:b, ph:rnd(0,6.28), amp});
  return b;
}
function buildCoral(x,y,z){
  const g = new THREE.Group(), m = coralMats[Math.floor(Math.random()*coralMats.length)];
  for(let i=0, n=3+Math.floor(Math.random()*3); i<n; i++){
    const h = rnd(0.5,1.3), c = new THREE.Mesh(CONE, m);
    c.scale.set(rnd(0.15,0.25), h, rnd(0.15,0.25));
    c.position.set(rnd(-0.3,0.3), h/2, rnd(-0.3,0.3));
    c.rotation.set(rnd(-0.3,0.3),0,rnd(-0.3,0.3));
    g.add(c);
  }
  g.position.set(x,y,z); worldScene.add(g);
}
function buildFish(){
  const g = new THREE.Group(), col = FISH_COLS[Math.floor(Math.random()*FISH_COLS.length)];
  const body = new THREE.Mesh(SPH, mat(col)); body.scale.set(0.36,0.2,0.14); g.add(body);
  const tail = new THREE.Mesh(CONE, mat(col)); tail.scale.set(0.12,0.22,0.04);
  tail.rotation.z = Math.PI/2; tail.position.x = -0.3; g.add(tail);
  return g;
}
function buildLake(L){
  // surface de l'eau
  const surf = new THREE.Mesh(new THREE.CircleGeometry(L.r+7,48), waterMat);
  surf.rotation.x = -Math.PI/2; surf.position.set(L.x,WL,L.z);
  worldScene.add(surf); WATERS.push(surf);
  // coraux
  for(let i=0;i<16;i++){ const p = lakeSpot(L,2.5); buildCoral(p.x,getHeight(p.x,p.z),p.z); }
  // pierres au fond
  for(let i=0;i<8;i++){
    const p = lakeSpot(L,2), s = rnd(0.5,1.2), r = new THREE.Mesh(DODEC,rockMat);
    r.scale.setScalar(s); r.position.set(p.x,getHeight(p.x,p.z)+s*0.2,p.z);
    r.rotation.set(rnd(0,3),rnd(0,3),0); worldScene.add(r);
  }
  // algues (feuilles plates)
  for(let i=0;i<22;i++){
    const p = lakeSpot(L,1.5), y = getHeight(p.x,p.z);
    for(let k=0;k<5;k++) addBlade(leafGeo,algaeMat,p.x+rnd(-0.5,0.5),y,p.z+rnd(-0.5,0.5),rnd(0.7,1.2),worldScene,0.15);
  }
  // herbes marines (longues)
  for(let i=0;i<26;i++){
    const p = lakeSpot(L,1.5), y = getHeight(p.x,p.z);
    for(let k=0;k<6;k++) addBlade(bladeGeo,seaMat,p.x+rnd(-0.4,0.4),y,p.z+rnd(-0.4,0.4),rnd(1.0,1.8),worldScene,0.12);
  }
  // roseaux au bord
  for(let i=0;i<20;i++){
    const a = rnd(0,6.28), d = L.r-0.5+rnd(0,2.5), x = L.x+Math.cos(a)*d, z = L.z+Math.sin(a)*d;
    for(let k=0;k<4;k++) addBlade(bladeGeo,reedMat,x+rnd(-0.3,0.3),getHeight(x,z),z+rnd(-0.3,0.3),rnd(1.6,2.4),worldScene,0.1);
  }
  // poissons qui nagent en rond
  for(let i=0;i<7;i++){
    const g = buildFish(); worldScene.add(g);
    FISH.push({g, cx:L.x, cz:L.z, R:L.r*rnd(0.35,0.6), ph:rnd(0,6.28), sp:rnd(0.25,0.5)});
  }
}

/* ---------- ENTRÉE DE LA GROTTE (dans la montagne) ---------- */
function buildCaveMouth(){
  const g = new THREE.Group(), stone = 0x7a756d;
  part(g,1.3,4.4,2,stone,-2.4,2.2,0.8);
  part(g,1.3,4.4,2,stone,2.4,2.2,0.8);
  part(g,6.1,1.5,2.2,stone,0,4.9,0.8);
  part(g,3.4,4,1.2,0x030303,0,2,-0.1);                     // trou noir
  for(let i=0;i<5;i++) part(g,rnd(0.8,1.6),rnd(0.6,1.2),rnd(0.8,1.6),0x6a655e,rnd(-3.5,3.5),0.3,rnd(1.8,2.6));
  g.position.set(MOUTH.x, getHeight(MOUTH.x,MOUTH.z)-0.4, MOUTH.z);
  g.rotation.y = Math.PI/4;                                 // l'entrée regarde vers l'extérieur
  worldScene.add(g);
}

/* ---------- VILLAGE & MAISONS-CHAMPIGNONS ---------- */
// Tige + chapeau rouge à pois blancs, porte et fenêtres
function buildMushroomHouse(x,z,rot=0,s=1){
  const g = new THREE.Group(), H = 3*s, R = 1*s;
  const rAt = y => R*(1 - 0.2*y/H);                         // rayon de la tige à la hauteur y
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.8*R,R,H,12), mat(0xf2e6d0));
  stem.position.y = H/2; stem.castShadow = stem.receiveShadow = true; g.add(stem);
  const capR = 2.6*s;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR,14,8,0,Math.PI*2,0,Math.PI/2), mat(0xd33a2a));
  cap.scale.y = 0.6; cap.position.y = H; cap.castShadow = true; g.add(cap);
  for(let i=0;i<7;i++){                                      // pois blancs
    const a = rnd(0,6.28), d = rnd(0.2,2.2)*s;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.2,0.35)*s,6,4), mat(0xffffff));
    spot.position.set(Math.cos(a)*d, H + 0.6*Math.sqrt(Math.max(0,capR*capR - d*d)) + 0.05*s, Math.sin(a)*d);
    g.add(spot);
  }
  const door = new THREE.Mesh(BOX, mat(0x5a3418));           // porte
  door.scale.set(0.6*s,1.2*s,0.12*s); door.position.set(0,0.6*s,rAt(0.6*s)+0.02*s); g.add(door);
  for(const sx of [-1,1]){                                   // fenêtres avec croix
    const y = 1.9*s, z = rAt(y)+0.02*s, x2 = sx*0.5*s;
    const win = new THREE.Mesh(BOX, mat(0x9fe7ff)); win.scale.set(0.45*s,0.45*s,0.1*s); win.position.set(x2,y,z); g.add(win);
    const b1 = new THREE.Mesh(BOX, mat(0xffffff)); b1.scale.set(0.5*s,0.05*s,0.12*s); b1.position.set(x2,y,z); g.add(b1);
    const b2 = new THREE.Mesh(BOX, mat(0xffffff)); b2.scale.set(0.05*s,0.5*s,0.12*s); b2.position.set(x2,y,z); g.add(b2);
  }
  g.position.set(x,getHeight(x,z),z); g.rotation.y = rot;
  worldScene.add(g);
  return g;
}
function buildVillage(){
  // grande maison du chef
  buildMushroomHouse(VIL.x, VIL.z-4, 0, 2.2);
  COL.push({x:VIL.x, z:VIL.z-4, r:2.6});
  // 5 maisons autour de la place (tournées vers le centre)
  for(let k=0;k<5;k++){
    const a = k*1.26+0.5, x = VIL.x+Math.cos(a)*15, z = VIL.z+Math.sin(a)*15;
    buildMushroomHouse(x,z, Math.atan2(-Math.cos(a),-Math.sin(a)), 1);
    COL.push({x,z,r:1.3});
  }
  // 8 emplacements à construire : cachés au début, révélés par revealHouse(i)
  for(let k=0;k<8;k++){
    const a = k/8*Math.PI*2+0.3, x = VIL.x+Math.cos(a)*23, z = VIL.z+Math.sin(a)*23;
    const g = buildMushroomHouse(x,z, Math.atan2(-Math.cos(a),-Math.sin(a)), 1);
    g.visible = false;
    growHouses.push({g,x,z,grow:1});
  }
  // feu de camp
  const cf = new THREE.Group();
  for(let i=0;i<4;i++){ const log = part(cf,0.2,0.2,1.4,0x5a3a1a,0,0.1,0); log.rotation.y = i*Math.PI/4; }
  const flame = new THREE.Mesh(CONE, new THREE.MeshLambertMaterial({color:0xff7a1a, emissive:0xff4400}));
  flame.scale.set(0.4,1,0.4); flame.position.y = 0.7; cf.add(flame);
  fireLight = new THREE.PointLight(0xff8a3c, 1.4, 14, 1.5);
  fireLight.position.set(0,1.2,0); cf.add(fireLight);
  cf.position.set(VIL.x+4, getHeight(VIL.x+4,VIL.z+3), VIL.z+3);
  worldScene.add(cf);
  // habitants
  makeNPC('chef','Chef Akela', VIL.x-2, VIL.z+3, 0x8a5a2b,0x3a3a3a,0xbbbbbb, g=>{
    part(g,0.48,0.08,0.46,0xd33a2a,0,1.93,0);               // bandeau rouge
    part(g,0.4,0.3,0.1,0xdddddd,0,1.62,-0.22);             // barbe blanche
  });
  makeNPC('mara','Mara', VIL.x+6, VIL.z-1, 0xd9a441,0x5a3a7a,0x3a2010, null);
  makeNPC('tom','Tom le chasseur', VIL.x-7, VIL.z-2, 0x4d6b3a,0x2e2a1e,0x6b4a2b, g=>{
    part(g,0.3,0.15,0.1,0x3a2a1a,0,1.7,-0.23);             // barbe
  });
  makeNPC('v1','Villageois', VIL.x+6, VIL.z+10, 0x3a7ad9,0x444444,0x222222, null);
  makeNPC('v2','Villageoise', VIL.x-14, VIL.z+10, 0xe07ab0,0x333355,0x8a4a1a, null);
}
function makeNPC(id,name,x,z,shirt,pants,hair,extra){
  const h = buildHuman(shirt,pants,hair,0xf1c79a);
  h.g.position.set(x,getHeight(x,z),z);
  if(extra) extra(h.g);
  worldScene.add(h.g);
  npcs.push({id,name,g:h.g,arms:h.arms,gave:false});
}
// Révèle un emplacement à construire (appelé par les missions)
function revealHouse(i){
  const h = growHouses[i];
  if(!h || h.g.visible) return;
  h.g.visible = true; h.g.scale.setScalar(0.01); h.grow = 0;
  COL.push({x:h.x, z:h.z, r:1.3});
}

/* ---------- ARBRES (5 sortes, à abattre à la hache) ---------- */
function makeTree(kind){
  const g = new THREE.Group(), h = kind==='palmier' ? rnd(4.5,6.5) : rnd(2.4,3.4), M = TREE_MAT[kind];
  const add = (geo,m,x,y,z,sx,sy,sz)=>{
    const o = new THREE.Mesh(geo,m); o.position.set(x,y,z); o.scale.set(sx,sy,sz);
    o.castShadow = true; g.add(o); return o;
  };
  add(CYL, kind==='bouleau' ? birchMat : barkMat, 0,h/2,0, 0.22,h,0.22);   // tronc
  if(kind==='pin'){
    for(let i=0;i<3;i++) add(CONE,M, 0,h+i*1.1,0, 2.1-i*0.6,2.4,2.1-i*0.6);
  } else if(kind==='chene'){
    for(let i=0;i<4;i++){ const r=rnd(1.1,1.7); add(BLOB,M, rnd(-0.9,0.9),h+rnd(0,1.2),rnd(-0.9,0.9), r,r,r); }
  } else if(kind==='bouleau'){
    for(let i=0;i<3;i++){ const r=rnd(0.9,1.3); add(DODEC,M, rnd(-0.6,0.6),h+rnd(0,1),rnd(-0.6,0.6), r,r,r); }
    for(let i=0;i<5;i++) add(BOX,darkMat, 0,rnd(0.4,h-0.3),0.2, 0.25,0.1,0.02);
  } else if(kind==='palmier'){
    for(let i=0;i<7;i++){ const a=i/7*Math.PI*2, l=add(BOX,M, Math.sin(a),h+0.2,Math.cos(a), 0.35,0.06,2.2); l.rotation.set(0.45,a,0); }
  } else {                                                  // pommier : des pommes rouges
    add(BLOB,M, 0,h+1,0, 1.6,1.4,1.6);
    for(let i=0;i<8;i++) add(SPH,appleMat, rnd(-1.2,1.2),h+rnd(0.3,1.8),rnd(-1.2,1.2), 0.14,0.14,0.14);
  }
  return g;
}
function buildTrees(){
  const KINDS = ['pin','pin','chene','chene','chene','bouleau','palmier','pommier'];
  let placed = 0;
  for(let i=0;i<1400 && placed<240;i++){
    const x=rnd(-185,185), z=rnd(-185,185);
    if(!free(x,z,1.6)) continue;
    const kind = KINDS[Math.floor(Math.random()*KINDS.length)], s = rnd(0.85,1.35);
    const g = makeTree(kind);
    g.scale.setScalar(s); g.rotation.y = rnd(0,6.28);
    g.position.set(x,getHeight(x,z)-0.2,z);
    worldScene.add(g);
    const col = {x,z,r:0.55*s+0.25};
    COL.push(col);
    TREES.push({x,z,g,kind,col,cut:false,fallT:0,fdir:Math.random()<0.5?1:-1});
    placed++;
  }
  // 9 pommes au sol, près des pommiers les plus proches du village (pour la mission)
  TREES.filter(t => t.kind==='pommier')
       .sort((a,b) => hyp(a.x,a.z,VIL.x,VIL.z) - hyp(b.x,b.z,VIL.x,VIL.z))
       .slice(0,9)
       .forEach(t => spawnPickup('apple', t.x+rnd(-1.5,1.5), t.z+rnd(-1.5,1.5)));
}
// Abat un arbre (appelé par la hache)
function cutTree(t){
  if(t.cut) return false;
  t.cut = true; t.fallT = 0;
  const i = COL.indexOf(t.col); if(i>=0) COL.splice(i,1);
  inv.wood++; quest.trees++;
  SND.chop();
  spawnDebris(t.x, getHeight(t.x,t.z)+1.5, t.z, 0x6b4a2b, 10);
  return true;
}

/* ---------- ROCHERS, HERBE HAUTE, FLEURS, NUAGES, PAPILLONS ---------- */
function buildRocks(){
  for(let i=0;i<70;i++){
    const x=rnd(-185,185), z=rnd(-185,185);
    if(!free(x,z,2)) continue;
    const s = rnd(0.8,2.2), r = new THREE.Mesh(DODEC,rockMat);
    r.scale.setScalar(s); r.position.set(x,getHeight(x,z)+s*0.4,z);
    r.rotation.set(rnd(0,3),rnd(0,3),rnd(0,3));
    r.castShadow = r.receiveShadow = true; worldScene.add(r);
    COL.push({x,z,r:s*0.8});
  }
  for(let i=0, n=0; i<300 && n<45; i++){                    // cailloux à ramasser
    const x=rnd(-185,185), z=rnd(-185,185);
    if(!free(x,z,1)) continue;
    spawnPickup('rock',x,z); n++;
  }
}
// Patchs d'herbe haute : on peut s'y cacher
function buildTallGrass(){
  for(let i=0, n=0; i<500 && n<22; i++){
    const x=rnd(-170,170), z=rnd(-170,170), r=rnd(3,5);
    if(!free(x,z,r) || getHeight(x,z)>12) continue;
    TALLZ.push({x,z,r}); n++;
    for(let k=0;k<Math.floor(r*r*2.2);k++){
      const a=rnd(0,6.28), d=Math.sqrt(Math.random())*r, bx=x+Math.cos(a)*d, bz=z+Math.sin(a)*d;
      addBlade(bladeGeo, grassMat, bx, getHeight(bx,bz)-0.05, bz, rnd(0.9,1.5), worldScene, 0.1);
    }
  }
}
function buildFlowers(){
  const FL = [0xff5577,0xffd34d,0xc68bff,0xffffff,0xff9a3c];
  for(let i=0, n=0; i<700 && n<140; i++){
    const x=rnd(-170,170), z=rnd(-170,170);
    if(!free(x,z,0.5)) continue;
    const f = new THREE.Group();
    const stem = new THREE.Mesh(CYL, grassMat); stem.scale.set(0.03,0.6,0.03); stem.position.y = 0.3; f.add(stem);
    const fm = new THREE.MeshLambertMaterial({color:FL[Math.floor(Math.random()*FL.length)]});
    fm.userData.h = Math.random();
    const head = new THREE.Mesh(SPH, fm); head.scale.setScalar(0.14); head.position.y = 0.65; f.add(head);
    flowerMats.push(fm);
    f.position.set(x,getHeight(x,z),z); worldScene.add(f); n++;
  }
}
function buildButterflies(){
  for(let i=0;i<10;i++){
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.3),
      new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(rnd(0,1),1,0.6), side:THREE.DoubleSide}));
    worldScene.add(b);
    butterflies.push({b, cx:rnd(-120,120), cz:rnd(-120,120), ph:rnd(0,6), r:rnd(4,10)});
  }
}
function buildClouds(){
  for(let i=0;i<12;i++){
    const g = new THREE.Group();
    for(let j=0;j<4;j++){
      const m = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({color:0xffffff}));
      m.scale.set(rnd(6,12),rnd(2,3),rnd(6,10)); m.position.set(rnd(-4,4),0,rnd(-3,3)); g.add(m);
    }
    g.position.set(rnd(-200,200),rnd(55,75),rnd(-200,200));
    worldScene.add(g); clouds.push(g);
  }
}

/* ---------- DINOSAURES (assemblés en blocs) ---------- */
const SPEC = {
  trex:    {hp:90, dmg:14, cool:1.6, speed:4.2, detect:20, reach:3.6, aggro:true,  retal:false, scale:1.3,  name:'T-Rex'},
  raptor:  {hp:30, dmg:7,  cool:1.0, speed:6.0, detect:17, reach:2.4, aggro:true,  retal:false, scale:0.95, name:'Vélociraptor'},
  brachio: {hp:160,dmg:0,  cool:99,  speed:1.6, detect:0,  reach:0,   aggro:false, retal:false, scale:1.0,  name:'Brachiosaure'},
  stego:   {hp:65, dmg:9,  cool:1.4, speed:2.6, detect:0,  reach:2.8, aggro:false, retal:true,  scale:1.0,  name:'Stégosaure'},
  ptero:   {hp:35, dmg:0,  cool:99,  speed:0,   detect:0,  reach:0,   aggro:false, retal:false, scale:0.9,  name:'Ptérosaure', fly:true}
};
function buildDino(kind){
  const spec = SPEC[kind], root = new THREE.Group(), body = new THREE.Group();
  root.add(body); root.scale.setScalar(spec.scale);
  const base = {trex:0x7a8f2a, raptor:0x9a6b3c, brachio:0x7fa06a, stego:0x6a8a92, ptero:0x5a4a6a}[kind];
  const col = () => jit(base,0.05), dark = 0x3a2a1a;
  const legs = [], arms = [];
  let tail=null, head=null, wingL=null, wingR=null;

  if(kind==='trex'){
    part(body,1.8,1.5,3.2,col(),0,2.4,0);
    part(body,1.1,1.2,1.1,col(),0,3.1,-1.7);
    head = new THREE.Group(); head.position.set(0,3.5,-2.4); body.add(head);
    part(head,1.3,1.2,1.9,col(),0,0,-0.2);
    part(head,1.1,0.4,1.7,col(),0,-0.7,-0.2);
    part(head,0.15,0.25,0.15,0xffffff,0.35,-0.5,-1.0);
    part(head,0.15,0.25,0.15,0xffffff,-0.35,-0.5,-1.0);
    part(head,0.18,0.18,0.08,0xff2a1a,0.4,0.2,-1.15);
    part(head,0.18,0.18,0.08,0xff2a1a,-0.4,0.2,-1.15);
    arms.push(limb(body,0.75,2.5,-1.0,0.3,0.7,0.3,col()));
    arms.push(limb(body,-0.75,2.5,-1.0,0.3,0.7,0.3,col()));
    legs.push(limb(body,0.7,1.5,0.2,0.6,1.5,0.7,col(),true));
    legs.push(limb(body,-0.7,1.5,0.2,0.6,1.5,0.7,col(),true));
    tail = new THREE.Group(); tail.position.set(0,2.6,1.3); body.add(tail);
    for(let i=0;i<4;i++) part(tail,1.1-i*0.22,0.9-i*0.16,0.9,col(),0,-i*0.05,0.7+i*0.8);
  }
  else if(kind==='raptor'){
    part(body,0.9,0.7,1.8,col(),0,1.35,0);
    part(body,0.55,0.6,0.7,col(),0,1.6,-1.0);
    head = new THREE.Group(); head.position.set(0,1.8,-1.5); body.add(head);
    part(head,0.6,0.5,0.9,col(),0,0,-0.2);
    part(head,0.4,0.2,0.9,0xf2ead0,0,-0.2,-0.3);
    part(head,0.08,0.08,0.05,0xff2200,0.2,0.1,-0.5);
    part(head,0.08,0.08,0.05,0xff2200,-0.2,0.1,-0.5);
    tail = new THREE.Group(); tail.position.set(0,1.4,1.0); body.add(tail);
    for(let i=0;i<4;i++) part(tail,0.6-i*0.12,0.35-i*0.05,0.7,col(),0,0,0.4+i*0.6);
    legs.push(limb(body,0.35,1.1,0.1,0.28,1.1,0.35,col(),true));
    legs.push(limb(body,-0.35,1.1,0.1,0.28,1.1,0.35,col(),true));
    arms.push(limb(body,0.45,1.7,-0.5,0.12,0.4,0.12,col()));
    arms.push(limb(body,-0.45,1.7,-0.5,0.12,0.4,0.12,col()));
    for(let i=0;i<3;i++) part(body,0.92,0.1,0.25,dark,0,1.7,-0.5+i*0.5);
  }
  else if(kind==='brachio'){
    part(body,2.4,1.8,4,col(),0,3.6,0);
    const neck = new THREE.Group(); neck.position.set(0,4.2,-1.6); body.add(neck);
    for(let i=0;i<4;i++) part(neck,0.8,0.9,0.8,col(),0,i*0.9,-i*0.25);
    head = new THREE.Group(); head.position.set(0,7.2,-2.8); body.add(head);
    part(head,1.1,0.9,1.5,col(),0,0,-0.4);
    part(head,0.15,0.15,0.1,0x111111,0.4,0.15,-1.15);
    part(head,0.15,0.15,0.1,0x111111,-0.4,0.15,-1.15);
    tail = new THREE.Group(); tail.position.set(0,3.4,1.9); body.add(tail);
    for(let i=0;i<4;i++) part(tail,0.9-i*0.18,0.8-i*0.15,0.9,col(),0,-i*0.08,0.6+i*0.9);
    [[0.9,1.4],[-0.9,1.4],[0.9,-1.4],[-0.9,-1.4]].forEach(([x,z])=>legs.push(limb(body,x,2.6,z,0.8,2.6,0.8,col(),true)));
  }
  else if(kind==='stego'){
    part(body,1.6,1.1,2.6,col(),0,1.7,0);
    part(body,0.9,0.8,0.9,col(),0,1.8,-1.5);
    head = new THREE.Group(); head.position.set(0,1.6,-2.0); body.add(head);
    part(head,0.9,0.6,0.9,col(),0,0,-0.3);
    part(head,0.1,0.1,0.05,0xffee00,0.25,0.1,-0.75);
    part(head,0.1,0.1,0.05,0xffee00,-0.25,0.1,-0.75);
    for(let i=-3;i<=3;i++) part(body,0.12,0.9,0.5,0xe0622f,0,2.5,i*0.35);
    tail = new THREE.Group(); tail.position.set(0,1.5,1.4); body.add(tail);
    for(let i=0;i<3;i++) part(tail,0.7-i*0.15,0.5-i*0.1,0.8,col(),0,0,0.5+i*0.7);
    part(tail,0.12,0.5,0.12,0xe0622f,0.4,0.3,2.6);
    part(tail,0.12,0.5,0.12,0xe0622f,-0.4,0.3,2.6);
    [[0.5,0.9],[-0.5,0.9],[0.5,-0.9],[-0.5,-0.9]].forEach(([x,z])=>legs.push(limb(body,x,1.0,z,0.35,1.0,0.35,col(),true)));
  }
  else if(kind==='ptero'){
    part(body,0.6,0.5,1.4,col(),0,0,0);
    head = new THREE.Group(); head.position.set(0,0.15,-0.9); body.add(head);
    part(head,0.4,0.35,0.7,col(),0,0,-0.3);
    part(head,0.2,0.12,0.9,0xffcc44,0,-0.05,-0.9);
    wingL = new THREE.Group(); wingL.position.set(0.3,0.1,0); body.add(wingL);
    part(wingL,3.2,0.08,1.2,col(),1.6,0,0);
    wingR = new THREE.Group(); wingR.position.set(-0.3,0.1,0); body.add(wingR);
    part(wingR,3.2,0.08,1.2,col(),-1.6,0,0);
  }

  return {
    kind,spec,root,body,legs,arms,tail,head,wingL,wingR,
    hp:spec.hp, cool:0, angry:0, attackT:0, hitT:0,
    dead:false, deadT:0, removed:false, phase:Math.random()*6,
    wanderT:rnd(1,4), walk:false, tx:0, tz:0, home:{x:0,z:0}
  };
}
function spawnMonster(kind,x,z){
  const m = buildDino(kind);
  m.root.position.set(x,getHeight(x,z),z);
  if(SPEC[kind].fly) m.root.position.y = getHeight(x,z)+22;
  m.home = {x,z}; m.tx = x; m.tz = z;
  worldScene.add(m.root); monsters.push(m);
}
function spawnRandom(kind,n,minVil){
  for(let k=0, tries=0; k<n && tries<2000; tries++){
    const x=rnd(-185,185), z=rnd(-185,185), h=getHeight(x,z);
    if(h<-1 || h>22) continue;
    if(hyp(x,z,VIL.x,VIL.z)<minVil || hyp(x,z,MOUTH.x,MOUTH.z)<25) continue;
    if(!free(x,z,2)) continue;
    spawnMonster(kind,x,z); k++;
  }
}

/* ---------- OBJETS À RAMASSER & DÉBRIS ---------- */
function makePickupMesh(type){
  const g = new THREE.Group();
  const add = (geo,color,x,y,z,sx,sy,sz)=>{
    const m = new THREE.Mesh(geo, mat(color)); m.position.set(x,y,z); m.scale.set(sx,sy,sz);
    m.castShadow = true; g.add(m); return m;
  };
  switch(type){
    case 'apple':   add(SPH,0xd42a2a,0,0.22,0,0.22,0.22,0.22); add(BOX,0x5a3a1a,0,0.45,0,0.05,0.12,0.05); break;
    case 'meat':    add(SPH,0xc0392b,0,0.2,0,0.3,0.2,0.22); break;
    case 'rock':    add(DODEC,0x8c8a86,0,0.22,0,0.22,0.22,0.22); break;
    case 'bigrock': add(DODEC,0x7d7870,0,0.5,0,0.5,0.5,0.5); break;
    case 'wood':    add(CYL,0x8b5a2b,0,0.2,0,0.18,0.9,0.18).rotation.z = Math.PI/2; break;
    case 'baton':   add(BOX,0x7a5230,0,0.5,0,0.12,1,0.12); break;
    case 'bow': {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.45,0.035,6,16,Math.PI), mat(0x7a4a22));
      m.position.y = 0.6; m.rotation.z = -Math.PI/2; g.add(m); break; }
    case 'arrow':   for(let i=0;i<3;i++) add(BOX,0x8b5a2b,(i-1)*0.1,0.1,0,0.03,0.03,0.9).rotation.y = 0.5; break;
    case 'axe':     add(BOX,0x7a5230,0,0.5,0,0.08,1,0.08); add(BOX,0x9a9a9a,0,0.95,0,0.3,0.22,0.08); break;
    case 'pickaxe': add(BOX,0x7a5230,0,0.5,0,0.08,1,0.08); add(BOX,0x8c8a86,0,0.95,0,0.7,0.14,0.12); break;
  }
  return g;
}
// scn = worldScene (monde) ou caveScene (grotte)
function spawnPickup(type,x,z,count=1,yOff=0,scn=worldScene){
  const g = makePickupMesh(type);
  const gy = scn===caveScene ? 0 : getHeight(x,z), base = gy + 0.4 + yOff;
  g.position.set(x,base,z); scn.add(g);
  pickups.push({type,count,g,base,scn});
}
function removePickup(p){
  if(p.g.parent) p.g.parent.remove(p.g);
  const i = pickups.indexOf(p); if(i>=0) pickups.splice(i,1);
}
function spawnDebris(x,y,z,color,n=8,scn=worldScene){
  for(let i=0;i<n;i++){
    const m = new THREE.Mesh(BOX, mat(color)); m.scale.setScalar(rnd(0.08,0.2));
    m.position.set(x,y,z); scn.add(m);
    debris.push({m, scn, life:1.5, v:new THREE.Vector3(rnd(-3,3),rnd(2,6),rnd(-3,3))});
  }
}

/* ---------- ASSEMBLAGE DU MONDE EXTÉRIEUR ---------- */
function buildOverworld(){
  LAKES.forEach(L => buildLake(L));
  buildCaveMouth();
  buildVillage();
  buildTrees();
  buildRocks();
  buildTallGrass();
  buildFlowers();
  buildButterflies();
  buildClouds();
  spawnRandom('raptor',6,35);
  spawnRandom('trex',3,60);
  spawnRandom('brachio',4,40);
  spawnRandom('stego',3,40);
  spawnRandom('ptero',2,0);
}

/* ---------- ANIMATIONS DU MONDE EXTÉRIEUR ---------- */
function animateWorld(dt,t){
  clouds.forEach(c=>{ c.position.x += dt*2; if(c.position.x>230) c.position.x = -230; });
  WATERS.forEach((w,i)=>{ w.position.y = WL + Math.sin(t*1.2+i)*0.05; });
  SWAYS.forEach(s=>{ s.m.rotation.z = Math.sin(t*1.6+s.ph)*s.amp; });
  FISH.forEach(f=>{
    const a = t*f.sp + f.ph;
    f.g.position.set(f.cx+Math.cos(a)*f.R, WL-0.9+Math.sin(t*2+f.ph)*0.25, f.cz+Math.sin(a)*f.R);
    f.g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
  });
  butterflies.forEach(b=>{
    b.b.position.set(b.cx+Math.cos(t*0.4+b.ph)*b.r, getHeight(b.cx,b.cz)+2.5+Math.sin(t*2+b.ph)*0.6, b.cz+Math.sin(t*0.4+b.ph)*b.r);
    b.b.lookAt(camera.position);
  });
  flowerMats.forEach(fm => fm.color.setHSL((fm.userData.h + t*0.02)%1, 0.7, 0.6));
  // arbres abattus qui tombent
  TREES.forEach(tr=>{
    if(tr.cut && tr.fallT<1.5){
      tr.fallT = Math.min(1.5, tr.fallT+dt);
      tr.g.rotation.z = tr.fdir*Math.min(Math.PI/2, tr.fallT*1.6);
    }
  });
  // maisons qui poussent
  growHouses.forEach(h=>{
    if(h.grow!==undefined && h.grow<1){
      h.grow = Math.min(1, h.grow+dt*0.8);
      h.g.scale.setScalar(Math.max(0.01, 1-Math.pow(1-h.grow,3)));
    }
  });
  if(fireLight) fireLight.intensity = 1.2+Math.sin(t*14)*0.25+Math.sin(t*5.3)*0.15;
  pickups.forEach(p=>{
    if(p.scn!==worldScene) return;
    p.g.rotation.y += dt*1.5;
    p.g.position.y = p.base + Math.sin(t*2+p.g.position.x)*0.08;
  });
  for(let i=debris.length-1;i>=0;i--){
    const d = debris[i];
    d.v.y -= 14*dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += dt*8; d.life -= dt;
    if(d.life<=0){ d.scn.remove(d.m); debris.splice(i,1); }
  }
}

/* =====================================================================
   Partie 2A : Greg (modèle articulé, animations, nage couché),
   mouvement, eau et oxygène, combat, projectiles, IA des dinosaures,
   ramassage, HUD, souris
   ===================================================================== */

/* ---------- ÉTAT DE GREG ---------- */
let wet = false, diving = false, pickT = 0, bubbleT = 0, lastHud = '', toastT = null;
const CAVE_COL = [];                       // collisions de la grotte
let activeCOL = COL;                       // collisions de la zone actuelle
const PS = {lL:0, lR:0, aL:0, aR:0, aLz:0, aRz:0, tor:0, yaw:0, hd:0};   // pose lissée
const arrowMat = mat(0x8b5a2b), stoneMat = mat(0x8c8a86);

/* ---------- APPARENCE DE GREG ---------- */
const PAL = {
  skin:  [0xffe0c4,0xf1c79a,0xd9a066,0xb87a4b,0x8d5524,0x5a3825],
  hair:  [0x1b1b1b,0x4a2e1a,0x8b5a2b,0xd9a441,0xc4572a,0x9aa0a6,0xe05fa0,0x3a7ad9],
  eyes:  [0x3b2a1a,0x2f6fd6,0x3fa34d,0x8a6a2a,0x7a8896],
  cloth: [0x2f6fd6,0xd33a2a,0x3fa34d,0xe8c13a,0x222222,0xf2f2f2,0xe07a2a,0x7a4ad9,0xe07ab0],
  pants: [0x2b3a67,0x1f1f1f,0x4a6fa5,0x8a7a4a,0x666b73,0x5a3a1a,0x9a2a2a,0x3a5a3a],
  shoes: [0x2a2118,0xf2f2f2,0xd33a2a,0x2f6fd6,0x1f1f1f,0x3fa34d,0xe8c13a,0xe07ab0],
  acc:   [0x3b3b3b,0xd33a2a,0x2f6fd6,0xe8c13a,0x3fa34d,0xf2f2f2,0xe07a2a,0xe07ab0]
};
const LOOK = {skin:1,face:0,eyes:0,hair:0,hairC:1,top:0,topC:0,bot:0,botC:0,shoe:0,shoeC:0,hat:0,glasses:0,bag:1,accC:0};
const shade = (c,k) => new THREE.Color(c).multiplyScalar(k).getHex();

function buildGreg(L=LOOK){
  const skin=PAL.skin[L.skin], hairC=PAL.hair[L.hairC], eyeC=PAL.eyes[L.eyes], shirt=PAL.cloth[L.topC],
        pants=PAL.pants[L.botC], shoe=PAL.shoes[L.shoeC], acc=PAL.acc[L.accC];
  const addM = (parent,m,x,y,z,sx,sy,sz) => {
    const o = new THREE.Mesh(BOX, m); o.position.set(x,y,z); o.scale.set(sx,sy,sz);
    o.castShadow = true; parent.add(o); return o;
  };
  const root = new THREE.Group();
  const hip = new THREE.Group(); hip.position.y = 0.9; root.add(hip);

  // Bas : 0 slim, 1 large, 2 short
  const lw = L.bot===1 ? 0.32 : L.bot===2 ? 0.29 : 0.25, ld = L.bot===1 ? 0.34 : 0.27;
  part(hip, L.bot===1 ? 0.62 : 0.52, 0.26, 0.34, pants, 0, 0.02, 0);
  const mkLeg = x => {
    const piv = new THREE.Group(); piv.position.set(x,0,0); hip.add(piv);
    if(L.bot===2){ part(piv,lw,0.42,ld,pants,0,-0.21,0); part(piv,0.22,0.44,0.24,skin,0,-0.64,0); }
    else part(piv,lw,0.86,ld,pants,0,-0.43,0);
    // Pieds : 0 chaussures, 1 baskets, 2 chaussettes, 3 chaussons
    if(L.shoe===0){ part(piv,0.3,0.15,0.44,shoe,0,-0.88,-0.07); part(piv,0.28,0.14,0.3,shoe,0,-0.76,0.02); }
    else if(L.shoe===1){
      part(piv,0.3,0.05,0.46,0xf2f2f2,0,-0.93,-0.08);
      part(piv,0.28,0.12,0.38,shoe,0,-0.85,-0.04);
      part(piv,0.26,0.07,0.1,0xf2f2f2,0,-0.88,-0.27);
    }
    else if(L.shoe===2){ part(piv,0.27,0.3,0.28,shoe,0,-0.72,0); part(piv,0.28,0.1,0.42,shoe,0,-0.9,-0.07); }
    else { part(piv,0.3,0.1,0.44,shoe,0,-0.9,-0.07); part(piv,0.3,0.14,0.12,shade(shoe,0.8),0,-0.84,0.1); }
    return piv;
  };
  const lx = L.bot===1 ? 0.18 : 0.17;
  const legL = mkLeg(-lx), legR = mkLeg(lx);

  // Haut : 0 t-shirt, 1 marcel, 2 sweat
  const torso = new THREE.Group(); torso.position.y = 0.12; hip.add(torso);
  const tw = L.top===2 ? 0.66 : 0.6, td = L.top===2 ? 0.4 : 0.36;
  if(L.top===1){ part(torso,0.6,0.7,0.36,skin,0,0.35,0); part(torso,0.4,0.7,0.38,shirt,0,0.35,0); }
  else part(torso,tw,0.7,td,shirt,0,0.35,0);
  if(L.top===2) part(torso,tw+0.02,0.1,td+0.02,shade(shirt,0.8),0,0.05,0);
  else part(torso,0.62,0.09,0.38,0x2a2a2a,0,0.02,0);
  if(L.bag) part(torso,0.5,0.55,0.24,acc,0,0.32,td/2+0.1);

  const ax = L.top===2 ? 0.45 : 0.42;
  const mkArm = x => {
    const piv = new THREE.Group(); piv.position.set(x,0.62,0); torso.add(piv);
    if(L.top===0){ part(piv,0.22,0.3,0.22,shirt,0,-0.15,0); part(piv,0.2,0.4,0.2,skin,0,-0.5,0); }
    else if(L.top===1) part(piv,0.2,0.7,0.2,skin,0,-0.35,0);
    else part(piv,0.23,0.7,0.23,shirt,0,-0.35,0);
    part(piv,0.2,0.2,0.2,skin,0,-0.8,0);
    return piv;
  };
  const armL = mkArm(-ax), armR = mkArm(ax);

  // Tête : 0 carré, 1 large, 2 allongé
  const [hw,hh,hd] = [[0.42,0.42,0.42],[0.5,0.4,0.42],[0.37,0.5,0.4]][L.face];
  const head = new THREE.Group(); head.position.y = 0.62; torso.add(head);
  part(head,hw,hh,hd,skin,0,hh/2,0);
  const ez = -(hd/2+0.01), ey = hh*0.57;
  for(const s of [-1,1]){
    part(head,0.11,0.08,0.03,0xffffff,s*hw*0.24,ey,ez);
    part(head,0.055,0.07,0.03,eyeC,s*hw*0.24,ey,ez-0.01);
    part(head,0.11,0.025,0.03,hairC,s*hw*0.24,ey+0.075,ez);        // sourcil
    part(head,0.04,0.1,0.08,skin,s*(hw/2+0.02),hh*0.45,0);         // oreille
  }
  part(head,0.06,0.08,0.06,shade(skin,0.92),0,hh*0.36,ez-0.02);    // nez
  part(head,0.14,0.04,0.03,0x8a3b2a,0,hh*0.2,ez);                  // bouche

  // Cheveux : 0 court, 1 long, 2 banane, 3 chauve
  if(L.hair<3){
    part(head,hw+0.04,hh*0.5,0.06,hairC,0,hh*0.74,hd/2);
    if(L.hair===1){
      part(head,hw+0.04,hh,0.1,hairC,0,hh*0.45,hd/2+0.03);
      for(const s of [-1,1]) part(head,0.06,hh*0.75,hd*0.8,hairC,s*(hw/2+0.03),hh*0.6,0.04);
    }
    if(!L.hat){
      part(head,hw+0.04,0.12,hd+0.02,hairC,0,hh-0.02,0);
      if(L.hair===2) part(head,hw*0.7,0.2,hd*0.7,hairC,0,hh+0.12,-0.04);
    }
  }
  // Accessoires
  if(L.hat===1){
    part(head,hw+0.06,0.14,hd+0.06,acc,0,hh+0.03,0);
    part(head,hw*0.85,0.035,0.26,shade(acc,0.8),0,hh-0.02,-(hd/2+0.13));
  } else if(L.hat===2){
    part(head,hw+0.06,0.26,hd+0.06,acc,0,hh+0.05,0);
    part(head,hw+0.08,0.08,hd+0.08,shade(acc,0.75),0,hh-0.03,0);
    part(head,0.12,0.12,0.12,0xf2f2f2,0,hh+0.24,0);
  }
  if(L.glasses){
    const gc = 0x161616, gz = -(hd/2+0.03);
    for(const s of [-1,1]){
      const gx = s*hw*0.24;
      part(head,0.17,0.02,0.02,gc,gx,ey+0.06,gz);
      part(head,0.17,0.02,0.02,gc,gx,ey-0.06,gz);
      part(head,0.02,0.12,0.02,gc,gx-0.085,ey,gz);
      part(head,0.02,0.12,0.02,gc,gx+0.085,ey,gz);
      part(head,0.02,0.02,hd*0.9,gc,s*(hw/2+0.02),ey+0.04,0);
    }
  }

  // Mains : les outils y sont accrochés
  const handR = new THREE.Group(); handR.position.y = -0.8; armR.add(handR);
  const handL = new THREE.Group(); handL.position.y = -0.8; armL.add(handL);
  const wood = mat(0x7a5230), metal = mat(0x9a9a9a), stone = mat(0x8c8a86);

  const tBaton = new THREE.Group(); handR.add(tBaton);
  addM(tBaton, wood, 0,-0.4,0, 0.12,0.9,0.12);
  const tAxe = new THREE.Group(); handR.add(tAxe);
  addM(tAxe, wood, 0,-0.45,0, 0.07,0.95,0.07);
  addM(tAxe, metal, 0,-0.85,0.05, 0.32,0.24,0.08);
  const tPick = new THREE.Group(); handR.add(tPick);
  addM(tPick, wood, 0,-0.45,0, 0.07,0.95,0.07);
  addM(tPick, stone, 0,-0.9,0, 0.75,0.1,0.12);
  const tRock = new THREE.Group(); handR.add(tRock);
  const rk = new THREE.Mesh(DODEC, stone); rk.scale.setScalar(0.2); tRock.add(rk);
  const bow = new THREE.Group(); handL.add(bow);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.5,0.035,6,16,Math.PI), mat(0x7a4a22));
  arc.rotation.set(-Math.PI/2, Math.PI/2, 0); bow.add(arc);
  addM(bow, mat(0xeeeeee), 0,0,0, 0.012,1.0,0.012);

  return {root,hip,legL,legR,torso,head,armL,armR,tBaton,tAxe,tPick,tRock,bow};
}
let GREG = buildGreg(LOOK);
const player = new THREE.Group(); worldScene.add(player);
const model = new THREE.Group(); model.rotation.order = 'YXZ';   // yaw en premier, puis couché
player.add(model); model.add(GREG.root);

/* ---------- ZONES ---------- */
function curScene(){ return zone==='cave' ? caveScene : worldScene; }
function setZone(z){
  zone = z; activeCOL = z==='cave' ? CAVE_COL : COL;
  curScene().add(player);
  wet = false; underwater = false; swimK = 0; vy = 0; onGround = true;
}

/* ---------- OUTILS DE MOUVEMENT ---------- */
function keyf(k,pts){                        // interpolation douce entre des images-clés
  for(let i=1;i<pts.length;i++){
    if(k<=pts[i][0]){
      const [k0,v0] = pts[i-1], [k1,v1] = pts[i];
      const u = (k-k0)/(k1-k0), e = u*u*(3-2*u);
      return v0 + (v1-v0)*e;
    }
  }
  return pts[pts.length-1][1];
}
function turnTo(target,dt){
  let d = target - heading; d = Math.atan2(Math.sin(d), Math.cos(d));
  heading += d*Math.min(1, dt*12);
}
function distTo(x,z){ return Math.hypot(x-player.position.x, z-player.position.z); }
function lock(){
  try{ const r = canvas.requestPointerLock(); if(r && r.catch) r.catch(()=>{}); }catch(e){}
}

/* ---------- MAINS & ÉQUIPEMENT ---------- */
function updateHands(){
  GREG.tBaton.visible = weapon==='baton';
  GREG.tAxe.visible   = weapon==='axe';
  GREG.tPick.visible  = weapon==='pickaxe';
  GREG.tRock.visible  = weapon==='rock' && inv.rock>0;
  GREG.bow.visible    = weapon==='bow';
}
function equipSlot(n){                       // n = 0..4 (touches 1 à 5)
  if(state!=='play') return;
  const id = HOTBAR[n];
  if(!(inv[id]>0)){ toast("Tu n'as pas encore : "+NAME[id]); return; }
  weapon = id; updateHands();
}

/* ---------- ANIMATIONS DE GREG ---------- */
function animatePlayer(t,dt,moving,running){
  const tg = {lL:0,lR:0,aL:0,aR:0,aLz:0,aRz:0,tor:0,yaw:0,hd:0};
  const land = onGround && !wet, amp = running ? 0.95 : 0.6;

  // Marche / course : bras et jambes opposés
  if(land && moving){
    const s = Math.sin(walkT);
    tg.lL = s*amp; tg.lR = -s*amp;
    tg.aL = -s*amp*0.9; tg.aR = s*amp*0.9;
    tg.tor = running ? -0.1 : 0;
  } else if(land){
    const b = Math.sin(t*2)*0.03;                 // respiration
    tg.aL = b; tg.aR = -b;
    if(keys.c) tg.tor = -0.3;                     // accroupi : buste penché
  }
  // Saut / chute
  if(!onGround && !wet){ tg.lL = -0.6; tg.lR = 0.3; tg.aL = 2.5; tg.aR = 2.5; }

  // Visée
  if(aiming && weapon==='bow'){ tg.aL = 1.55; tg.aR = 1.45; tg.aRz = -0.35; }
  if(aiming && weapon==='rock'){ tg.aL = 0.9; tg.aR = -1.1; }

  // Ramassage : Greg se penche
  if(pickT>0){
    pickT = Math.max(0,pickT-dt);
    const b = Math.sin((1-pickT/0.6)*Math.PI);
    tg.tor = -b; tg.hd = -b*0.3; tg.aL = b*0.6; tg.aR = b*0.6;
  }

  // Recevoir un objet (le bras se tend)
  if(reachT>0){
    reachT = Math.max(0,reachT-dt);
    const k = 1-reachT/0.7;
    tg.aR = keyf(k,[[0,0],[0.5,1.7],[1,0.2]]);
    tg.aL = keyf(k,[[0,0],[0.5,1.2],[1,0]]);
  }

  // Attaques (images-clés)
  if(atkT>0){
    atkT = Math.max(0,atkT-dt);
    const k = 1-atkT/atkDur;
    if(atkKind==='axe' || atkKind==='pickaxe'){            // hache / pioche : coup par-dessus la tête
      tg.aR = keyf(k,[[0,0],[0.42,atkKind==='axe'?-2.8:-2.4],[0.62,1.15],[1,0]]);
      tg.aL = keyf(k,[[0,0],[0.42,-1],[0.62,0.6],[1,0]]);
      tg.tor = keyf(k,[[0,0],[0.42,-0.3],[0.62,0.5],[1,0]]);
    } else if(atkKind==='baton'){                          // bâton : balayage horizontal
      tg.aR = keyf(k,[[0,-0.2],[0.4,-1.1],[0.62,1.3],[1,0]]);
      tg.aRz = keyf(k,[[0,0.3],[0.4,0.7],[0.62,-0.8],[1,0]]);
      tg.yaw = keyf(k,[[0,0],[0.4,0.45],[0.62,-0.5],[1,0]]);
    } else if(atkKind==='throw'){                          // lancer une pierre
      tg.aR = keyf(k,[[0,-1.1],[0.5,-2.1],[0.72,1.7],[1,0]]);
      tg.tor = keyf(k,[[0,0],[0.5,0.4],[0.72,-0.2],[1,0]]);
    } else if(atkKind==='bow'){                            // tir à l'arc avec recul
      tg.aL = 1.55; tg.aR = keyf(k,[[0,1.45],[0.25,0.9],[1,1.45]]); tg.aRz = -0.35;
    }
  }

  // Nage (crawl) : bras en moulin, jambes qui battent
  if(wet){
    tg.lL = Math.sin(t*9)*0.6; tg.lR = Math.sin(t*9+Math.PI)*0.6;
    tg.aR = (t*5)%(Math.PI*2); tg.aL = tg.aR+Math.PI;
    tg.tor = 0; tg.yaw = 0; tg.hd = 0; tg.aRz = 0; tg.aLz = 0;
  }

  const f = 1-Math.exp(-dt*14);
  for(const k in tg) PS[k] = lerp(PS[k], tg[k], f);
  if(wet){ PS.lL = tg.lL; PS.lR = tg.lR; PS.aL = tg.aL; PS.aR = tg.aR; }   // pas de lissage en nage

  const g = GREG;
  g.legL.rotation.x = PS.lL;  g.legR.rotation.x = PS.lR;
  g.armL.rotation.x = PS.aL;  g.armR.rotation.x = PS.aR;
  g.armL.rotation.z = PS.aLz; g.armR.rotation.z = PS.aRz;
  g.torso.rotation.x = PS.tor; g.torso.rotation.y = PS.yaw;
  g.head.rotation.x = PS.hd;
}

/* ---------- MOUVEMENT, EAU, OXYGÈNE ---------- */
function updatePlayer(dt,t){
  const pl = player.position;
  const fwd = (keys.z||keys.w||keys.arrowup ? 1:0) - (keys.s||keys.arrowdown ? 1:0);
  const str = (keys.d||keys.arrowright ? 1:0) - (keys.q||keys.a||keys.arrowleft ? 1:0);
  const gh = groundY(pl.x,pl.z);

  // Entrée / sortie de l'eau (éclaboussure + son)
  const nowWet = zone==='world' && gh < WL-0.15;
  if(nowWet !== wet){
    SND.splash(); spawnDebris(pl.x, WL+0.1, pl.z, 0xcfeeff, 14, curScene());
    if(nowWet) vy = 0;
  }
  wet = nowWet;
  diving = wet && !!keys.c;                       // C dans l'eau = plonger
  underwater = wet && pl.y < WL-0.35;
  const crouch = !!keys.c && !wet;
  const running = !!keys.shift && !crouch && !wet && !aiming;

  let sp = crouch ? 2.2 : running ? 9 : 5.5;
  if(aiming) sp = 2.6;
  if(wet) sp = underwater ? 2.2 : 3.4;

  // Déplacement relatif à la caméra
  const fx=-Math.sin(yaw), fz=-Math.cos(yaw), rx=Math.cos(yaw), rz=-Math.sin(yaw);
  let dx = fx*fwd + rx*str, dz = fz*fwd + rz*str;
  const len = Math.hypot(dx,dz), moving = len>0;
  if(moving){
    dx/=len; dz/=len;
    pl.x += dx*sp*dt; pl.z += dz*sp*dt;
    walkT += dt*sp*1.1; stepDist += sp*dt;
  } else stepDist = 0;

  // Limites de la zone
  const B = zone==='cave' ? {x:ROOM.x, z:ROOM.z, r:ROOM.r-1.5} : {x:0, z:0, r:185};
  const bx = pl.x-B.x, bz = pl.z-B.z, bd = Math.hypot(bx,bz);
  if(bd > B.r){ pl.x = B.x+bx/bd*B.r; pl.z = B.z+bz/bd*B.r; }

  // Collisions avec arbres, rochers, maisons
  for(const c of activeCOL){
    const ex = pl.x-c.x, ez = pl.z-c.z, d = Math.hypot(ex,ez), minD = c.r+0.45;
    if(d<minD && d>0.001){ pl.x = c.x+ex/d*minD; pl.z = c.z+ez/d*minD; }
  }

  if(aiming) turnTo(yaw,dt);
  else if(moving) turnTo(Math.atan2(-dx,-dz),dt);

  // Hauteur : marche, saut ou nage
  const gh2 = groundY(pl.x,pl.z);
  if(wet){
    const want = diving ? WL-1.3 : (keys[' '] ? WL+0.15 : WL-0.25);
    pl.y = lerp(pl.y, Math.max(want, gh2+0.35), 1-Math.exp(-dt*6));
    vy = 0; onGround = false;
  } else {
    if(keys[' '] && onGround && !crouch){ vy = 9; onGround = false; }
    vy -= 24*dt; pl.y += vy*dt;
    if(pl.y <= gh2){ pl.y = gh2; vy = 0; onGround = true; }
  }

  // Greg se couche dans l'eau
  swimK = lerp(swimK, wet ? 1 : 0, 1-Math.exp(-dt*5));
  model.rotation.x = -Math.PI/2*swimK;
  model.rotation.y = heading;
  crouchS = lerp(crouchS, crouch ? 0.6 : 1, 1-Math.exp(-dt*10));
  model.scale.y = crouchS;

  // Sons de pas et de nage
  if(moving && onGround && !wet && stepDist > (running ? 2.2 : 1.6)){ stepDist = 0; SND.step(running); }
  if(moving && wet && stepDist > 1.6){ stepDist = 0; SND.bubble(); }

  // Oxygène : se vide lentement sous l'eau, se remplit en surface
  if(underwater){
    oxygen = Math.max(0, oxygen - dt*2.2);
    bubbleT -= dt; if(bubbleT<=0){ bubbleT = 1.8; SND.bubble(); }
  } else oxygen = Math.min(100, oxygen + dt*18);
  if(underwater && oxygen<=0){ playerHP -= dt*10; if(playerHP<=0) respawn(); }

  animatePlayer(t,dt,moving,running);
}

function updateCamera(){
  const p = player.position, sw = swimK > 0.5;
  const tx = p.x, ty = p.y + (sw ? 0.7 : 1.6*crouchS), tz = p.z;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cx = tx+Math.sin(yaw)*cp*camDist, cy = ty+sp*camDist+0.3, cz = tz+Math.cos(yaw)*cp*camDist;
  const gy = groundY(cx,cz)+0.8;
  camera.position.set(cx, Math.max(cy,gy), cz);
  camera.lookAt(tx,ty,tz);
  const f = aiming ? 50 : 70;
  if(Math.abs(camera.fov-f)>0.1){ camera.fov = lerp(camera.fov,f,0.15); camera.updateProjectionMatrix(); }
}

/* ---------- SOURIS ---------- */
addEventListener('mousemove', e => {
  if(document.pointerLockElement !== canvas) return;
  yaw -= e.movementX*0.003;
  pitch = clamp(pitch + e.movementY*0.002, -0.2, 1.2);
});
addEventListener('mousedown', e => {
  if(state!=='play') return;
  if(!document.pointerLockElement){ lock(); return; }
  if(e.button===0) attack();
  if(e.button===2) aiming = (weapon==='bow' || weapon==='rock');
});
addEventListener('mouseup', e => { if(e.button===2) aiming = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { camBase = clamp(camBase + e.deltaY*0.004, 3, 12); }, {passive:true});

/* ---------- COMBAT DU JOUEUR ---------- */
function hitMonsters(range,minDot,dmg){
  const fx=-Math.sin(heading), fz=-Math.cos(heading), px=player.position.x, pz=player.position.z;
  for(const m of monsters){
    if(m.dead || m.spec.fly) continue;
    const dx=m.root.position.x-px, dz=m.root.position.z-pz, d=Math.hypot(dx,dz);
    if(d < range+m.spec.scale && (dx*fx+dz*fz)/(d||1) > minDot) hurtMonster(m,dmg);
  }
}
function nearestTree(range,minDot){
  const fx=-Math.sin(heading), fz=-Math.cos(heading), px=player.position.x, pz=player.position.z;
  let best=null, bd=range;
  for(const t of TREES){
    if(t.cut) continue;
    const dx=t.x-px, dz=t.z-pz, d=Math.hypot(dx,dz);
    if(d<bd && (dx*fx+dz*fz)/(d||1) > minDot){ bd=d; best=t; }
  }
  return best;
}
function attack(){
  if(state!=='play' || wet || atkT>0 || pickT>0) return;
  combatT = 4;

  // Arc et pierres : il faut viser (clic droit maintenu)
  if(weapon==='bow' || weapon==='rock'){
    if(!aiming) return;
    if(weapon==='bow'){
      if(inv.arrow<=0){ toast("Tu n'as plus de flèches"); return; }
      inv.arrow--; atkKind='bow'; atkDur=0.35; atkT=atkDur;
      shootProjectile('arrow');
    } else {
      if(inv.rock<=0){ toast("Tu n'as plus de pierres"); return; }
      inv.rock--; atkKind='throw'; atkDur=0.5; atkT=atkDur;
      shootProjectile('rock'); updateHands();
    }
    return;
  }

  SND.swing();
  if(weapon==='baton'){
    atkKind='baton'; atkDur=0.4; atkT=atkDur;
    hitMonsters(3.4,0.2,25);
  } else if(weapon==='axe'){
    atkKind='axe'; atkDur=0.55; atkT=atkDur;
    const tr = nearestTree(3.4,0.3);
    if(tr) cutTree(tr);                              // abat l'arbre (partie 1B)
    else hitMonsters(3.2,0.3,30);
  } else if(weapon==='pickaxe'){
    atkKind='pickaxe'; atkDur=0.6; atkT=atkDur;
    const fx=-Math.sin(heading), fz=-Math.cos(heading);
    pickaxeHit(fx,fz);                               // défini dans la partie 2B-1
  }
}

/* ---------- PROJECTILES (flèches et pierres) ---------- */
function shootProjectile(type){
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const scn = curScene();
  const mesh = type==='arrow' ? new THREE.Mesh(BOX,arrowMat) : new THREE.Mesh(DODEC,stoneMat);
  if(type==='arrow') mesh.scale.set(0.04,0.04,0.9); else mesh.scale.setScalar(0.16);
  mesh.castShadow = true;
  mesh.position.set(player.position.x, player.position.y+1.5, player.position.z).addScaledVector(dir,0.9);
  scn.add(mesh);
  projectiles.push({mesh, type, scn, vel:dir.multiplyScalar(type==='arrow'?60:28), life:3});
  SND.shoot();
}
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p = projectiles[i], q = p.mesh.position;
    p.vel.y -= 9.8*dt*(p.type==='arrow'?0.8:1.2);
    q.addScaledVector(p.vel,dt);
    if(p.type==='arrow') p.mesh.lookAt(q.x+p.vel.x, q.y+p.vel.y, q.z+p.vel.z);
    p.life -= dt;

    let hit = false;
    if(p.scn===worldScene){
      for(const m of monsters){
        if(m.dead) continue;
        const dy = m.root.position.y+1.2*m.spec.scale-q.y;
        if(Math.hypot(m.root.position.x-q.x, dy, m.root.position.z-q.z) < 1.6*m.spec.scale){
          hurtMonster(m, p.type==='arrow'?35:12); hit=true; break;
        }
      }
    }
    const inWater = p.scn===worldScene && q.y < WL && getHeight(q.x,q.z) < WL;
    const gy = p.scn===caveScene ? 0 : getHeight(q.x,q.z);
    if(hit || p.life<=0 || inWater || q.y<gy){
      if(!hit && !inWater) spawnPickup(p.type, q.x, q.z, 1, 0, p.scn);   // on peut la ramasser
      if(inWater && !hit) spawnDebris(q.x, WL+0.1, q.z, 0xcfeeff, 8, p.scn);
      p.scn.remove(p.mesh); projectiles.splice(i,1);
    }
  }
}

/* ---------- VIE, FAIM, MORT ---------- */
function hurtPlayer(d){
  playerHP -= d; combatT = 8; SND.hurt();
  const f = $('flash'); f.style.opacity = 0.5; setTimeout(()=>{ f.style.opacity = 0; }, 180);
  if(playerHP<=0) respawn();
}
function respawn(){
  setZone('world');
  player.position.set(VIL.x+2, getHeight(VIL.x+2,VIL.z-3), VIL.z-3);
  playerHP = 100; food = 60; oxygen = 100; vy = 0;
  $('minimap').classList.add('hidden');
  toast("Tu t'es réveillé au village…");
}
function survival(dt){
  food = Math.max(0, food - dt*0.5);
  if(food<=0) playerHP -= dt*3;
  else if(food>60 && playerHP<100) playerHP = Math.min(100, playerHP + dt*1.5);
  if(playerHP<=0) respawn();
}
function eat(){
  if(state!=='play') return;
  if(inv.meat>0){ inv.meat--; food = Math.min(100, food+40); toast('Tu manges de la viande (+40)'); }
  else if(inv.apple>0){ inv.apple--; food = Math.min(100, food+20); toast('Tu manges une pomme (+20)'); }
  else toast('Rien à manger');
}

/* ---------- OBJETS & INVENTAIRE ---------- */
function nearestPickup(maxD){
  const scn = curScene(); let best = null, bd = maxD;
  for(const p of pickups){
    if(p.scn!==scn) continue;
    const d = distTo(p.g.position.x, p.g.position.z);
    if(d<bd){ bd = d; best = p; }
  }
  return best;
}
function giveItem(id,n=1){
  inv[id] = (inv[id]||0) + n;
  SND.pick(); toast('+ '+NAME[id]+(n>1?' x'+n:'')); updateHands();
}
function collectPickup(p){
  giveItem(p.type, p.count);
  removePickup(p);
  pickT = 0.6;                                       // Greg se penche pour ramasser
}

/* ---------- MESSAGES À L'ÉCRAN ---------- */
function toast(msg){
  const el = $('toast'); el.textContent = msg; el.style.opacity = 1;
  clearTimeout(toastT); toastT = setTimeout(()=>{ el.style.opacity = 0; }, 2200);
}
function updateHUD(){
  $('hp').firstElementChild.style.width = Math.max(0,playerHP)+'%';
  $('food').firstElementChild.style.width = Math.max(0,food)+'%';
  $('oxy').firstElementChild.style.width = Math.max(0,oxygen)+'%';
  $('oxyBox').classList.toggle('hidden', !wet);          // oxygène seulement dans l'eau
  $('under').classList.toggle('hidden', !underwater);    // voile bleu sous l'eau
  const slots = HOTBAR.map((id,i)=>{
    const s = (i+1)+' '+NAME[id];
    return id===weapon ? '<b>['+s+']</b>' : inv[id]>0 ? s : '<span style="opacity:.4">'+s+'</span>';
  }).join(' · ');
  const txt = slots+'<br>Flèches : '+inv.arrow+' · Pierres : '+inv.rock+' · Bois : '+inv.wood;
  if(txt!==lastHud){ lastHud = txt; $('weapon').innerHTML = txt; }
}

/* ---------- IA DES DINOSAURES (monde extérieur) ---------- */
// Un dinosaure ne marche pas dans l'eau ni à travers les arbres et rochers
function blocked(x,z){
  return getHeight(x,z) < -1.2 || COL.some(c => hyp(c.x,c.z,x,z) < c.r+0.8);
}
function stepMonster(m,tx,tz,step){
  const p = m.root.position, dx = tx-p.x, dz = tz-p.z, d = Math.hypot(dx,dz);
  if(d<0.1) return false;
  const base = Math.atan2(dx,dz);
  for(const off of [0,0.7,-0.7,1.4,-1.4]){          // contourne l'obstacle si besoin
    const a = base+off, nx = p.x+Math.sin(a)*step, nz = p.z+Math.cos(a)*step;
    if(!blocked(nx,nz)){
      p.x = nx; p.z = nz;
      m.root.rotation.y = Math.atan2(-Math.sin(a), -Math.cos(a));
      return true;
    }
  }
  return false;
}
function faceTo(m,tx,tz){
  const p = m.root.position; m.root.rotation.y = Math.atan2(-(tx-p.x), -(tz-p.z));
}
function setFlash(m,on){                             // rouge quand le dino est touché
  if(m.flashOn===on) return; m.flashOn = on;
  const hex = on ? 0xff3300 : 0x000000;
  m.root.traverse(o => { if(o.isMesh && o.material.emissive) o.material.emissive.setHex(hex); });
}
function updateMonsters(dt,t){
  if(zone!=='world') return;
  for(let i=monsters.length-1;i>=0;i--){
    const m = monsters[i];
    updateMonster(m,dt,t);
    if(m.removed) monsters.splice(i,1);
  }
}
function updateMonster(m,dt,t){
  if(m.dead){
    m.deadT += dt;
    m.root.rotation.z = Math.min(Math.PI/2, m.deadT*3);
    if(m.deadT>3){ worldScene.remove(m.root); m.removed = true; }
    return;
  }
  if(m.hitT>0) m.hitT -= dt;
  setFlash(m, m.hitT>0);

  if(m.spec.fly){                                    // ptérosaure : tourne en vol
    const a = t*0.12 + m.phase;
    const x = m.home.x+Math.cos(a)*30, z = m.home.z+Math.sin(a)*30;
    m.root.position.set(x, getHeight(x,z)+22+Math.sin(t*0.7+m.phase)*2, z);
    m.root.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a));
    m.wingL.rotation.z = Math.sin(t*7)*0.6; m.wingR.rotation.z = -Math.sin(t*7)*0.6;
    return;
  }

  m.cool = Math.max(0,m.cool-dt); m.angry = Math.max(0,m.angry-dt); m.attackT = Math.max(0,m.attackT-dt);
  const p = m.root.position, pl = player.position;
  const dist = hyp(p.x,p.z,pl.x,pl.z);
  const hidden = inTallGrass(pl.x,pl.z) && dist>3.5;       // caché dans l'herbe haute
  const chasing = m.angry>0 || (m.spec.aggro && !hidden && dist<m.spec.detect);
  let moving = false;

  if(chasing && m.spec.dmg>0){
    if(dist > m.spec.reach){
      moving = stepMonster(m,pl.x,pl.z,m.spec.speed*dt);
    } else {
      faceTo(m,pl.x,pl.z);
      if(m.cool<=0){ m.cool = m.spec.cool; m.attackT = 0.4; hurtPlayer(m.spec.dmg); }
    }
  } else {
    m.wanderT -= dt;
    if(m.wanderT<=0){
      m.wanderT = rnd(3,7);
      const a = rnd(0,6.28), r = rnd(3,12);
      m.tx = m.home.x+Math.cos(a)*r; m.tz = m.home.z+Math.sin(a)*r;
      m.walk = Math.random()<0.6;
    }
    if(m.walk && m.spec.speed>0) moving = stepMonster(m,m.tx,m.tz,m.spec.speed*0.3*dt);
  }

  p.y = getHeight(p.x,p.z);
  if(moving) m.phase += dt*m.spec.speed*1.5;
  const sw = moving ? 0.55 : 0;
  m.legs.forEach((L,i) => { L.rotation.x = Math.sin(m.phase+(i%2)*Math.PI)*sw; });
  if(m.tail) m.tail.rotation.y = Math.sin(t*1.5+m.phase)*0.25;
  m.body.rotation.x = m.attackT>0 ? Math.sin(m.attackT*15)*0.12 : 0;
}
function hurtMonster(m,amt){
  if(m.dead) return;
  m.hp -= amt; m.hitT = 0.2; SND.hit(); combatT = 6;
  if(m.spec.retal) m.angry = 10;
  if(m.hp<=0){
    m.dead = true; m.deadT = 0; SND.roar();
    if(m.kind!=='ptero') spawnPickup('meat', m.root.position.x, m.root.position.z, 1);
  }
}

/* ---------- PNJ : ils se tournent vers Greg quand il approche ---------- */
function updateNPCs(t){
  npcs.forEach(n => {
    const dx = player.position.x-n.g.position.x, dz = player.position.z-n.g.position.z;
    if(Math.hypot(dx,dz) < 8){
      let d = Math.atan2(-dx,-dz) - n.g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.g.rotation.y += d*0.05;
    }
    n.arms.forEach((a,i) => { a.rotation.x = Math.sin(t*1.5+i)*0.05; });
  });
}

/* =====================================================================
   Partie 2B-1 : missions, cadeaux du chef, dialogues, grotte (salle,
   murs à casser, gobelins, minicarte), interactions, souvenirs
   ===================================================================== */

let lastQuest = '', gift = null, memDone = false, dlgQueue = [], dlgDone = null;
const torches = [];
const mmC = $('minimap').getContext('2d');
const GOB_TALK = [
  "Tu es perdu, humain ? Ici, c'est NOTRE grotte !",
  "Ces murs sont durs… mais une bonne pioche les casse.",
  "Le cristal du centre brille depuis toujours. Ne le touche pas trop fort.",
  "On a vu un grand T-Rex rôder dehors. Fais gaffe !",
  "Tu veux échanger ? Non ? Dommage…",
  "La lumière au fond de la salle, c'est la sortie. Ne rate pas le passage !"
];
const SPEECH = {
  mara: ["Tiens, deux pommes ! Tu as l'air affamé.", "Quand ta faim baisse, appuie sur R pour manger."],
  tom: ["Dans l'herbe haute, les dinosaures ne te voient pas. Cache-toi !",
        "Sous l'eau, surveille ta barre d'oxygène : elle se vide lentement. Maintiens C pour plonger."],
  v1: ["Les vélociraptors chassent en groupe. Reste près du feu la nuit."],
  v2: ["Les maisons-champignons sont douillettes. Le chef dit qu'il en faudra d'autres !"]
};

/* ---------- DIALOGUES ---------- */
function openDialog(name, lines, done){
  state = 'dialog';
  dlgQueue = lines.slice(); dlgDone = done;
  $('dlgName').textContent = name;
  $('dialog').classList.remove('hidden');
  nextLine();
}
function nextLine(){
  if(!dlgQueue.length){ closeDialog(); return; }
  $('dlgText').textContent = dlgQueue.shift();
}
function advanceDialog(){ if(state==='dialog') nextLine(); }
function closeDialog(){
  $('dialog').classList.add('hidden');
  state = 'play';
  const d = dlgDone; dlgDone = null;
  if(d) d();
  lock();
}

/* ---------- MISSIONS ---------- */
function updateQuest(){
  const txt = MISSION[quest.stage]
    .replace('{trees}', Math.min(6, quest.trees))
    .replace('{apples}', Math.min(6, inv.apple))
    .replace('{rocks}', Math.min(8, inv.bigrock));
  if(txt!==lastQuest){ lastQuest = txt; $('quest').innerHTML = '<b>Mission :</b><br>' + txt; }
}
function checkMissions(){
  if(quest.stage===1 && quest.trees>=6){
    quest.stage = 2; SND.quest(); toast('6 arbres abattus ! Retourne voir le chef.');
  }
  if(quest.stage===4 && inv.bigrock>=8){
    quest.stage = 5; SND.quest(); toast('8 gros rochers ! Rapporte-les au chef.');
  }
}

/* ---------- CADEAUX DU CHEF (animation des bras) ---------- */
function startGift(npc,id){ gift = {npc, id, t:0, given:false}; }
function animateGift(dt){
  if(!gift) return;
  gift.t += dt;
  const k = clamp(gift.t/0.9, 0, 1);
  gift.npc.arms[1].rotation.x = -2.2*Math.sin(Math.PI*k);      // le chef lève le bras puis le baisse
  if(!gift.given && gift.t>0.45){
    gift.given = true; reachT = 0.7;                           // notre bras se tend
    giveItem(gift.id);
    if(gift.id==='axe' || gift.id==='pickaxe'){ weapon = gift.id; updateHands(); }
  }
  if(gift.t>=0.9) gift = null;
}

/* ---------- PARLER AUX PNJ ---------- */
function talkTo(n){
  if(n.id==='chef') return talkChef(n);
  let lines;
  if(n.id==='mara'){
    if(!n.gave){ n.gave = true; inv.apple += 2; SND.pick(); toast('+ 2 Pommes'); lines = SPEECH.mara; }
    else lines = ["Les pommiers poussent près du village. Cherche bien !"];
  } else lines = n.lines || SPEECH[n.id] || ['…'];
  openDialog(n.name, lines, null);
}
function talkChef(n){
  const s = quest.stage;
  let lines = [], after = null;
  if(s===0){
    lines = ["Bienvenue, étranger. Notre village a besoin de bras, et tu as l'air solide.",
             "Prends cette hache (touche 4). Abats 6 arbres pour nous : clic gauche face à un arbre."];
    after = () => { quest.stage = 1; startGift(n,'axe'); };
  }
  else if(s===1){
    lines = ["Il te reste " + Math.max(0, 6-quest.trees) + " arbre(s) à abattre."];
  }
  else if(s===2){
    lines = ["Bien joué ! Prends cette pioche en pierre (touche 5). Elle casse les murs de la grotte.",
             "Mais d'abord, ramasse 6 pommes pour le village."];
    after = () => { quest.stage = 3; startGift(n,'pickaxe'); };
  }
  else if(s===3){
    if(inv.apple>=6){
      inv.apple -= 6;
      lines = ["Six pommes ! Le village te remercie.",
               "Maintenant, va dans la grotte, à l'entrée de la montagne. Casse 8 gros rochers."];
      after = () => { quest.stage = 4; };
    } else lines = ["Il me faut encore " + (6-inv.apple) + " pomme(s). Les pommiers poussent près du village."];
  }
  else if(s===4){
    lines = ["Va dans la grotte : appuie sur E devant l'entrée de la montagne.",
             "Il te faut encore " + Math.max(0, 8-inv.bigrock) + " gros rocher(s)."];
  }
  else if(s===5){
    if(inv.bigrock>=8){
      inv.bigrock -= 8;
      lines = ["Huit gros rochers ! Avec ça, on va construire le village.", "Regarde les maisons pousser !"];
      after = () => { quest.stage = 6; buildVillageGrow(); };
    } else lines = ["Il te faut encore " + (8-inv.bigrock) + " gros rocher(s)."];
  }
  else lines = ["Le village est en paix grâce à toi. Tu as construit un vrai foyer, Greg."];
  openDialog(n.name, lines, after);
}
// Fait pousser les 8 maisons une par une
function buildVillageGrow(){
  growHouses.forEach((_,i) => setTimeout(() => { revealHouse(i); SND.build(); }, i*700));
}

/* ---------- ENTRÉE / SORTIE DE LA GROTTE ---------- */
function enterCave(){
  setZone('cave');
  player.position.set(ROOM.x, 0, ROOM.z-20);
  vy = 0; onGround = true;
  $('minimap').classList.remove('hidden');
  SND.echo();
  toast(quest.stage===4 ? 'Casse les murs avec ta pioche (touche 5) !' : 'Tu entres dans la grotte…');
}
function leaveCave(){
  setZone('world');
  player.position.set(MOUTH.x+3, getHeight(MOUTH.x+3, MOUTH.z+3), MOUTH.z+3);
  $('minimap').classList.add('hidden');
  SND.noise(0.6, 0.25, 600, 'lowpass');
  toast("Tu ressors à l'air libre.");
}

/* ---------- LA GROTTE (autre carte) ---------- */
function buildCaveRoom(){
  const cx = ROOM.x, cz = ROOM.z, R = ROOM.r, WR = R+1, S = caveScene, N = 48;
  // sol, roche derrière les murs, voûte basse
  const ft = TEX.rock.clone(); ft.repeat.set(8,8); ft.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R+4,48),
    new THREE.MeshLambertMaterial({map:ft, color:0xb8a58c}));
  floor.rotation.x = -Math.PI/2; floor.position.set(cx,0,cz); S.add(floor);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(R+8,R+8,16,40,1,true),
    new THREE.MeshLambertMaterial({map:TEX.rock, color:0x6a6058, side:THREE.BackSide}));
  back.position.set(cx,8,cz); S.add(back);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R+8,24,12,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshLambertMaterial({color:0x3a302a, side:THREE.BackSide, flatShading:true}));
  dome.scale.y = 0.35; dome.position.set(cx,0,cz); S.add(dome);

  // lumières
  S.add(new THREE.HemisphereLight(0x9fb3cc, 0x2a2018, 0.8));
  caveLight = new THREE.PointLight(0xfff3d6, 1.2, 60, 1.1);
  caveLight.position.set(cx,9,cz); S.add(caveLight);
  const exitLight = new THREE.PointLight(0x9fe7ff, 1.4, 16, 1.4);
  exitLight.position.set(cx,4,cz+WR-3); S.add(exitLight);

  // murs cassables : 48 morceaux, une ouverture vers la sortie (+z)
  const wallMats = [
    new THREE.MeshLambertMaterial({map:TEX.rock, flatShading:true}),
    new THREE.MeshLambertMaterial({map:TEX.rock, color:0xb7a894, flatShading:true})
  ];
  for(let k=0;k<N;k++){
    if(k===N/4) continue;                                   // N/4 = angle π/2 = la sortie
    const a = k/N*Math.PI*2, x = cx+Math.cos(a)*WR, z = cz+Math.sin(a)*WR, h = rnd(6,8.5);
    const m = new THREE.Mesh(BOX, wallMats[k%2]);
    m.scale.set(4.8, h, 2.6); m.position.set(x, h/2, z); m.rotation.y = Math.PI/2-a; S.add(m);
    const top = new THREE.Mesh(DODEC, wallMats[(k+1)%2]);
    top.scale.setScalar(rnd(1.4,2)); top.position.set(x, h+0.5, z);
    top.rotation.set(rnd(0,3), rnd(0,3), 0); S.add(top);
    const col = {x, z, r:2.2}; CAVE_COL.push(col);
    caveWalls.push({m, top, x, z, hp:2, broken:false, col});
  }
  // lumière de la sortie
  const portal = new THREE.Mesh(BOX, mat(0x9fe7ff, {emissive:0x3ab0ff}));
  portal.scale.set(4.2, 6, 0.5); portal.position.set(cx, 3, cz+WR); S.add(portal);

  // socle et cristal au centre
  const plinth = new THREE.Mesh(CYL, rockMat);
  plinth.scale.set(2.2, 1.2, 2.2); plinth.position.set(cx, 0.6, cz); S.add(plinth);
  CAVE_COL.push({x:cx, z:cz, r:2.2});
  crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), mat(0x66ffe0, {emissive:0x1a9a80}));
  crystal.position.set(cx, 2.6, cz); S.add(crystal);

  // torches aux quatre coins
  for(let i=0;i<4;i++){
    const a = Math.PI/4 + i*Math.PI/2, x = cx+Math.cos(a)*26, z = cz+Math.sin(a)*26;
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pole = new THREE.Mesh(BOX, mat(0x5a3a1a)); pole.scale.set(0.25, 2.4, 0.25); pole.position.y = 1.2; g.add(pole);
    const fl = new THREE.Mesh(CONE, new THREE.MeshLambertMaterial({color:0xff7a1a, emissive:0xff5500, flatShading:true}));
    fl.scale.set(0.45, 0.9, 0.45); fl.position.y = 2.8; g.add(fl);
    const L = new THREE.PointLight(0xff9a3c, 0.9, 22, 1.4); L.position.y = 3; g.add(L);
    S.add(g); torches.push({L}); CAVE_COL.push({x, z, r:0.4});
  }
  // stalactites
  for(let i=0;i<16;i++){
    const a = rnd(0,6.28), d = rnd(4,26), h = rnd(2,4);
    const st = new THREE.Mesh(CONE, rockMat);
    st.scale.set(rnd(0.6,1.1), h, rnd(0.6,1.1)); st.rotation.x = Math.PI;
    st.position.set(cx+Math.cos(a)*d, 11-h/2, cz+Math.sin(a)*d); S.add(st);
  }
  // gobelins (rouges et gris)
  [['gob1','Gorg',-10,-6,0xb02a2a,0x4a4a4a], ['gob2','Snik',9,-9,0x6e6e6e,0x3a3a3a],
   ['gob3','Mog',-14,8,0xb02a2a,0x5a2020],   ['gob4','Rak',6,12,0x7a7a7a,0x4a4a4a],
   ['gob5','Vrok',16,2,0xc23a3a,0x3a3a3a],   ['gob6','Zib',-4,18,0x5c5c5c,0x2e2e2e]
  ].forEach(([id,name,x,z,sh,pa]) => makeGoblin(id, name, cx+x, cz+z, sh, pa));
}
function makeGoblin(id,name,x,z,shirt,pants){
  const h = buildHuman(shirt, pants, 0x2a3a1a, 0x7fb35a), g = h.g;
  g.scale.setScalar(0.8);
  for(const sx of [-1,1]){                                  // oreilles pointues
    const ear = new THREE.Mesh(CONE, mat(0x7fb35a));
    ear.scale.set(0.12,0.3,0.12); ear.rotation.z = sx*Math.PI/2; ear.position.set(sx*0.3, 1.85, 0); g.add(ear);
  }
  part(g,0.08,0.06,0.03,0xff3333,-0.1,1.78,-0.22);          // yeux rouges
  part(g,0.08,0.06,0.03,0xff3333, 0.1,1.78,-0.22);
  part(h.arms[1],0.06,1.2,0.06,0x6b4a2b,0,-0.9,0);          // lance dans la main droite
  part(h.arms[1],0.14,0.3,0.06,0x9a9a9a,0,-1.6,0);
  g.position.set(x,0,z); caveScene.add(g);
  npcs.push({id, name, g, arms:h.arms, gave:false,
             lines: GOB_TALK.slice().sort(() => Math.random()-0.5).slice(0,2)});
}

/* ---------- PIOCHE : CASSER LES MURS ---------- */
function pickaxeHit(fx,fz){
  if(zone!=='cave'){ toast("Ces rochers sont trop durs. Les murs de la grotte, eux, cèdent à la pioche."); return; }
  setTimeout(() => doPickHit(fx,fz), 240);                // le coup tombe au moment de l'impact
}
function doPickHit(fx,fz){
  if(state!=='play' || zone!=='cave') return;
  const px = player.position.x, pz = player.position.z;
  let best = null, bd = 4.2;
  for(const w of caveWalls){
    if(w.broken) continue;
    const dx = w.x-px, dz = w.z-pz, d = Math.hypot(dx,dz);
    if(d<bd && (dx*fx+dz*fz)/(d||1) > 0.3){ bd = d; best = w; }
  }
  SND.clink();
  if(!best) return;
  spawnDebris(best.x, 2+rnd(0,2), best.z, 0x8a847b, 6, caveScene);
  best.hp--;
  if(best.hp<=0) breakWall(best);
}
// Casse une grande zone de mur et fait tomber un gros rocher
function breakWall(w){
  for(const c of caveWalls){
    if(c.broken || hyp(c.x,c.z,w.x,w.z) > 5.2) continue;
    c.broken = true;
    caveScene.remove(c.m); caveScene.remove(c.top);
    const i = CAVE_COL.indexOf(c.col); if(i>=0) CAVE_COL.splice(i,1);
    spawnDebris(c.x, 3, c.z, 0x8a847b, 14, caveScene);
  }
  SND.crack();
  const dx = ROOM.x-w.x, dz = ROOM.z-w.z, d = Math.hypot(dx,dz);
  spawnPickup('bigrock', w.x+dx/d*3.2, w.z+dz/d*3.2, 1, 0, caveScene);
}
function animateCave(dt,t){
  if(crystal){ crystal.rotation.y += dt*1.2; crystal.position.y = 2.6+Math.sin(t*1.5)*0.3; }
  torches.forEach((tc,i) => { tc.L.intensity = 0.8+Math.sin(t*12+i*2)*0.2+Math.sin(t*5.7+i)*0.1; });
  pickups.forEach(p => {
    if(p.scn!==caveScene) return;
    p.g.rotation.y += dt*1.5;
    p.g.position.y = p.base + Math.sin(t*2+p.g.position.x)*0.08;
  });
}

/* ---------- MINICARTE (en haut, dans la grotte) ---------- */
function drawMinimap(){
  const S = 92/ROOM.r, X = x => 100+(x-ROOM.x)*S, Y = z => 100+(z-ROOM.z)*S, c = mmC;
  c.clearRect(0,0,200,200);
  c.save(); c.beginPath(); c.arc(100,100,97,0,Math.PI*2); c.clip();
  c.fillStyle = '#2a211b'; c.fillRect(0,0,200,200);
  c.fillStyle = '#4a3f36'; c.beginPath(); c.arc(100,100,ROOM.r*S,0,Math.PI*2); c.fill();
  c.fillStyle = '#c9b79c';
  for(const w of caveWalls) if(!w.broken) c.fillRect(X(w.x)-2, Y(w.z)-2, 4, 4);
  c.fillStyle = '#9fe7ff'; c.beginPath(); c.arc(X(EXIT.x), Y(EXIT.z), 5, 0, 7); c.fill();
  if(!memDone){ c.fillStyle = '#66ffe0'; c.beginPath(); c.arc(X(ROOM.x), Y(ROOM.z), 4, 0, 7); c.fill(); }
  c.fillStyle = '#ffcc66';
  for(const p of pickups) if(p.scn===caveScene) c.fillRect(X(p.g.position.x)-2, Y(p.g.position.z)-2, 4, 4);
  for(const n of npcs) if(n.g.parent===caveScene){
    c.fillStyle = n.id.startsWith('gob') ? '#ff5555' : '#cccccc';
    c.beginPath(); c.arc(X(n.g.position.x), Y(n.g.position.z), 3, 0, 7); c.fill();
  }
  // Greg : petite flèche qui indique sa direction
  const px = X(player.position.x), py = Y(player.position.z);
  const fx = -Math.sin(heading), fz = -Math.cos(heading), qx = -fz, qz = fx;
  c.fillStyle = '#ffffff'; c.beginPath();
  c.moveTo(px+fx*10, py+fz*10);
  c.lineTo(px+qx*5-fx*5, py+qz*5-fz*5);
  c.lineTo(px-qx*5-fx*5, py-qz*5-fz*5);
  c.closePath(); c.fill();
  c.restore();
  c.fillStyle = '#e6ffb3'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
  c.fillText('GROTTE', 100, 18);
}

/* ---------- MINI-JEU 2D : LES SOUVENIRS DU CRISTAL ---------- */
function playMemory(){
  state = 'mini';
  if(document.exitPointerLock) document.exitPointerLock();
  showScreen('mini');
  const cv = $('minicv'), c = cv.getContext('2d'), W = cv.width, H = cv.height, GY = H-60;
  let px = 80, py = GY, pvy = 0, onG = true, lives = 3, got = 0, t = 0, flash = 0, raf = 0;
  let rocks = [], souv = [];
  const k = {};
  const kd = e => { k[e.key.toLowerCase()] = true; if(e.key===' ') e.preventDefault(); };
  const ku = e => { k[e.key.toLowerCase()] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  function finish(){
    cancelAnimationFrame(raf);
    removeEventListener('keydown', kd); removeEventListener('keyup', ku);
    showScreen(null); state = 'play'; memDone = true;
    openDialog('Greg', ["Des images remontent : mon grand-père dans son atelier, ce cristal posé sur son bureau…",
                        "Greg (pensée) : Le cristal… c'est lui qui ouvre le passage. Je dois le garder."], null);
  }
  function frame(){
    t++;
    if(k.q||k.a||k.arrowleft) px -= 5;
    if(k.d||k.arrowright) px += 5;
    px = clamp(px, 30, W-30);
    if((k[' ']||k.z||k.w||k.arrowup) && onG){ pvy = -13; onG = false; }
    pvy += 0.7; py += pvy;
    if(py>=GY){ py = GY; pvy = 0; onG = true; }
    if(t%50===0) rocks.push({x:rnd(30,W-30), y:-20, v:rnd(3,5)});
    if(t%110===0 && souv.length<6) souv.push({x:rnd(40,W-40), y:rnd(120,GY-80)});
    rocks.forEach(r => {
      r.y += r.v;
      if(!r.hit && Math.abs(r.x-px)<26 && Math.abs(r.y-(py-30))<34){ r.hit = true; lives--; flash = 20; }
    });
    rocks = rocks.filter(r => !r.hit && r.y<H+30);
    souv = souv.filter(s => { if(Math.hypot(s.x-px, s.y-(py-30))<34){ got++; return false; } return true; });
    if(flash>0) flash--;
    c.fillStyle = '#9ed9ff'; c.fillRect(0,0,W,H);
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(W-80,70,36,0,7); c.fill();
    c.fillStyle = '#4f9a33'; c.fillRect(0,GY,W,H-GY);
    c.fillStyle = '#8a8580'; rocks.forEach(r => { c.beginPath(); c.arc(r.x,r.y,16,0,7); c.fill(); });
    souv.forEach(s => {
      c.fillStyle = '#fff3b0'; c.fillRect(s.x-14, s.y-10, 28, 20);
      c.fillStyle = '#333'; c.fillRect(s.x-7, s.y-5, 14, 10);
    });
    c.fillStyle = flash%4<2 ? '#2f6fd6' : '#ff5555'; c.fillRect(px-14, py-42, 28, 30);
    c.fillStyle = '#f1c79a'; c.fillRect(px-10, py-60, 20, 18);
    c.fillStyle = '#4a2e1a'; c.fillRect(px-11, py-62, 22, 6);
    c.fillStyle = '#2b3a67'; c.fillRect(px-12, py-12, 10, 12); c.fillRect(px+2, py-12, 10, 12);
    c.fillStyle = '#000'; c.font = 'bold 20px sans-serif';
    c.fillText('Souvenirs : '+got+'/5', 20, 34);
    c.fillText('Vies : '+lives, 20, 64);
    if(got>=5){ finish(); return; }
    if(lives<=0){ lives = 3; got = 0; rocks = []; souv = []; toast("Tu as été assommé… on recommence !"); }
    raf = requestAnimationFrame(frame);
  }
  frame();
}

/* ---------- PNJ ET INTERACTIONS ---------- */
function nearestNPC(maxD){
  const scn = curScene(); let best = null, bd = maxD;
  for(const n of npcs){
    if(n.g.parent!==scn) continue;
    const d = distTo(n.g.position.x, n.g.position.z);
    if(d<bd){ bd = d; best = n; }
  }
  return best;
}
function promptText(){
  if(zone==='cave'){
    if(distTo(EXIT.x,EXIT.z)<4.5) return 'E : Sortir de la grotte';
    if(!memDone && distTo(ROOM.x,ROOM.z)<4) return 'E : Toucher le cristal';
  } else if(distTo(MOUTH.x,MOUTH.z)<5) return 'E : Entrer dans la grotte';
  const p = nearestPickup(2.4); if(p) return 'E : Ramasser ' + NAME[p.type];
  const n = nearestNPC(3.6);   if(n) return 'E : Parler à ' + n.name;
  return '';
}
function updatePrompt(){
  const txt = state==='play' ? promptText() : '';
  const el = $('prompt');
  if(el.textContent!==txt) el.textContent = txt;
  el.classList.toggle('hidden', !txt);
}
function interact(){
  if(zone==='cave'){
    if(distTo(EXIT.x,EXIT.z)<4.5){ leaveCave(); return; }
    if(!memDone && distTo(ROOM.x,ROOM.z)<4){ playMemory(); return; }
  } else if(distTo(MOUTH.x,MOUTH.z)<5){ enterCave(); return; }
  const p = nearestPickup(2.4); if(p){ collectPickup(p); return; }
  const n = nearestNPC(3.6);   if(n){ talkTo(n); return; }
}

/* ---------- ASSEMBLAGE DU MONDE ---------- */
function buildAll(){
  buildOverworld();
  spawnPickup('bow', VIL.x+8, VIL.z+6);                   // un arc au feu de camp
  spawnPickup('arrow', VIL.x+8.6, VIL.z+6.6, 10);         // et 10 flèches
  buildCaveRoom();
  setZone('world');
  player.position.set(VIL.x+2, getHeight(VIL.x+2, VIL.z-3), VIL.z-3);
}

/* =====================================================================
   Partie 2B-2 : cinématique, menus, pause, paramètres, touches
   illustrées, inventaire, musique, clavier, boucle de jeu, démarrage
   ===================================================================== */

/* ---------- CINÉMATIQUE D'INTRODUCTION ---------- */
const SCENES = [
  {bg:'linear-gradient(#1b1f3a,#3a2a4a)', icon:'🛏️', t:"Paris, 2026. Greg a 15 ans. Depuis des mois, il passe ses soirées dans l'atelier de son grand-père, paléontologue, à réparer une vieille machine couverte de poussière."},
  {bg:'linear-gradient(#050510,#0b3b5c)', icon:'⚡', t:"Un soir d'orage, la machine s'allume toute seule dans un éclair bleu. Au fond de la pièce, un cristal se met à briller."},
  {bg:'radial-gradient(circle,#7af,#204 70%)', icon:'🌀', t:"Greg est aspiré dans un tunnel de lumière. Le temps se tord autour de lui, et une voix lointaine murmure son prénom…"},
  {bg:'linear-gradient(#ffb36b,#2e7d32)', icon:'🦖', t:"Il atterrit brutalement dans un monde disparu : le Crétacé, il y a 66 millions d'années. Un rugissement fait trembler la terre."},
  {bg:'linear-gradient(#ff9a6b,#1b5e20)', icon:'🏕️', t:"Des humains vivent ici, dans un village de maisons-champignons. Le chef Akela accepte d'aider ce garçon venu d'ailleurs."},
  {bg:'linear-gradient(#2b1d3a,#0d2b1a)', icon:'💎', t:"Pour rentrer chez lui, Greg devra comprendre le secret du cristal caché dans la grotte de la montagne. Survis, Greg."}
];
let sceneI = 0, cineTimer = null;
function startCinematic(){ state = 'cine'; showScreen('cine'); sceneI = 0; showScene(); }
function showScene(){
  if(sceneI >= SCENES.length){ startGame(); return; }
  const s = SCENES[sceneI];
  $('cineBg').style.background = s.bg;
  $('cineIcon').textContent = s.icon;
  $('cineText').textContent = s.t;
  clearTimeout(cineTimer);
  cineTimer = setTimeout(nextScene, 7000);
}
function nextScene(){ if(state!=='cine') return; sceneI++; showScene(); }
function startGame(){
  clearTimeout(cineTimer);
  state = 'play';
  showScreen(null);
  $('hud').classList.remove('hidden');
  updateQuest(); updateHands();
  toast("Clique dans le jeu pour contrôler la caméra");
  lock();
}

/* ---------- AFFICHAGE DES ÉCRANS (menus) ---------- */
const SCREENS = ['menu','pause','set','cine','inv','mini','custom'];
function showScreen(name){
  SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== name));
}

/* ---------- PAUSE, INVENTAIRE, PARAMÈTRES ---------- */
function pause(){
  if(state!=='play') return;
  state = 'pause';
  if(document.exitPointerLock) document.exitPointerLock();
  showScreen('pause');
}
function resume(){ state = 'play'; showScreen(null); lock(); }
function openSettings(from){ settingsFrom = from; state = 'set'; showScreen('set'); }
function openInv(){
  if(state!=='play') return;
  state = 'inv';
  if(document.exitPointerLock) document.exitPointerLock();
  renderInv(); showScreen('inv');
}
function closeInv(){ state = 'play'; showScreen(null); lock(); }
function renderInv(){
  $('invGrid').innerHTML = ITEMS.map(([id,em,name]) => {
    const slot = HOTBAR.indexOf(id);
    return `<div class="slot ${inv[id]>0?'':'empty'}"><b>${em}</b>${name}<br>x${inv[id]||0}${slot>=0?`<br><small>touche ${slot+1}</small>`:''}</div>`;
  }).join('');
}
// Si on quitte le verrouillage de la souris pendant la partie, on met en pause
document.addEventListener('pointerlockchange', () => {
  if(!document.pointerLockElement && state==='play') pause();
});

/* ---------- TOUCHES ILLUSTRÉES (menu paramètres) ---------- */
const USED = ['Échap','1','2','3','4','5','Tab','Z','Q','S','D','E','R','C','Maj','Espace'];
const KB_ROWS = [
  ['Échap','1','2','3','4','5'],
  ['Tab','A','Z','E','R','T'],
  ['Maj','Q','S','D','F','G'],
  ['Ctrl','W','X','C','V','B'],
  ['Espace']
];
const KEY_W = {'Échap':70,'Tab':60,'Maj':70,'Ctrl':60,'Espace':230};
const ACTIONS = [
  ['Z / S', "avancer / reculer"],
  ['Q / D', "aller à gauche / à droite"],
  ['Espace', "sauter (dans l'eau : remonter)"],
  ['C', "s'accroupir (dans l'eau : plonger)"],
  ['Maj', "courir"],
  ['Tab', "inventaire"],
  ['E', "parler, ramasser, entrer ou sortir de la grotte"],
  ['R', "manger"],
  ['1 à 5', "changer d'arme ou d'outil"],
  ['Échap', "pause"]
];
function drawControls(){
  const key = k => `<span class="key" style="min-width:${KEY_W[k]||42}px;margin:3px;${USED.includes(k)?'background:#3f8a2c;border-color:#c8f08a;color:#fff':'opacity:.5'}">${k}</span>`;
  const kb = `<div style="background:#1a1a1a;border:2px solid #444;border-radius:12px;padding:10px 12px">
    <div style="font-size:13px;opacity:.7;margin-bottom:4px">Clavier (en vert : touches utilisées)</div>
    ${KB_ROWS.map(r => `<div style="display:flex;justify-content:center;flex-wrap:wrap">${r.map(key).join('')}</div>`).join('')}
  </div>`;
  const mouse = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">
    <svg width="84" height="120" viewBox="0 0 70 100">
      <rect x="3" y="3" width="64" height="94" rx="32" fill="#222"/>
      <rect x="5" y="5" width="28" height="36" fill="#4caf50"/>
      <rect x="37" y="5" width="28" height="36" fill="#ff7043"/>
      <rect x="31" y="14" width="8" height="16" rx="4" fill="#888"/>
      <rect x="3" y="3" width="64" height="94" rx="32" fill="none" stroke="#aaa" stroke-width="3"/>
      <line x1="35" y1="5" x2="35" y2="41" stroke="#aaa" stroke-width="3"/>
    </svg>
    <div style="text-align:left;font-size:15px;line-height:1.7">
      <b style="color:#4caf50">Clic gauche</b> : attaquer, lancer<br>
      <b style="color:#ff7043">Clic droit (maintenu)</b> : viser<br>
      <b>Molette</b> : zoom · <b>Souris</b> : orienter la caméra
    </div>
  </div>`;
  const list = ACTIONS.map(([k,t]) => `<div style="margin:4px 0"><b style="display:inline-block;min-width:95px;color:#c8f08a">${k}</b>${t}</div>`).join('');
  $('ctrl').innerHTML = `
    <div style="display:flex;gap:28px;align-items:center;justify-content:center;flex-wrap:wrap;margin:8px 0">${kb}${mouse}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 28px;text-align:left;font-size:16px;max-width:760px;margin:0 auto">${list}</div>`;
  const panel = $('set').querySelector('.panel');
  panel.style.maxHeight = '92vh'; panel.style.overflow = 'auto';
}

/* ---------- MUSIQUE SELON LA SITUATION ---------- */
function currentTrack(){
  const onMenu = state==='menu' || state==='custom' || state==='cine' || (state==='set' && settingsFrom==='menu');
  if(onMenu) return 'menu';
  if(zone==='cave') return 'cave';
  if(wet) return 'water';                 // nage calme, même si un dinosaure est proche
  if(combatT>0) return 'combat';
  if(nearVillage(player.position.x, player.position.z)) return 'village';
  return 'world';
}

/* ---------- CLAVIER ---------- */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k)) e.preventDefault();
  keys[k] = true;
  if(e.repeat) return;                    // une touche maintenue ne déclenche qu'une fois
  switch(state){
    case 'custom': if(k==='escape') $('cuBack').click(); break;
    case 'cine':   if([' ','enter','escape'].includes(k)) nextScene(); break;
    case 'dialog': if(['e',' ','enter','escape'].includes(k)) advanceDialog(); break;
    case 'play':
      if(k==='tab') openInv();
      else if(k==='escape') pause();
      else if(k==='e') interact();
      else if(k==='r') eat();
      else if(['1','2','3','4','5'].includes(k)) equipSlot(+k-1);
      break;
    case 'inv':   if(k==='tab' || k==='escape') closeInv(); break;
    case 'pause': if(k==='escape') resume(); break;
    case 'set':   if(k==='escape') $('setBack').onclick(); break;
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for(const k in keys) keys[k] = false; });   // évite les touches bloquées

/* ---------- BOUTONS DES MENUS ---------- */
addEventListener('pointerdown', () => SND.init(), {once:true});   // le son démarre au premier clic
$('btnNew').onclick = () => { SND.init(); openCustom(); };
$('btnMenuSet').onclick = () => openSettings('menu');
$('btnPauseSet').onclick= () => openSettings('pause');
$('btnResume').onclick  = resume;
$('btnQuit').onclick    = () => location.reload();
$('setBack').onclick    = () => {
  if(settingsFrom==='pause'){ state = 'pause'; showScreen('pause'); }
  else { state = 'menu'; showScreen('menu'); }
};
$('sBright').oninput = e => { renderer.toneMappingExposure = +e.target.value; };
$('sSfx').oninput = e => SND.setVol(+e.target.value, +$('sMus').value);
$('sMus').oninput = e => SND.setVol(+$('sSfx').value, +e.target.value);
$('cine').onclick    = nextScene;
$('dialog').onclick  = advanceDialog;

/* ---------- BOUCLE DE JEU ---------- */
const clock = new THREE.Clock();
function loop(){
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  combatT = Math.max(0, combatT - dt);
  if(state==='custom'){
    updateCustom(dt,t);
    MUS.play(currentTrack());
    renderer.render(roomScene,camera);
    requestAnimationFrame(loop);
    return;
  }

  if(state==='play'){
    updatePlayer(dt,t);
    updateMonsters(dt,t);
    updateProjectiles(dt);
    survival(dt);
  }
  checkMissions();
  updateNPCs(t);
  animateGift(dt);                        // après updateNPCs : le geste du chef reste visible
  animateWorld(dt,t);
  animateCave(dt,t);
  updateQuest();
  updatePrompt();
  updateHUD();

  camDist = lerp(camDist, aiming ? 3 : camBase, 0.12);
  updateCamera();
  if(zone==='cave') drawMinimap();
  MUS.play(currentTrack());

  if(zone==='world'){
    sunW.position.set(player.position.x+60, 100, player.position.z+40);
    sunW.target.position.copy(player.position);
  }
  $('crosshair').style.display = (state==='play' && aiming && (weapon==='bow' || weapon==='rock')) ? 'block' : 'none';

  renderer.render(zone==='cave' ? caveScene : worldScene, camera);
  requestAnimationFrame(loop);
}

/* =====================================================================
   PERSONNALISATION : chambre de Greg + menu
   ===================================================================== */
const CU = [
  {ico:'🧍', name:'Corps', y:1.0, d:5, sec:[
    {k:'skin', t:'Peau', pal:'skin'},
    {k:'face', t:'Visage', opts:['Carré','Large','Allongé']},
    {k:'eyes', t:'Yeux', pal:'eyes'}]},
  {ico:'💇', name:'Cheveux', y:1.65, d:2.4, sec:[
    {k:'hair', t:'Coiffure', opts:['Court','Long','Banane','Chauve']},
    {k:'hairC', t:'Couleur', pal:'hair'}]},
  {ico:'👕', name:'Haut', y:1.25, d:3.4, sec:[
    {k:'top', t:'Style', opts:['T-shirt','Marcel','Sweat']},
    {k:'topC', t:'Couleur', pal:'cloth'}]},
  {ico:'👖', name:'Bas', y:0.6, d:3.8, sec:[
    {k:'bot', t:'Style', opts:['Slim','Large','Short']},
    {k:'botC', t:'Couleur', pal:'pants'}]},
  {ico:'👟', name:'Pieds', y:0.35, d:3.0, sec:[
    {k:'shoe', t:'Style', opts:['Chaussures','Baskets','Chaussettes','Chaussons']},
    {k:'shoeC', t:'Couleur', pal:'shoes'}]},
  {ico:'🧢', name:'Accessoires', y:1.5, d:3.0, sec:[
    {k:'hat', t:'Couvre-chef', opts:['Aucun','Casquette','Bonnet']},
    {k:'glasses', t:'Lunettes', opts:['Non','Oui']},
    {k:'bag', t:'Sac à dos', opts:['Non','Oui']},
    {k:'accC', t:'Couleur accessoires', pal:'acc'}]}
];

const roomScene = new THREE.Scene();
roomScene.background = new THREE.Color(0x14111f);
const prevPivot = new THREE.Group(); prevPivot.position.set(0,0.06,0.3); roomScene.add(prevPivot);
let prevG = null, cuTab = 0, spin = 0.35, spinV = 0, drag = null, zoomOff = 0, camT = {y:1,d:5}, crystalR = null;

function glow(w,h,d,c,e,x,y,z){
  const m = new THREE.Mesh(BOX, mat(c,{emissive:e})); m.scale.set(w,h,d); m.position.set(x,y,z); roomScene.add(m); return m;
}
function buildRoom(){
  const S = roomScene;
  // lumières
  S.add(new THREE.HemisphereLight(0xaab8ff,0x4a3524,0.7));
  const key = new THREE.DirectionalLight(0xfff0dd,1.1); key.position.set(-3,5,5); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:1,far:15});
  key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.001; S.add(key);
  const lamp = new THREE.PointLight(0xffb86b,1.2,9,1.4); lamp.position.set(3.05,1.4,-2.4); S.add(lamp);
  const moon = new THREE.PointLight(0x7f9fff,0.8,8,1.4); moon.position.set(0.4,2.7,-2.2); S.add(moon);

  // sol en parquet, mur, plinthe, tapis
  const wood = makeTex(128,(g,s)=>{
    for(let i=0;i<4;i++){ const v = Math.floor(rnd(160,225)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0,i*s/4,s,s/4); }
    g.fillStyle = 'rgba(0,0,0,.35)'; for(let i=0;i<4;i++) g.fillRect(0,i*s/4-1,s,2);
  },4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10,9), new THREE.MeshLambertMaterial({map:wood,color:0xc8905e}));
  floor.rotation.x = -Math.PI/2; floor.position.set(0,0,1.5); floor.receiveShadow = true; S.add(floor);
  part(S,10,5,0.2,0x57608f,0,2.5,-3.1);
  part(S,10,0.15,0.05,0xdddddd,0,0.075,-2.98);
  for(const [r,c] of [[1.6,0x7a3a4a],[1.15,0xb85a6a]]){
    const rug = new THREE.Mesh(new THREE.CircleGeometry(r,40), new THREE.MeshLambertMaterial({color:c}));
    rug.rotation.x = -Math.PI/2; rug.position.set(0,r>1.2?0.01:0.02,0.3); rug.receiveShadow = true; S.add(rug);
  }
  // lit
  part(S,1.7,0.35,2.2,0x5a3a1a,-2.5,0.175,-1.9);
  part(S,1.8,0.9,0.1,0x5a3a1a,-2.5,0.7,-2.95);
  part(S,1.6,0.25,2.1,0xf2f2f2,-2.5,0.47,-1.9);
  part(S,1.62,0.1,1.3,0x3a7ad9,-2.5,0.62,-1.45);
  part(S,1.0,0.14,0.5,0xffffff,-2.5,0.66,-2.7);
  // poster
  const pt = makeTex(128,(g,s)=>{
    g.fillStyle = '#1f5f3a'; g.fillRect(0,0,s,s);
    g.strokeStyle = '#e6ffb3'; g.lineWidth = 4; g.strokeRect(6,6,s-12,s-12);
    g.font = '80px serif'; g.textAlign = 'center'; g.fillText('🦖',s/2,s*0.7);
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.1), new THREE.MeshBasicMaterial({map:pt,color:0xcccccc}));
  poster.position.set(-2.5,2.6,-2.98); S.add(poster);
  // fenêtre de nuit
  glow(1.5,1.3,0.04,0x223a7a,0x1a2f66,0.4,2.7,-2.92);
  glow(0.2,0.2,0.02,0xfff3b0,0xfff3b0,0.9,3.1,-2.89);
  part(S,1.7,0.1,0.08,0xe8e8e8,0.4,3.4,-2.92); part(S,1.7,0.1,0.08,0xe8e8e8,0.4,2.0,-2.92);
  part(S,0.1,1.5,0.08,0xe8e8e8,-0.45,2.7,-2.92); part(S,0.1,1.5,0.08,0xe8e8e8,1.25,2.7,-2.92);
  part(S,0.05,1.3,0.07,0xe8e8e8,0.4,2.7,-2.9); part(S,1.5,0.05,0.07,0xe8e8e8,0.4,2.7,-2.9);
  // bureau, ordinateur, lampe, chaise
  part(S,1.8,0.08,0.8,0x6b4a2b,2.6,0.8,-2.55);
  for(const sx of [-1,1]) for(const sz of [-1,1]) part(S,0.08,0.8,0.08,0x4a3320,2.6+sx*0.82,0.4,-2.55+sz*0.34);
  part(S,0.5,0.03,0.35,0x333333,2.2,0.86,-2.45);
  glow(0.5,0.32,0.02,0x66b8ff,0x3a8acc,2.2,1.04,-2.68).rotation.x = -0.12;
  part(S,0.14,0.03,0.14,0x222222,3.2,0.86,-2.7); part(S,0.03,0.4,0.03,0x222222,3.2,1.06,-2.7);
  glow(0.22,0.08,0.16,0xe8c13a,0xaa8a10,3.1,1.28,-2.65);
  part(S,0.5,0.06,0.5,0x3a3a4a,2.6,0.5,-1.75); part(S,0.5,0.5,0.06,0x3a3a4a,2.6,0.8,-1.5); part(S,0.06,0.5,0.06,0x222222,2.6,0.25,-1.75);
  // le cristal du grand-père
  crystalR = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), mat(0x66ffe0,{emissive:0x1a9a80}));
  crystalR.position.set(1.85,1.02,-2.5); S.add(crystalR);
  const cl = new THREE.PointLight(0x66ffe0,0.7,3.5,1.5); cl.position.copy(crystalR.position); S.add(cl);
}

function rebuildPreview(){
  if(prevG) prevPivot.remove(prevG.root);
  prevG = buildGreg(LOOK);
  ['tBaton','tAxe','tPick','tRock','bow'].forEach(k => prevG[k].visible = false);
  prevG.armL.rotation.z = -0.08; prevG.armR.rotation.z = 0.08;
  prevPivot.add(prevG.root);
}
function drawCustom(){
  $('cuTabs').innerHTML = CU.map((c,i)=>`<button class="cuTab ${i===cuTab?'on':''}" data-t="${i}">${c.ico}<span>${c.name}</span></button>`).join('');
  $('cuBody').innerHTML = CU[cuTab].sec.map(s =>
    `<div class="cuSec"><h3>${s.t}</h3><div class="cuRow">` +
    (s.opts
      ? s.opts.map((o,i)=>`<button class="chip ${LOOK[s.k]===i?'on':''}" data-k="${s.k}" data-v="${i}">${o}</button>`).join('')
      : PAL[s.pal].map((c,i)=>`<button class="sw ${LOOK[s.k]===i?'on':''}" data-k="${s.k}" data-v="${i}" style="background:#${c.toString(16).padStart(6,'0')}"></button>`).join('')) +
    `</div></div>`).join('');
}
function setViewShift(){      // décale Greg pour qu'il ne soit pas caché par le panneau
  if(innerWidth>800) camera.setViewOffset(innerWidth,innerHeight,190,0,innerWidth,innerHeight);
  else camera.setViewOffset(innerWidth,innerHeight,0,Math.round(innerHeight*0.2),innerWidth,innerHeight);
}
function resetCam(){ camera.clearViewOffset(); camera.fov = 70; camera.updateProjectionMatrix(); }
function openCustom(){
  state = 'custom'; cuTab = 0; spin = 0.35; spinV = 0; zoomOff = 0; camT = {y:1,d:5};
  showScreen('custom'); drawCustom(); rebuildPreview();
  camera.fov = 38; camera.updateProjectionMatrix();
}
function updateCustom(dt,t){
  if(drag) spinV *= 0.8; else { spin += spinV; spinV *= 0.93; }
  prevPivot.rotation.y = Math.PI + spin;
  if(prevG){ const b = Math.sin(t*2)*0.03; prevG.armL.rotation.x = b; prevG.armR.rotation.x = -b; }
  if(crystalR){ crystalR.rotation.y += dt; crystalR.position.y = 1.02+Math.sin(t*1.6)*0.04; }
  const c = CU[cuTab], k = 1-Math.exp(-dt*5);
  camT.y = lerp(camT.y, c.y, k); camT.d = lerp(camT.d, clamp(c.d+zoomOff,1.8,7), k);
  camera.position.set(0, camT.y+0.25, 0.3+camT.d);
  camera.lookAt(0, camT.y, 0.3);
  setViewShift();
}

// Interactions du menu
$('custom').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.t!==undefined) cuTab = +b.dataset.t;
  else if(b.dataset.k){ LOOK[b.dataset.k] = +b.dataset.v; rebuildPreview(); }
  else return;
  drawCustom();
});
$('cuRnd').onclick = () => {
  CU.forEach(c => c.sec.forEach(s => { LOOK[s.k] = Math.floor(Math.random()*(s.opts ? s.opts.length : PAL[s.pal].length)); }));
  rebuildPreview(); drawCustom();
};
$('cuGo').onclick = () => {
  model.remove(GREG.root); GREG = buildGreg(LOOK); model.add(GREG.root);   // applique l'apparence en jeu
  resetCam(); startCinematic();
};
// Rotation à la souris / au doigt
$('custom').addEventListener('pointerdown', e => { if(e.target.closest('#cuPanel')) return; drag = {x:e.clientX}; spinV = 0; });
addEventListener('pointermove', e => { if(!drag) return; const dx = e.clientX-drag.x; drag.x = e.clientX; spin += dx*0.012; spinV = dx*0.012; });
addEventListener('pointerup', () => { drag = null; });
$('custom').addEventListener('wheel', e => { zoomOff = clamp(zoomOff+e.deltaY*0.002,-1,1.5); e.stopPropagation(); }, {passive:true});

/* ---------- DÉMARRAGE ---------- */
buildAll();
buildRoom();
drawControls();
showScreen('menu');
loop();
$('cuBack').onclick = () => {
  state = 'menu';
  showScreen('menu');
  resetCam();
};
/* ==========================================================
   PATCH : graphismes, animations, cinématique d'intro
   À coller TOUT EN BAS du JS, après le code existant.
   ========================================================== */

// ---------- Style global ----------
(function(){
  const st = document.createElement('style');
  st.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&display=swap');
    body,.btn,.chip,h1,h2,label{font-family:'Fredoka','Trebuchet MS',sans-serif}
    #menu{background:linear-gradient(180deg,#ff9a5a 0%,#ffd38a 28%,#8fd3ff 58%,#5cb84a 59%,#2c6b25 100%)}
    h1{animation:bob 3s ease-in-out infinite}
    @keyframes bob{50%{transform:translateY(-6px) rotate(-.6deg)}}
    .btn{background:linear-gradient(180deg,#6cd14e,#3a8a28);transition:transform .15s,filter .2s}
    .btn:hover{background:linear-gradient(180deg,#86e066,#4aa434);transform:translateY(-2px);filter:brightness(1.1)}
    #stats,#quest{border:2px solid rgba(255,255,255,.18);backdrop-filter:blur(4px)}
    #vig{position:fixed;inset:0;pointer-events:none;z-index:4;background:radial-gradient(ellipse at center,transparent 55%,rgba(20,5,0,.5) 100%)}
    #cineFx,#cineFlash{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    #cineFx{z-index:1}
    #cineFlash{z-index:3;background:#fff;opacity:0}
    #cineBg{animation:pan 24s ease-in-out infinite alternate}
    @keyframes pan{from{transform:scale(1)}to{transform:scale(1.1)}}
    #cineSkip{position:absolute;right:22px;bottom:22px;z-index:6;background:rgba(0,0,0,.5);color:#fff;border:2px solid #c8f08a;border-radius:20px;padding:8px 16px;font:inherit;font-size:15px;cursor:pointer}
    #cineSkip:hover{background:rgba(63,138,44,.8)}
    .typing::after{content:'▍';animation:blink 1s steps(1) infinite}
    @keyframes blink{50%{opacity:0}}
  `;
  document.head.appendChild(st);
  const v = document.createElement('div'); v.id = 'vig'; document.body.appendChild(v);
})();

// ---------- Graphismes : ciel, lumière, couleurs ----------
(function(){
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#2f7fd8'); gr.addColorStop(.55,'#9fd8ff'); gr.addColorStop(1,'#ffe6b8');
  g.fillStyle = gr; g.fillRect(0,0,4,256);
  worldScene.background = new THREE.CanvasTexture(c);
  worldScene.fog.color.set(0xcfe9ff);
  worldScene.children.forEach(o => {
    if(o.isHemisphereLight){ o.color.set(0xfff1d6); o.groundColor.set(0x4f7a2e); o.intensity = 0.9; }
  });
  sunW.color.set(0xffe0a0); sunW.intensity = 2.3;
  renderer.toneMappingExposure = 1.15;
  canvas.style.filter = 'saturate(1.3) contrast(1.06)';
})();

// ---------- Particules de pollen qui suivent Greg ----------
(function(){
  const N = 160, pos = new Float32Array(N*3);
  const ph = Array.from({length:N}, () => Math.random()*6.28);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({color:0xfff3b0,size:0.12,transparent:true,opacity:0.85,depthWrite:false}));
  pts.frustumCulled = false; worldScene.add(pts);
  (function tick(){
    requestAnimationFrame(tick);
    if(zone!=='world' || state!=='play'){ pts.visible = false; return; }
    pts.visible = true;
    const t = performance.now()/1000, p = player.position;
    for(let i=0;i<N;i++){
      const a = ph[i] + t*(0.15 + (i%4)*0.05), r = 3 + (i%7)*0.9;
      pos[i*3]   = p.x + Math.cos(a)*r;
      pos[i*3+1] = p.y + 0.8 + Math.sin(t*0.8+i)*1.1 + (i%3);
      pos[i*3+2] = p.z + Math.sin(a)*r;
    }
    geo.attributes.position.needsUpdate = true;
  })();
})();

// ---------- État partagé (sûr même avant la fin du chargement) ----------
function FXS(){
  return window.FX || (window.FX = {bobAmp:0, shake:0, typeT:null, typed:false, full:'', fxMode:'stars', fxP:[], cv:null, cx:null, flash:null});
}

// ---------- Caméra : balancement en marchant + secousses ----------
window.updateCamera = function(){
  const F = FXS(), p = player.position, sw = swimK > 0.5;
  const mv = ['z','w','s','q','a','d','arrowup','arrowdown','arrowleft','arrowright'].some(k => keys[k]);
  F.bobAmp = lerp(F.bobAmp, (mv && onGround && !wet && state==='play') ? 0.06 : 0, 0.12);
  F.shake = Math.max(0, F.shake - 0.03);
  const bob = Math.sin(walkT*2)*F.bobAmp, sh = F.shake*(Math.random()-0.5);
  const tx = p.x, ty = p.y + (sw ? 0.7 : 1.6*crouchS) + bob, tz = p.z;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cx = tx + Math.sin(yaw)*cp*camDist + sh, cy = ty + sp*camDist + 0.3, cz = tz + Math.cos(yaw)*cp*camDist;
  const gy = groundY(cx,cz) + 0.8;
  camera.position.set(cx, Math.max(cy,gy), cz);
  camera.lookAt(tx,ty,tz);
  const f = aiming ? 50 : 70;
  if(Math.abs(camera.fov-f) > 0.1){ camera.fov = lerp(camera.fov,f,0.15); camera.updateProjectionMatrix(); }
};

// Greg touché : secousse + flash rouge
window.hurtPlayer = function(d){
  playerHP -= d; combatT = 8; SND.hurt(); FXS().shake = 0.6;
  const f = $('flash'); f.style.opacity = 0.5; setTimeout(()=>{ f.style.opacity = 0; }, 180);
  if(playerHP<=0) respawn();
};

// ---------- CINÉMATIQUE D'INTRO ----------
SCENES.length = 0;
SCENES.push(
  {bg:'radial-gradient(circle at 50% 40%,#2a1d4a,#050510 70%)', icon:'🦖', fx:'stars',
   t:"GREG & LES DINOSAURES — Chapitre 1 : le cristal"},
  {bg:'linear-gradient(#2b2440,#6b4a3a 70%,#1a1410)', icon:'🛏️', fx:'embers',
   t:"Paris, 2026. Greg a 15 ans. Chaque soir, il rejoint l'atelier de son grand-père, paléontologue, pour réparer une vieille machine couverte de poussière."},
  {bg:'linear-gradient(#0a0a1f,#0b3b5c 60%,#1a2f4a)', icon:'⚡', fx:'rain', shake:false,
   t:"Un soir d'orage, la machine s'allume toute seule dans un éclair bleu. Au fond de la pièce, un cristal se met à briller."},
  {bg:'radial-gradient(circle,#9ff 0%,#4a1a8a 45%,#050010 80%)', icon:'🌀', fx:'stars',
   t:"Greg est aspiré dans un tunnel de lumière. Le temps se tord autour de lui, et une voix lointaine murmure son prénom…"},
  {bg:'linear-gradient(#ffb36b,#ff6f3c 35%,#2e7d32 70%,#1b5e20)', icon:'🦕', fx:'leaves', shake:true,
   t:"Il atterrit brutalement dans un monde disparu : le Crétacé, il y a 66 millions d'années. Un rugissement fait trembler la terre."},
  {bg:'linear-gradient(#ff9a6b,#ffd38a 40%,#2e7d32 75%,#1b3d12)', icon:'🏕️', fx:'embers', shake:false,
   t:"Des humains vivent ici, dans un village de maisons-champignons. Le chef Akela accepte d'aider ce garçon venu d'ailleurs."},
  {bg:'linear-gradient(#2b1d3a,#0d2b1a)', icon:'💎', fx:'stars', shake:false,
   t:"Pour rentrer chez lui, Greg devra comprendre le secret du cristal caché dans la grotte de la montagne. Survis, Greg."}
);

function cineInit(){
  const F = FXS(); if(F.cv) return;
  const cine = $('cine');
  F.cv = document.createElement('canvas'); F.cv.id = 'cineFx'; cine.prepend(F.cv);
  F.cx = F.cv.getContext('2d');
  F.flash = document.createElement('div'); F.flash.id = 'cineFlash'; cine.prepend(F.flash);
  const sk = document.createElement('button'); sk.id = 'cineSkip'; sk.textContent = 'Passer ⏭';
  sk.onclick = e => { e.stopPropagation(); skipCine(); };
  cine.appendChild(sk);
  const rs = () => { F.cv.width = innerWidth; F.cv.height = innerHeight; };
  rs(); addEventListener('resize', rs);
  (function tick(){ requestAnimationFrame(tick); cineFxDraw(); })();
}
function cineSpawn(mode){
  const F = FXS(), W = innerWidth, H = innerHeight;
  const n = {stars:120, rain:150, embers:70, leaves:45}[mode] || 0;
  F.fxMode = mode;
  F.fxP = Array.from({length:n}, () => ({x:Math.random()*W, y:Math.random()*H, v:0.5+Math.random()*1.5, s:1+Math.random()*2, ph:Math.random()*6.28}));
}
function cineFxDraw(){
  const F = FXS(); if(state!=='cine' || !F.cx) return;
  const c = F.cx, W = F.cv.width, H = F.cv.height, t = performance.now()/1000;
  c.clearRect(0,0,W,H);
  for(const p of F.fxP){
    if(F.fxMode==='stars'){
      p.y += p.v*0.15; if(p.y>H) p.y = 0;
      c.fillStyle = `rgba(255,255,255,${0.4+0.6*Math.sin(t*2+p.ph)})`;
      c.beginPath(); c.arc(p.x,p.y,p.s*0.6,0,6.28); c.fill();
    } else if(F.fxMode==='rain'){
      p.y += p.v*16; p.x -= 3; if(p.y>H){ p.y = -20; p.x = Math.random()*W; }
      c.strokeStyle = 'rgba(170,215,255,.45)';
      c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(p.x+3,p.y+16); c.stroke();
    } else if(F.fxMode==='embers'){
      p.y -= p.v*0.9; p.x += Math.sin(t+p.ph)*0.7; if(p.y<-10){ p.y = H+10; p.x = Math.random()*W; }
      c.fillStyle = 'rgba(255,170,70,.85)';
      c.beginPath(); c.arc(p.x,p.y,p.s,0,6.28); c.fill();
    } else if(F.fxMode==='leaves'){
      p.y += p.v*0.7; p.x += Math.sin(t+p.ph)*1.2; if(p.y>H){ p.y = -10; p.x = Math.random()*W; }
      c.save(); c.translate(p.x,p.y); c.rotate(t+p.ph);
      c.fillStyle = 'rgba(110,190,70,.85)'; c.fillRect(-p.s*2,-p.s,p.s*4,p.s*2); c.restore();
    }
  }
}
function cineFlash(){
  const f = FXS().flash;
  f.style.transition = 'none'; f.style.opacity = .7;
  requestAnimationFrame(()=>{ f.style.transition = 'opacity 1.2s ease-out'; f.style.opacity = 0; });
}
function cineDone(){
  const F = FXS(); clearInterval(F.typeT); F.typed = true;
  const txt = $('cineText'); txt.textContent = F.full; txt.classList.remove('typing');
}
function skipCine(){
  if(state!=='cine') return;
  sceneI = SCENES.length; clearTimeout(cineTimer); showScene();
}

window.showScene = function(){
  cineInit();
  const F = FXS();
  clearTimeout(cineTimer); clearInterval(F.typeT);
  if(sceneI >= SCENES.length){ startGame(); return; }
  const s = SCENES[sceneI];
  $('cineBg').style.background = s.bg;
  const ic = $('cineIcon'); ic.textContent = s.icon;
  ic.animate([{transform:'scale(.2) rotate(-25deg)',opacity:0},{transform:'scale(1) rotate(0)',opacity:1}],
             {duration:900, easing:'cubic-bezier(.2,1.5,.4,1)'});
  cineSpawn(s.fx);
  if(s.shake){
    cineFlash();
    $('cine').animate([{transform:'translate(0,0)'},{transform:'translate(7px,-4px)'},{transform:'translate(-6px,3px)'},{transform:'translate(0,0)'}],{duration:400});
  }
  F.full = s.t; F.typed = false;
  const txt = $('cineText'); txt.textContent = ''; txt.classList.add('typing');
  let i = 0;
  F.typeT = setInterval(() => {
    i++; txt.textContent = F.full.slice(0,i);
    if(i >= F.full.length) cineDone();
  }, 35);
  cineTimer = setTimeout(nextScene, Math.max(9000, F.full.length*35 + 3000));
};

window.nextScene = function(){
  if(state!=='cine') return;
  const F = FXS();
  if(!F.typed){ cineDone(); return; }   // 1er clic : texte complet
  sceneI++; showScene();                // 2e clic : scène suivante
};
$('cine').onclick = () => nextScene();
/* ==========================================================
   PATCH 1 : petites créatures (poules, lapins, gobelins)
   - Clic gauche près d'un animal = tu l'attrapes
   - Clic gauche quand tu le tiens = tu le lances
   À coller TOUT EN BAS du script, après le patch graphismes.
   ========================================================== */
 
const CRIT = [];          // petites créatures vivantes
let critHeld = null;      // créature tenue au-dessus de la tête
 
const CRIT_NAME = {poule:'la poule', lapin:'le lapin', gobelin:'le gobelin'};
 
function buildChicken(){
  const g = new THREE.Group();
  part(g,0.5,0.4,0.6,0xfafafa,0,0.45,0);          // corps
  part(g,0.3,0.3,0.3,0xfafafa,0,0.8,-0.25);       // tête
  part(g,0.12,0.1,0.14,0xffa62b,0,0.78,-0.5);     // bec
  part(g,0.06,0.14,0.14,0xd33a2a,0,0.98,-0.25);   // crête
  part(g,0.04,0.2,0.04,0xffa62b,-0.1,0.1,0);      // pattes
  part(g,0.04,0.2,0.04,0xffa62b, 0.1,0.1,0);
  return g;
}
 
function buildRabbit(){
  const g = new THREE.Group();
  part(g,0.5,0.45,0.7,0xc8a27a,0,0.42,0);         // corps
  part(g,0.36,0.34,0.36,0xc8a27a,0,0.75,-0.3);    // tête
  part(g,0.12,0.5,0.1,0xc8a27a,-0.1,1.1,-0.3);    // oreilles
  part(g,0.12,0.5,0.1,0xc8a27a, 0.1,1.1,-0.3);
  part(g,0.1,0.1,0.1,0xffffff,0,0.45,0.42);       // queue
  part(g,0.06,0.06,0.04,0xff3333,-0.08,0.78,-0.49); // yeux
  part(g,0.06,0.06,0.04,0xff3333, 0.08,0.78,-0.49);
  return g;
}
 
function spawnCritter(kind, x, z){
  let g;
  if(kind==='poule') g = buildChicken();
  else if(kind==='lapin') g = buildRabbit();
  else { g = buildHuman(0x5c3b1e,0x2a2a2a,0x2a3a1a,0x7fb35a).g; g.scale.setScalar(0.7); }
  g.position.set(x, getHeight(x,z), z);
  worldScene.add(g);
  CRIT.push({kind, g, hx:x, hz:z, tx:x, tz:z, wT:rnd(1,4),
             sp: kind==='poule' ? 1.6 : kind==='lapin' ? 2.4 : 2.2,
             ph:rnd(0,6.28), held:false, air:false, vx:0, vy:0, vz:0});
}
 
// Pose les créatures dans le monde (loin du village et de la grotte)
function buildCritters(){
  const plan = [['poule',14],['lapin',14],['gobelin',8]];
  for(const [kind,n] of plan){
    for(let k=0, tries=0; k<n && tries<3000; tries++){
      const x = rnd(-160,160), z = rnd(-160,160);
      if(hyp(x,z,VIL.x,VIL.z) < 45 || hyp(x,z,MOUTH.x,MOUTH.z) < 30) continue;
      if(!free(x,z,1)) continue;
      spawnCritter(kind,x,z); k++;
    }
  }
}
 
/* ---------- Déplacement, fuite, retombée ---------- */
function critStep(c, dt, t){
  const p = c.g.position;
 
  // En l'air (lancée) : elle retombe et rebondit
  if(c.air){
    c.vy -= 22*dt;
    p.x += c.vx*dt; p.z += c.vz*dt; p.y += c.vy*dt;
    const gy = getHeight(p.x,p.z);
    if(p.y <= gy){
      p.y = gy; c.vy = -c.vy*0.35; c.vx *= 0.6; c.vz *= 0.6;
      if(Math.abs(c.vy) < 1.5){ c.air = false; c.vx = c.vz = 0; c.hx = p.x; c.hz = p.z; c.tx = p.x; c.tz = p.z; }
    }
    return;
  }
 
  // Fuite quand Greg approche, sinon errance autour de son point de départ
  const pl = player.position, dPl = Math.hypot(pl.x-p.x, pl.z-p.z);
  if(dPl < 5){
    const a = Math.atan2(p.x-pl.x, p.z-pl.z);
    c.tx = p.x + Math.sin(a)*6; c.tz = p.z + Math.cos(a)*6; c.wT = 1.2;
  } else {
    c.wT -= dt;
    if(c.wT <= 0){
      c.wT = rnd(2,5);
      const a = rnd(0,6.28), r = rnd(2,9);
      c.tx = c.hx + Math.cos(a)*r; c.tz = c.hz + Math.sin(a)*r;
    }
  }
 
  const dx = c.tx-p.x, dz = c.tz-p.z, d = Math.hypot(dx,dz);
  const moving = d > 0.2;
  if(moving){
    const st = Math.min(d, c.sp*dt);
    const nx = p.x + dx/d*st, nz = p.z + dz/d*st;
    if(!blocked(nx,nz)){ p.x = nx; p.z = nz; c.g.rotation.y = Math.atan2(-dx,-dz); }
    else c.wT = 0;                                      // obstacle : on change de direction
  }
  // Le lapin fait de petits bonds, les autres marchent au ras du sol
  const hop = (c.kind==='lapin' && moving) ? Math.abs(Math.sin(t*9+c.ph))*0.3 : 0;
  p.y = getHeight(p.x,p.z) + hop;
  if(c.kind!=='lapin' && moving) c.g.rotation.z = Math.sin(t*10+c.ph)*0.04;
  else c.g.rotation.z = 0;
}
 
/* ---------- Tenir et lancer ---------- */
function critHoldPos(){
  const pl = player.position, fx = -Math.sin(heading), fz = -Math.cos(heading);
  return {x: pl.x + fx*0.9, y: pl.y + 2.6, z: pl.z + fz*0.9};
}
function critNearest(maxD){
  let best = null, bd = maxD;
  for(const c of CRIT){
    if(c.held || c.air) continue;
    const d = distTo(c.g.position.x, c.g.position.z);
    if(d < bd){ bd = d; best = c; }
  }
  return best;
}
function critGrab(c){
  c.held = true; critHeld = c; c.air = false;
  SND.pick();
  toast('Tu tiens ' + CRIT_NAME[c.kind] + ' ! Clic gauche pour le lancer.');
}
function critThrow(){
  const c = critHeld; critHeld = null; c.held = false;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  c.vx = dir.x*16; c.vz = dir.z*16; c.vy = dir.y*16 + 6;
  c.air = true;
  SND.noise(0.12, 0.2, 2000, 'bandpass');
}
 
// Clic gauche : d'abord attraper / lancer, sinon l'attaque normale.
// Capture sur window = passe avant le clic d'attaque existant.
addEventListener('mousedown', e => {
  if(e.button!==0 || state!=='play' || zone!=='world' || !document.pointerLockElement) return;
  if(critHeld){ critThrow(); e.stopImmediatePropagation(); return; }
  const c = critNearest(3.2);
  if(c){ critGrab(c); e.stopImmediatePropagation(); }
}, true);
 
// Boucle propre aux créatures (indépendante de la boucle principale)
let _critLast = performance.now();
(function critLoop(){
  requestAnimationFrame(critLoop);
  const now = performance.now(), dt = Math.min(0.05, (now-_critLast)/1000), t = now/1000;
  _critLast = now;
  for(const c of CRIT){
    c.g.visible = zone==='world';
    if(c.held){
      const h = critHoldPos();
      c.g.position.set(h.x, h.y + Math.sin(t*12)*0.05, h.z);
      c.g.rotation.y = heading;
      continue;
    }
    if(state==='play' && zone==='world') critStep(c, dt, t);
  }
})();
 
// Quand on entre dans la grotte, on lâche la créature tenue
const _critSetZone = setZone;
setZone = function(z){
  if(critHeld && z!=='world'){ critHeld.held = false; critHeld.air = false; critHeld = null; }
  _critSetZone(z);
};
 
buildCritters();
/* ==========================================================
   PATCH 2 v2 : pouvoir « PRENDRE » (REMPLACE l'ancien patch 2)
   - Tout reste dans le jeu : on ne retire plus rien des listes,
     on marque seulement l'objet comme « tenu ».
   - Maisons de base, rochers, arbres, dinosaures, villageois.
   - Les objets reprennent leur collision quand on les repose.
   - Au cristal, après les quêtes : pas de mini-jeu, le pouvoir.
   À coller APRÈS le patch 1 (créatures), tout en bas du script.
   ========================================================== */

const PWR = {owned:false, on:false};
let bigHeld = null;           // entrée actuellement tenue
const GRABS = [];             // tout ce qui peut être pris (permanent)
const AIRS = [];              // objets lancés ou lâchés qui retombent

MISSION[6] = "Mission terminée ! Va voir le cristal au fond de la grotte et appuie sur E devant lui.";

/* ---------- Inventaire de tout ce qui est prenable ---------- */
function buildGrabs(){
  TREES.forEach(t => GRABS.push({
    kind:'arbre', root:t.g, col:t.col, ref:t, alive:() => !t.cut
  }));
  monsters.forEach(m => GRABS.push({
    kind:'dino', root:m.root, col:null, ref:m, alive:() => !m.dead && !m.spec.fly
  }));
  npcs.forEach(n => GRABS.push({
    kind:'perso', root:n.g, col:null, ref:n, alive:() => n.g.parent===worldScene
  }));
  // Maisons et rochers : on retrouve leur objet 3D grâce à leur position (x,z)
  const treeGroups = new Set(TREES.map(t => t.g));
  const npcGroups  = new Set(npcs.map(n => n.g));
  worldScene.children.forEach(o => {
    if(o===player) return;
    const isRock  = o.isMesh && o.geometry===DODEC && o.material===rockMat;
    const isHouse = o.isGroup && !treeGroups.has(o) && !npcGroups.has(o);
    if(!isRock && !isHouse) return;
    const c = COL.find(c => Math.abs(c.x-o.position.x)<0.01 && Math.abs(c.z-o.position.z)<0.01);
    if(!c) return;
    GRABS.push({
      kind: isRock ? 'rocher' : 'maison', root:o, col:c, ref:null,
      alive:() => o.visible && o.parent===worldScene
    });
  });
}

function grabNearest(maxD){
  const fx = -Math.sin(heading), fz = -Math.cos(heading), pl = player.position;
  let best = null, bd = maxD;
  for(const e of GRABS){
    if(e.held || e.air || !e.alive()) continue;
    const dx = e.root.position.x-pl.x, dz = e.root.position.z-pl.z, d = Math.hypot(dx,dz);
    if(d < bd && (dx*fx+dz*fz)/(d||1) > 0.2){ bd = d; best = e; }
  }
  return best;
}

function grabIt(e){
  e.held = true; bigHeld = e;
  if(e.ref) e.ref.grabbed = true;               // l'IA des dinos / arbres s'arrête
  if(e.col){ const i = COL.indexOf(e.col); if(i>=0) COL.splice(i,1); }
  SND.pick();
  toast('Tu prends ' + e.kind + ' ! Clic gauche pour le jeter.');
}

function throwIt(){
  const e = bigHeld; bigHeld = null;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  e.held = false; e.air = true;
  e.vx = dir.x*18; e.vy = dir.y*18+5; e.vz = dir.z*18;
  AIRS.push(e); SND.crack();
}

function dropIt(){
  const e = bigHeld; bigHeld = null;
  e.held = false; e.air = true; e.vx = e.vy = e.vz = 0;
  AIRS.push(e);
}

// Quand un objet touche le sol : il redevient solide là où il est, et l'IA reprend
function landIt(e, i){
  const p = e.root.position;
  e.air = false; AIRS.splice(i,1);
  if(e.ref) e.ref.grabbed = false;
  if(e.ref && e.kind==='dino'){ e.ref.home = {x:p.x, z:p.z}; e.ref.tx = p.x; e.ref.tz = p.z; }
  if(e.col){ e.col.x = p.x; e.col.z = p.z; if(COL.indexOf(e.col)<0) COL.push(e.col); }
}

// Clic gauche avec le pouvoir : prendre ou jeter (capture = avant l'attaque)
addEventListener('mousedown', e => {
  if(e.button!==0 || state!=='play' || zone!=='world' || !document.pointerLockElement) return;
  if(critHeld) return;                          // le patch 1 gère déjà les petites créatures
  if(bigHeld){ throwIt(); e.stopImmediatePropagation(); return; }
  if(!PWR.on) return;
  const g = grabNearest(7);
  if(g){ grabIt(g); e.stopImmediatePropagation(); }
}, true);

/* ---------- Déblocage du pouvoir au cristal ---------- */
function unlockPower(){
  PWR.owned = true; PWR.on = false; SND.quest();
  openDialog('Le cristal', [
    "Tu as tout accompli, Greg. Le cristal te reconnaît enfin.",
    "Appuie sur F pour équiper le pouvoir PRENDRE. Ensuite, clic gauche pour tout prendre, clic gauche pour le jeter.",
    "Dinosaures, villageois, maisons-champignons, arbres, rochers… rien ne te résistera."
  ], () => toast("Pouvoir obtenu : appuie sur F pour l'équiper"));
}
// E devant le cristal, une fois les quêtes finies : le pouvoir (et pas le mini-jeu)
const _interactBase = interact;
interact = function(){
  if(zone==='cave' && quest.stage>=6 && !PWR.owned && distTo(ROOM.x,ROOM.z)<4){ unlockPower(); return; }
  _interactBase();
};

// Touche F : équiper / ranger le pouvoir (et débloquer au cristal aussi)
addEventListener('keydown', e => {
  if(e.repeat || e.key.toLowerCase()!=='f' || state!=='play') return;
  if(zone==='cave' && !PWR.owned && quest.stage>=6 && distTo(ROOM.x,ROOM.z)<6){ unlockPower(); return; }
  if(!PWR.owned){ toast("Tu n'as pas encore de pouvoir."); return; }
  PWR.on = !PWR.on;
  if(!PWR.on && bigHeld) dropIt();
  toast(PWR.on ? 'Pouvoir PRENDRE équipé ✋' : 'Pouvoir PRENDRE rangé');
});

const _promptTextBase = promptText;
promptText = function(){
  if(zone==='cave' && quest.stage>=6 && !PWR.owned && distTo(ROOM.x,ROOM.z)<6) return 'E / F : Écouter le cristal';
  return _promptTextBase();
};

/* ---------- Dinos et arbres tenus : l'IA et la coupe les ignorent ---------- */
const _updateMonsterBase = updateMonster;
updateMonster = function(m,dt,t){ if(m.grabbed) return; _updateMonsterBase(m,dt,t); };
const _cutTreeBase = cutTree;
cutTree = function(t){ if(t.grabbed) return false; return _cutTreeBase(t); };
const _nearestTreeBase = nearestTree;
nearestTree = function(r,d){ const t = _nearestTreeBase(r,d); return t && !t.grabbed ? t : null; };

/* ---------- Boucle : suivre la main, voler, retomber ---------- */
let _bigLast = performance.now();
(function bigLoop(){
  requestAnimationFrame(bigLoop);
  const now = performance.now(), dt = Math.min(0.05, (now-_bigLast)/1000);
  _bigLast = now;
  const onWorld = zone==='world';

  if(bigHeld){
    const h = critHoldPos();
    bigHeld.root.position.set(h.x, h.y-1.2, h.z);
    bigHeld.root.rotation.y = heading;
  }
  for(const e of GRABS) if(e.held || e.air) e.root.visible = onWorld;

  if(state==='play' && onWorld){
    for(let i=AIRS.length-1;i>=0;i--){
      const e = AIRS[i], p = e.root.position;
      e.vy -= 22*dt;
      p.x += e.vx*dt; p.y += e.vy*dt; p.z += e.vz*dt;
      // choc contre un dinosaure vivant
      for(const m of monsters){
        if(m.dead || m.spec.fly || m===e.ref) continue;
        if(Math.hypot(m.root.position.x-p.x, m.root.position.z-p.z) < 2.5*m.spec.scale && p.y < m.root.position.y+3){
          hurtMonster(m, 30); e.vx *= -0.3; e.vz *= -0.3;
        }
      }
      const gy = getHeight(p.x,p.z);
      if(p.y <= gy){
        p.y = gy; e.vy = -e.vy*0.3; e.vx *= 0.6; e.vz *= 0.6;
        if(Math.abs(e.vy) < 1.2) landIt(e, i);
      }
    }
  }
})();

// Changer de zone : on lâche ce qu'on tient
const _setZoneBig = setZone;
setZone = function(z){
  if(bigHeld && z!=='world') dropIt();
  _setZoneBig(z);
};

buildGrabs();
/* ==========================================================
   PATCH 3 : cinématique du cristal (quand on récolte le pouvoir)
   1. Le cristal tourne de plus en plus vite et monte
   2. Il brille fort en jaune, puis grossit et devient bleu clair
   3. La lumière explose : toute la grotte devient blanche
   4. Caméra fixe de la grotte : les gobelins sursautent et courent
   Puis le dialogue normal reprend.
   À coller APRÈS le patch 2 v2, tout en bas du script.
   ========================================================== */

const CUT = {on:false, t:0, dur:13.5, ang:0, shake:0, sfx:false, done:null};
const cutLight = new THREE.PointLight(0xffe14d, 0, 70, 1.2);
caveScene.add(cutLight);

// Voile blanc (flash) et bandes noires (style cinéma)
const cutEl = {};
(function(){
  const mk = s => { const d = document.createElement('div'); d.style.cssText = s; document.body.appendChild(d); return d; };
  cutEl.top   = mk('position:fixed;left:0;right:0;top:0;height:0;background:#000;z-index:28;pointer-events:none;transition:none');
  cutEl.bot   = mk('position:fixed;left:0;right:0;bottom:0;height:0;background:#000;z-index:28;pointer-events:none');
  cutEl.flash = mk('position:fixed;inset:0;background:#fff;opacity:0;z-index:29;pointer-events:none');
})();

let CUT_BG0 = null, CUT_FOG0 = null;
const CUT_GOB = [];                     // gobelins de la grotte pendant la cinématique
const WHITE = new THREE.Color(0xffffff);
const YELLOW = new THREE.Color(0xffe14d), LIGHTBLUE = new THREE.Color(0x9fe7ff);

function cutStart(onDone){
  CUT.on = true; CUT.t = 0; CUT.sfx = false; CUT.done = onDone;
  state = 'cut';
  for(const k in keys) keys[k] = false;
  if(document.exitPointerLock) document.exitPointerLock();
  CUT_BG0 = caveScene.background.clone();
  CUT_FOG0 = caveScene.fog.color.clone();
  $('hud').classList.add('hidden');
  CUT_GOB.length = 0;
  npcs.forEach(n => {
    if(n.g.parent===caveScene && n.id.startsWith('gob'))
      CUT_GOB.push({n, hx:n.g.position.x, hz:n.g.position.z, ph:rnd(0,6.28), tx:ROOM.x, tz:ROOM.z, wT:0});
  });
  camera.fov = 60; camera.updateProjectionMatrix();
  SND.echo();
}

// Appelé à chaque image, après l'animation de la grotte
function updateCut(dt){
  const t = CUT.t += dt, c = crystal, cx = ROOM.x, cz = ROOM.z;
  const k = clamp(t/6.5, 0, 1);

  // 1) Rotation qui accélère, montée lente
  c.rotation.y += (1.2 + 26*k*k) * dt;
  c.position.set(cx, 2.6 + 3.4*k*k, cz);

  // 2) Jaune vif, puis bleu clair et grossit
  const bl = clamp((t-3)/2, 0, 1);
  c.material.color.copy(YELLOW).lerp(LIGHTBLUE, bl);
  c.material.emissive.copy(YELLOW).lerp(LIGHTBLUE, bl);
  c.scale.setScalar(1 + 2.5*clamp((t-3)/2.5, 0, 1));

  // 3) Lumière qui monte, puis explose
  cutLight.position.set(cx, c.position.y, cz);
  cutLight.color.copy(c.material.color);
  cutLight.intensity = t < 3 ? 3 + t*3
                     : t < 5 ? 12
                     : t < 6.5 ? 12 + (t-5)/1.5*80
                     : 92 - 80*clamp((t-7.5)/2, 0, 1);

  // 4) Flash blanc : la grotte devient toute blanche, puis revient
  const fl = clamp((t-6.5)/0.8, 0, 1) - clamp((t-7.5)/1.6, 0, 1);
  cutEl.flash.style.opacity = fl;
  caveScene.background.copy(CUT_BG0).lerp(WHITE, fl);
  caveScene.fog.color.copy(CUT_FOG0).lerp(WHITE, fl);
  if(!CUT.sfx && t >= 6.5){ CUT.sfx = true; SND.roar(); SND.crack(); }

  // Secousses de la caméra : de plus en plus fortes, puis elles retombent
  CUT.shake = t < 6.5 ? 0.02 + 0.45*k*k : 0.5*(1 - clamp((t-6.5)/2, 0, 1));

  // Bandes noires
  const bars = clamp(t/1.0, 0, 1)*12 - clamp((t-12.5)/1, 0, 1)*12;
  cutEl.top.style.height = bars + 'vh';
  cutEl.bot.style.height = bars + 'vh';

  // Gobelins : sursaut puis course
  for(const g of CUT_GOB) cutGob(g, dt, t);

  if(t >= CUT.dur) cutEnd();
}

function cutGob(g, dt, t){
  const p = g.n.g.position;
  if(t < 7.5) return;
  if(t < 8.3){                                        // sursaut : saut et bras en l'air
    p.y = Math.abs(Math.sin((t-7.5)/0.8*Math.PI))*0.9;
    g.n.arms.forEach(a => a.rotation.x = -2.6);
    return;
  }
  // course dans la grotte
  p.y = Math.abs(Math.sin(t*14 + g.ph))*0.15;
  g.n.arms.forEach((a,i) => a.rotation.x = Math.sin(t*14 + g.ph + i*Math.PI)*0.9);
  g.wT -= dt;
  const dd = Math.hypot(g.tx-p.x, g.tz-p.z);
  if(g.wT <= 0 || dd < 0.5){
    g.wT = rnd(0.8,1.6);
    const a = rnd(0,6.28), r = rnd(4,16);
    g.tx = ROOM.x + Math.cos(a)*r; g.tz = ROOM.z + Math.sin(a)*r;
  }
  const dx = g.tx-p.x, dz = g.tz-p.z, d = Math.hypot(dx,dz);
  if(d > 0.01){
    const st = Math.min(d, 7*dt);
    p.x += dx/d*st; p.z += dz/d*st;
    g.n.g.rotation.y = Math.atan2(-dx,-dz);
  }
}

function cutEnd(){
  CUT.on = false;
  cutEl.flash.style.opacity = 0;
  cutEl.top.style.height = '0'; cutEl.bot.style.height = '0';
  crystal.scale.setScalar(1);
  crystal.material.color.set(0x66ffe0);
  crystal.material.emissive.set(0x1a9a80);
  cutLight.intensity = 0;
  caveScene.background.copy(CUT_BG0);
  caveScene.fog.color.copy(CUT_FOG0);
  CUT_GOB.forEach(g => { g.n.g.position.set(g.hx, 0, g.hz); g.n.arms.forEach(a => a.rotation.x = 0); });
  camera.fov = 70; camera.updateProjectionMatrix();
  $('hud').classList.remove('hidden');
  state = 'play';
  const d = CUT.done; CUT.done = null;
  if(d) d();
}

// Caméra fixe qui tourne doucement autour du cristal (la main de Greg ne la commande pas)
const _updateCameraBase = updateCamera;
updateCamera = function(){
  if(!CUT.on){ _updateCameraBase(); return; }
  const t = CUT.t, cx = ROOM.x, cz = ROOM.z, sh = CUT.shake;
  const a = 0.6 + t*0.12, d = 14 - Math.min(4, t*0.4);
  camera.position.set(cx + Math.sin(a)*d + rnd(-sh,sh), 4.5 + rnd(-sh,sh)*0.5, cz + Math.cos(a)*d + rnd(-sh,sh));
  camera.lookAt(cx, crystal.position.y, cz);
};

// La cinématique se joue à chaque image, avant le rendu
const _animateCaveBase = animateCave;
animateCave = function(dt,t){
  _animateCaveBase(dt,t);
  if(CUT.on) updateCut(dt);
};

// Le pouvoir passe par la cinématique, puis le dialogue
const _unlockBase = unlockPower;
unlockPower = function(){
  if(CUT.on || PWR.owned) return;
  PWR.owned = true;                       // bloque les doubles appuis pendant la cinématique
  cutStart(() => _unlockBase());
};
/* ==========================================================
   PATCH 4A : grotte plus vivante + gros rochers à miner
   - Grappes de cristaux colorés, champignons lumineux, flaques,
     mousse, dalles de couleur, ossements de dinosaures
   - Gros rochers à miner à la pioche (4 coups) : éclats, secousse,
     son, et gros rochers qui tombent
   À coller APRÈS le patch 3, tout en bas du script.
   ========================================================== */

const MINE = [];
const CRYST_GEO = new THREE.OctahedronGeometry(1, 0);
const GROT_COLS = [0x66ffe0, 0xff7ad9, 0xb58cff, 0xffb347, 0x7ef07e];

// Position au hasard dans la grotte, en évitant la sortie
function grotPlace(dMin, dMax){
  const a = rnd(0, 6.28), d = rnd(dMin, dMax);
  return {x: ROOM.x + Math.cos(a)*d, z: ROOM.z + Math.sin(a)*d};
}
const nearGrotExit = (x,z) => hyp(x,z,EXIT.x,EXIT.z) < 9;

function caveDecorate(){
  const S = caveScene;
  const glow = (c, k=0.6) => new THREE.MeshLambertMaterial({color:c, emissive:c, emissiveIntensity:k, flatShading:true});

  // Grappes de cristaux colorés (avec une petite lumière pour certaines)
  for(let i=0, n=0; i<80 && n<16; i++){
    const p = grotPlace(12, 27);
    if(nearGrotExit(p.x,p.z)) continue;
    n++;
    const c = GROT_COLS[n % GROT_COLS.length], g = new THREE.Group();
    for(let k=0, m=Math.floor(rnd(3,6)); k<m; k++){
      const s = new THREE.Mesh(CRYST_GEO, glow(c, 0.5));
      const h = rnd(0.8, 1.9);
      s.scale.set(rnd(0.25,0.45), h, rnd(0.25,0.45));
      s.position.set(rnd(-0.5,0.5), h*0.8, rnd(-0.5,0.5));
      s.rotation.set(rnd(-0.25,0.25), rnd(0,6), rnd(-0.25,0.25));
      g.add(s);
    }
    g.position.set(p.x, 0, p.z); S.add(g);
    CAVE_COL.push({x:p.x, z:p.z, r:0.8});
    if(n % 4 === 0){
      const L = new THREE.PointLight(c, 0.7, 9, 1.5);
      L.position.set(p.x, 2, p.z); S.add(L);
    }
  }

  // Champignons lumineux qui poussent par petits groupes
  for(let i=0; i<14; i++){
    const p = grotPlace(10, 26);
    if(nearGrotExit(p.x,p.z)) continue;
    const g = new THREE.Group(), c = GROT_COLS[Math.floor(rnd(0,GROT_COLS.length))];
    for(let k=0, m=Math.floor(rnd(2,5)); k<m; k++){
      const ox = rnd(-0.7,0.7), oz = rnd(-0.7,0.7), sc = rnd(0.7,1.2);
      part(g, 0.12*sc, 0.6*sc, 0.12*sc, 0xeee8d8, ox, 0.3*sc, oz);
      const cap = new THREE.Mesh(SPH, glow(c, 0.9));
      cap.scale.set(0.35*sc, 0.2*sc, 0.35*sc); cap.position.set(ox, 0.62*sc, oz); g.add(cap);
    }
    g.position.set(p.x, 0, p.z); S.add(g);
  }

  // Flaques d'eau brillantes au sol
  for(let i=0; i<10; i++){
    const p = grotPlace(8, 26);
    const f = new THREE.Mesh(new THREE.CircleGeometry(rnd(1.5,3.5), 14),
      new THREE.MeshPhongMaterial({color:0x3a7ab0, shininess:120, specular:0x88ccff, transparent:true, opacity:0.7}));
    f.rotation.x = -Math.PI/2; f.position.set(p.x, 0.03, p.z); S.add(f);
  }

  // Taches de mousse et de terre : le sol n'est plus tout gris
  for(let i=0; i<36; i++){
    const p = grotPlace(3, 30);
    const moss = Math.random() < 0.6;
    const f = new THREE.Mesh(new THREE.CircleGeometry(rnd(1.2,3), 10),
      new THREE.MeshLambertMaterial({color: moss ? jit(0x4f8a3a,0.05) : jit(0x6b5034,0.05)}));
    f.rotation.x = -Math.PI/2; f.position.set(p.x, 0.02, p.z); S.add(f);
  }

  // Ossements de dinosaures au sol (des côtes)
  for(let i=0; i<5; i++){
    const p = grotPlace(10, 24), g = new THREE.Group();
    for(let k=0; k<4; k++){
      const r = part(g, 0.12, 0.12, 1.4, 0xe8e0c8, 0, 0.1, (k-1.5)*0.45);
      r.rotation.y = rnd(-0.2,0.2);
    }
    g.position.set(p.x, 0, p.z); g.rotation.y = rnd(0,6.28); S.add(g);
  }
}

// Gros rochers colorés à miner
function caveMineNodes(){
  for(let i=0, n=0; i<90 && n<9; i++){
    const p = grotPlace(10, 26);
    if(nearGrotExit(p.x,p.z) || MINE.some(m => hyp(m.x,m.z,p.x,p.z) < 6)) continue;
    n++;
    const g = new THREE.Group();
    const rock = new THREE.Mesh(DODEC, new THREE.MeshLambertMaterial({map:TEX.rock, color:0xd8c8b0, flatShading:true}));
    rock.scale.setScalar(rnd(1.5,2.1)); rock.position.y = 1.3;
    rock.rotation.set(rnd(0,3), rnd(0,3), 0); rock.castShadow = true; g.add(rock);
    const c = GROT_COLS[n % GROT_COLS.length];
    for(let k=0; k<4; k++){                        // éclats de cristal sur le rocher
      const s = new THREE.Mesh(CRYST_GEO, new THREE.MeshLambertMaterial({color:c, emissive:c, emissiveIntensity:0.5, flatShading:true}));
      s.scale.set(0.35, rnd(0.7,1.2), 0.35); s.position.set(rnd(-1,1), 1.8, rnd(-1,1));
      s.rotation.set(rnd(-0.5,0.5), 0, rnd(-0.6,0.6)); g.add(s);
    }
    g.position.set(p.x, 0, p.z); caveScene.add(g);
    const col = {x:p.x, z:p.z, r:1.8}; CAVE_COL.push(col);
    MINE.push({g, rock, x:p.x, z:p.z, hp:4, col, wob:0, color:c});
  }
}

// Coup de pioche sur un rocher coloré (prioritaire sur les murs)
function mineHit(fx,fz){
  const px = player.position.x, pz = player.position.z;
  let best = null, bd = 4.2;
  for(const m of MINE){
    if(m.hp <= 0) continue;
    const dx = m.x-px, dz = m.z-pz, d = Math.hypot(dx,dz);
    if(d < bd && (dx*fx+dz*fz)/(d||1) > 0.3){ bd = d; best = m; }
  }
  if(!best) return false;
  best.hp--; best.wob = 0.35;
  SND.clink(); FXS().shake = 0.25;
  spawnDebris(best.x, 1.5+rnd(0,1.5), best.z, 0xd8c8b0, 7, caveScene);
  spawnDebris(best.x, 2.2, best.z, best.color, 4, caveScene);
  if(best.hp <= 0) mineBreak(best);
  return true;
}

function mineBreak(m){
  const i = CAVE_COL.indexOf(m.col); if(i >= 0) CAVE_COL.splice(i,1);
  caveScene.remove(m.g);
  spawnDebris(m.x, 2.5, m.z, 0xd8c8b0, 30, caveScene);
  spawnDebris(m.x, 2.5, m.z, m.color, 12, caveScene);
  SND.crack(); FXS().shake = 0.8;
  spawnPickup('bigrock', m.x+rnd(-1.5,1.5), m.z+rnd(-1.5,1.5), 1, 0, caveScene);
  if(Math.random() < 0.6) spawnPickup('rock', m.x+rnd(-2,2), m.z+rnd(-2,2), 3, 0, caveScene);
  toast('Rocher cassé ! Tu trouves un gros rocher.');
}

// Le pioche touche d'abord les rochers colorés, sinon les murs
const _doPickHitBase = doPickHit;
doPickHit = function(fx,fz){
  if(state==='play' && zone==='cave' && mineHit(fx,fz)) return;
  _doPickHitBase(fx,fz);
};

// Les rochers tremblent après un coup
const _animateCaveP4 = animateCave;
animateCave = function(dt,t){
  _animateCaveP4(dt,t);
  for(const m of MINE){
    if(m.wob > 0){
      m.wob = Math.max(0, m.wob - dt);
      m.rock.rotation.z = Math.sin(m.wob*40) * 0.12 * (m.wob/0.35);
    }
  }
};

caveDecorate();
caveMineNodes();
/* ==========================================================
   PATCH 4B : chemins des gobelins, coffres, champignon vert
   - 3 sentiers de pierres plates depuis le bord de la grotte
     jusqu'à des coffres ; les gobelins marchent dessus
   - Coffres (touche E) : flèches, champignons verts, arc, nourriture
   - Champignon vert (touche R) : +60 % de vitesse pendant 1 minute
   À coller APRÈS le patch 4A, tout en bas du script.
   ========================================================== */

const BOOST = {t:0};
const CHESTS = [];
const TRAILS = [];
const GOB_WALK = [];
const TILE_MAT = new THREE.MeshLambertMaterial({color:0x8a6a48, flatShading:true});
const TILE_GEO = new THREE.BoxGeometry(1.3, 0.04, 1.3);

// Nouvel objet : le champignon vert
ITEMS.push(['champi','🍄','Champignon vert']);
NAME.champi = 'Champignon vert';
inv.champi = 0;

// Courbe douce entre deux points (quadratique)
function grotCurve(sx,sz,ex,ez){
  const mx = (sx+ex)/2 + rnd(-7,7), mz = (sz+ez)/2 + rnd(-7,7), pts = [];
  for(let i=0;i<=24;i++){
    const t = i/24, u = 1-t;
    pts.push({x: u*u*sx + 2*u*t*mx + t*t*ex, z: u*u*sz + 2*u*t*mz + t*t*ez});
  }
  let len = 0;
  for(let i=1;i<pts.length;i++) len += Math.hypot(pts[i].x-pts[i-1].x, pts[i].z-pts[i-1].z);
  return {pts, len};
}

function buildChest(x, z, rot){
  const g = new THREE.Group();
  part(g, 1.5, 0.8, 1.0, 0x7a4a22, 0, 0.4, 0);                 // caisse
  const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.5); g.add(lid);
  part(lid, 1.56, 0.25, 1.06, 0x5a3418, 0, 0.12, 0.5);        // couvercle
  part(lid, 1.58, 0.1, 0.12, 0x9a9a9a, 0, 0.02, 1.0);         // bande métal
  part(g, 0.22, 0.3, 0.1, 0xf1c40f, 0, 0.6, 0.53);             // serrure dorée
  g.position.set(x, 0, z); g.rotation.y = rot; caveScene.add(g);
  return {g, lid, x, z, open:false, anim:0};
}

// Sentiers, coffres et gobelins qui marchent dessus
(function buildTrailsAndChests(){
  const ends = [];
  for(let i=0;i<5;i++){
    const a = i/5*Math.PI*2 + rnd(-0.3,0.3), d = rnd(8,14);
    ends.push({x: ROOM.x+Math.cos(a)*d, z: ROOM.z+Math.sin(a)*d, a});
  }
  ends.forEach((e, i) => {
    if(i >= 3) {                                         // 2 coffres sans sentier
      CHESTS.push(buildChest(e.x, e.z, Math.atan2(e.x-ROOM.x, e.z-ROOM.z)));
      CAVE_COL.push({x:e.x, z:e.z, r:1.0});
      return;
    }
    const sa = e.a + rnd(-0.5,0.5);
    const trail = grotCurve(ROOM.x+Math.cos(sa)*27, ROOM.z+Math.sin(sa)*27, e.x, e.z);
    TRAILS.push(trail);
    trail.pts.forEach((p,k) => {                         // pierres plates le long du sentier
      if(k % 2) return;
      const t = new THREE.Mesh(TILE_GEO, TILE_MAT);
      t.position.set(p.x + rnd(-0.2,0.2), 0.03, p.z + rnd(-0.2,0.2));
      t.rotation.y = rnd(0, 1.2); t.receiveShadow = true; caveScene.add(t);
    });
    CHESTS.push(buildChest(e.x, e.z, Math.atan2(e.x-ROOM.x, e.z-ROOM.z)));
    CAVE_COL.push({x:e.x, z:e.z, r:1.0});
  });
  // Les gobelins se répartissent sur les sentiers
  let n = 0;
  npcs.forEach(g => {
    if(!g.id.startsWith('gob') || g.g.parent!==caveScene) return;
    GOB_WALK.push({n:g, trail:TRAILS[n % TRAILS.length], u:rnd(0,20), dir:1, pause:0});
    n++;
  });
})();

// Marche des gobelins le long des sentiers
function walkGobs(dt, t){
  for(const w of GOB_WALK){
    if(w.pause > 0){ w.pause -= dt; continue; }
    const pts = w.trail.pts, last = pts.length-1;
    w.u += w.dir * 1.2 * last / w.trail.len * dt;
    if(w.u >= last){ w.u = last; w.dir = -1; w.pause = rnd(1,3); }
    if(w.u <= 0){ w.u = 0; w.dir = 1; w.pause = rnd(1,3); }
    const i = Math.floor(w.u), f = w.u - i;
    const a = pts[i], b = pts[Math.min(i+1,last)];
    const p = w.n.g.position;
    p.x = a.x + (b.x-a.x)*f; p.z = a.z + (b.z-a.z)*f;
    p.y = Math.abs(Math.sin(t*10 + i))*0.05;
    w.n.g.rotation.y = Math.atan2(-(b.x-a.x)*w.dir, -(b.z-a.z)*w.dir);
  }
}

// Coffre le plus proche de Greg
function nearChest(){
  for(const c of CHESTS) if(distTo(c.x,c.z) < 2.6) return c;
  return null;
}

// Butin : flèches, champignons verts, nourriture, et l'arc si tu ne l'as pas
function openChest(c){
  c.open = true; c.anim = 0; SND.pick();
  const got = [];
  const add = (id, n, label) => { inv[id] = (inv[id]||0) + n; got.push(n + ' ' + label); };
  add('arrow', Math.floor(rnd(8,13)), 'flèches');
  add('champi', Math.floor(rnd(1,3)), 'champignon(s) vert(s)');
  const bonus = ['apple','meat','wood'][Math.floor(rnd(0,3))];
  add(bonus, 2, {apple:'pommes', meat:'viande', wood:'bois'}[bonus]);
  if(!inv.bow){ inv.bow = 1; got.push('un arc'); }
  updateHands();
  toast('Coffre : ' + got.join(', ') + ' !');
}

// E : ouvrir un coffre (prioritaire dans la grotte)
const _interactP4 = interact;
interact = function(){
  if(state==='play' && zone==='cave'){
    const c = nearChest();
    if(c){ if(!c.open) openChest(c); else toast('Ce coffre est vide.'); return; }
  }
  _interactP4();
};
const _promptP4 = promptText;
promptText = function(){
  if(zone==='cave'){ const c = nearChest(); if(c && !c.open) return 'E : Ouvrir le coffre'; }
  return _promptP4();
};

// R : manger le champignon vert avant la nourriture normale
const _eatBase = eat;
eat = function(){
  if(state==='play' && inv.champi > 0){
    inv.champi--; food = Math.min(100, food+10); BOOST.t = 60;
    SND.quest();
    toast('Champignon vert ! Tu cours plus vite pendant 1 minute ⚡');
    return;
  }
  _eatBase();
};

// Vitesse : quand le bonus est actif, Greg avance 1,6 fois plus vite
const boostBox = document.createElement('div');
boostBox.id = 'boostBox'; boostBox.className = 'hidden';
boostBox.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:rgba(60,160,40,.85);padding:6px 14px;border-radius:10px;font-size:18px;z-index:6;pointer-events:none';
document.body.appendChild(boostBox);

const _updatePlayerP4 = updatePlayer;
updatePlayer = function(dt,t){
  _updatePlayerP4(dt,t);
  if(BOOST.t > 0){
    BOOST.t = Math.max(0, BOOST.t - dt);
    _updatePlayerP4(dt*0.6, t);
    boostBox.textContent = '⚡ Vitesse +60 % : ' + Math.ceil(BOOST.t) + ' s';
    boostBox.classList.remove('hidden');
  } else boostBox.classList.add('hidden');
};

// Animation : gobelins sur les sentiers, couvercles des coffres qui s'ouvrent
const _animateCaveP4b = animateCave;
animateCave = function(dt,t){
  _animateCaveP4b(dt,t);
  if(CUT.on) return;                                    // la cinématique garde la main
  walkGobs(dt, t);
  for(const c of CHESTS){
    if(c.open && c.anim < 1){
      c.anim = Math.min(1, c.anim + dt*1.2);
      const e = 1 - Math.pow(1-c.anim, 3);
      c.lid.rotation.x = -1.9*e;
    }
  }
};
/* ==========================================================
   PATCH 5A : mini-jeu 2D « Souvenirs du cristal » (amélioré)
   - Décor : ciel qui change, soleil, nuages, collines, plateformes
   - Greg animé (course, saut, double saut), invincibilité après un coup
   - Pièges : rochers qui tombent, raptors qui courent au sol
   - Bonus : cœurs (+1 vie), souvenirs à récupérer sur les plateformes
   - Chaque souvenir raconte un petit bout de l'histoire de grand-père
   À coller APRÈS le patch 4B, tout en bas du script.
   ========================================================== */

const MEM_LINES = [
  "Mon grand-père rangeait ses fossiles par ordre d'âge, comme des livres.",
  "Il disait que les dinosaures ne sont jamais vraiment partis.",
  "Ce cristal, il l'avait trouvé dans une vieille machine de l'atelier.",
  "Une photo : un squelette de T-Rex dans un musée, un matin de pluie.",
  "Il m'a dit : « Si un jour tu rentres dans la grotte, ne lâche jamais le cristal. »",
  "Greg (pensée) : Je dois rentrer. Je dois me souvenir de tout."
];
const MINI_SKY = [['#7fd0ff','#e8f7ff'], ['#ffc27a','#ffe9b8'], ['#9b6bd6','#ffb3c7'], ['#1d2b5a','#4a5a9a']];
const MINI_PLAT = [{x:170, dy:110, w:150}, {x:420, dy:180, w:140}, {x:600, dy:95, w:120}];

function playMemory(){
  state = 'mini';
  if(document.exitPointerLock) document.exitPointerLock();
  showScreen('mini');
  const cv = $('minicv'), c = cv.getContext('2d'), W = cv.width, H = cv.height, GY = H-60;
  const PLAT = MINI_PLAT.map(p => ({x:p.x, y:GY-p.dy, w:p.w}));
  const GOAL = MEM_LINES.length;

  const P = {x:80, y:GY, vy:0, onG:true, air:1, face:1, walk:0, inv:0};
  let lives = 3, got = 0, t = 0, flash = 0, shake = 0, msg = '', msgT = 0, jumpReq = 0, winT = 0, raf = 0;
  let rocks = [], raptors = [], souv = [], hearts = [], parts = [];
  const clouds = Array.from({length:5}, () => ({x:rnd(0,W), y:rnd(30,130), s:rnd(0.6,1.2)}));
  const keys = {};

  const kd = e => {
    const kk = e.key.toLowerCase(); keys[kk] = true;
    if(kk===' ' || kk==='z' || kk==='w' || kk==='arrowup'){ jumpReq = 8; e.preventDefault(); }
  };
  const ku = e => { keys[e.key.toLowerCase()] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);

  function cleanup(){
    cancelAnimationFrame(raf);
    removeEventListener('keydown', kd); removeEventListener('keyup', ku);
  }
  function finish(){
    cleanup();
    showScreen(null); state = 'play'; memDone = true;
    openDialog('Greg', [
      "Des images remontent, une à une : mon grand-père, l'atelier, le cristal sur son bureau…",
      "Greg (pensée) : Le cristal… il ouvre le passage. Je dois le garder précieusement."
    ], null);
  }
  function burst(x, y, col, n){
    for(let i=0; i<n; i++) parts.push({x, y, vx:rnd(-3,3), vy:rnd(-4,1), life:rnd(25,45), col, s:rnd(2,4)});
  }
  function hurt(){
    if(P.inv > 0) return;
    lives--; P.inv = 70; shake = 12; flash = 18; SND.hurt();
    burst(P.x, P.y-30, '#ff5555', 14);
  }
  function collectSouv(s){
    got++; msg = MEM_LINES[got-1]; msgT = 280; SND.pick();
    burst(s.x, s.y, '#ffe66b', 20);
    if(got >= GOAL){ winT = 150; msg = 'Tous les souvenirs sont revenus…'; msgT = 150; }
  }

  // --- Dessins ---
  function hill(color, base, amp, freq, off){
    c.fillStyle = color; c.beginPath(); c.moveTo(-20, H);
    for(let x=-20; x<=W+20; x+=20) c.lineTo(x, base - amp*Math.abs(Math.sin((x+off)*freq)));
    c.lineTo(W+20, H); c.closePath(); c.fill();
  }
  function drawCloud(x, y, s){
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.ellipse(x, y, 40*s, 16*s, 0, 0, 7); c.ellipse(x+30*s, y-6*s, 28*s, 18*s, 0, 0, 7); c.fill();
  }
  function drawHeart(x, y, s){
    c.fillStyle = '#ff4d7a'; c.beginPath();
    c.arc(x-s/2, y, s/2, 0, 7); c.arc(x+s/2, y, s/2, 0, 7);
    c.moveTo(x-s, y+s*0.1); c.lineTo(x, y+s); c.lineTo(x+s, y+s*0.1); c.fill();
  }
  function drawGreg(){
    const blink = P.inv > 0 && Math.floor(t/4) % 2 === 0;
    if(blink) return;
    const sw = P.onG ? Math.sin(P.walk)*6 : 0;
    c.save(); c.translate(P.x, P.y); c.scale(P.face, 1);
    c.fillStyle = '#2b3a67'; c.fillRect(-10+sw, -18, 8, 18); c.fillRect(2-sw, -18, 8, 18);   // jambes
    c.fillStyle = '#2f6fd6'; c.fillRect(-12, -44, 24, 28);                                    // t-shirt
    c.fillStyle = '#f1c79a'; c.fillRect(8, -40+sw*0.3, 6, 18);                                // bras
    c.fillRect(-16, -40-sw*0.3, 6, 18);
    c.fillStyle = '#f1c79a'; c.fillRect(-10, -62, 20, 18);                                    // tête
    c.fillStyle = '#4a2e1a'; c.fillRect(-11, -64, 22, 7);                                     // cheveux
    c.fillStyle = '#222'; c.fillRect(3, -54, 3, 3);                                           // œil
    c.restore();
  }
  function drawRaptor(d){
    const sw = Math.sin(d.walk)*5;
    c.fillStyle = '#c9702a';
    c.fillRect(d.x-22, GY-34, 40, 18);                 // corps
    c.fillRect(d.x-32, GY-44, 16, 12);                 // tête (à gauche, il court vers la gauche)
    c.fillRect(d.x+14, GY-30, 18, 6);                  // queue
    c.fillStyle = '#8a4a1a';
    c.fillRect(d.x-12+sw, GY-16, 6, 16); c.fillRect(d.x+2-sw, GY-16, 6, 16);   // pattes
    c.fillStyle = '#ff2222'; c.fillRect(d.x-28, GY-40, 3, 3);                 // œil
  }
  function drawRock(r){
    c.fillStyle = '#6b6964'; c.beginPath(); c.arc(r.x, r.y+2, r.r, 0, 7); c.fill();
    c.fillStyle = '#8c8a86'; c.beginPath(); c.arc(r.x, r.y, r.r*0.9, 0, 7); c.fill();
    c.fillStyle = '#b5b2ab'; c.beginPath(); c.arc(r.x-r.r*0.3, r.y-r.r*0.3, r.r*0.3, 0, 7); c.fill();
  }

  function frame(){
    t++;

    // Déplacements
    const left = keys.q || keys.a || keys.arrowleft, right = keys.d || keys.arrowright;
    const vx = ((right?1:0) - (left?1:0)) * 5;
    if(vx){ P.face = Math.sign(vx); if(P.onG) P.walk += 0.3; }
    P.x = clamp(P.x + vx, 30, W-30);

    // Saut et double saut
    if(jumpReq > 0){
      jumpReq--;
      if(P.onG){ P.vy = -12; P.onG = false; P.air = 1; SND.tone(500, 0.12, 'triangle', 0.1, null, 300); }
      else if(P.air > 0){ P.vy = -10; P.air--; burst(P.x, P.y, '#ffffff', 6); }
      jumpReq = 0;
    }

    // Gravité et atterrissage (sol ou plateforme)
    const prev = P.y;
    P.vy += 0.6; P.y += P.vy;
    let land = null;
    if(P.vy >= 0){
      for(const p of PLAT) if(P.x+12 > p.x && P.x-12 < p.x+p.w && prev <= p.y && P.y >= p.y && (land===null || p.y < land)) land = p.y;
      if(prev <= GY && P.y >= GY && (land===null || GY < land)) land = GY;
    }
    if(land !== null){ P.y = land; P.vy = 0; P.onG = true; P.air = 1; }
    else P.onG = false;
    if(P.inv > 0) P.inv--;

    // Apparitions
    const freq = Math.max(28, 60 - got*4);
    if(winT <= 0){
      if(t % freq === 0) rocks.push({x:rnd(30,W-30), y:-20, v:rnd(3,4.5)+got*0.25, r:rnd(12,18)});
      if(t % 520 === 0 && got > 0) raptors.push({x:W+40, v:4.5+got*0.25, walk:0});
      if(t % 150 === 0 && souv.length < 2 && got + souv.length < GOAL){
        const pl = PLAT[Math.floor(rnd(0, PLAT.length))];
        souv.push({x:pl.x + pl.w/2, y:pl.y - 40, ph:rnd(0,6)});
      }
      if(t % 600 === 300) hearts.push({x:rnd(60,W-60), y:rnd(GY-200, GY-40), ph:rnd(0,6)});
    }

    // Rochers
    rocks = rocks.filter(r => {
      r.y += r.v;
      if(Math.abs(r.x-P.x) < 18+r.r*0.6 && r.y+r.r > P.y-62 && r.y-r.r < P.y){ hurt(); burst(r.x, r.y, '#9a948c', 10); return false; }
      return r.y < H+30;
    });
    // Raptors
    raptors = raptors.filter(d => {
      d.x -= d.v; d.walk += 0.4;
      if(Math.abs(d.x-P.x) < 28 && P.y > GY-45) hurt();
      return d.x > -60;
    });
    // Souvenirs
    souv = souv.filter(s => {
      s.ph += 0.05;
      if(Math.hypot(s.x-P.x, s.y-(P.y-30)) < 34){ collectSouv(s); return false; }
      return true;
    });
    // Cœurs
    hearts = hearts.filter(h => {
      h.ph += 0.05;
      if(Math.hypot(h.x-P.x, h.y-(P.y-30)) < 30){ lives = Math.min(5, lives+1); SND.pick(); burst(h.x, h.y, '#ff4d7a', 12); return false; }
      return true;
    });
    // Particules
    parts = parts.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--; return p.life > 0; });

    // Perdu : on repart du bon endroit, avec les souvenirs déjà trouvés
    if(lives <= 0){
      lives = 3; rocks = []; raptors = []; P.x = 80; P.y = GY; P.vy = 0; P.onG = true;
      msg = "Tu es assommé… mais tes souvenirs restent avec toi !"; msgT = 180;
    }
    if(winT > 0){ winT--; if(winT === 0){ finish(); return; } }
    if(msgT > 0) msgT--;
    if(flash > 0) flash--;
    if(shake > 0){ shake *= 0.85; if(shake < 0.3) shake = 0; }

    // --- Dessin ---
    const pal = MINI_SKY[Math.min(3, Math.floor(got/2))];
    const sky = c.createLinearGradient(0,0,0,H); sky.addColorStop(0,pal[0]); sky.addColorStop(1,pal[1]);
    c.save();
    if(shake > 0) c.translate(rnd(-shake,shake), rnd(-shake,shake));
    c.fillStyle = sky; c.fillRect(-20,-20,W+40,H+40);

    c.fillStyle = 'rgba(255,230,120,0.25)'; c.beginPath(); c.arc(W-110, 80, 70, 0, 7); c.fill();
    c.fillStyle = '#ffe066'; c.beginPath(); c.arc(W-110, 80, 34, 0, 7); c.fill();
    for(const cl of clouds){ cl.x += cl.s*0.4; if(cl.x > W+80) cl.x = -80; drawCloud(cl.x, cl.y, cl.s); }

    const off = (P.x-W/2);
    hill('rgba(40,50,95,0.35)', GY-70, 90, 0.008, off*0.15);       // montagnes lointaines
    hill('rgba(45,120,60,0.55)', GY-10, 40, 0.02, off*0.4);         // collines proches

    c.fillStyle = '#4f9a33'; c.fillRect(-20, GY, W+40, 20);         // herbe
    c.fillStyle = '#3f8529';
    for(let x=-20; x<W+20; x+=24) c.fillRect(x + ((x/24)%2)*8, GY, 10, 6);
    c.fillStyle = '#8a5a2b'; c.fillRect(-20, GY+20, W+40, H-GY);   // terre
    c.fillStyle = '#6e4620';
    for(let x=0; x<W; x+=40) c.fillRect(x+((x/40)%3)*6, GY+34, 12, 4);

    for(const p of PLAT){                                           // plateformes en pierre
      c.fillStyle = '#7a6a58'; c.fillRect(p.x, p.y, p.w, 16);
      c.fillStyle = '#4f9a33'; c.fillRect(p.x, p.y-4, p.w, 6);
    }

    for(const h of hearts) drawHeart(h.x, h.y + Math.sin(h.ph)*4, 14);
    for(const s of souv){
      const bob = Math.sin(s.ph)*4;
      c.fillStyle = 'rgba(255,230,120,0.25)'; c.beginPath(); c.arc(s.x, s.y+bob, 26+Math.sin(s.ph*2)*3, 0, 7); c.fill();
      c.fillStyle = '#fff3b0'; c.fillRect(s.x-16, s.y-12+bob, 32, 24);
      c.fillStyle = '#3a5a8a'; c.fillRect(s.x-11, s.y-7+bob, 22, 14);
    }
    for(const r of rocks) drawRock(r);
    for(const d of raptors) drawRaptor(d);
    for(const p of parts){ c.globalAlpha = Math.min(1, p.life/20); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    drawGreg();
    c.restore();

    if(flash > 0){ c.fillStyle = 'rgba(255,60,60,' + (flash/18*0.35) + ')'; c.fillRect(0,0,W,H); }

    // HUD : vies, progression
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(14, 14, 240, 92);
    for(let i=0; i<lives; i++) drawHeart(38 + i*26, 36, 16);
    c.fillStyle = '#333'; c.fillRect(30, 60, 210, 14);
    c.fillStyle = '#ffe066'; c.fillRect(30, 60, 210*got/GOAL, 14);
    c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.textAlign = 'left';
    c.fillText('Souvenirs : ' + got + ' / ' + GOAL, 30, 94);
    c.textAlign = 'right'; c.font = '13px sans-serif'; c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillText('Q/D : bouger · Espace : sauter (x2 en l\'air)', W-14, H-10);

    // Message de souvenir
    if(msgT > 0){
      c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(W/2-340, H-70, 680, 46);
      c.fillStyle = '#fff'; c.font = '16px sans-serif'; c.textAlign = 'center';
      c.fillText(msg, W/2, H-42);
    }

    raf = requestAnimationFrame(frame);
  }
  frame();
}
/* ==========================================================
   PATCH 5B : nouvel objectif après le pouvoir
   - Dès que tu as le pouvoir PRENDRE, nouvelle mission :
     retrouver les 3 fragments de cristal éparpillés dans le monde
   - 3 fragments brillants (E pour les ramasser)
   - Quand tu les as tous : la dernière mission s'affiche
   À coller APRÈS le patch 5A, tout en bas du script.
   ========================================================== */

ITEMS.push(['fragment','💠','Fragment de cristal']);
NAME.fragment = 'Fragment de cristal';
inv.fragment = 0;

// Crée un fragment brillant au sol (ramassable avec E comme les autres objets)
function spawnFragment(x, z){
  const g = new THREE.Group();
  const m = new THREE.Mesh(CRYST_GEO, new THREE.MeshLambertMaterial({color:0x66ffe0, emissive:0x1a9a80, flatShading:true}));
  m.scale.set(0.35, 0.6, 0.35); m.position.y = 0.6; m.castShadow = true; g.add(m);
  const L = new THREE.PointLight(0x66ffe0, 0.6, 6, 1.5); L.position.y = 1.2; g.add(L);
  const base = getHeight(x,z) + 0.4;
  g.position.set(x, base, z); worldScene.add(g);
  pickups.push({type:'fragment', count:1, g, base, scn:worldScene});
}

// 3 fragments loin du village, dans des endroits libres
(function placeFragments(){
  let n = 0;
  for(let i=0; i<2000 && n<3; i++){
    const a = rnd(0, 6.28), d = rnd(70, 165);
    const x = Math.cos(a)*d, z = Math.sin(a)*d;
    if(!free(x,z,1) || getHeight(x,z) < 2) continue;
    if(hyp(x,z,MOUNT.x,MOUNT.z) < 30) continue;
    spawnFragment(x, z); n++;
  }
})();

// Texte de la mission, avec le compteur des fragments
const _updateQuestP5 = updateQuest;
updateQuest = function(){
  MISSION[7] = "Retrouve les 3 fragments de cristal éparpillés dans le monde. (" + Math.min(3, inv.fragment) + "/3)";
  MISSION[8] = "Les 3 fragments brillent ensemble ! Retourne au cristal de la grotte pour rentrer chez toi.";
  _updateQuestP5();
};

// Changement de mission : après le pouvoir, puis quand les 3 fragments sont là
const _checkMissionsP5 = checkMissions;
checkMissions = function(){
  _checkMissionsP5();
  if(quest.stage === 6 && PWR.owned){
    quest.stage = 7; SND.quest();
    toast('Nouvelle mission : retrouve les 3 fragments de cristal !');
  }
  if(quest.stage === 7 && inv.fragment >= 3){
    quest.stage = 8; SND.quest();
    toast('Les 3 fragments brillent ensemble !');
  }
};
/* ==========================================================
   PATCH 6A : retour dans la chambre, puis départ vers le Monde Vert
   - Après les 3 fragments, le cristal de la grotte te ramène
     dans la chambre de Greg (petite scène avec dialogue)
   - Le cristal s'ouvre : Greg saute dans la lumière violette
   À coller APRÈS le patch 5B, tout en bas du script.
   (Le patch 6B crée le monde : à coller juste après.)
   ========================================================== */

const CH2 = {started:false, room:false, t0:0};

// Caméra de la chambre : douce dérive autour de Greg
const _updateCameraP6 = updateCamera;
updateCamera = function(){
  if(!CH2.room){ _updateCameraP6(); return; }
  const t = (performance.now() - CH2.t0) / 1000;
  camera.position.set(Math.sin(t*0.2)*0.6, 1.6 + Math.sin(t*0.5)*0.05, 3.6 - Math.min(1.2, t*0.05));
  camera.lookAt(0, 1.1, 0.3);
  if(crystalR) crystalR.rotation.y += 0.02;
};

// Affichage : la chambre à la place de la grotte pendant la scène
const _rrBaseP6 = renderer.render.bind(renderer);
renderer.render = function(scene, cam){
  if(CH2.room) return _rrBaseP6(roomScene, cam);
  if(zone === 'world2') return _rrBaseP6(world2Scene, cam);
  return _rrBaseP6(scene, cam);
};

function startChapter2(){
  if(CH2.started || CUT.on) return;
  CH2.started = true;
  state = 'cut';
  for(const k in keys) keys[k] = false;
  if(document.exitPointerLock) document.exitPointerLock();
  $('hud').classList.add('hidden');
  rebuildPreview();                                  // Greg dans sa tenue actuelle
  prevPivot.rotation.y = 0;
  CH2.room = true; CH2.t0 = performance.now();
  camera.fov = 50; camera.updateProjectionMatrix();
  openDialog('Chambre', [
    "Greg rentre chez lui. Tout est exactement comme il l'a laissé… sauf le cristal sur le bureau, qui brille doucement.",
    "À côté, un vieux carnet ouvert. Un dessin : une forêt géante, des champignons plus hauts que des maisons, et un nom écrit à la main : « Le Monde Vert ».",
    "Greg (pensée) : Grand-père… tu étais déjà allé plus loin que moi.",
    "Le cristal se met à vibrer. Le plafond s'ouvre sur une lumière violette. Greg n'hésite pas : il saute."
  ], () => ch2Leap());
}

// Saut dans la lumière : flash blanc, puis arrivée dans le Monde Vert
function ch2Leap(){
  state = 'cut';
  cutEl.flash.style.transition = 'opacity 0.9s ease-in';
  cutEl.flash.style.opacity = 1;
  setTimeout(() => {
    CH2.room = false;
    camera.fov = 70; camera.updateProjectionMatrix();
    setZone('world2');
    cutEl.flash.style.transition = 'opacity 1.6s ease-out';
    cutEl.flash.style.opacity = 0;
    $('hud').classList.remove('hidden');
    state = 'play';
    quest.stage = 9; SND.quest();
    toast('Chapitre 2 : le Monde Vert');
    lock();
  }, 950);
}

// E devant le cristal, une fois les 3 fragments trouvés
const _interactP6 = interact;
interact = function(){
  if(state==='play' && zone==='cave' && quest.stage>=8 && !CH2.started && distTo(ROOM.x,ROOM.z)<4){
    startChapter2(); return;
  }
  _interactP6();
};
const _promptP6 = promptText;
promptText = function(){
  if(zone==='cave' && quest.stage>=8 && !CH2.started && distTo(ROOM.x,ROOM.z)<4) return 'E : Rentrer chez toi';
  return _promptP6();
};
/* ==========================================================
   PATCH 7 v2 : fin du chapitre 1 -> jeu de voiture
   - Le saut dans la lumière (fin du patch 6A) appelle
     window.lancerVoiture() : c'est lui qui remplace le Monde Vert.
   - Le patch 6B (Monde Vert) n'est plus utilisé : il faut le
     SUPPRIMER du fichier (voir LISEZ-MOI.txt).
   - Si lancerVoiture n'existe pas, Greg reste dans la grotte avec
     un message : rien ne casse.
   - Pendant la voiture : la musique de Greg est coupée et seule
     la scène window.VOITURE_SCENE est dessinée.
   À coller TOUT EN BAS du script, après le patch 6A.
   ========================================================== */

window.VOITURE_ON = false;
window.VOITURE_SCENE = null;

// Objectif affiché pendant le trajet (remplace l'ancien objectif du Monde Vert)
MISSION[9] = "Le cristal t'emporte vers un nouveau monde : prends le volant !";

// Le saut dans la lumière : flash blanc, puis le jeu de voiture
ch2Leap = function(){
  if(typeof window.lancerVoiture !== 'function'){
    CH2.room = false;
    camera.fov = 70; camera.updateProjectionMatrix();
    state = 'play';
    toast("Le jeu de voiture n'est pas encore chargé.");
    lock();
    return;
  }
  state = 'cut';
  cutEl.flash.style.transition = 'opacity 0.9s ease-in';
  cutEl.flash.style.opacity = 1;
  setTimeout(() => {
    CH2.room = false;
    quest.stage = 9;
    camera.fov = 70; camera.updateProjectionMatrix();
    $('hud').classList.add('hidden');
    cutEl.flash.style.transition = 'opacity 1.6s ease-out';
    cutEl.flash.style.opacity = 0;
    window.VOITURE_ON = true;
    clearInterval(MUS.timer); MUS.name = null;      // coupe la musique de Greg
    window.lancerVoiture();
  }, 950);
};

// Pendant la voiture, la musique de Greg ne doit plus se relancer
const _musPlayP7 = MUS.play;
MUS.play = function(name){
  if(window.VOITURE_ON) return;
  _musPlayP7.call(MUS, name);
};

// Pendant la voiture, on ne dessine que la scène de la voiture
const _rrP7 = renderer.render.bind(renderer);
renderer.render = function(scene, cam){
  // Les scènes de la voiture (course et garage) ont userData.voiture = true
  const estVoiture = scene === window.VOITURE_SCENE || (scene && scene.userData && scene.userData.voiture);
  if(window.VOITURE_ON && !estVoiture) return;
  return _rrP7(scene, cam);
};
/* =====================================================================
   PATCH 8 : JEU DE VOITURE (remplace patch_7b)
   - Tout le code de la course est enveloppé dans window.lancerVoiture
     pour qu'aucun nom (player, SKY, keys, renderer…) n'entre en conflit
     avec Greg.
   - Il réutilise le renderer et le canvas #gl de Greg.
   - Ses éléments HTML et CSS sont créés au lancement (préfixés car… ).
   À coller TOUT EN BAS, après le patch 7 (et sans le patch 7b).
   ===================================================================== */
window.lancerVoiture = function(){
// --- Éléments HTML et CSS de la course ---
const carCss = document.createElement('style');
carCss.id = 'carCss';
carCss.textContent = `
#carHud{position:fixed;left:16px;top:14px;background:rgba(0,0,0,.5);padding:12px 16px;border-radius:12px;border:2px solid #39ff88;pointer-events:none;min-width:230px;z-index:6}
#speed{font-size:34px;font-weight:bold;color:#ffd23f}
#pos,#time{font-size:18px;margin-top:4px}
#legend{margin-top:10px;font-size:14px;line-height:1.7}
.lb{color:#2fb8ff}
.lr{color:#ff5a5a}
.lg{color:#39ff88}
#help{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.5);padding:6px 14px;border-radius:10px;font-size:15px;pointer-events:none;z-index:6}
#count{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);font-size:110px;font-weight:bold;color:#fff;text-shadow:0 6px 0 #0a1236,0 0 30px #39ff88;pointer-events:none;z-index:6}
#end{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.6);text-align:center;z-index:10}
#end h1{font-size:64px;margin:0;color:#39ff88}
#end p{font-size:22px}
`;
document.head.appendChild(carCss);
const carRoot = document.createElement('div');
carRoot.id = 'carRoot';
carRoot.innerHTML = `
<div id="carHud">
  <div id="speed">0 km/h</div>
  <div id="pos">Position : 1/5</div>
  <div id="time">0:00.00</div>
  <div id="legend">
    <div class="lb">■ Bleu : boost de vitesse</div>
    <div class="lr">■ Rouge : saut</div>
    <div class="lg">■ Vert : grand saut</div>
  </div>
</div>
<div id="count"></div>
<div id="help">Z/W : accélérer · S : freiner · Q/D : tourner · R : recommencer</div>
<div id="end" class="hidden">
  <h1>Arrivée !</h1>
  <p id="endTxt"></p>
  <p>Appuie sur R pour recommencer</p>
</div>`;
document.body.appendChild(carRoot);

// --- Code de la course (inchangé sauf les points ci-dessus) ---
/* =====================================================================
   COURSE DE VOITURE : 3 circuits, pièces à débloquer en course,
   bouton aléatoire, étapes 1 et 2, magasin, garage
   - Pièces (ailerons, jantes, couleurs, stickers, pneus) : débloquées en course
     court = 1 pièce, nuit = 2, long = 3, +1 si 1er, +1 si record
   - Bouton 🎲 Aléatoire dans la personnalisation
   ===================================================================== */

const rnd = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp = (a,b,t) => a + (b-a)*t;
const smooth = t => { t = clamp(t,0,1); return t*t*(3-2*t); };
const TAU = Math.PI*2;
const DODEC = new THREE.DodecahedronGeometry(1, 0);
const pick = a => a[Math.floor(Math.random()*a.length)];

const SCALE = 0.5, OX = 580, OY = 340;
const HALF = 12;
const SEG = 40;
const TUNNEL_H = 9;

/* ---------- ÉQUILIBRAGE ---------- */
const BAL = {
  accel: 22, brake: 34, roll: 6,
  maxBase: 42, boostMax: 92, boostBonus: 22,
  padJump: 24, gravity: 22, padCount: 22,
  gapSpeed: 52, gapHeight: 20,
  hotSlow: 0.8,
  vineStun: 1.2,
  vineCap: 14
};
// Nombre de pièces débloquées selon le circuit
const PIECES_PER_TRACK = {court:1, nuit:2, long:3};

/* ---------- SAUVEGARDE ---------- */
const SAVE_KEY = 'nexusGameSave';
function loadSave(){
  try{
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if(d) return Object.assign({money:0, owned:[], record:null, rec:{}, sound:'base', cfg:null, track:'long'}, d);
  }catch(e){}
  return {money:0, owned:[], record:null, rec:{}, sound:'base', cfg:null, track:'long'};
}
let S = loadSave();
function saveGame(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
const hasItem = id => S.owned.includes(id);

/* ---------- COULEURS ---------- */
const PAINT_HEX = ['#ffd23f','#ff3b3b','#39ff88','#2fb8ff','#ff5ea8','#ffffff',
                   '#111111','#6b8f4e','#7a4ad9','#ff8c42','#1d2a4a','#c0c6d0'];
const PAINT_EXTRA = ['#ff00ff','#00ffff','#ff6600','#aaff00','#ff1493','#8a2be2'];
const paintPalette = () => hasItem('paint_neon') ? PAINT_HEX.concat(PAINT_EXTRA) : PAINT_HEX;
const RIM_HEX  = ['#dfe7ff','#111111','#ffd23f','#39ff88','#ff3b3b','#2fe0ff'];
const CAL_HEX  = ['#ff3b3b','#ffd23f','#2fb8ff','#111111','#39ff88'];
const HEAD_HEX = ['#fff3b0','#ffffff','#9fe7ff','#ffd23f','#ff5ea8'];
const NEON_HEX = ['#39ff88','#2fb8ff','#ff5ea8','#ff3b3b','#ffd23f','#7a4ad9'];
const NEON_EXTRA = ['#ffffff','#ff8c00','#00ffff','#ff00aa'];
const neonPalette = () => hasItem('neon_pack') ? NEON_HEX.concat(NEON_EXTRA) : NEON_HEX;
const GLASS_HEX = ['#1a2a4a','#000000','#2a2a2a','#4a6a8a','#2d1b4a','#0f3a2a'];
const TRAIL_HEX = ['#000000','#ffffff','#ff3b3b','#2fb8ff'];
const TRAIL_EXTRA = ['#39ff88','#ff5ea8','#ffd23f','#7a4ad9'];
const trailPalette = () => hasItem('trail_pack') ? TRAIL_HEX.concat(TRAIL_EXTRA) : TRAIL_HEX;
const SMOKE_HEX = ['#bbbbcc','#ffffff','#333344'];
const SMOKE_EXTRA = ['#ff8c42','#66ffe0','#ff3b3b','#ffd23f'];
const smokePalette = () => hasItem('smoke_pack') ? SMOKE_HEX.concat(SMOKE_EXTRA) : SMOKE_HEX;

const ENVS = [
  {name:'Garage sombre',    bg:'#0b0d14', floor:'#1a1d26', amb:0.5,  key:0.9, keyHex:'#ffffff'},
  {name:'Studio blanc',     bg:'#eef1f6', floor:'#d9dee8', amb:1.0,  key:1.0, keyHex:'#ffffff'},
  {name:'Parking de nuit',  bg:'#050614', floor:'#101633', amb:0.35, key:0.7, keyHex:'#7f9fff'},
  {name:'Coucher de soleil',bg:'#3b1d3d', floor:'#2a1a2a', amb:0.6,  key:1.2, keyHex:'#ffb36b'}
];
const ENGINE_ACC = [1, 1.1, 1.2, 1.3];

const DEFAULT_CFG = {
  paintHex:'#ffd23f', finish:'gloss', secHex:'#1b1f2e', glassHex:'#1a2a4a',
  rimStyle:0, rimHex:'#dfe7ff', caliperHex:'#ff3b3b', rimSize:1, tire:0, tireWidth:1,
  frontBumper:0, rearBumper:0, skirts:false, fenders:0, hood:0, roof:0, spoiler:1, diffuser:false,
  headStyle:0, headHex:'#fff3b0', neonOn:true, neonHex:'#39ff88',
  stripes:0, stripeHex:'#ffffff', num:'7', numHex:'#ffffff',
  rideHeight:0.1, trackWidth:0.1, exhaust:0,
  engine:0, turbo:false, env:0, decal:'none',
  trailHex:'#000000', smokeHex:'#bbbbcc', antenna:0, antennaHex:'#111111', antennaMat:'acier'
};
const CFG = JSON.parse(JSON.stringify(DEFAULT_CFG));
if(S.cfg) Object.assign(CFG, S.cfg);

/* ---------- OPTIONS (listes filtrées selon ce qui est débloqué) ---------- */
const rimOpts = () => {
  const l = [[0,'Sport'],[1,'Course'],[2,'Luxe'],[3,'Rétro'],[4,'Futuriste']];
  if(hasItem('rim_diamond')) l.push([5,'Diamant']);
  return l;
};
const tireOpts = () => {
  const l = [[0,'Normal'],[1,'Sport'],[2,'Tout-terrain'],[3,'Drift']];
  if(hasItem('tire_slick')) l.push([4,'Slick']);
  if(hasItem('tire_neon')) l.push([5,'Néon']);
  return l;
};
const spoilerOpts = () => {
  const l = [[0,'Aucun'],[1,'Petit becquet'],[2,'Aileron sport'],[3,'Aileron géant']];
  if(hasItem('wing_gt')) l.push([4,'Aileron GT']);
  return l;
};
const hoodOpts = () => {
  const l = [[0,'Standard'],[1,'Ventilé'],[2,'Racing']];
  if(hasItem('hood_scoop')) l.push([3,"Prise d'air"]);
  return l;
};
const headOpts = () => {
  const l = [[0,'Classique'],[1,'Futuriste']];
  if(hasItem('headlight_led')) l.push([2,'LED']);
  return l;
};
const antOpts = () => {
  const l = [[0,'Aucune'],[1,'Antenne']];
  if(hasItem('ant_pack')) l.push([2,'Antenne + drapeau']);
  return l;
};
const ownedDecos = () => SHOP.filter(i => i.kind === 'deco' && hasItem(i.id)).map(i => i.id);

/* ---------- MAGASIN ----------
   reward:true = pièce à débloquer en course (pas achetable)
   ------------------------------------------------------------ */
const SHOP_CATS = [
  {id:'Tous',        icon:'🛍️', label:'Tout voir'},
  {id:'Sons',        icon:'🔊', label:'Sons'},
  {id:'Stickers',    icon:'🖌️', label:'Stickers'},
  {id:'Carrosserie', icon:'🏎️', label:'Carrosserie'},
  {id:'Roues',       icon:'🛞', label:'Roues & pneus'},
  {id:'Accessoires', icon:'📡', label:'Accessoires'},
  {id:'Couleurs',    icon:'🎨', label:'Couleurs'}
];
const SHOP = [
  {id:'snd_retro', kind:'engine', cat:'Sons', name:'Moteur rétro', price:70, emoji:'🛻', bg:'#ffe9c7',
   desc:'Petit moteur vintage, bien rond.',
   fiche:[['Son','Rond, chaud, vintage'],['Effet sur la conduite','Aucun (son uniquement)']]},
  {id:'snd_v8', kind:'engine', cat:'Sons', name:'Moteur V8', price:80, emoji:'🔥', bg:'#ffd6c2',
   desc:'Grondement grave, comme un muscle car.',
   fiche:[['Son','Grave et profond'],['Effet sur la conduite','Aucun (son uniquement)']]},
  {id:'snd_turbo', kind:'engine', cat:'Sons', name:'Turbo sifflant', price:120, emoji:'💨', bg:'#d6f0ff',
   desc:'Sifflement aigu à chaque accélération.',
   fiche:[['Son','Sifflement aigu'],['Effet sur la conduite','Aucun (son uniquement)']]},
  {id:'snd_elec', kind:'engine', cat:'Sons', name:'Moteur électrique', price:150, emoji:'⚡', bg:'#e6fff2',
   desc:'Son futuriste et presque silencieux.',
   fiche:[['Son','Sifflement électrique'],['Effet sur la conduite','Aucun (son uniquement)']]},
  {id:'snd_jet', kind:'engine', cat:'Sons', name:'Réacteur', price:220, emoji:'🚀', bg:'#e8e4ff',
   desc:'Rugissement de réacteur d\'avion.',
   fiche:[['Son','Rugissement de réacteur'],['Effet sur la conduite','Aucun (son uniquement)']]},
  {id:'snd_tires', kind:'tire', cat:'Sons', name:'Crissement des pneus', price:60, emoji:'🔈', bg:'#eeeeee',
   desc:'Un crissement quand la voiture dérape.',
   fiche:[['Son','Crissement en dérapage'],['Effet sur la conduite','Aucun (indication sonore)']]},

  {id:'deco_flames', kind:'deco', cat:'Stickers', name:'Flammes', reward:true, emoji:'🔥', bg:'#ffe0d0',
   desc:'Flammes sur toute la carrosserie.', apply:c=>{c.decal='deco_flames';},
   fiche:[['Matière','Vinyle adhésif'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'deco_checker', kind:'deco', cat:'Stickers', name:'Damier', reward:true, emoji:'🏁', bg:'#eeeeee',
   desc:'Damier de course sur toute la voiture.', apply:c=>{c.decal='deco_checker';},
   fiche:[['Matière','Vinyle adhésif'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'deco_stars', kind:'deco', cat:'Stickers', name:'Étoiles', reward:true, emoji:'⭐', bg:'#fff6c8',
   desc:'Étoiles dorées sur toute la voiture.', apply:c=>{c.decal='deco_stars';},
   fiche:[['Matière','Vinyle adhésif doré'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'deco_lightning', kind:'deco', cat:'Stickers', name:'Éclairs', reward:true, emoji:'⚡', bg:'#d6f8ff',
   desc:'Éclairs néon sur toute la voiture.', apply:c=>{c.decal='deco_lightning';},
   fiche:[['Matière','Vinyle réfléchissant'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'deco_zebra', kind:'deco', cat:'Stickers', name:'Zèbre', reward:true, emoji:'🦓', bg:'#f0f0f0',
   desc:'Rayures de zèbre sur toute la voiture.', apply:c=>{c.decal='deco_zebra';},
   fiche:[['Matière','Vinyle adhésif'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'deco_hearts', kind:'deco', cat:'Stickers', name:'Cœurs', reward:true, emoji:'💖', bg:'#ffd6e6',
   desc:'Cœurs roses sur toute la voiture.', apply:c=>{c.decal='deco_hearts';},
   fiche:[['Matière','Vinyle adhésif'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'deco_camo', kind:'deco', cat:'Stickers', name:'Camouflage', reward:true, emoji:'🪖', bg:'#dfe6cf',
   desc:'Camouflage militaire sur toute la voiture.', apply:c=>{c.decal='deco_camo';},
   fiche:[['Matière','Vinyle mat'],['Effet sur la conduite','Aucun (esthétique)']]},

  {id:'wing_gt', kind:'part', cat:'Carrosserie', name:'Aileron GT', reward:true, emoji:'🪽', bg:'#e4e8f0',
   desc:'Grand aileron de course : il plaque la voiture au sol dans les virages.',
   apply:c=>{c.spoiler=4;}, bonus:{grip:0.10, top:-0.03},
   fiche:[['Matière','Fibre de carbone'],['Poids','+4 kg'],['Adhérence','+10 %'],['Vitesse max','−3 %'],['Aérodynamisme','+12 %']]},
  {id:'hood_scoop', kind:'part', cat:'Carrosserie', name:"Capot à prise d'air", reward:true, emoji:'🌬️', bg:'#e8f4ff',
   desc:"Grosse prise d'air qui refroidit le moteur et augmente un peu la vitesse.",
   apply:c=>{c.hood=3;}, bonus:{top:0.02},
   fiche:[['Matière','Acier peint'],['Poids','+2 kg'],['Refroidissement','Moteur plus froid'],['Vitesse max','+2 %']]},
  {id:'headlight_led', kind:'part', cat:'Carrosserie', name:'Phares LED', reward:true, emoji:'💡', bg:'#fffbe0',
   desc:'Barre lumineuse LED à l\'avant : tu vois mieux dans le brouillard.',
   apply:c=>{c.headStyle=2;}, bonus:{},
   fiche:[['Matière','Plastique et LED'],['Poids','+0,5 kg'],['Visibilité dans le brouillard','+60 %']]},

  {id:'rim_diamond', kind:'part', cat:'Roues', name:'Jantes diamant', reward:true, emoji:'💎', bg:'#e6f3ff',
   desc:'Jantes fines et légères.',
   apply:c=>{c.rimStyle=5;}, bonus:{acc:0.03, grip:-0.01},
   fiche:[['Matière','Alliage forgé'],['Poids','−3 kg'],['Accélération','+3 %'],['Adhérence','−1 %']]},
  {id:'tire_slick', kind:'part', cat:'Roues', name:'Pneus slick', reward:true, emoji:'🏎️', bg:'#e5e5e5',
   desc:'Pneus lisses de compétition : beaucoup d\'adhérence sur route sèche.',
   apply:c=>{c.tire=4;}, bonus:{grip:0.10, top:-0.02},
   fiche:[['Matière','Gomme tendre'],['Poids','−1 kg'],['Adhérence','+10 %'],['Vitesse max','−2 %']]},
  {id:'tire_neon', kind:'part', cat:'Roues', name:'Pneus néon', reward:true, emoji:'🟢', bg:'#e6fff0',
   desc:'Pneus avec un liseré néon vert, purement esthétique.',
   apply:c=>{c.tire=5;}, bonus:{},
   fiche:[['Matière','Gomme avec liseré LED'],['Effet sur la conduite','Aucun (esthétique)']]},

  {id:'ant_carbon', kind:'part', cat:'Accessoires', name:'Antenne carbone', reward:true, emoji:'📡', bg:'#e9e9e9',
   desc:'Antenne légère en fibre de carbone.',
   apply:c=>{c.antennaMat='carbone'; c.antenna=Math.max(c.antenna,1);}, bonus:{acc:0.005},
   fiche:[['Matière','Fibre de carbone'],['Poids','−0,2 kg'],['Accélération','+0,5 %']]},
  {id:'ant_pack', kind:'part', cat:'Accessoires', name:"Drapeau d'antenne", reward:true, emoji:'🚩', bg:'#ffe8e8',
   desc:'Un drapeau au bout de l\'antenne. Petit frein dans l\'air.',
   apply:c=>{c.antenna=2;}, bonus:{top:-0.005},
   fiche:[['Matière','Nylon et tige en acier'],['Aérodynamisme','−1 %'],['Vitesse max','−0,5 %']]},

  {id:'paint_neon', kind:'part', cat:'Couleurs', name:'Couleurs peinture', reward:true, emoji:'🎨', bg:'#fbe6ff',
   desc:'6 couleurs fluo pour la peinture.', preview:c=>{c.paintHex='#ff00ff';},
   fiche:[['Matière','Peinture fluorescente'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'neon_pack', kind:'part', cat:'Couleurs', name:'Couleurs néons', reward:true, emoji:'🌈', bg:'#e6fff0',
   desc:'4 couleurs de plus pour les néons sous la voiture.', preview:c=>{c.neonHex='#ffffff';},
   fiche:[['Matière','Tube néon LED'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'trail_pack', kind:'part', cat:'Couleurs', name:'Couleurs de traînée', reward:true, emoji:'〰️', bg:'#fff0e0',
   desc:'4 couleurs pour les traces laissées par les pneus.', preview:c=>{c.trailHex='#ff5ea8';},
   fiche:[['Matière','Pigment de gomme'],['Effet sur la conduite','Aucun (esthétique)']]},
  {id:'smoke_pack', kind:'part', cat:'Couleurs', name:'Fumée colorée', reward:true, emoji:'💨', bg:'#eaf2ff',
   desc:'4 couleurs pour la fumée d\'échappement.', preview:c=>{c.smokeHex='#66ffe0';},
   fiche:[['Matière','Pigment de fumée'],['Effet sur la conduite','Aucun (esthétique)']]}
];
const itemById = id => SHOP.find(i => i.id === id);
const REWARDS = () => SHOP.filter(i => i.reward);
const ENGINE_SND = {
  base:      {type:'sawtooth', f:v=>70+v*1.5,  vol:0.02,  dur:0.14},
  snd_retro: {type:'triangle', f:v=>60+v*1.2,  vol:0.025, dur:0.16},
  snd_v8:    {type:'sawtooth', f:v=>48+v*1.1,  vol:0.035, dur:0.16},
  snd_turbo: {type:'square',   f:v=>90+v*2.2,  vol:0.012, dur:0.12},
  snd_elec:  {type:'sine',     f:v=>200+v*2.4, vol:0.012, dur:0.14},
  snd_jet:   {type:'sawtooth', f:v=>120+v*3.0, vol:0.015, dur:0.12}
};

const PRESETS = {
  'Sport':        {paintHex:'#ff3b3b', finish:'gloss', secHex:'#111111', rimStyle:0, tire:1, frontBumper:1, rearBumper:1, spoiler:2, skirts:true, hood:1, stripes:1, stripeHex:'#111111', rideHeight:0.05, engine:1},
  'Luxe':         {paintHex:'#1d2a4a', finish:'metal', secHex:'#e6e6e6', rimStyle:2, rimHex:'#ffd23f', tire:0, frontBumper:0, rearBumper:0, spoiler:0, roof:2, headStyle:0, neonHex:'#ffd23f', engine:1, rideHeight:0.15, glassHex:'#000000'},
  'Drift':        {paintHex:'#f2f2f2', finish:'gloss', secHex:'#111111', rimStyle:1, tire:3, tireWidth:1.3, fenders:2, frontBumper:1, rearBumper:1, skirts:true, spoiler:1, diffuser:true, stripes:2, stripeHex:'#ff3b3b', engine:2, turbo:true, exhaust:1, trailHex:'#ff3b3b'},
  'Tout-terrain': {paintHex:'#6b8f4e', finish:'matte', secHex:'#2a2f1a', rimStyle:0, rimHex:'#333333', tire:2, tireWidth:1.2, rimSize:1.12, rideHeight:0.35, trackWidth:0.25, frontBumper:1, rearBumper:1, spoiler:0, exhaust:1, engine:1, antenna:1},
  'Course':       {paintHex:'#ffffff', finish:'gloss', secHex:'#39ff88', rimStyle:1, rimHex:'#dfe7ff', tire:1, frontBumper:2, rearBumper:2, skirts:true, hood:2, roof:2, spoiler:3, diffuser:true, stripes:2, stripeHex:'#39ff88', engine:3, turbo:true, exhaust:2, rideHeight:0},
  'Futuriste':    {paintHex:'#0b0f1f', finish:'chrome', secHex:'#2fe0ff', rimStyle:4, rimHex:'#2fe0ff', tire:0, headStyle:1, headHex:'#9fe7ff', neonOn:true, neonHex:'#ff5ea8', spoiler:2, roof:1, frontBumper:2, skirts:true, engine:2, turbo:true, glassHex:'#2fe0ff', trailHex:'#ff5ea8'}
};

/* ---------- EFFETS DES PIÈCES EN COURSE ---------- */
function playerBonus(cfg){
  const b = {grip:0, acc:0, top:0};
  const add = o => { b.grip += o.grip||0; b.acc += o.acc||0; b.top += o.top||0; };
  if(cfg.spoiler === 4) add(itemById('wing_gt').bonus);
  if(cfg.spoiler === 3){ b.grip += 0.05; b.top -= 0.02; }
  if(cfg.spoiler === 2) b.grip += 0.03;
  if(cfg.rimStyle === 5) add(itemById('rim_diamond').bonus);
  if(cfg.hood === 3) add(itemById('hood_scoop').bonus);
  if(cfg.antenna === 2) add(itemById('ant_pack').bonus);
  if(cfg.antenna && cfg.antennaMat === 'carbone') add(itemById('ant_carbon').bonus);
  if(cfg.tire === 4) add(itemById('tire_slick').bonus);
  if(cfg.tire === 1){ b.grip += 0.06; b.acc += 0.01; }
  if(cfg.tire === 2){ b.grip += 0.03; b.top -= 0.03; }
  if(cfg.tire === 3){ b.grip -= 0.04; }
  return b;
}
let PB = playerBonus(CFG);

function carMults(cfg){
  const acc = ENGINE_ACC[cfg.engine] * (cfg.turbo ? 1.08 : 1);
  const top = (1 + 0.03*cfg.engine) * (cfg.turbo ? 1.12 : 1);
  return {acc, top};
}

/* ---------- LES 3 CIRCUITS ---------- */
const LONG_PX = [
  [580,575,0],[580,490,0],[585,420,0],[585,380,0],[505,388,1],[400,392,1],[330,388,0],
  [250,368,0],[205,310,0],[205,235,1],[260,190,2],[380,172,2],[435,178,1],[510,190,1],
  [550,240,2],[560,320,3],[600,372,5],[655,340,8],[720,285,10],[765,235,12],[820,180,13],
  [900,110,12],[985,88,11],[1065,108,9],[1105,170,8],[1095,265,6],[1040,330,4],[955,352,3],
  [880,300,5],[825,240,8],[765,185,10],[710,150,9],[640,125,8],[600,112,7],[520,85,5],
  [430,48,3],[375,36,2],[300,40,1],[210,62,0],[130,125,0],[80,215,0],[45,300,0],
  [42,370,0],[48,460,0],[110,515,0],[195,540,0],[700,530,0],[800,512,0],[905,490,0]
];
const LONG_BLOCKS = [
  {k:'norm',  n:10, lv:10, ramp:4, wig:1.5, weather:'clear'},
  {k:'tun',   n:4,  lv:-3},
  {k:'world', n:16, lv:-3, w:0, wig:2, weather:'snow'},
  {k:'tun',   n:4,  lv:10},
  {k:'norm',  n:10, lv:10, wig:1.5, weather:'rain'},
  {k:'tun',   n:4,  lv:-3},
  {k:'world', n:16, lv:-3, w:1, wig:2},
  {k:'tun',   n:4,  lv:10},
  {k:'norm',  n:10, lv:10, wig:1.5},
  {k:'tun',   n:4,  lv:-3},
  {k:'world', n:16, lv:-3, w:2, wig:2},
  {k:'tun',   n:4,  lv:10},
  {k:'norm',  n:10, lv:10, wig:1.5, weather:'rain'},
  {k:'tun',   n:4,  lv:-3},
  {k:'world', n:16, lv:-3, w:3, wig:2, weather:'fog'},
  {k:'tun',   n:4,  lv:10},
  {k:'norm',  n:10, lv:10, wig:1.5}
];
const COURT_PX = [
  [580,575,0],[560,470,0],[470,400,1],[380,330,2],[300,300,2],[230,350,1],[240,450,0],
  [340,500,0],[460,470,0],[560,430,0],[640,470,0],[720,560,0],[820,580,0]
];
const COURT_BLOCKS = [
  {k:'norm',  n:8,  lv:10, ramp:4, wig:1.5, weather:'clear'},
  {k:'tun',   n:4,  lv:-3},
  {k:'world', n:12, lv:-3, w:0, wig:2, weather:'snow'},
  {k:'tun',   n:4,  lv:10},
  {k:'norm',  n:8,  lv:10, wig:1.5}
];
const NUIT_PX = [
  [300,560,0],[300,430,1],[380,330,2],[500,290,3],[620,320,4],[700,400,3],
  [690,500,2],[600,560,1],[500,520,0],[520,430,0],[600,380,1]
];
const NUIT_BLOCKS = [
  {k:'norm',  n:8,  lv:10, ramp:4, wig:1.5, night:true, weather:'rain'},
  {k:'tun',   n:4,  lv:-3},
  {k:'world', n:12, lv:-3, w:2, wig:2},
  {k:'tun',   n:4,  lv:10},
  {k:'norm',  n:8,  lv:10, wig:1.5, night:true},
  {k:'tun',   n:4,  lv:-3},
  {k:'world', n:12, lv:-3, w:3, wig:2, weather:'fog'},
  {k:'tun',   n:4,  lv:10},
  {k:'norm',  n:8,  lv:10, wig:1.5, night:true, weather:'rain'}
];
const TRACK_DEFS = {
  long:  {name:'Circuit long',    desc:'Le plus long : 4 mondes, environ 3 minutes. 3 pièces par course.', px:LONG_PX,  blocks:LONG_BLOCKS,  gap:true},
  court: {name:'Circuit court',   desc:'Rapide : 2 mondes, virages serrés. 1 pièce par course.',          px:COURT_PX, blocks:COURT_BLOCKS, gap:false},
  nuit:  {name:'Circuit de nuit', desc:'Ville la nuit, pluie et brouillard. 2 pièces par course.',        px:NUIT_PX,  blocks:NUIT_BLOCKS, gap:false}
};

/* ---------- ÉTAT DU CIRCUIT EN COURS ---------- */
const TRK = new THREE.Group();
let CUR_TRACK = null;
let SX=[], SY=[], SZ=[], SL=[], NS=0, TOTAL=1, B0=0, CTRL=[];
let BLOCKS=[], BLK_D0=[], BLK_D1=[], ZONES=[], HOT=[], PADS=[], GRP=[], NORM_FAR=null;
let RSX=[], RSZ=[], VINES=[], PIECES=[], GATE_MATS=[];
const ANIM = [];

function levelAt(s){
  for(let i=0; i<BLOCKS.length; i++){
    const b = BLOCKS[i];
    if(s < b.s0 || s > b.s1) continue;
    const prev = i > 0 ? BLOCKS[i-1].lv : 0;
    const u = s - b.s0 + 1;
    const t = b.k==='tun' ? u/b.n : Math.min(1, u/(b.ramp||3));
    let h = prev + (b.lv - prev)*smooth(t);
    if(b.wig) h += b.wig*Math.sin(s*0.31);
    return h;
  }
  return 0;
}
const cr = (p0,p1,p2,p3,t) => {
  const t2 = t*t, t3 = t2*t;
  return 0.5*((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
};
function slAt(fi){
  const i = Math.floor(fi), f = fi - i;
  return SL[i] + (SL[Math.min(i+1,NS-1)] - SL[i]) * f;
}
function idxAtD(D){
  let lo = 0, hi = NS-1;
  while(lo < hi){ const m = (lo+hi)>>1; if(SL[m] < D) lo = m+1; else hi = m; }
  return lo;
}
function zoneAt(D){
  for(const z of ZONES) if(D >= z.da && D <= z.db) return {z, u:(D-z.da)/(z.db-z.da)};
  return null;
}
function bumpAt(D){
  const zi = zoneAt(D); if(!zi) return 0;
  if(zi.z.type === 'gap') return BAL.gapHeight * Math.sin(Math.PI*zi.u);
  return 0;
}
const isGapD    = D => { const z = zoneAt(D); return !!z && z.z.type === 'gap'; };
const isTunnelD = D => { const z = zoneAt(D); return !!z && z.z.type === 'tunnel'; };
const hotAt = D => HOT.some(h => D >= h.da && D <= h.db);
function blockAtD(D){
  if(D < BLK_D0[0]) return -1;
  for(let i=0; i<BLOCKS.length; i++) if(D < BLK_D1[i]) return i;
  return BLOCKS.length-1;
}
function envOfD(D){
  const b = blockAtD(D);
  return b < 0 ? BLOCKS[0].env : BLOCKS[b].env;
}
function trackAt(D){
  if(D <= 0){
    let tx = SX[1]-SX[0], tz = SZ[1]-SZ[0]; const l = Math.hypot(tx,tz)||1; tx/=l; tz/=l;
    return {x:SX[0]+tx*D, y:SY[0], z:SZ[0]+tz*D, tx, tz};
  }
  if(D >= TOTAL) D = TOTAL;
  let lo = 0, hi = NS-1;
  while(hi-lo > 1){ const m = (lo+hi)>>1; if(SL[m] <= D) lo = m; else hi = m; }
  const f = (D-SL[lo]) / ((SL[hi]-SL[lo]) || 1);
  const dx = SX[hi]-SX[lo], dz = SZ[hi]-SZ[lo], l = Math.hypot(dx,dz) || 1;
  return {
    x: SX[lo] + dx*f,
    y: SY[lo] + (SY[hi]-SY[lo])*f + bumpAt(D),
    z: SZ[lo] + dz*f,
    tx: dx/l, tz: dz/l
  };
}
function frameAt(i){
  const a = Math.max(0,i-1), b = Math.min(NS-1,i+1);
  let tx = SX[b]-SX[a], tz = SZ[b]-SZ[a]; const l = Math.hypot(tx,tz)||1;
  return {tx:tx/l, tz:tz/l};
}
function edgePt(i, off, yo){
  const f = frameAt(i);
  return [SX[i] + (-f.tz)*off, SY[i] + bumpAt(SL[i]) + yo, SZ[i] + f.tx*off];
}
function roadDist(x,z){
  let best = 1e18;
  for(let k=0; k<RSX.length; k++){
    const dx = RSX[k]-x, dz = RSZ[k]-z, d = dx*dx+dz*dz;
    if(d < best) best = d;
  }
  return Math.sqrt(best);
}
const GRIP = {clear:1, rain:0.6, snow:0.35, fog:1};
const WEATHER_LABEL = {clear:'', rain:' · 🌧 Pluie', snow:' · ❄ Neige', fog:' · 🌫 Brouillard'};
function weatherAt(D){
  const b = blockAtD(D);
  return b < 0 ? 'clear' : (BLOCKS[b].weather || 'clear');
}
function gripAt(D){ return GRIP[weatherAt(D)]; }

/* ---------- RENDU ---------- */
// Le renderer de Greg est réutilisé (même canvas #gl)
document.getElementById('gl').style.filter = 'none';
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.userData.voiture = true;
scene.background = new THREE.Color(0x06081a);
scene.fog = new THREE.Fog(0x06081a, 300, 1100);
scene.add(TRK);
const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 3000);
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x101828, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left:-70, right:70, top:70, bottom:-70, near:1, far:400});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

/* ---------- ENVIRONNEMENTS ---------- */
const ENV = [
  {road:0x3a3f52, rail:0xdfe7ff, neon:0x39ff88, base:-1.5, bg:0x06081a, fog:0x06081a, fn:300, ff:1100,
   hs:0x9fd8ff, hg:0x101828, hi:0.8, sc:0xfff4e0, si:1.0, skyTop:'#05071a', skyHor:'#1c2a5a'},
  {road:0x2a2f40, rail:0x20263a, neon:0x9fe7ff, base:-9, bg:0x05060c, fog:0x05060c, fn:120, ff:420,
   hs:0x445577, hg:0x111118, hi:0.6, sc:0x88aaff, si:0.3},
  {road:0xb8e8ff, rail:0xeaf7ff, neon:0x7fe0ff, base:-9, bg:0xbfeaff, fog:0xbfeaff, fn:260, ff:900,
   hs:0xe6f8ff, hg:0x5a7fa0, hi:1.0, sc:0xfffaf0, si:1.1, skyTop:'#4fa8d8', skyHor:'#e8fbff'},
  {road:0x2a1010, rail:0x3a1a10, neon:0xff7a2a, base:-9, bg:0x2a0800, fog:0x3a0c00, fn:240, ff:900,
   hs:0xff9050, hg:0x301000, hi:0.8, sc:0xff7a30, si:1.1, skyTop:'#1a0300', skyHor:'#a02a00'},
  {road:0x203a40, rail:0x0f3a3a, neon:0x39ffd0, base:-9, bg:0x041a1a, fog:0x06302e, fn:220, ff:850,
   hs:0x7fffe0, hg:0x0a2a20, hi:0.8, sc:0x9fffe8, si:0.7, skyTop:'#020f14', skyHor:'#0f4a46'},
  {road:0x6a5a40, rail:0xf0e0b0, neon:0xffd27a, base:-9, bg:0xf0c886, fog:0xf0c886, fn:200, ff:820,
   hs:0xfff0c0, hg:0x8a6a30, hi:1.0, sc:0xffe0a0, si:1.3, skyTop:'#2a4a8a', skyHor:'#ffd27a'},
  {road:0x14162a, rail:0x222a44, neon:0xff3ea5, base:-9, bg:0x03030c, fog:0x03030c, fn:150, ff:520,
   hs:0x2a3a66, hg:0x05050a, hi:0.5, sc:0x9fb4ff, si:0.4, skyTop:'#02020a', skyHor:'#1a1040'}
];
const WORLD_NAMES = {0:'Monde habituel', 1:'Tunnel', 2:'Monde de glace', 3:'Monde de lave', 4:'Jungle lumineuse', 5:'Désert doré', 6:'Ville de nuit'};
let ENV_CUR = -2;

function skyTex(top, horizon){
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0, top); gr.addColorStop(0.55, horizon); gr.addColorStop(1, horizon);
  g.fillStyle = gr; g.fillRect(0,0,4,256);
  return new THREE.CanvasTexture(c);
}
const SKY = {};
function makeSky(e){
  const E = ENV[e];
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16),
    new THREE.MeshBasicMaterial({map:skyTex(E.skyTop, E.skyHor), side:THREE.BackSide, fog:false, depthWrite:false}));
  m.renderOrder = -2; m.visible = false;
  scene.add(m); SKY[e] = m; return m;
}
[0,2,3,4,5,6].forEach(makeSky);
SKY[5].add((() => { const s = new THREE.Mesh(new THREE.SphereGeometry(90,16,12),
  new THREE.MeshBasicMaterial({color:0xfff0b0, fog:false})); s.position.set(0,260,-1000); return s; })());
SKY[3].add((() => { const s = new THREE.Mesh(new THREE.SphereGeometry(120,16,12),
  new THREE.MeshBasicMaterial({color:0xff7a2a, fog:false})); s.position.set(-600,300,-900); return s; })());
SKY[6].add((() => { const s = new THREE.Mesh(new THREE.SphereGeometry(70,16,12),
  new THREE.MeshBasicMaterial({color:0xeef4ff, fog:false})); s.position.set(400,320,-900); return s; })());

function applyEnvIdx(e){
  const E = ENV[e];
  scene.background = new THREE.Color(E.bg);
  scene.fog.color.set(E.fog); scene.fog.near = E.fn; scene.fog.far = E.ff;
  hemi.color.set(E.hs); hemi.groundColor.set(E.hg); hemi.intensity = E.hi;
  sun.color.set(E.sc); sun.intensity = E.si;
  for(const k in SKY) SKY[k].visible = (+k === e);
  if(NORM_FAR) NORM_FAR.visible = e === 0;
  ENV_CUR = e;
}

const colArr = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function ribbon(getA, getB, colFn, skipFn, mat){
  const pos = [], col = [], idx = [];
  for(let i=0; i<NS; i++){
    const A = getA(i), B = getB(i), c = colFn(i);
    pos.push(...A, ...B); col.push(...c, ...c);
  }
  for(let i=0; i<NS-1; i++){
    if(skipFn(i)) continue;
    const a = 2*i, b = a+1, c = a+2, d = a+3;
    idx.push(a,b,c, b,d,c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); TRK.add(m); return m;
}

/* ---------- ROUTE, BARRIÈRES, TUNNELS ---------- */
function buildRoadMesh(){
  const skipGap = i => isGapD(SL[i]);
  const noTun   = i => isGapD(SL[i]) || isTunnelD(SL[i]);
  const roadCol = i => {
    const z = zoneAt(SL[i]), t = z ? z.z.type : null;
    if(t === 'boost') return colArr(0x2fb8ff);
    if(t === 'tunnel') return colArr(0x2a2f40);
    if(hotAt(SL[i])) return colArr(0xff4a1a);
    return colArr(ENV[envOfD(SL[i])].road);
  };
  const roadMat = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide});
  const road = ribbon(i=>edgePt(i,HALF,0), i=>edgePt(i,-HALF,0), roadCol, skipGap, roadMat);
  road.receiveShadow = true;

  const barMat = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide});
  const barCol = i => colArr(ENV[envOfD(SL[i])].rail);
  ribbon(i=>edgePt(i,HALF,0),  i=>edgePt(i,HALF,2.6),  barCol, noTun, barMat);
  ribbon(i=>edgePt(i,-HALF,0), i=>edgePt(i,-HALF,2.6), barCol, noTun, barMat);

  const neonMat = new THREE.MeshBasicMaterial({vertexColors:true});
  const neonCol = i => colArr(ENV[envOfD(SL[i])].neon);
  ribbon(i=>edgePt(i,HALF,2.7),  i=>edgePt(i,HALF-0.5,2.7),  neonCol, noTun, neonMat);
  ribbon(i=>edgePt(i,-HALF,2.7), i=>edgePt(i,-HALF+0.5,2.7), neonCol, noTun, neonMat);

  const tunSkip = i => !isTunnelD(SL[i]);
  const tunMat = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide});
  const tunCol = () => colArr(0x20263a);
  const wL = ribbon(i=>edgePt(i,HALF+1,0),  i=>edgePt(i,HALF+1,TUNNEL_H),  tunCol, tunSkip, tunMat);
  const wR = ribbon(i=>edgePt(i,-HALF-1,0), i=>edgePt(i,-HALF-1,TUNNEL_H), tunCol, tunSkip, tunMat);
  const roof = ribbon(i=>edgePt(i,-HALF-1,TUNNEL_H), i=>edgePt(i,HALF+1,TUNNEL_H), tunCol, tunSkip, tunMat);
  wL.receiveShadow = wR.receiveShadow = true;
  roof.castShadow = roof.receiveShadow = true;
  ribbon(i=>edgePt(i,-0.7,TUNNEL_H-0.1), i=>edgePt(i,0.7,TUNNEL_H-0.1),
         ()=>colArr(0x9fe7ff), tunSkip, new THREE.MeshBasicMaterial({vertexColors:true}));
}

function buildTunnelLightsMesh(){
  const lm = new THREE.MeshBasicMaterial({color:0xcff8ff});
  const g = new THREE.BoxGeometry(1.4, 0.15, 3);
  for(let i=0; i<NS; i+=10){
    if(!isTunnelD(SL[i])) continue;
    const [px,py,pz] = edgePt(i, 0, TUNNEL_H-0.2);
    const f = frameAt(i);
    const m = new THREE.Mesh(g, lm);
    m.position.set(px, py, pz); m.rotation.y = Math.atan2(-f.tx, -f.tz);
    TRK.add(m);
  }
}

function buildGate(D, colHex){
  const i = idxAtD(D);
  const mat = new THREE.MeshBasicMaterial({color:colHex, transparent:true, opacity:0.9});
  GATE_MATS.push(mat);
  for(const s of [-1,1]){
    const [px,py,pz] = edgePt(i, s*(HALF+1.5), 0);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 12, 0.8), mat);
    p.position.set(px, py+6, pz); TRK.add(p);
  }
  const [cx,cy,cz] = edgePt(i, 0, 12);
  const f = frameAt(i);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2*HALF+4, 0.8, 0.8), mat);
  bar.position.set(cx, cy, cz); bar.rotation.y = Math.atan2(-f.tx, -f.tz);
  TRK.add(bar);
}
function buildGatesMesh(){
  BLOCKS.forEach((b,i) => {
    if(b.k !== 'tun') return;
    buildGate(BLK_D0[i], 0xff5ea8);
    buildGate(BLK_D1[i], 0x7dfbd0);
  });
}

function buildLinesMesh(){
  const p0 = trackAt(0);
  const start = new THREE.Mesh(new THREE.BoxGeometry(2*HALF, 0.1, 1.2), new THREE.MeshBasicMaterial({color:0xffffff}));
  start.position.set(p0.x, p0.y+0.08, p0.z);
  start.rotation.y = Math.atan2(-p0.tx, -p0.tz);
  TRK.add(start);

  const pf = trackAt(TOTAL);
  const ang = Math.atan2(-pf.tx, -pf.tz);
  const neon = new THREE.MeshBasicMaterial({color:0xffe14d});
  for(const s of [-1,1]){
    const px = pf.x + (-pf.tz)*s*(HALF+1), pz = pf.z + pf.tx*s*(HALF+1);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5,7,0.5), neon);
    pole.position.set(px, pf.y+3.5, pz); TRK.add(pole);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2*(HALF+1)+0.5, 0.6, 0.5), neon);
  bar.position.set(pf.x, pf.y+7, pf.z); bar.rotation.y = ang; TRK.add(bar);
}

/* ---------- SOLS AVEC RELIEF ET TEXTURES ---------- */
function relief(e,x,z){
  if(e === 0) return 1.5*Math.sin(x*0.05) + 1.2*Math.cos(z*0.06) + 0.6*Math.sin((x+z)*0.11);
  if(e === 2) return 6*Math.sin(x*0.03)*Math.cos(z*0.035) + 2.5*Math.sin(x*0.11+z*0.09);
  if(e === 3) return 4*Math.sin(x*0.05)*Math.cos(z*0.05) + 9*Math.pow(Math.max(0, Math.sin(x*0.02+z*0.03)), 3);
  if(e === 4) return 7*(0.5*Math.sin(x*0.025) + 0.5*Math.cos(z*0.03)) + 2*Math.sin(x*0.12+z*0.1);
  if(e === 6) return 1.2*Math.sin(x*0.04) + 0.8*Math.cos(z*0.05);
  return 6*Math.sin(x*0.015 + Math.sin(z*0.02)*2) + 2*Math.sin(z*0.08);
}

function envTex(e){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const walk = (col, lw, n, len) => {
    g.strokeStyle = col; g.lineWidth = lw;
    for(let i=0; i<n; i++){
      let x = rnd(0,256), y = rnd(0,256); g.beginPath(); g.moveTo(x,y);
      for(let k=0; k<len; k++){ x += rnd(-14,14); y += rnd(-14,14); g.lineTo(x,y); }
      g.stroke();
    }
  };
  if(e === 0){
    g.fillStyle = '#070c26'; g.fillRect(0,0,256,256);
    g.strokeStyle = 'rgba(45,255,138,0.55)'; g.lineWidth = 3;
    for(let i=0; i<=256; i+=64){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,256); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(256,i); g.stroke(); }
  } else if(e === 2){
    g.fillStyle = '#cfefff'; g.fillRect(0,0,256,256);
    walk('rgba(90,150,200,0.7)', 1.5, 22, 6);
    for(let i=0; i<60; i++){ g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(rnd(0,256), rnd(0,256), 2, 2); }
  } else if(e === 3){
    g.fillStyle = '#1a0606'; g.fillRect(0,0,256,256);
    walk('rgba(255,110,30,0.95)', 3, 9, 7);
    walk('rgba(255,170,60,0.5)', 1, 25, 4);
  } else if(e === 4){
    g.fillStyle = '#052a2c'; g.fillRect(0,0,256,256);
    for(let i=0; i<40; i++){ g.fillStyle = 'rgba(3,26,28,0.8)'; g.beginPath(); g.arc(rnd(0,256), rnd(0,256), rnd(10,30), 0, TAU); g.fill(); }
    for(let i=0; i<70; i++){ g.fillStyle = 'rgba(57,255,208,0.9)'; g.beginPath(); g.arc(rnd(0,256), rnd(0,256), rnd(1,3), 0, TAU); g.fill(); }
  } else if(e === 6){
    g.fillStyle = '#0a0c1e'; g.fillRect(0,0,256,256);
    g.strokeStyle = 'rgba(255,62,165,0.6)'; g.lineWidth = 3;
    for(let i=0; i<=256; i+=64){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,256); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(256,i); g.stroke(); }
    for(let i=0; i<30; i++){ g.fillStyle = 'rgba(62,232,255,0.7)'; g.fillRect(rnd(0,256), rnd(0,256), 3, 3); }
  } else {
    g.fillStyle = '#d8b270'; g.fillRect(0,0,256,256);
    g.strokeStyle = 'rgba(170,120,60,0.45)'; g.lineWidth = 2;
    for(let y=0; y<256; y+=14){
      g.beginPath(); g.moveTo(0,y);
      for(let x=0; x<=256; x+=16) g.lineTo(x, y + Math.sin(x*0.05 + y)*3);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const GMAT = {};
[0,2,3,4,5,6].forEach(e => {
  GMAT[e] = new THREE.MeshLambertMaterial({map:envTex(e), vertexColors:true});
});

function buildBlockGround(i0, i1, e, grp){
  i0 = clamp(i0, 0, NS-1); i1 = clamp(i1, 0, NS-1);
  let x0=1e9, x1=-1e9, z0=1e9, z1=-1e9;
  for(let i=i0; i<=i1; i++){
    x0 = Math.min(x0, SX[i]); x1 = Math.max(x1, SX[i]);
    z0 = Math.min(z0, SZ[i]); z1 = Math.max(z1, SZ[i]);
  }
  const M = 130; x0 -= M; x1 += M; z0 -= M; z1 += M;
  const C = 50, pos = [], col = [], uv = [], idx = [];
  const base = ENV[e].base;
  for(let iz=0; iz<=C; iz++) for(let ix=0; ix<=C; ix++){
    const x = x0 + (x1-x0)*ix/C, z = z0 + (z1-z0)*iz/C;
    const blend = smooth((roadDist(x,z) - 12)/28);
    const h = base + relief(e,x,z)*blend;
    pos.push(x, h, z);
    const sh = 0.7 + 0.3*clamp((h-base)/10, 0, 1);
    col.push(sh, sh, sh);
    uv.push(x/14, z/14);
  }
  for(let iz=0; iz<C; iz++) for(let ix=0; ix<C; ix++){
    const a = iz*(C+1)+ix, b = a+1, c = a+(C+1), d = c+1;
    idx.push(a,c,b, b,c,d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, GMAT[e]);
  m.receiveShadow = true;
  grp.add(m);
}

/* ---------- DÉCOR PAR MONDE (avec animations) ---------- */
function decorFor(e, grp, i0, i1){
  const add = (geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x,y,z); o.castShadow = true;
    grp.add(o); return o;
  };
  const step = (st, fn) => {
    for(let i=i0; i<i1 && i<NS; i+=st){ if(isTunnelD(SL[i])) continue; fn(i); }
  };
  const side = (i, d) => edgePt(i, (Math.random()<0.5?-1:1)*(HALF+d), 0);

  if(e === 0){
    const postM = new THREE.MeshLambertMaterial({color:0x2a2f45});
    const lampM = new THREE.MeshBasicMaterial({color:0x39ff88});
    const pyM = new THREE.MeshLambertMaterial({color:0x222a40});
    const pyLM = new THREE.MeshBasicMaterial({color:0x2fe0ff});
    const crM = new THREE.MeshLambertMaterial({color:0x66ffe0, emissive:0x1aff99});
    const trunkM = new THREE.MeshLambertMaterial({color:0x1b2a3a});
    step(30, i => {
      for(const s of [-1,1]){
        const [x,y,z] = edgePt(i, s*(HALF+1.2), 0);
        add(new THREE.CylinderGeometry(0.18,0.22,5,6), postM, x, y+2.5, z);
        add(new THREE.SphereGeometry(0.55,8,6), lampM, x, y+5.2, z);
      }
    });
    step(60, i => {
      const [x,y,z] = edgePt(i, -(HALF+8), 0);
      add(new THREE.CylinderGeometry(0.4,0.5,14,8), pyM, x, y+7, z);
      add(new THREE.BoxGeometry(1.2,0.4,1.2), pyLM, x, y+14.2, z);
    });
    step(45, i => {
      if(Math.random() < 0.5) return;
      const [x,y,z] = side(i, rnd(5,14));
      const sc = rnd(2,4.5);
      add(new THREE.CylinderGeometry(0.3,0.4,5.5,6), trunkM, x, y+2.75, z);
      const cm = add(new THREE.OctahedronGeometry(1,0), crM, x, y+5.5+sc*0.6, z);
      cm.scale.set(sc*0.7, sc*1.6, sc*0.7);
    });
  }
  else if(e === 2){
    const iceM = new THREE.MeshLambertMaterial({color:0xbfeeff, emissive:0x2a6a9a});
    const whiteM = new THREE.MeshLambertMaterial({color:0xf2fbff});
    const paleM = new THREE.MeshLambertMaterial({color:0xa8dcf0});
    const shardM = new THREE.MeshLambertMaterial({color:0x9fe7ff, emissive:0x1a5a7a, transparent:true, opacity:0.85});
    step(22, i => {
      const [x,y,z] = side(i, rnd(6,14)); const h = rnd(10,22);
      add(new THREE.ConeGeometry(rnd(1.5,2.6), h, 6), iceM, x, y+h/2, z);
    });
    step(40, i => {
      const [x,y,z] = side(i, rnd(8,16));
      add(new THREE.CylinderGeometry(0.3,0.4,6,6), whiteM, x, y+3, z);
      add(new THREE.ConeGeometry(2.4,6,7), paleM, x, y+7.5, z);
    });
    step(35, i => {
      const [x,y,z] = edgePt(i, rnd(-40,40), rnd(18,34));
      const m = add(DODEC, shardM, x, y, z);
      m.scale.setScalar(rnd(2,5)); m.rotation.set(rnd(0,3), rnd(0,3), 0);
    });
  }
  else if(e === 3){
    const darkM = new THREE.MeshLambertMaterial({color:0x2a1410});
    const orangeM = new THREE.MeshLambertMaterial({color:0xff6a1a, emissive:0xff4400});
    const jetM = new THREE.MeshBasicMaterial({color:0xffb040, transparent:true, opacity:0.85});
    step(60, i => {
      const [x,y,z] = side(i, rnd(20,40));
      add(new THREE.ConeGeometry(14,18,8), darkM, x, y+9, z);
      add(new THREE.CylinderGeometry(3,3,1.2,8), orangeM, x, y+18.5, z);
    });
    step(30, i => {
      const [x,y,z] = side(i, rnd(5,9)); const h = rnd(6,12);
      add(new THREE.CylinderGeometry(0.8,1.2,h,8), orangeM, x, y+h/2, z);
    });
    step(25, i => {
      const [x,y,z] = side(i, rnd(8,18));
      const r = add(DODEC, darkM, x, y+1, z); r.scale.setScalar(rnd(2,4));
    });
    step(55, i => {
      const [x,y,z] = side(i, rnd(7,14));
      add(new THREE.CylinderGeometry(1.4,1.8,0.6,10), darkM, x, y+0.3, z);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.9,1,10), jetM);
      jet.position.set(x, y+0.6, z); grp.add(jet);
      const ph = rnd(0, 6);
      ANIM.push(t => {
        const h = Math.pow(Math.max(0, Math.sin(t*1.1 + ph)), 3) * 16 + 0.05;
        jet.scale.y = h; jet.position.y = y + 0.6 + h/2;
      });
    });
  }
  else if(e === 4){
    const creamM = new THREE.MeshLambertMaterial({color:0xe8e0c8});
    const pinkM = new THREE.MeshLambertMaterial({color:0xff3ba0, emissive:0x501030});
    step(25, i => {
      const [x,y,z] = side(i, rnd(6,13)); const h = rnd(8,13);
      add(new THREE.CylinderGeometry(0.9,1.3,h,8), creamM, x, y+h/2, z);
      const cap = add(new THREE.SphereGeometry(rnd(3,4.5),12,8), pinkM, x, y+h, z);
      cap.scale.y = 0.45;
    });
    const N = 70, pos = new Float32Array(N*3), base = [];
    for(let k=0; k<N; k++){
      const i = Math.floor(rnd(i0, Math.min(i1, NS-1)));
      const [x,y,z] = edgePt(i, rnd(-30,30), rnd(2,9));
      base.push({x,y,z, ph:rnd(0,6), sp:rnd(0.5,1.2)});
      pos[k*3]=x; pos[k*3+1]=y; pos[k*3+2]=z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({color:0xc8ff7a, size:0.6, transparent:true, opacity:0.9, depthWrite:false}));
    grp.add(pts);
    ANIM.push(t => {
      for(let k=0; k<N; k++){
        const b = base[k];
        pos[k*3]   = b.x + Math.sin(t*b.sp + b.ph)*2.5;
        pos[k*3+1] = b.y + Math.sin(t*1.3 + b.ph*2)*1.2;
        pos[k*3+2] = b.z + Math.cos(t*b.sp + b.ph)*2.5;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }
  else if(e === 5){
    const sandM = new THREE.MeshLambertMaterial({color:0xe0c080});
    const duneM = new THREE.MeshLambertMaterial({color:0xf0d49a});
    const cactusM = new THREE.MeshLambertMaterial({color:0x4a8a3a});
    const goldM = new THREE.MeshLambertMaterial({color:0xf0d070, emissive:0x553300});
    step(60, i => {
      const [x,y,z] = side(i, rnd(18,36));
      const p = add(new THREE.ConeGeometry(16,20,4), sandM, x, y+10, z);
      p.rotation.y = Math.PI/4;
    });
    step(25, i => {
      const [x,y,z] = side(i, rnd(6,12)); const h = rnd(4,7);
      add(new THREE.CylinderGeometry(0.5,0.6,h,8), cactusM, x, y+h/2, z);
      add(new THREE.BoxGeometry(1.0,0.4,0.4), cactusM, x+0.6, y+h*0.6, z);
    });
    step(50, i => {
      const [x,y,z] = side(i, rnd(8,14));
      add(new THREE.BoxGeometry(1.5,14,1.5), goldM, x, y+7, z);
    });
    step(40, i => {
      const [x,y,z] = side(i, rnd(14,28));
      const dune = add(new THREE.SphereGeometry(1,12,8), duneM, x, y, z);
      dune.scale.set(rnd(7,12), rnd(2,4), rnd(5,8));
      const ph = rnd(0,6), x0 = x, z0 = z, dir = Math.random()<0.5 ? 1 : -1;
      ANIM.push(t => {
        dune.position.x = x0 + Math.sin(t*0.25 + ph)*4*dir;
        dune.position.z = z0 + Math.cos(t*0.2 + ph)*2;
        dune.scale.y = 2.5 + Math.sin(t*0.4 + ph)*0.4;
      });
    });
  }
  else {
    const bM = new THREE.MeshLambertMaterial({color:0x14162e});
    const winM = new THREE.MeshBasicMaterial({color:0xffe6a0});
    const neonA = new THREE.MeshBasicMaterial({color:0xff3ea5});
    const neonB = new THREE.MeshBasicMaterial({color:0x3ee8ff});
    const poleM = new THREE.MeshLambertMaterial({color:0x2a2f45});
    step(40, i => {
      const [x,y,z] = side(i, rnd(10,22));
      const h = rnd(18,40), w = rnd(5,9);
      add(new THREE.BoxGeometry(w,h,w), bM, x, y+h/2, z);
      for(let k=0; k<5; k++) add(new THREE.BoxGeometry(0.4,0.3,0.1), winM, x + rnd(-w/2+0.5,w/2-0.5), y + rnd(2,h-2), z + w/2 + 0.05);
    });
    step(30, i => {
      const [x,y,z] = side(i, rnd(6,12));
      add(new THREE.BoxGeometry(0.5,6,0.5), poleM, x, y+3, z);
      add(new THREE.SphereGeometry(0.6,8,6), neonB, x, y+6.2, z);
    });
    step(60, i => {
      const [x,y,z] = side(i, rnd(8,14));
      add(new THREE.BoxGeometry(4,1,0.3), Math.random()<0.5 ? neonA : neonB, x, y+5+rnd(0,6), z);
    });
  }
}

function buildNormalFar(){
  NORM_FAR = new THREE.Group(); TRK.add(NORM_FAR);
  const mtM = new THREE.MeshLambertMaterial({color:0x1d1640, emissive:0x0a0820});
  for(let k=0; k<16; k++){
    const a = k/16*TAU + rnd(-0.1,0.1), d = rnd(420,520), h = rnd(90,170), r = rnd(60,110);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mtM);
    m.position.set(Math.cos(a)*d, h/2 - 1.5, Math.sin(a)*d);
    NORM_FAR.add(m);
  }
}

function buildGroundAndDecor(){
  buildBlockGround(0, B0*SEG, BLOCKS[0].env, GRP[0]);
  decorFor(BLOCKS[0].env, GRP[0], 0, B0*SEG);
  BLOCKS.forEach((b, i) => {
    if(b.k === 'tun') return;
    buildBlockGround(b.c0*SEG, b.c1*SEG, b.env, GRP[i+1]);
    decorFor(b.env, GRP[i+1], b.c0*SEG, b.c1*SEG);
  });
}

/* ---------- LIANES QUI TOMBENT (jungle) ---------- */
const vineDown = v => ((gameT + v.ph) % 5) < 2.5;
function vineHit(c){
  if(!racing) return false;
  for(const v of VINES){
    if(Math.abs(c.D - v.D) < 2.5 && vineDown(v)) return true;
  }
  return false;
}
function buildVinesMesh(){
  const leafM = new THREE.MeshLambertMaterial({color:0x2e8a3a});
  const ropeM = new THREE.MeshLambertMaterial({color:0x3fa34d});
  BLOCKS.forEach((b, bi) => {
    if(b.k !== 'world' || b.w !== 2) return;
    for(const o of [2,5,8,11,14]){
      const i = Math.min(NS-1, Math.round((b.c0+o)*SEG));
      const grp = GRP[bi+1];
      const f = frameAt(i);
      const bar = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,2*HALF-1,6), ropeM);
      body.rotation.z = Math.PI/2; bar.add(body);
      for(let k=0; k<8; k++){
        const lf = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.1,0.25), leafM);
        lf.position.set(-HALF+1.5 + k*(2*HALF-3)/7, -0.3, rnd(-0.3,0.3)); lf.rotation.y = rnd(0,3);
        bar.add(lf);
      }
      const [px,py,pz] = edgePt(i, 0, 0);
      bar.position.set(px, py, pz);
      bar.rotation.y = Math.atan2(-f.tx, -f.tz);
      const ropes = [-1,1].map(s => {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,1,5), ropeM);
        r.position.set(px + (-f.tz)*s*(HALF-0.5), py, pz + f.tx*s*(HALF-0.5));
        TRK.add(r); return r;
      });
      grp.add(bar);
      const v = {D: SL[i], bar, ropes, cur:11, ph: rnd(0,5), px, py, pz};
      VINES.push(v);
      ANIM.push(() => {
        const down = vineDown(v);
        v.cur = lerp(v.cur, down ? 1.2 : 11, 0.12);
        bar.position.y = py + v.cur;
        ropes.forEach(r => { r.position.y = py + (v.cur + 16)/2; r.scale.y = Math.max(0.01, 16 - v.cur); });
      });
    }
  });
}

/* ---------- GROS BOUTONS ROUGES ---------- */
function buildPadsMesh(){
  const padMat = new THREE.MeshBasicMaterial({color:0xff2a2a});
  const ringMat = new THREE.MeshBasicMaterial({color:0xffe14d});
  for(const pd of PADS){
    const p = trackAt(pd.D);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,0.3,28), padMat));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4,0.2,8,32), ringMat);
    ring.rotation.x = Math.PI/2; ring.position.y = 0.25; g.add(ring);
    g.position.set(p.x + (-p.tz)*pd.d, p.y + 0.15, p.z + p.tx*pd.d);
    TRK.add(g); pd.g = g;
  }
}

/* ---------- PIÈCES À RAMASSER (10 argent) ---------- */
function buildPiecesMesh(){
  const gm = new THREE.MeshLambertMaterial({color:0xffd23f, emissive:0x7a5a00});
  for(let k=0; k<40; k++){
    const D = rnd(TOTAL*0.03, TOTAL*0.97), d = rnd(-(HALF-3), HALF-3);
    const g = new THREE.Group();
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,0.18,16), gm);
    coin.rotation.x = Math.PI/2; g.add(coin);
    TRK.add(g);
    PIECES.push({D, d, g, got:false});
  }
}
function placePieces(){
  for(const p of PIECES){
    const t = trackAt(p.D);
    p.g.position.set(t.x + (-t.tz)*p.d, t.y + 1.3, t.z + t.tx*p.d);
    p.g.visible = true; p.got = false;
  }
}

/* ---------- CONSTRUCTION D'UN CIRCUIT ---------- */
function buildTrack(id){
  const def = TRACK_DEFS[id];
  CUR_TRACK = id;
  while(TRK.children.length) TRK.remove(TRK.children[0]);
  ANIM.length = 0; GATE_MATS.length = 0; VINES.length = 0; PIECES.length = 0;
  PADS.length = 0; HOT.length = 0; ZONES.length = 0;
  BLOCKS = def.blocks.map(b => ({...b}));

  const CTRL_A = def.px.map(([px,py,h]) => ({x:(px-OX)*SCALE, z:(py-OY)*SCALE, h}));
  const jA = CTRL_A[CTRL_A.length-1], jP = CTRL_A[CTRL_A.length-2];
  const B_BASE = Math.atan2(jA.z-jP.z, jA.x-jP.x);
  B0 = CTRL_A.length - 1;

  let acc = 0;
  BLOCKS.forEach(b => {
    b.env = b.k==='norm' ? (b.night ? 6 : 0) : b.k==='tun' ? 1 : 2 + b.w;
    b.s0 = acc + 1; b.s1 = acc + b.n; acc += b.n;
  });
  const TOT_STEPS = acc;

  CTRL = CTRL_A.slice();
  let bx = jA.x, bz = jA.z;
  for(let s=1; s<=TOT_STEPS; s++){
    const ph = B_BASE + 0.35 + 0.5*Math.sin(s*0.09) + 0.25*Math.sin(s*0.031+1.7);
    bx += Math.cos(ph)*36; bz += Math.sin(ph)*36;
    CTRL.push({x:bx, z:bz, h:levelAt(s)});
  }
  BLOCKS.forEach(b => { b.c0 = B0 + b.s0 - 1; b.c1 = B0 + b.s1; });

  SX = []; SY = []; SZ = [];
  for(let i=0; i<CTRL.length-1; i++){
    const a = CTRL[Math.max(0,i-1)], b = CTRL[i], c = CTRL[i+1], d = CTRL[Math.min(CTRL.length-1,i+2)];
    for(let k=0; k<SEG; k++){
      const t = k/SEG;
      SX.push(cr(a.x,b.x,c.x,d.x,t));
      SZ.push(cr(a.z,b.z,c.z,d.z,t));
      SY.push(cr(a.h,b.h,c.h,d.h,t));
    }
  }
  const lastC = CTRL[CTRL.length-1];
  SX.push(lastC.x); SZ.push(lastC.z); SY.push(lastC.h);
  NS = SX.length;
  SL = [0];
  for(let i=1; i<NS; i++) SL.push(SL[i-1] + Math.hypot(SX[i]-SX[i-1], SZ[i]-SZ[i-1]));
  TOTAL = SL[NS-1];

  if(def.gap){
    [{type:'boost', a:0.6,b:1.6},{type:'boost', a:11.6,b:12.6},{type:'boost', a:16.6,b:17.6},
     {type:'boost', a:23.6,b:24.6},{type:'boost', a:35.6,b:36.6},{type:'boost', a:41.6,b:42.6},
     {type:'gap', a:45, b:46}].forEach(z => ZONES.push(z));
  }
  BLOCKS.forEach(b => {
    if(b.k === 'tun') ZONES.push({type:'tunnel', a:b.c0, b:b.c1});
    else {
      const o = b.k==='world' ? 5 : 3, len = b.k==='world' ? 3 : 2;
      ZONES.push({type:'boost', a:b.c0+o, b:b.c0+o+len});
    }
  });
  ZONES.forEach(z => { z.da = slAt(z.a*SEG); z.db = slAt(z.b*SEG); });

  BLOCKS.forEach(b => {
    if(b.k === 'world' && b.w === 1){
      for(const o of [1,4,7,10,13]) HOT.push({da: slAt((b.c0+o)*SEG), db: slAt((b.c0+o+1)*SEG)});
    }
  });

  BLK_D0 = BLOCKS.map(b => slAt(b.c0*SEG));
  BLK_D1 = BLOCKS.map(b => slAt(b.c1*SEG));

  for(let k=0; k<BAL.padCount; k++){
    const D = (k+0.5)/BAL.padCount * TOTAL;
    const z = zoneAt(D);
    if(z && (z.z.type === 'tunnel' || z.z.type === 'gap')) continue;
    PADS.push({D, d: rnd(-(HALF-4.5), HALF-4.5), g:null});
  }

  RSX = []; RSZ = [];
  for(let i=0; i<NS; i+=10){ RSX.push(SX[i]); RSZ.push(SZ[i]); }

  GRP = [];
  for(let k=0; k<BLOCKS.length+1; k++){ const g = new THREE.Group(); TRK.add(g); GRP.push(g); }

  buildRoadMesh();
  buildTunnelLightsMesh();
  buildGatesMesh();
  buildLinesMesh();
  buildNormalFar();
  buildGroundAndDecor();
  buildVinesMesh();
  buildPadsMesh();
  buildPiecesMesh();
  placePieces();
  ENV_CUR = -2;
}

/* ---------- VOITURES : construction ---------- */
function makeMat(hex, finish){
  const col = new THREE.Color(hex);
  switch(finish){
    case 'matte':  return new THREE.MeshLambertMaterial({color:col});
    case 'metal':  return new THREE.MeshPhongMaterial({color:col, specular:0x9aa3b5, shininess:70});
    case 'chrome': return new THREE.MeshPhongMaterial({color:col.clone().multiplyScalar(0.6), specular:0xffffff, shininess:220});
    case 'pearl':  return new THREE.MeshPhongMaterial({color:col, specular:0xffd6f0, shininess:120, emissive:col.clone().multiplyScalar(0.06)});
    default:       return new THREE.MeshPhongMaterial({color:col, specular:0x444444, shininess:90});
  }
}
function numTex(text, hex){
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.clearRect(0,0,256,160);
  g.fillStyle = hex; g.font = 'bold 140px Arial Black, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text || '', 128, 84);
  return new THREE.CanvasTexture(c);
}

/* ---------- STICKERS ---------- */
const DECAL_TEX = {};
function starPath(g, x, y, r){
  g.beginPath();
  for(let k=0; k<10; k++){
    const a = k*Math.PI/5 - Math.PI/2, rr = k%2 ? r*0.45 : r;
    g.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr);
  }
  g.closePath();
}
function decalTex(kind){
  if(DECAL_TEX[kind]) return DECAL_TEX[kind];
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'); g.clearRect(0,0,512,256);
  if(kind === 'deco_flames'){
    for(let i=0; i<14; i++){
      const x = i*38 + rnd(-6,6), h = rnd(60,200);
      const gr = g.createLinearGradient(0,256,0,256-h);
      gr.addColorStop(0,'#ff3b00'); gr.addColorStop(0.6,'#ffb300'); gr.addColorStop(1,'rgba(255,255,120,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x,256);
      g.quadraticCurveTo(x+18, 256-h*0.6, x+8, 256-h);
      g.quadraticCurveTo(x+36, 256-h*0.5, x+38, 256); g.fill();
    }
  } else if(kind === 'deco_checker'){
    for(let y=0; y<8; y++) for(let x=0; x<16; x++){
      g.fillStyle = (x+y)%2 ? '#ffffff' : '#111111';
      g.fillRect(x*32, y*32, 32, 32);
    }
  } else if(kind === 'deco_stars'){
    g.fillStyle = '#ffd23f';
    for(let i=0; i<26; i++){ starPath(g, rnd(20,492), rnd(20,236), rnd(8,18)); g.fill(); }
  } else if(kind === 'deco_lightning'){
    g.strokeStyle = '#2fe0ff'; g.lineWidth = 8; g.shadowColor = '#2fe0ff'; g.shadowBlur = 14;
    for(let i=0; i<6; i++){
      let x = rnd(20,500), y = 0; g.beginPath(); g.moveTo(x,y);
      while(y < 256){ y += rnd(18,36); x += rnd(-30,30); g.lineTo(x,y); }
      g.stroke();
    }
    g.shadowBlur = 0;
  } else if(kind === 'deco_zebra'){
    g.fillStyle = '#ffffff';
    for(let x=-512; x<1024; x+=40){
      g.beginPath(); g.moveTo(x,256); g.lineTo(x+20,256); g.lineTo(x+120,0); g.lineTo(x+100,0); g.closePath(); g.fill();
    }
  } else if(kind === 'deco_hearts'){
    g.fillStyle = '#ff3b7a'; g.font = '80px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for(let i=0; i<14; i++) g.fillText('♥', rnd(30,482), rnd(30,226));
  } else if(kind === 'deco_camo'){
    const cols = ['#4a5a3a','#2f3b26','#6b7a4a','#1e2a1a'];
    for(let i=0; i<40; i++){
      g.fillStyle = cols[i%4]; g.globalAlpha = 0.85;
      g.beginPath(); g.ellipse(rnd(0,512), rnd(0,256), rnd(20,60), rnd(12,36), rnd(0,3), 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  DECAL_TEX[kind] = t;
  return t;
}

function addRim(wh, cfg, R, faceX, rimM){
  const g = new THREE.Group(); g.position.x = faceX; wh.add(g);
  const spokes = (n, len, w, t) => {
    for(let i=0; i<n; i++){
      const s = new THREE.Group(); s.rotation.x = i/n*TAU; g.add(s);
      const m = new THREE.Mesh(new THREE.BoxGeometry(t, len, w), rimM);
      m.position.y = len/2; s.add(m);
    }
  };
  const ring = (rad, tube, m) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 32), m);
    t.rotation.y = Math.PI/2; g.add(t);
  };
  switch(cfg.rimStyle){
    case 0: spokes(5, R*0.85, R*0.2, 0.05); break;
    case 1: spokes(3, R*0.9, R*0.28, 0.06); break;
    case 2: ring(R*0.8, 0.05, rimM); spokes(10, R*0.7, R*0.08, 0.03); break;
    case 3: spokes(12, R*0.95, R*0.04, 0.02); break;
    case 5: {
      for(let i=0; i<8; i++){
        const s = new THREE.Group(); s.rotation.x = i/8*TAU; g.add(s);
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, R*0.9, R*0.05), rimM);
        m.position.y = R*0.45; s.add(m);
      }
      ring(R*0.85, 0.025, rimM);
      break;
    }
    default: {
      const nm = new THREE.MeshBasicMaterial({color:cfg.neonHex});
      ring(R*0.8, 0.06, nm); spokes(3, R*0.8, R*0.1, 0.03);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R*0.18, R*0.18, 0.06, 14), rimM);
  hub.rotation.z = Math.PI/2; g.add(hub);
}

// Pneus : 0-3 normaux, 4 slick (lisse), 5 néon (liseré vert)
const TIRE_DEF = [
  {r:0.42, t:0.36, c:0x111111},
  {r:0.42, t:0.30, c:0x1d1d22},
  {r:0.50, t:0.48, c:0x2a2a22},
  {r:0.44, t:0.26, c:0x222226},
  {r:0.42, t:0.34, c:0x161616},
  {r:0.42, t:0.34, c:0x1b1b1b, e:0x0c5a2a}
];

function buildCar(cfg){
  const car = new THREE.Group();
  const W = 1.8 * (1 + 0.08*cfg.fenders), L = 3.4;
  const ride = cfg.rideHeight * 1.2;
  const ch = new THREE.Group(); ch.position.y = ride; car.add(ch);
  const add = (geo, m, x, y, z, parent) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true;
    (parent || ch).add(o); return o;
  };
  const paint = makeMat(cfg.paintHex, cfg.finish);
  const sec   = makeMat(cfg.secHex, cfg.finish === 'chrome' ? 'metal' : cfg.finish);
  const dark  = new THREE.MeshLambertMaterial({color:0x0b1020});
  const glass = new THREE.MeshLambertMaterial({color:cfg.glassHex || '#1a2a4a'});

  add(new THREE.BoxGeometry(W, 0.6, L), paint, 0, 0.7, 0);
  const roofM = cfg.roof === 1
    ? new THREE.MeshPhongMaterial({color:0x9fe7ff, transparent:true, opacity:0.45, specular:0xffffff, shininess:140})
    : cfg.roof === 2
      ? new THREE.MeshPhongMaterial({color:0x151515, specular:0x666666, shininess:60})
      : sec;
  add(new THREE.BoxGeometry(W*0.66, 0.5, 1.5), roofM, 0, 1.25, 0.2);
  add(new THREE.BoxGeometry(W*0.68, 0.42, 1.2), glass, 0, 1.2, 0.2);

  add(new THREE.BoxGeometry(W*0.9, 0.06, 1.1), sec, 0, 1.03, -1.0);
  if(cfg.hood === 1){
    add(new THREE.BoxGeometry(0.12, 0.04, 0.9), dark, -0.25, 1.07, -1.0);
    add(new THREE.BoxGeometry(0.12, 0.04, 0.9), dark,  0.25, 1.07, -1.0);
  } else if(cfg.hood === 2){
    add(new THREE.BoxGeometry(0.5, 0.22, 0.5), dark, 0, 1.15, -0.9);
  } else if(cfg.hood === 3){
    add(new THREE.BoxGeometry(0.9, 0.26, 0.6), dark, 0, 1.16, -0.9);
    add(new THREE.BoxGeometry(0.9, 0.04, 0.5), new THREE.MeshBasicMaterial({color:cfg.neonHex}), 0, 1.3, -0.9);
  }

  if(cfg.stripes > 0){
    const sm = makeMat(cfg.stripeHex, 'matte');
    if(cfg.stripes === 1){
      add(new THREE.BoxGeometry(0.5, 0.02, L-0.3), sm, 0, 1.065, 0);
    } else {
      add(new THREE.BoxGeometry(0.16, 0.02, L-0.3), sm, -0.2, 1.065, 0);
      add(new THREE.BoxGeometry(0.16, 0.02, L-0.3), sm,  0.2, 1.065, 0);
    }
  }

  if(cfg.frontBumper === 1){
    add(new THREE.BoxGeometry(W*0.95, 0.3, 0.25), dark, 0, 0.45, -1.8);
  } else if(cfg.frontBumper === 2){
    add(new THREE.BoxGeometry(W*1.02, 0.32, 0.35), dark, 0, 0.42, -1.85);
    add(new THREE.BoxGeometry(W*1.1, 0.05, 0.5), dark, 0, 0.18, -1.95);
  }
  if(cfg.rearBumper === 1){
    add(new THREE.BoxGeometry(W*0.95, 0.3, 0.25), dark, 0, 0.45, 1.8);
  } else if(cfg.rearBumper === 2){
    add(new THREE.BoxGeometry(W*1.02, 0.32, 0.35), dark, 0, 0.42, 1.85);
    add(new THREE.BoxGeometry(W*0.8, 0.22, 0.5), dark, 0, 0.3, 1.85);
  }
  if(cfg.skirts){
    for(const s of [-1,1]) add(new THREE.BoxGeometry(0.12, 0.22, 2.6), dark, s*(W/2+0.02), 0.32, 0);
  }
  if(cfg.diffuser) add(new THREE.BoxGeometry(W*0.8, 0.22, 0.5), dark, 0, 0.3, 1.85);

  if(cfg.spoiler === 1){
    add(new THREE.BoxGeometry(W*0.8, 0.08, 0.3), sec, 0, 1.08, 1.55);
  } else if(cfg.spoiler === 2){
    add(new THREE.BoxGeometry(W*0.95, 0.1, 0.55), dark, 0, 1.6, 1.6);
    for(const s of [-1,1]) add(new THREE.BoxGeometry(0.08, 0.8, 0.08), dark, s*W*0.3, 1.2, 1.55);
  } else if(cfg.spoiler === 3){
    add(new THREE.BoxGeometry(W*1.1, 0.12, 0.8), dark, 0, 2.0, 1.7);
    for(const s of [-1,1]) add(new THREE.BoxGeometry(0.1, 1.2, 0.1), dark, s*W*0.35, 1.4, 1.6);
  } else if(cfg.spoiler === 4){
    add(new THREE.BoxGeometry(W*1.05, 0.12, 0.7), dark, 0, 2.05, 1.7);
    for(const s of [-1,1]) add(new THREE.BoxGeometry(0.1, 1.0, 0.1), dark, s*W*0.32, 1.5, 1.6);
  }

  const headM = new THREE.MeshBasicMaterial({color:cfg.headHex});
  if(cfg.headStyle === 0){
    for(const s of [-1,1]) add(new THREE.BoxGeometry(0.35, 0.18, 0.1), headM, s*0.55, 0.8, -1.72);
  } else if(cfg.headStyle === 1){
    for(const s of [-1,1]) add(new THREE.BoxGeometry(0.75, 0.08, 0.1), headM, s*0.5, 0.82, -1.72);
  } else {
    for(const s of [-1,1]) add(new THREE.BoxGeometry(0.9, 0.05, 0.12), new THREE.MeshBasicMaterial({color:0xffffff}), s*0.5, 0.9, -1.72);
  }
  const tailM = new THREE.MeshBasicMaterial({color:0xff2a2a});
  for(const s of [-1,1]) add(new THREE.BoxGeometry(0.4, 0.14, 0.08), tailM, s*0.55, 0.85, 1.72);

  if(cfg.antenna){
    const am = new THREE.MeshLambertMaterial({color: cfg.antennaMat === 'carbone' ? 0x1a1a1a : 0xbfc6d0});
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), am);
    rod.position.set(0.45, 1.85, 0.9); ch.add(rod);
    if(cfg.antenna === 2){
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.02),
        new THREE.MeshBasicMaterial({color:cfg.neonHex}));
      flag.position.set(0.66, 2.3, 0.9); ch.add(flag);
    }
  }

  const exM = new THREE.MeshPhongMaterial({color:0x9aa3b5, specular:0xffffff, shininess:120});
  const exR = [0.07, 0.09, 0.11][cfg.exhaust];
  const exX = cfg.exhaust === 2 ? [-0.6,-0.2,0.2,0.6] : [-0.35,0.35];
  for(const x of exX){
    const c = new THREE.Mesh(new THREE.CylinderGeometry(exR, exR, 0.18, 12), exM);
    c.rotation.x = Math.PI/2; c.position.set(x, 0.35, 1.78); ch.add(c);
  }

  if(cfg.num){
    const tex = numTex(cfg.num, cfg.numHex);
    const plane = new THREE.PlaneGeometry(1.0, 0.625);
    for(const s of [-1,1]){
      const pm = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({map:tex, transparent:true}));
      pm.position.set(s*(W/2+0.012), 0.7, 0);
      pm.rotation.y = s*Math.PI/2;
      ch.add(pm);
    }
  }

  if(cfg.decal && cfg.decal !== 'none'){
    const tex = decalTex(cfg.decal);
    const mk = (w, h) => {
      const m = new THREE.MeshBasicMaterial({map:tex, transparent:true, depthWrite:false,
        polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    };
    for(const s of [-1,1]){
      const p = mk(L*0.9, 1.0);
      p.position.set(s*(W/2+0.02), 0.8, 0); p.rotation.y = s*Math.PI/2;
      ch.add(p);
    }
    const top = mk(W*0.95, L*0.9);
    top.rotation.x = -Math.PI/2; top.position.set(0, 1.012, 0);
    ch.add(top);
  }

  if(cfg.neonOn){
    add(new THREE.BoxGeometry(W*0.85, 0.03, L*0.9), new THREE.MeshBasicMaterial({color:cfg.neonHex}), 0, 0.05, 0);
    const nl = new THREE.PointLight(cfg.neonHex, 0.9, 6, 1.6);
    nl.position.set(0, 0.15, 0); ch.add(nl);
  }

  const T = TIRE_DEF[cfg.tire] || TIRE_DEF[0];
  const R = T.r * cfg.rimSize, Tw = T.t * cfg.tireWidth;
  const tX = W/2 + 0.04 + cfg.trackWidth*0.8;
  const tireM = new THREE.MeshLambertMaterial({color:T.c, emissive:T.e || 0x000000});
  const rimM = makeMat(cfg.rimHex, 'metal');
  const calM = makeMat(cfg.caliperHex, 'matte');
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const wh = new THREE.Group();
    wh.position.set(sx*tX, R, sz*1.1);
    car.add(wh);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Tw, 20), tireM);
    tire.rotation.z = Math.PI/2; tire.castShadow = true; wh.add(tire);
    addRim(wh, cfg, R*0.9, sx*(Tw/2+0.01), rimM);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, R*0.4, R*0.3), calM);
    cal.position.set(sx*(Tw/2+0.03), R*0.5, 0); wh.add(cal);
  }
  return car;
}

/* ---------- VOITURES DE LA COURSE ---------- */
function makeCar(cfg, isPlayer, D0, d0, mult){
  const mesh = buildCar(cfg); scene.add(mesh);
  return {mesh, isPlayer, D:D0, d:d0, v:0, laneT:d0, laneTimer:0,
          finished:false, finishT:0, zn:null, x:0, y:0, z:0, tx:0, tz:-1, mult,
          air:false, airH:0, airV:0, padHit:new Set(), slip:0, stun:0};
}
const player = makeCar(CFG, true, 0, 0, null);
const botCfg = (hex, num) => ({...DEFAULT_CFG, paintHex:hex, neonHex:hex, neonOn:false,
                               num:String(num), rimStyle:num % 5, stripes:1, stripeHex:'#111111'});
const bots = [
  makeCar(botCfg('#39ff88', 2), false, -8,  -2.5, {acc:rnd(0.97,1), top:rnd(0.97,1)}),
  makeCar(botCfg('#ff5ea8', 3), false, -16,  2.5, {acc:rnd(0.97,1), top:rnd(0.97,1)}),
  makeCar(botCfg('#7fd4ff', 4), false, -24, -1,   {acc:rnd(0.97,1), top:rnd(0.97,1)}),
  makeCar(botCfg('#ff8c42', 5), false, -32,  1.5, {acc:rnd(0.97,1), top:rnd(0.97,1)})
];
const CARS = [player, ...bots];

/* ---------- COURSE : physique ---------- */
let racing = false, raceT = 0, countT = 3.99, goT = 0, endShown = false;

function updateCar(c, dt, inp){
  const zi = zoneAt(c.D), zt = zi ? zi.z.type : null;
  const base = c.isPlayer ? carMults(CFG) : c.mult;
  const m = c.isPlayer
    ? {acc: base.acc*(1+PB.acc), top: base.top*(1+PB.top)}
    : base;
  const grip = c.isPlayer
    ? clamp(gripAt(c.D)*(1+PB.grip), 0.2, 1.15)
    : gripAt(c.D);
  if(racing && zt === 'boost' && c.zn !== 'boost') c.v += BAL.boostBonus * m.top;
  c.zn = zt;

  let st = 0;
  if(!racing){ c.v = 0; c.slip = 0; c.stun = 0; }
  else if(zt === 'gap'){ c.v = BAL.gapSpeed; }
  else if(c.isPlayer){
    if(inp.up) c.v += BAL.accel*dt*m.acc*(0.45 + 0.55*grip);
    else if(inp.down) c.v -= BAL.brake*dt*(0.45 + 0.55*grip);
    else c.v -= BAL.roll*dt;
    st = (inp.left?1:0) - (inp.right?1:0);
    c.d += st * dt * 10 * clamp(c.v/18, 0.25, 1) * (0.5 + 0.5*grip);
    c.slip += st * dt * (1 - grip) * 9;
    c.slip *= Math.exp(-dt*(1.2 + 2*grip));
    c.d += c.slip * dt;
  } else {
    c.v += BAL.accel*dt*m.acc*(0.6 + 0.4*grip);
    c.laneTimer -= dt;
    if(c.laneTimer <= 0){ c.laneTimer = rnd(2,4); c.laneT = rnd(-(HALF-3), HALF-3); }
    c.d += (c.laneT - c.d) * Math.min(1, dt*0.8);
  }

  const hot = hotAt(c.D);
  let cap = BAL.maxBase * m.top;
  if(zt === 'boost') cap = BAL.boostMax * m.top;
  if(hot) cap *= BAL.hotSlow;
  cap *= (0.85 + 0.15*grip);

  if(racing && c.stun <= 0 && vineHit(c)) c.stun = BAL.vineStun;
  if(c.stun > 0){ c.stun -= dt; cap = Math.min(cap, BAL.vineCap); c.v -= 10*dt; }

  if(c.v > cap) c.v -= Math.min(c.v-cap, 22*dt);
  c.v = clamp(c.v, -12, BAL.boostMax*1.3*m.top);

  const lim = HALF - 1.2;
  if(c.d > lim){ c.d = lim; c.v *= 0.6; c.slip = 0; }
  else if(c.d < -lim){ c.d = -lim; c.v *= 0.6; c.slip = 0; }

  if(racing && zt !== 'gap' && !c.air){
    for(let pi=0; pi<PADS.length; pi++){
      const pd = PADS[pi];
      if(c.padHit.has(pi)) continue;
      if(Math.abs(c.D - pd.D) < 3.6 && Math.abs(c.d - pd.d) < 3.6){
        c.padHit.add(pi); c.air = true; c.airV = BAL.padJump;
        if(c.isPlayer) sfxPad();
        break;
      }
    }
  }
  if(c.air){
    c.airV -= BAL.gravity*dt;
    c.airH += c.airV*dt;
    if(c.airH <= 0){ c.airH = 0; c.airV = 0; c.air = false; }
  }

  if(racing){
    c.D += c.v * dt;
    if(c.D >= TOTAL && !c.finished){
      c.D = TOTAL; c.v = 0; c.finished = true; c.finishT = raceT;
      if(c.isPlayer){ endShown = true; showEnd(); }
    }
  }

  const p = trackAt(c.D);
  c.tx = p.tx; c.tz = p.tz;
  c.x = p.x + (-p.tz)*c.d;
  c.z = p.z + p.tx*c.d;
  c.y = p.y + c.airH;
  c.mesh.position.set(c.x, c.y, c.z);
  c.mesh.rotation.set(c.air ? -c.airV*0.02 : 0,
                      Math.atan2(-p.tx, -p.tz) + c.slip*0.03,
                      -st*0.08 - c.slip*0.02);
}

/* ---------- COLLISIONS ENTRE VOITURES ---------- */
const CAR_W = 2.3, CAR_L = 4.4;
function resolveCars(){
  if(!racing) return;
  for(let i=0; i<CARS.length; i++) for(let j=i+1; j<CARS.length; j++){
    const a = CARS[i], b = CARS[j];
    if(a.finished || b.finished) continue;
    const dD = a.D - b.D, dd = a.d - b.d;
    if(Math.abs(dD) > CAR_L || Math.abs(dd) > CAR_W) continue;
    const vMin = Math.min(a.v, b.v);
    a.v = lerp(a.v, vMin, 0.3);
    b.v = lerp(b.v, vMin, 0.3);
    const ov = CAR_W - Math.abs(dd), sg = dd >= 0 ? 1 : -1, lim = HALF - 1.2;
    a.d = clamp(a.d + sg*ov/2, -lim, lim);
    b.d = clamp(b.d - sg*ov/2, -lim, lim);
  }
}

/* ---------- RÉCOMPENSES ---------- */
function gainMoney(n){
  S.money += n; saveGame(); refreshMoney();
}
function collectPieces(){
  for(const p of PIECES){
    if(p.got) continue;
    if(Math.abs(player.D - p.D) < 3 && Math.abs(player.d - p.d) < 2.6){
      p.got = true; p.g.visible = false;
      gainMoney(10);
      flashPick('+10 💰');
      beep(1200, 0.1, 'sine', 0.06);
    }
  }
}
function recordOf(id){
  S.rec = S.rec || {};
  if(S.rec[id] !== undefined) return S.rec[id];
  if(id === 'long' && S.record !== null && S.record !== undefined) return S.record;
  return null;
}
// Débloque des pièces au hasard parmi celles pas encore possédées
function unlockRewards(count){
  const pool = REWARDS().filter(i => !hasItem(i.id));
  if(!pool.length) return {got:[], bonusMoney:50};
  const got = [];
  for(let k=0; k<count && pool.length; k++){
    const idx = Math.floor(Math.random()*pool.length);
    const it = pool.splice(idx, 1)[0];
    S.owned.push(it.id);
    got.push(it);
  }
  return {got, bonusMoney:0};
}
function showEnd(){
  const place = rankOf(player);
  const base = [100, 65, 50][place-1] || 25;
  const prev = recordOf(CUR_TRACK);
  const isRecord = prev === null || player.finishT < prev;
  let bonus = 0;
  if(prev !== null && player.finishT < prev) bonus = 40;
  if(isRecord){ S.rec = S.rec || {}; S.rec[CUR_TRACK] = player.finishT; }

  // Nombre de pièces : selon le circuit, +1 si 1er, +1 si record
  let count = PIECES_PER_TRACK[CUR_TRACK] || 1;
  if(place === 1) count += 1;
  if(isRecord) count += 1;
  const rew = unlockRewards(count);
  if(rew.bonusMoney) bonus += rew.bonusMoney;

  gainMoney(base + bonus);
  let txt = TRACK_DEFS[CUR_TRACK].name + '<br>Temps : ' + fmt(player.finishT) + ' · Position : ' + place + '/' + CARS.length +
    '<br>Récompense : +' + base + ' 💰' + (bonus ? '<br>Bonus : +' + bonus + ' 💰' : '');
  if(rew.got.length){
    txt += '<br>🎁 Pièces débloquées (' + rew.got.length + ') : ' + rew.got.map(i => i.name).join(', ');
  } else if(rew.bonusMoney){
    txt += '<br>🎁 Tu as déjà tout débloqué : +50 💰';
  }
  document.getElementById('endTxt').innerHTML = txt;
  document.getElementById('end').classList.remove('hidden');
  saveGame();
}

function rankOf(p){
  let r = 1;
  for(const c of CARS){
    if(c === p) continue;
    if(c.finished && (!p.finished || c.finishT < p.finishT)) r++;
    else if(!c.finished && !p.finished && c.D > p.D) r++;
  }
  return r;
}
const fmt = t => {
  const m = Math.floor(t/60), s = (t%60).toFixed(2).padStart(5,'0');
  return m + ':' + s;
};
function resetRace(){
  CARS.forEach((c,i) => {
    c.D = i===0 ? 0 : -8*i;
    c.d = c.isPlayer ? 0 : c.laneT;
    c.v = 0; c.finished = false; c.finishT = 0; c.zn = null; c.laneTimer = 0;
    c.air = false; c.airH = 0; c.airV = 0; c.padHit = new Set(); c.slip = 0; c.stun = 0;
  });
  racing = false; raceT = 0; countT = 3.99; goT = 0; endShown = false;
  placePieces();
  document.getElementById('end').classList.add('hidden');
}

/* ---------- INTERFACE DE COURSE ---------- */
const raceExtra = document.createElement('div');
raceExtra.id = 'raceExtra';
raceExtra.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);background:rgba(0,0,0,.55);padding:8px 16px;border-radius:12px;border:2px solid #39ff88;font-size:16px;z-index:6;pointer-events:none;text-align:center;min-width:280px';
raceExtra.innerHTML = '<div id="wName">Monde habituel</div>' +
  '<div style="height:8px;background:#222;border-radius:4px;margin-top:6px;overflow:hidden">' +
  '<div id="wBar" style="height:100%;width:0%;background:linear-gradient(90deg,#39ff88,#2fb8ff)"></div></div>';
document.body.appendChild(raceExtra);
const wNameEl = document.getElementById('wName'), wBarEl = document.getElementById('wBar');

const moneyHud = document.createElement('div');
moneyHud.id = 'moneyHud';
moneyHud.style.cssText = 'position:fixed;top:14px;right:14px;background:rgba(0,0,0,.55);padding:8px 14px;border-radius:12px;border:2px solid #ffd23f;font-size:18px;color:#ffd23f;z-index:6;pointer-events:none';
document.body.appendChild(moneyHud);

const pickMsg = document.createElement('div');
pickMsg.id = 'pickMsg';
pickMsg.style.cssText = 'position:fixed;left:50%;top:110px;transform:translateX(-50%);font-size:24px;font-weight:bold;color:#ffd23f;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .4s;z-index:6;pointer-events:none';
document.body.appendChild(pickMsg);
let pickT = null;
function flashPick(txt){
  pickMsg.textContent = txt; pickMsg.style.opacity = 1;
  clearTimeout(pickT); pickT = setTimeout(() => { pickMsg.style.opacity = 0; }, 900);
}
const alertMsg = document.createElement('div');
alertMsg.id = 'alertMsg';
alertMsg.style.cssText = 'position:fixed;left:50%;top:160px;transform:translateX(-50%);font-size:18px;font-weight:bold;color:#fff;background:rgba(200,40,20,.85);padding:6px 14px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:6;pointer-events:none';
document.body.appendChild(alertMsg);
let alertT = null;
function flashAlert(txt){
  alertMsg.textContent = txt; alertMsg.style.opacity = 1;
  clearTimeout(alertT); alertT = setTimeout(() => { alertMsg.style.opacity = 0; }, 1400);
}
function refreshMoney(){
  moneyHud.textContent = 'Argent : ' + S.money + ' 💰';
  const g = document.getElementById('gMoney');
  if(g) g.textContent = 'Argent : ' + S.money + ' 💰';
}

/* ---------- PLUIE ET NEIGE ---------- */
const WX = {N:500, pos:new Float32Array(500*3), pts:null, mat:null};
(function buildWeatherFX(){
  for(let i=0; i<WX.N; i++){
    WX.pos[i*3] = rnd(-40,40); WX.pos[i*3+1] = rnd(0,30); WX.pos[i*3+2] = rnd(-40,40);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(WX.pos, 3));
  WX.mat = new THREE.PointsMaterial({color:0xbfe6ff, size:0.25, transparent:true, opacity:0.7, depthWrite:false});
  WX.pts = new THREE.Points(geo, WX.mat);
  WX.pts.frustumCulled = false;
  WX.pts.visible = false;
  scene.add(WX.pts);
})();
function updateWeatherFX(dt){
  const w = MODE === 'race' ? weatherAt(player.D) : 'clear';
  const show = w === 'rain' || w === 'snow';
  WX.pts.visible = show;
  if(!show) return;
  const snow = w === 'snow';
  WX.mat.color.set(snow ? 0xffffff : 0xbfe6ff);
  WX.mat.size = snow ? 0.5 : 0.25;
  const fall = snow ? 3 : 22, t = performance.now()/1000;
  for(let i=0; i<WX.N; i++){
    const k = i*3;
    WX.pos[k+1] -= fall*dt*(0.7 + (i%5)*0.1);
    if(snow) WX.pos[k] += Math.sin(t*2 + i)*dt*1.2;
    if(WX.pos[k+1] < 0){ WX.pos[k+1] = 30; WX.pos[k] = rnd(-40,40); WX.pos[k+2] = rnd(-40,40); }
  }
  WX.pts.geometry.attributes.position.needsUpdate = true;
  WX.pts.position.set(player.x, player.y + player.airH, player.z);
}

/* ---------- EFFETS : fumée, traces, sons ---------- */
const FX = {particles:[], trails:[], snd:null, engineT:0, lastKey:null, hot:false, stun:false};
function audio(){
  if(FX.snd) return FX.snd;
  try{ FX.snd = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ FX.snd = null; }
  return FX.snd;
}
function beep(freq, dur, type, vol, slide){
  const ctx = audio(); if(!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq+slide), t+dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t+dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t+dur+0.05);
}
const sfxPad = () => beep(520, 0.3, 'triangle', 0.1, 420);
const sfxPortal = () => { beep(180, 0.8, 'sine', 0.12, 700); beep(880, 0.5, 'triangle', 0.06, -400); };

function engineBeep(v){
  const s = ENGINE_SND[S.sound] || ENGINE_SND.base;
  beep(s.f(v), s.dur, s.type, s.vol);
}

const smokeGeo = new THREE.SphereGeometry(0.5, 6, 4);
function spawnSmoke(c){
  const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({color:CFG.smokeHex || '#bbbbcc', transparent:true, opacity:0.5}));
  m.position.set(c.x - c.tx*2.2, c.y + 0.4, c.z - c.tz*2.2);
  scene.add(m);
  FX.particles.push({m, life:1.2, vx:rnd(-0.6,0.6), vz:rnd(-0.6,0.6)});
}
function spawnTrail(c){
  const side = c.d > 0 ? -1 : 1;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.9),
    new THREE.MeshBasicMaterial({color:CFG.trailHex || '#000000', transparent:true, opacity:0.45}));
  m.position.set(c.x - c.tx*1.4 + (-c.tz)*side*0.9, c.y + 0.03, c.z - c.tz*1.4 + c.tx*side*0.9);
  m.rotation.y = Math.atan2(-c.tx, -c.tz);
  scene.add(m);
  FX.trails.push({m, life:6});
}
function updateFX(dt, c){
  if(!racing || !c.isPlayer) return;
  if(c.v > 20 && Math.random() < dt*12) spawnSmoke(c);
  if(c.v > 25 && !c.air && Math.random() < dt*20) spawnTrail(c);
  if(Math.abs(c.slip) > 2 && Math.random() < dt*15) spawnTrail(c);

  FX.engineT -= dt;
  if(FX.engineT <= 0){ FX.engineT = 0.12; engineBeep(c.v); }

  if(hasItem('snd_tires') && Math.abs(c.slip) > 1.2 && Math.random() < dt*6){
    beep(1400 + rnd(0,400), 0.18, 'sawtooth', 0.012, -300);
  }

  const zt = (zoneAt(c.D)||{}).z; const key = zt ? zt.type : null;
  if(key && key !== FX.lastKey){
    if(key === 'boost') beep(900, 0.2, 'square', 0.05, 300);
    if(key === 'gap')   beep(300, 0.6, 'sine', 0.1, 500);
    if(key === 'tunnel') beep(140, 0.9, 'sine', 0.08, -60);
  }
  FX.lastKey = key;

  if(hotAt(c.D) && !FX.hot){ FX.hot = true; flashAlert('🔥 Route brûlante : ralentis !'); }
  if(!hotAt(c.D)) FX.hot = false;
  if(c.stun > 0 && !FX.stun){ FX.stun = true; flashAlert('🌿 Liane sur la piste !'); beep(200, 0.3, 'sawtooth', 0.05); }
  if(c.stun <= 0) FX.stun = false;
}
function tickFX(dt){
  for(let i=FX.particles.length-1; i>=0; i--){
    const p = FX.particles[i];
    p.life -= dt;
    p.m.position.x += p.vx*dt; p.m.position.z += p.vz*dt; p.m.position.y += dt*1.2;
    p.m.scale.multiplyScalar(1 + dt*1.5);
    p.m.material.opacity = Math.max(0, p.life*0.4);
    if(p.life <= 0){ scene.remove(p.m); p.m.material.dispose(); FX.particles.splice(i,1); }
  }
  for(let i=FX.trails.length-1; i>=0; i--){
    const t = FX.trails[i];
    t.life -= dt;
    t.m.material.opacity = Math.max(0, t.life/6 * 0.45);
    if(t.life <= 0){ scene.remove(t.m); t.m.material.dispose(); FX.trails.splice(i,1); }
  }
}

/* ---------- FLASH ET CHANGEMENT D'ENVIRONNEMENT ---------- */
const tFlash = document.createElement('div');
tFlash.style.cssText = 'position:fixed;inset:0;background:#e6fbff;opacity:0;pointer-events:none;z-index:9';
document.body.appendChild(tFlash);
const FLASH = {v:0, shake:0};

function updateEnvironment(dt){
  const b = blockAtD(player.D);
  const e = b < 0 ? BLOCKS[0].env : BLOCKS[b].env;
  if(e !== ENV_CUR){
    if(ENV_CUR === 1 && e !== 1){ FLASH.v = 1; FLASH.shake = 0.6; sfxPortal(); }
    applyEnvIdx(e);
  }
  for(let k=0; k<GRP.length; k++) GRP[k].visible = Math.abs((k-1) - b) <= 1;

  const w = weatherAt(player.D);
  const label = WORLD_NAMES[ENV_CUR] + WEATHER_LABEL[w];
  if(wNameEl.textContent !== label) wNameEl.textContent = label;

  if(w === 'fog'){
    const far = CFG.headStyle === 2 ? 390 : 230;
    scene.fog.near = lerp(scene.fog.near, 45, 0.04);
    scene.fog.far  = lerp(scene.fog.far, far, 0.04);
  }

  FLASH.v = Math.max(0, FLASH.v - dt*1.4);
  FLASH.shake = Math.max(0, FLASH.shake - dt*1.5);
  tFlash.style.opacity = (FLASH.v*0.8).toFixed(3);

  wBarEl.style.width = (clamp(player.D / TOTAL, 0, 1) * 100).toFixed(1) + '%';

  const pulse = 0.65 + 0.35*Math.sin(performance.now()/300);
  for(const m of GATE_MATS) m.opacity = pulse;

  updateWeatherFX(dt);
}

/* ---------- GARAGE 3D ---------- */
const gScene = new THREE.Scene();
gScene.userData.voiture = true;
const gAmb = new THREE.HemisphereLight(0xffffff, 0x222233, 0.8);
gScene.add(gAmb);
const gKey = new THREE.DirectionalLight(0xffffff, 1);
gKey.position.set(4, 9, 6); gKey.castShadow = true;
gKey.shadow.mapSize.set(1024, 1024);
Object.assign(gKey.shadow.camera, {left:-6, right:6, top:6, bottom:-6, near:1, far:40});
gKey.shadow.camera.updateProjectionMatrix();
gScene.add(gKey);
const gSpot = new THREE.SpotLight(0xffffff, 0.6, 40, 0.5, 0.5);
gSpot.position.set(-5, 10, -4); gScene.add(gSpot);
const gFloor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshLambertMaterial({color:0x1a1d26}));
gFloor.rotation.x = -Math.PI/2; gFloor.receiveShadow = true; gScene.add(gFloor);
const gTurn = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.12, 64), new THREE.MeshLambertMaterial({color:0x262b3a}));
gTurn.position.y = 0.06; gTurn.receiveShadow = true; gScene.add(gTurn);
const gRingMat = new THREE.MeshBasicMaterial({color:0x39ff88});
const gRing = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.05, 8, 96), gRingMat);
gRing.rotation.x = Math.PI/2; gRing.position.y = 0.14; gScene.add(gRing);
const gHolder = new THREE.Group(); gScene.add(gHolder);
let gCar = null;
let gYaw = 0.6, gPitch = 0.22, gDist = 9.5;
let MODE = 'garage';
let SNAP = null, dragging = false, lastX = 0, idleT = 0;

function applyEnv(){
  const e = ENVS[CFG.env] || ENVS[0];
  gScene.background = new THREE.Color(e.bg);
  gFloor.material.color.set(e.floor);
  gAmb.intensity = e.amb; gKey.intensity = e.key; gKey.color.set(e.keyHex);
}
function rebuildGarageCar(cfgObj){
  const c = cfgObj || CFG;
  if(gCar) gHolder.remove(gCar);
  gCar = buildCar(c);
  gHolder.add(gCar);
  gRingMat.color.set(c.neonOn ? c.neonHex : '#222636');
}
function updateGarageCam(){
  const cp = Math.cos(gPitch), sp = Math.sin(gPitch);
  camera.position.set(Math.sin(gYaw)*cp*gDist, 1.4 + sp*gDist, Math.cos(gYaw)*cp*gDist);
  camera.lookAt(0, 1.1, 0);
}

/* ---------- BOUTON ALÉATOIRE ---------- */
// Tire une configuration au hasard, uniquement avec ce qui est débloqué
function randomizeCfg(){
  const fin = ['matte','gloss','metal','chrome','pearl'];
  CFG.paintHex = pick(paintPalette());
  CFG.secHex = pick(paintPalette());
  CFG.glassHex = pick(GLASS_HEX);
  CFG.finish = pick(fin);
  CFG.rimStyle = pick(rimOpts())[0];
  CFG.rimHex = pick(RIM_HEX);
  CFG.caliperHex = pick(CAL_HEX);
  CFG.rimSize = pick([0.9, 1, 1.12]);
  CFG.tire = pick(tireOpts())[0];
  CFG.tireWidth = pick([0.8, 1, 1.2]);
  CFG.frontBumper = Math.floor(Math.random()*3);
  CFG.rearBumper = Math.floor(Math.random()*3);
  CFG.skirts = Math.random() < 0.5;
  CFG.fenders = Math.floor(Math.random()*3);
  CFG.hood = pick(hoodOpts())[0];
  CFG.roof = Math.floor(Math.random()*3);
  CFG.spoiler = pick(spoilerOpts())[0];
  CFG.diffuser = Math.random() < 0.5;
  CFG.headStyle = pick(headOpts())[0];
  CFG.headHex = pick(HEAD_HEX);
  CFG.neonOn = Math.random() < 0.7;
  CFG.neonHex = pick(neonPalette());
  const decos = ownedDecos();
  CFG.decal = decos.length && Math.random() < 0.7 ? pick(decos) : 'none';
  CFG.stripes = Math.floor(Math.random()*3);
  CFG.stripeHex = pick(paintPalette());
  CFG.num = String(Math.floor(rnd(1,99)));
  CFG.numHex = pick(['#ffffff','#111111','#ffd23f','#39ff88','#ff3b3b']);
  CFG.trailHex = pick(trailPalette());
  CFG.smokeHex = pick(smokePalette());
  CFG.antenna = pick(antOpts())[0];
  CFG.antennaHex = pick(RIM_HEX);
  CFG.exhaust = Math.floor(Math.random()*3);
  CFG.rideHeight = pick([0, 0.05, 0.1, 0.2, 0.3]);
  CFG.trackWidth = pick([0, 0.1, 0.2]);
  CFG.env = Math.floor(Math.random()*ENVS.length);
}

/* ---------- MAGASIN ---------- */
const CSS_SHOP = `
  #openShop{position:absolute;left:14px;top:14px;z-index:21;pointer-events:auto;background:#ff5a1f;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-weight:bold;font-size:15px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.3)}
  #openShop:hover{filter:brightness(1.08)}
  #shopOv{position:fixed;inset:0;z-index:30;background:#f4f5f8;color:#222;font-family:'Trebuchet MS',Verdana,sans-serif;display:flex;flex-direction:column}
  #shopOv.hidden{display:none}
  #shopTop{display:flex;align-items:center;gap:14px;padding:12px 18px;background:#fff;border-bottom:1px solid #e3e6ee}
  #shopTop .logo{font-weight:bold;font-size:20px;color:#ff5a1f;letter-spacing:1px}
  #shopSearch{flex:1;padding:9px 14px;border-radius:20px;border:1px solid #ccd3e0;font-size:15px;font-family:inherit}
  #shopMoney{font-weight:bold;color:#c25000;white-space:nowrap}
  #shopClose{background:#222;color:#fff;border:none;border-radius:10px;padding:8px 14px;cursor:pointer;font-size:14px}
  #shopBody{flex:1;display:flex;min-height:0}
  #shopSide{width:210px;background:#fff;border-right:1px solid #e3e6ee;padding:12px;overflow:auto}
  .sCat{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 12px;border:none;background:none;border-radius:10px;font-size:15px;cursor:pointer;margin-bottom:4px;color:#333;font-family:inherit}
  .sCat:hover{background:#f3f4f8}
  .sCat.on{background:#ff5a1f;color:#fff}
  #shopGrid{flex:1;overflow:auto;padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;align-content:start}
  .scCard{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);cursor:pointer;transition:transform .15s,box-shadow .15s}
  .scCard:hover{transform:translateY(-3px);box-shadow:0 6px 16px rgba(0,0,0,.12)}
  .scImg{height:130px;display:flex;align-items:center;justify-content:center;font-size:58px}
  .scBody{padding:10px 12px 12px}
  .scCat{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}
  .scName{font-weight:bold;font-size:15px;margin:2px 0}
  .scRow{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
  .scPrice{color:#ff5a1f;font-weight:bold}
  .scOwn{font-size:12px;background:#e3f8ea;color:#1a8f4a;padding:3px 8px;border-radius:10px;font-weight:bold}
  .scNone{font-size:12px;color:#888}
  .scLock{font-size:12px;background:#f1ecff;color:#6a3fc2;padding:3px 8px;border-radius:10px;font-weight:bold}
  #shopEmpty{color:#888;padding:30px;font-size:15px}
  #shopDetail{position:fixed;inset:0;z-index:31;pointer-events:none}
  #shopDetail.hidden{display:none}
  #sdLeft{position:absolute;left:14px;top:14px;bottom:14px;width:370px;background:#fff;color:#222;border-radius:14px;padding:16px 18px;overflow:auto;pointer-events:auto;box-shadow:0 4px 18px rgba(0,0,0,.18);font-family:'Trebuchet MS',Verdana,sans-serif}
  .sdHero{height:150px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:76px;margin:10px 0}
  .sdCat{font-size:11px;color:#ff5a1f;text-transform:uppercase;letter-spacing:1px;font-weight:bold}
  .sdTitle{font-size:22px;margin:3px 0 6px}
  .sdDesc{font-size:14px;color:#555;line-height:1.4}
  .sdSec{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:14px 0 4px}
  .fRow{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
  .fRow span:first-child{color:#444}
  .fRow b{color:#222;text-align:right}
  .fRow b.up{color:#1a8f4a}
  .fRow b.down{color:#c33}
  .sdPrice{font-size:22px;font-weight:bold;color:#ff5a1f;margin-top:14px}
  .sdMiss{font-size:13px;color:#c33;margin-top:2px}
  .sdLock{font-size:13px;color:#6a3fc2;background:#f1ecff;border-radius:10px;padding:10px;margin-top:12px;line-height:1.4}
  #sdBar{position:absolute;left:calc(50% + 185px);bottom:20px;transform:translateX(-50%);display:flex;gap:10px;pointer-events:auto;flex-wrap:wrap;justify-content:center;max-width:420px}
  .sdBtn{background:#ff5a1f;color:#fff;border:none;border-radius:12px;padding:12px 20px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;box-shadow:0 3px 10px rgba(0,0,0,.2)}
  .sdBtn.sec{background:#fff;color:#222;border:1px solid #ccd3e0;box-shadow:none}
  .sdBtn:disabled{opacity:.45;cursor:not-allowed}
  .sdTag{background:#fff;color:#1a8f4a;border-radius:12px;padding:12px 18px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,.2)}
  #gRandom{background:#6a3fc2;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;margin-top:6px;pointer-events:auto}
`;
(function buildShopUI(){
  const st = document.createElement('style');
  st.textContent = CSS_SHOP;
  document.head.appendChild(st);

  const ov = document.createElement('div');
  ov.id = 'shopOv'; ov.className = 'hidden';
  ov.innerHTML = `
    <div id="shopTop">
      <div class="logo">🏬 BOUTIQUE NEXUS</div>
      <input id="shopSearch" type="text" placeholder="Rechercher un article…">
      <div id="shopMoney"></div>
      <button id="shopClose">✕ Fermer</button>
    </div>
    <div id="shopBody">
      <aside id="shopSide"></aside>
      <main id="shopGrid"></main>
    </div>`;
  document.body.appendChild(ov);

  const dt = document.createElement('div');
  dt.id = 'shopDetail'; dt.className = 'hidden';
  dt.innerHTML = `<div id="sdLeft"></div><div id="sdBar"></div>`;
  document.body.appendChild(dt);
})();

const shopOv = document.getElementById('shopOv');
const shopSide = document.getElementById('shopSide');
const shopGrid = document.getElementById('shopGrid');
const shopSearch = document.getElementById('shopSearch');
const shopMoneyEl = document.getElementById('shopMoney');
const shopDetail = document.getElementById('shopDetail');
const sdLeft = document.getElementById('sdLeft');
const sdBar = document.getElementById('sdBar');
let shopCat = 'Tous';
let detailId = null;

function isMounted(it){
  if(it.kind === 'engine') return S.sound === it.id;
  if(!it.apply) return false;
  const t = JSON.parse(JSON.stringify(CFG));
  it.apply(t);
  return JSON.stringify(t) === JSON.stringify(CFG);
}
function mountItem(it){
  if(it.kind === 'engine'){ S.sound = it.id; saveGame(); return; }
  if(it.apply){ it.apply(CFG); onCfgChanged(false); persistCfg(); }
}
function persistCfg(){ S.cfg = JSON.parse(JSON.stringify(CFG)); saveGame(); }

function renderShopSide(){
  shopSide.innerHTML = SHOP_CATS.map(c =>
    `<button class="sCat ${shopCat===c.id?'on':''}" data-skind="cat" data-v="${c.id}"><span>${c.icon}</span><span>${c.label}</span></button>`
  ).join('');
}
function renderShopGrid(){
  const q = shopSearch.value.trim().toLowerCase();
  const list = SHOP.filter(i =>
    (shopCat === 'Tous' || i.cat === shopCat) &&
    (!q || i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)));
  shopMoneyEl.textContent = '💰 ' + S.money;
  if(!list.length){ shopGrid.innerHTML = '<div id="shopEmpty">Aucun article trouvé.</div>'; return; }
  shopGrid.innerHTML = list.map(it => {
    const own = hasItem(it.id);
    let tag;
    if(own) tag = '<span class="scOwn">Possédé ✓</span>';
    else if(it.reward) tag = '<span class="scLock">🏁 En course</span>';
    else tag = `<span class="scPrice">${it.price} 💰</span>`;
    return `<div class="scCard" data-skind="open" data-v="${it.id}">
      <div class="scImg" style="background:${it.bg}">${it.emoji}</div>
      <div class="scBody">
        <div class="scCat">${it.cat}</div>
        <div class="scName">${it.name}</div>
        <div class="scRow">${tag}</div>
      </div>
    </div>`;
  }).join('');
}
function openShop(){
  shopOv.classList.remove('hidden');
  gUI.classList.add('hidden');
  shopDetail.classList.add('hidden');
  renderShopSide(); renderShopGrid();
}
function closeShop(){
  shopOv.classList.add('hidden');
  shopDetail.classList.add('hidden');
  gUI.classList.remove('hidden');
  rebuildGarageCar(CFG);
}
function backToGrid(){
  shopDetail.classList.add('hidden');
  shopOv.classList.remove('hidden');
  rebuildGarageCar(CFG);
  renderShopGrid();
}

function openDetail(id){
  const it = itemById(id); if(!it) return;
  detailId = id;
  shopOv.classList.add('hidden');
  shopDetail.classList.remove('hidden');
  const pc = JSON.parse(JSON.stringify(CFG));
  if(it.preview) it.preview(pc);
  else if(it.apply) it.apply(pc);
  rebuildGarageCar(pc);
  renderDetail();
}
function renderDetail(){
  const it = itemById(detailId); if(!it) return;
  const own = hasItem(it.id);
  const mounted = isMounted(it);
  const miss = (it.price || 0) - S.money;
  const rows = it.fiche.map(([a,b]) => {
    const cls = /^\+/.test(b) && !/Poids/.test(a) ? 'up' : (/^−|^-/.test(b) && !/Poids/.test(a) ? 'down' : '');
    return `<div class="fRow"><span>${a}</span><b class="${cls}">${b}</b></div>`;
  }).join('');
  let priceBlock = '';
  if(!own && !it.reward) priceBlock = `<div class="sdPrice">${it.price} 💰</div>${miss>0?`<div class="sdMiss">Il te manque ${miss} 💰</div>`:''}`;
  if(!own && it.reward) priceBlock = `<div class="sdLock">🏁 Pièce à débloquer en gagnant des courses.<br>Court = 1 pièce, nuit = 2, long = 3. +1 si 1er, +1 si record. Tirée au hasard parmi celles qui manquent.</div>`;
  sdLeft.innerHTML = `
    <button class="sdBtn sec" data-skind="back" style="padding:7px 12px;font-size:13px">← Retour à la boutique</button>
    <div class="sdHero" style="background:${it.bg}">${it.emoji}</div>
    <div class="sdCat">${it.cat}</div>
    <div class="sdTitle">${it.name}</div>
    <div class="sdDesc">${it.desc}</div>
    <div class="sdSec">Fiche technique</div>
    ${rows}
    ${priceBlock}
    ${own ? `<div class="sdSec">Ton statut</div><div style="font-size:14px">${mounted?'✓ Monté sur ta voiture':'Possédé — non monté'}</div>` : ''}`;

  let bar = '';
  if(!own && !it.reward){
    bar += `<button class="sdBtn" data-skind="buy" ${miss>0?'disabled':''}>Acheter ${it.price} 💰</button>`;
  } else if(own && !mounted && (it.apply || it.kind === 'engine')){
    bar += `<button class="sdBtn" data-skind="mount">Monter sur ma voiture</button>`;
  } else if(own && mounted){
    bar += `<div class="sdTag">✓ Monté</div>`;
  }
  if(it.kind === 'engine') bar += `<button class="sdBtn sec" data-skind="listen">🔊 Écouter</button>`;
  sdBar.innerHTML = bar;
}
function shopMsgSet(t){
  let el = document.getElementById('sdMsg');
  if(!el){
    el = document.createElement('div'); el.id = 'sdMsg';
    el.style.cssText = 'position:absolute;left:50%;top:18px;transform:translateX(-50%);background:#222;color:#fff;padding:9px 16px;border-radius:10px;font-size:14px;pointer-events:none;z-index:32;transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent = t; el.style.opacity = 1;
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = 0; }, 1800);
}

shopOv.addEventListener('click', e => {
  const b = e.target.closest('[data-skind]'); if(!b) return;
  const k = b.dataset.skind;
  if(k === 'cat'){ shopCat = b.dataset.v; renderShopSide(); renderShopGrid(); }
  else if(k === 'open'){ openDetail(b.dataset.v); }
});
shopSearch.addEventListener('input', renderShopGrid);
document.getElementById('shopClose').addEventListener('click', closeShop);

sdBar.addEventListener('click', e => {
  const b = e.target.closest('[data-skind]'); if(!b) return;
  const it = itemById(detailId); if(!it) return;
  const k = b.dataset.skind;
  if(k === 'buy'){
    if(hasItem(it.id) || it.reward) return;
    if(S.money < it.price){ shopMsgSet("Pas assez d'argent"); return; }
    S.money -= it.price; S.owned.push(it.id);
    mountItem(it);
    saveGame(); refreshMoney();
    shopMsgSet(it.name + ' acheté et monté sur ta voiture !');
    openDetail(it.id);
  }
  else if(k === 'mount'){
    mountItem(it); shopMsgSet(it.name + ' monté !');
    openDetail(it.id);
  }
  else if(k === 'listen'){
    const s = ENGINE_SND[it.id] || ENGINE_SND.base;
    for(let i=0; i<10; i++) setTimeout(() => beep(s.f(20 + i*10), 0.2, s.type, s.vol), i*200);
  }
});
sdLeft.addEventListener('click', e => {
  const b = e.target.closest('[data-skind]'); if(!b) return;
  if(b.dataset.skind === 'back') backToGrid();
});

/* ---------- OPTIONS DU GARAGE ---------- */
const CATS = [
  {id:'paint',   icon:'🎨', label:'Peinture'},
  {id:'wheels',  icon:'🛞', label:'Roues'},
  {id:'body',    icon:'🏎️', label:'Carrosserie'},
  {id:'light',   icon:'💡', label:'Lumière'},
  {id:'sticker', icon:'🖌️', label:'Stickers'},
  {id:'fx',      icon:'✨', label:'Effets'},
  {id:'tune',    icon:'🔧', label:'Réglages'},
  {id:'perf',    icon:'⚙️', label:'Perf.'},
  {id:'style',   icon:'⭐', label:'Styles'},
  {id:'place',   icon:'🌆', label:'Circuit'},
  {id:'save',    icon:'💾', label:'Garage'}
];
let curCat = 'paint';

function buildGarageUI(){
  const st = document.createElement('style');
  st.textContent = `
    #gUI{position:fixed;inset:0;z-index:20;pointer-events:none;font-family:'Trebuchet MS',Verdana,sans-serif;color:#eef}
    #gUI.hidden{display:none}
    #gLeft{position:absolute;left:14px;top:62px;bottom:14px;width:380px;background:rgba(12,14,22,.92);border:1px solid #2b3550;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;pointer-events:auto;overflow:hidden}
    #gTop h2{margin:0;font-size:22px;color:#9fe7ff;letter-spacing:2px}
    #gTop small{opacity:.7}
    #gCats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    .gCat{background:#161c2c;border:1px solid #2b3550;border-radius:10px;color:#fff;padding:6px 0;cursor:pointer;font-size:20px;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:inherit}
    .gCat span{font-size:10px;opacity:.85}
    .gCat.on{background:#1c5f7a;border-color:#2fe0ff}
    #gOpts{flex:1;overflow:auto;padding-right:4px}
    .gSec{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#7fd4ff;margin:12px 0 6px}
    .gSw{width:30px;height:30px;border-radius:50%;border:3px solid #222;cursor:pointer;margin:3px;box-shadow:0 0 0 1px #445}
    .gSw.on{border-color:#fff;transform:scale(1.15)}
    .gChip{background:#161c2c;border:1px solid #3a4a6a;color:#fff;border-radius:16px;padding:6px 11px;font-size:14px;cursor:pointer;margin:3px;font-family:inherit}
    .gChip.on{background:#2f6fd6;border-color:#9fe7ff}
    .gTrack{display:block;width:100%;text-align:left;border-radius:12px;padding:12px;margin:6px 0}
    .gTrack.on{background:#1c5f7a;border-color:#2fe0ff}
    .gRowL{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0;font-size:15px}
    .gRowL input[type=range]{width:160px}
    .gRowL input[type=color]{width:46px;height:30px;border:none;background:none;cursor:pointer}
    .gRowL input[type=text]{width:90px;background:#161c2c;color:#fff;border:1px solid #3a4a6a;border-radius:6px;padding:4px}
    #gStats{position:absolute;right:14px;top:14px;width:270px;background:rgba(12,14,22,.9);border:1px solid #2b3550;border-radius:14px;padding:14px;pointer-events:auto;font-size:15px}
    #gStats h3{margin:0 0 8px;color:#39ff88;font-size:16px}
    .gStat{display:flex;justify-content:space-between;margin:6px 0}
    .gStat b{color:#ffd23f}
    .gStat i{opacity:.6;font-style:normal;font-size:12px}
    #gBottom{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:10px;pointer-events:auto}
    .gBtn2{background:#161c2c;border:1px solid #3a4a6a;color:#fff;border-radius:10px;padding:10px 16px;font-size:15px;cursor:pointer;font-family:inherit}
    #gGo{background:linear-gradient(180deg,#39ff88,#1fb85a);color:#06140a;font-weight:bold;font-size:18px;border:none;padding:12px 26px;border-radius:12px;cursor:pointer;font-family:inherit}
    #gHint{position:absolute;right:14px;bottom:16px;opacity:.75;font-size:13px;pointer-events:none}
  `;
  document.head.appendChild(st);
  const ui = document.createElement('div');
  ui.id = 'gUI';
  ui.innerHTML = `
    <button id="openShop">🛒 Magasin</button>
    <div id="gLeft">
      <div id="gTop">
        <h2>GARAGE</h2><small>Modèle GT · Niveau 1</small>
        <div id="gMoney" style="color:#ffd23f;font-size:16px;margin-top:4px"></div>
        <button id="gRandom" data-kind="random">🎲 Aléatoire</button>
      </div>
      <div id="gCats"></div>
      <div id="gOpts"></div>
    </div>
    <div id="gStats"></div>
    <div id="gBottom">
      <button class="gBtn2" data-kind="cancel">Annuler</button>
      <button class="gBtn2" data-kind="reset">Réinitialiser</button>
      <button id="gGo" data-kind="go">Valider et conduire</button>
    </div>
    <div id="gHint">Glisser : tourner · Molette : zoom · Entrée : conduire</div>`;
  document.body.appendChild(ui);
  return ui;
}
const gUI = buildGarageUI();
const gCatsEl = gUI.querySelector('#gCats');
const gOptsEl = gUI.querySelector('#gOpts');
const gStats = gUI.querySelector('#gStats');
document.getElementById('openShop').addEventListener('click', openShop);

const esc = s => String(s).replace(/"/g,'&quot;');
const enc = v => encodeURIComponent(JSON.stringify(v));
const rowSw = (label, key, list) =>
  `<div class="gSec">${label}</div><div>` +
  list.map(h => `<button class="gSw ${CFG[key]===h?'on':''}" data-kind="sw" data-k="${key}" data-v="${h}" style="background:${h}"></button>`).join('') + `</div>`;
const rowChips = (label, key, list) =>
  `<div class="gSec">${label}</div><div>` +
  list.map(([v,t]) => `<button class="gChip ${CFG[key]===v?'on':''}" data-kind="chip" data-k="${key}" data-v="${enc(v)}">${t}</button>`).join('') + `</div>`;
const rowColor = (label, key) =>
  `<div class="gRowL"><span>${label}</span><input type="color" data-kind="inp" data-k="${key}" value="${CFG[key]}"></div>`;
const rowRange = (label, key, min, max, step) =>
  `<div class="gRowL"><span>${label}</span><input type="range" data-kind="inp" data-num="1" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${CFG[key]}"></div>`;
const rowToggle = (label, key) =>
  `<div class="gRowL"><span>${label}</span><input type="checkbox" data-kind="inp" data-bool="1" data-k="${key}" ${CFG[key]?'checked':''}></div>`;
const rowText = (label, key) =>
  `<div class="gRowL"><span>${label}</span><input type="text" maxlength="2" data-kind="inp" data-text="1" data-k="${key}" value="${esc(CFG[key])}"></div>`;

function getSaved(){ try{ return JSON.parse(localStorage.getItem('nexusGarage') || '{}'); }catch(e){ return {}; } }
function setSaved(o){ try{ localStorage.setItem('nexusGarage', JSON.stringify(o)); }catch(e){} }
function savedListHTML(){
  const names = Object.keys(getSaved());
  if(!names.length) return '<div>Aucune sauvegarde.</div>';
  return names.map(n =>
    `<div class="gRowL"><button class="gChip" data-kind="load" data-v="${esc(n)}">${n}</button><button class="gChip" data-kind="del" data-v="${esc(n)}">✕</button></div>`).join('');
}
function trackHTML(){
  return `<div class="gSec">Choisis ton circuit</div>` +
    Object.keys(TRACK_DEFS).map(id =>
      `<button class="gChip gTrack ${S.track===id?'on':''}" data-kind="track" data-v="${id}">
         <b>${TRACK_DEFS[id].name}</b>${S.track===id ? ' ✓' : ''}<br><small>${TRACK_DEFS[id].desc}</small>
       </button>`).join('');
}

const OPTS = {
  paint: () =>
    rowSw('Couleur principale', 'paintHex', paintPalette()) + rowColor('Palette RGB', 'paintHex') +
    rowChips('Finition', 'finish', [['matte','Mate'],['gloss','Brillante'],['metal','Métallisée'],['chrome','Chromée'],['pearl','Nacrée']]) +
    rowSw('Couleur secondaire (toit, capot)', 'secHex', paintPalette()) + rowColor('Palette RGB secondaire', 'secHex') +
    rowSw('Couleur des vitres', 'glassHex', GLASS_HEX),
  wheels: () =>
    rowChips('Style de jantes', 'rimStyle', rimOpts()) +
    rowSw('Couleur des jantes', 'rimHex', RIM_HEX) +
    rowSw('Couleur des étriers', 'caliperHex', CAL_HEX) +
    rowChips('Taille des jantes', 'rimSize', [[0.9,'Petite'],[1,'Moyenne'],[1.12,'Grande']]) +
    rowChips('Type de pneus', 'tire', tireOpts()) +
    rowRange('Épaisseur des pneus', 'tireWidth', 0.6, 1.4, 0.1),
  body: () =>
    rowChips('Pare-chocs avant', 'frontBumper', [[0,'Origine'],[1,'Sport'],[2,'Racing']]) +
    rowChips('Pare-chocs arrière', 'rearBumper', [[0,'Origine'],[1,'Sport'],[2,'Racing']]) +
    rowToggle('Bas de caisse', 'skirts') +
    rowRange("Élargisseurs d'ailes", 'fenders', 0, 2, 1) +
    rowChips('Capot', 'hood', hoodOpts()) +
    rowChips('Toit', 'roof', [[0,'Normal'],[1,'Vitré'],[2,'Carbone']]) +
    rowChips('Aileron', 'spoiler', spoilerOpts()) +
    rowToggle('Diffuseur arrière', 'diffuser'),
  light: () =>
    rowChips('Style des phares', 'headStyle', headOpts()) +
    rowSw('Couleur des phares', 'headHex', HEAD_HEX) + rowColor('Palette RGB phares', 'headHex') +
    rowToggle('Néons sous la voiture', 'neonOn') +
    rowSw('Couleur des néons', 'neonHex', neonPalette()) + rowColor('Palette RGB néons', 'neonHex'),
  sticker: () => {
    const decos = [['none','Aucun']].concat(
      SHOP.filter(i => i.kind === 'deco' && hasItem(i.id)).map(i => [i.id, i.name]));
    return rowChips('Décor complet', 'decal', decos) +
      rowChips('Bandes de course', 'stripes', [[0,'Aucune'],[1,'Bande simple'],[2,'Double bande']]) +
      rowSw('Couleur des bandes', 'stripeHex', paintPalette()) +
      rowText('Numéro (2 chiffres)', 'num') +
      rowSw('Couleur du numéro', 'numHex', ['#ffffff','#111111','#ffd23f','#39ff88','#ff3b3b']);
  },
  fx: () => {
    let h = rowSw('Couleur des traînées de pneus', 'trailHex', trailPalette()) +
      rowSw('Couleur de la fumée', 'smokeHex', smokePalette()) +
      rowChips('Antenne', 'antenna', antOpts()) +
      rowSw("Couleur de l'antenne", 'antennaHex', RIM_HEX);
    if(hasItem('ant_carbon')){
      h += rowChips("Matière de l'antenne", 'antennaMat', [['acier','Acier'],['carbone','Carbone']]);
    }
    return h;
  },
  tune: () =>
    rowRange('Garde au sol', 'rideHeight', 0, 0.4, 0.05) +
    rowRange('Largeur des voies', 'trackWidth', 0, 0.3, 0.05) +
    rowChips('Échappement', 'exhaust', [[0,'Classique'],[1,'Sport'],[2,'Racing']]),
  perf: () =>
    rowChips('Moteur', 'engine', [[0,'Origine'],[1,'Niveau 1'],[2,'Niveau 2'],[3,'Niveau 3']]) +
    rowToggle('Turbo', 'turbo') +
    `<div class="gSec">Banc d'essai</div><button class="gChip" data-kind="sound">🔊 Écouter le moteur équipé</button>`,
  style: () =>
    `<div class="gSec">Styles prédéfinis</div><div>` +
    Object.keys(PRESETS).map(n => `<button class="gChip" data-kind="preset" data-v="${esc(n)}">${n}</button>`).join('') + `</div>`,
  place: () => trackHTML() +
    rowChips('Ambiance', 'env', ENVS.map((e,i) => [i, e.name])),
  save: () =>
    `<div class="gSec">Sauvegarder cette voiture</div>
     <div class="gRowL"><input type="text" id="saveName" maxlength="20" placeholder="Nom" style="width:160px;background:#161c2c;color:#fff;border:1px solid #3a4a6a;border-radius:6px;padding:4px">
     <button class="gChip" data-kind="saveBtn">Sauver</button></div>
     <div class="gSec">Mes voitures</div>` + savedListHTML()
};

function renderCats(){
  gCatsEl.innerHTML = CATS.map(c =>
    `<button class="gCat ${c.id===curCat?'on':''}" data-kind="cat" data-v="${c.id}">${c.icon}<span>${c.label}</span></button>`).join('');
}
function renderOpts(){ gOptsEl.innerHTML = OPTS[curCat](); }

function updateStats(){
  const m = carMults(CFG);
  const pw = 120 + CFG.engine*45 + (CFG.turbo ? 70 : 0);
  const row = (name, val, orig) =>
    `<div class="gStat"><span>${name}</span><span><b>${val}</b> <i>(origine ${orig})</i></span></div>`;
  const pct = v => (v >= 0 ? '+' : '') + Math.round(v*100) + ' %';
  gStats.innerHTML = `<h3>Performances</h3>` +
    row('Vitesse max', Math.round(180*m.top*(1+PB.top)) + ' km/h', '180') +
    row('Accélération', Math.round(100*m.acc*(1+PB.acc)) + ' %', '100') +
    row('Adhérence', pct(PB.grip), '0 %') +
    row('Puissance', pw + ' ch', '120') +
    row('Circuit', TRACK_DEFS[S.track || 'long'].name, '—');
}
function onCfgChanged(rerender){
  PB = playerBonus(CFG);
  applyEnv(); rebuildGarageCar(CFG); updateStats();
  if(rerender) renderOpts();
}

gUI.addEventListener('click', e => {
  const b = e.target.closest('[data-kind]');
  if(!b || b.id === 'openShop') return;
  const kind = b.dataset.kind;
  idleT = 0;
  if(kind === 'random'){ randomizeCfg(); onCfgChanged(true); persistCfg(); }
  else if(kind === 'cat'){ curCat = b.dataset.v; renderCats(); renderOpts(); }
  else if(kind === 'track'){ S.track = b.dataset.v; saveGame(); renderOpts(); updateStats(); }
  else if(kind === 'sw'){ CFG[b.dataset.k] = b.dataset.v; onCfgChanged(true); persistCfg(); }
  else if(kind === 'chip'){ CFG[b.dataset.k] = JSON.parse(decodeURIComponent(b.dataset.v)); onCfgChanged(true); persistCfg(); }
  else if(kind === 'preset'){ Object.assign(CFG, JSON.parse(JSON.stringify(PRESETS[b.dataset.v]))); onCfgChanged(true); persistCfg(); }
  else if(kind === 'sound'){ playEngineTest(); }
  else if(kind === 'saveBtn'){
    const name = (document.getElementById('saveName').value || '').trim() || 'Ma voiture';
    const s = getSaved(); s[name] = JSON.parse(JSON.stringify(CFG)); setSaved(s);
    renderOpts();
  }
  else if(kind === 'load'){
    const s = getSaved();
    if(s[b.dataset.v]){ Object.assign(CFG, JSON.parse(JSON.stringify({...DEFAULT_CFG, ...s[b.dataset.v]}))); onCfgChanged(true); persistCfg(); }
  }
  else if(kind === 'del'){
    const s = getSaved(); delete s[b.dataset.v]; setSaved(s); renderOpts();
  }
  else if(kind === 'cancel'){ Object.assign(CFG, JSON.parse(JSON.stringify(SNAP))); onCfgChanged(true); persistCfg(); }
  else if(kind === 'reset'){ Object.assign(CFG, JSON.parse(JSON.stringify(DEFAULT_CFG))); onCfgChanged(true); persistCfg(); }
  else if(kind === 'go'){ startFromGarage(); }
});
gUI.addEventListener('input', e => {
  const t = e.target;
  if(t.dataset.kind !== 'inp') return;
  const k = t.dataset.k;
  if(t.dataset.bool) CFG[k] = t.checked;
  else if(t.dataset.num) CFG[k] = parseFloat(t.value);
  else if(t.dataset.text) CFG[k] = t.value.slice(0,2);
  else CFG[k] = t.value;
  onCfgChanged(false);
  persistCfg();
});

function playEngineTest(){
  const s = ENGINE_SND[S.sound] || ENGINE_SND.base;
  const lvl = CFG.engine + (CFG.turbo ? 1 : 0);
  for(let i=0; i<12; i++){
    setTimeout(() => beep(s.f(10 + lvl*10 + i*12), 0.2, s.type, s.vol), i*200);
  }
}

/* ---------- PASSAGES GARAGE <-> COURSE ---------- */
const RACE_UI = ['hud','help','count','raceExtra','moneyHud','pickMsg','alertMsg'];
function setRaceUI(on){
  RACE_UI.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = on ? '' : 'none'; });
}
function setPlayerMesh(){
  scene.remove(player.mesh);
  player.mesh = buildCar(CFG);
  scene.add(player.mesh);
}
function enterGarage(){
  SNAP = JSON.parse(JSON.stringify(CFG));
  MODE = 'garage';
  setRaceUI(false);
  document.getElementById('end').classList.add('hidden');
  gUI.classList.remove('hidden');
  shopOv.classList.add('hidden');
  shopDetail.classList.add('hidden');
  camera.fov = 42; camera.updateProjectionMatrix();
  dragging = false; idleT = 0;
  renderCats(); renderOpts();
  applyEnv(); rebuildGarageCar(CFG); updateStats(); refreshMoney();
}
let firstFrame = true;
function startFromGarage(){
  if(MODE !== 'garage') return;
  MODE = 'race';
  gUI.classList.add('hidden');
  shopOv.classList.add('hidden');
  shopDetail.classList.add('hidden');
  setRaceUI(true);
  camera.fov = 65; camera.updateProjectionMatrix();
  const wanted = S.track || 'long';
  if(CUR_TRACK !== wanted) buildTrack(wanted);
  PB = playerBonus(CFG);
  setPlayerMesh();
  resetRace();
  ENV_CUR = -2; FLASH.v = 0;
  firstFrame = true;
  refreshMoney();
}
(function addGarageButton(){
  const endBox = document.getElementById('end');
  const b = document.createElement('button');
  b.className = 'gChip'; b.style.fontSize = '18px'; b.textContent = 'Retour au garage';
  b.addEventListener('click', enterGarage);
  endBox.appendChild(b);
})();

/* ---------- SOURIS, CLAVIER ---------- */
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => {
  if(MODE !== 'garage') return;
  dragging = true; lastX = e.clientX; idleT = 0;
});
cv.addEventListener('pointermove', e => {
  if(!dragging) return;
  gYaw -= (e.clientX - lastX) * 0.008;
  lastX = e.clientX; idleT = 0;
});
addEventListener('pointerup', () => { dragging = false; });
cv.addEventListener('wheel', e => {
  if(MODE !== 'garage') return;
  gDist = clamp(gDist + e.deltaY*0.006, 5, 16); idleT = 0;
}, {passive:true});

const keys = {};
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if(MODE === 'garage'){
    if(e.key === 'Enter' && e.target.tagName !== 'INPUT' && shopOv.classList.contains('hidden') && shopDetail.classList.contains('hidden')){
      e.preventDefault(); startFromGarage();
    }
    return;
  }
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys[k] = true;
  if(k === 'r' && !e.repeat) resetRace();
  if(k === 'g' && !e.repeat) enterGarage();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for(const k in keys) keys[k] = false; });

/* ---------- CAMÉRA DE COURSE ---------- */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCam(dt, snap){
  const p = player;
  const sp = clamp(p.v / (BAL.boostMax*0.9), 0, 1.2);
  const back = 13 - 4*sp, up = 6 - 1.0*sp, ahead = 8 + 4*sp;
  const tp = new THREE.Vector3(p.x - p.tx*back, p.y + p.airH + up, p.z - p.tz*back);
  const tl = new THREE.Vector3(p.x + p.tx*ahead, p.y + p.airH + 1.5, p.z + p.tz*ahead);
  if(snap){ camPos.copy(tp); camLook.copy(tl); }
  else {
    camPos.lerp(tp, 1 - Math.exp(-dt*6));
    camLook.lerp(tl, 1 - Math.exp(-dt*10));
  }
  const shake = Math.max(FLASH.shake, sp > 0.9 ? 0.05 : 0);
  if(shake > 0){
    camPos.x += rnd(-shake,shake); camPos.y += rnd(-shake,shake)*0.6;
  }
  const fovT = 65 + 14*clamp(sp, 0, 1);
  if(Math.abs(camera.fov - fovT) > 0.05){
    camera.fov = lerp(camera.fov, fovT, 0.1);
    camera.updateProjectionMatrix();
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  for(const k in SKY) SKY[k].position.copy(camPos);
}

/* ---------- AFFICHAGE DE LA COURSE ---------- */
const hudSpeed = document.getElementById('speed'), hudPos = document.getElementById('pos'),
      hudTime = document.getElementById('time'), hudCount = document.getElementById('count');
function updateHUD(){
  hudSpeed.textContent = Math.round(Math.abs(player.v)*3.6) + ' km/h';
  hudPos.textContent = 'Position : ' + rankOf(player) + '/' + CARS.length;
  hudTime.textContent = fmt(raceT);
  if(countT > 0) hudCount.textContent = Math.ceil(countT);
  else if(goT > 0) hudCount.textContent = 'GO !';
  else hudCount.textContent = '';
}

/* ---------- BOUCLE ---------- */
buildTrack(S.track || 'long');
resetRace();
setRaceUI(false);
enterGarage();
let lastT = performance.now(), gameT = 0;
function loop(now){
  const dt = Math.min(0.05, (now - lastT)/1000); lastT = now;
  gameT += dt;

  if(MODE === 'garage'){
    idleT += dt;
    if(!dragging && idleT > 3) gYaw += dt*0.15;
    updateGarageCam();
    renderer.render(gScene, camera);
    requestAnimationFrame(loop);
    return;
  }

  if(!racing && countT > 0){
    countT -= dt;
    if(countT <= 0){ racing = true; goT = 0.9; }
  } else if(goT > 0) goT -= dt;

  if(racing && !player.finished) raceT += dt;

  const inp = {
    up:    !!(keys.z || keys.w || keys.arrowup),
    down:  !!(keys.s || keys.arrowdown),
    left:  !!(keys.q || keys.a || keys.arrowleft),
    right: !!(keys.d || keys.arrowright)
  };
  for(const c of CARS) updateCar(c, dt, c.isPlayer ? inp : null);
  resolveCars();
  if(racing && !player.finished) collectPieces();
  for(const c of CARS) if(c.isPlayer) updateFX(dt, c);
  for(const pd of PADS) if(pd.g) pd.g.scale.setScalar(1 + 0.04*Math.sin(gameT*5));
  for(const p of PIECES) if(!p.got) p.g.rotation.y += dt*3;
  for(const f of ANIM) f(gameT);
  tickFX(dt);
  updateEnvironment(dt);

  sun.position.set(player.x + 60, 140, player.z + 60);
  sun.target.position.set(player.x, 0, player.z);
  sun.target.updateMatrixWorld();

  updateCam(dt, firstFrame); firstFrame = false;
  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
};
/* ==========================================================
   PATCH 9 : GRAPHISMES DE LA CARTE
   - Terrain plus fin : chemins de terre, place du village,
     prairies, alpages, roche et neige sur la montagne
   - Vraie entrée de grotte : arche de rochers, falaise,
     poutres de mine, rails, wagonnet, torches, lianes, cristaux
   - Sortie de la grotte : arche avec la lumière du jour,
     rayons de lumière, poussière qui flotte
   - Herbe qui ondule au vent, buissons, fleurs, cailloux
   - Village : palissade, portails, panneaux, puits, marché,
     fanions, lampadaires le long des chemins
   - Lacs : eau animée, écume, nénuphars, ponton
   - Horizon : forêt en bordure, montagnes lointaines,
     soleil, nuages ronds
   - Personnages : visages des villageois et des gobelins,
     détails sur Greg (reflets dans les yeux, ceinture, logo…)
   À coller TOUT EN BAS du script, après le patch 8 (voiture).
   ========================================================== */
(function(){
if(window.__PATCH9) return;
window.__PATCH9 = true;

// Chaque partie est protégée : si une partie plante, les autres marchent quand même
const SAFE = (name, fn) => { try{ fn(); }catch(e){ console.warn('Patch 9 (' + name + ') :', e); } };
const TAU = Math.PI*2;
const sm = t => { t = clamp(t,0,1); return t*t*(3-2*t); };
const lam = (c, o={}) => new THREE.MeshLambertMaterial(Object.assign({color:c}, o));
const angDiff = (a,b) => Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b)));
const nz = (x,z) => Math.sin(x*0.071 + Math.cos(z*0.053)*2.1) * Math.cos(z*0.064 - Math.sin(x*0.041)*1.7);
const shadowAll = o => o.traverse(m => { if(m.isMesh){ m.castShadow = true; m.receiveShadow = true; } });
const ANIM = [];                                  // petites animations du décor
const U = {value:0};                              // temps pour le vent dans l'herbe

/* ---------- CHEMINS (du village vers la grotte et les lacs) ---------- */
const PATHS = [
  [[VIL.x,VIL.z], [-45,-10], [-60,-45], [MOUTH.x+3, MOUTH.z+3]],
  [[VIL.x,VIL.z], [15,0],   [42,-26]],
  [[VIL.x,VIL.z], [0,45],   [18,60]],
  [[VIL.x,VIL.z], [-70,30], [-102,36]]
];
const PATH_NAMES = ['⛰ Grotte', '🌊 Grand lac', '🌾 Lac aux roseaux', "🌊 Lac de l'ouest"];
function segDist(px,pz,ax,az,bx,bz){
  const dx = bx-ax, dz = bz-az, l2 = dx*dx + dz*dz;
  const t = clamp(((px-ax)*dx + (pz-az)*dz) / l2, 0, 1);
  return Math.hypot(px-ax-dx*t, pz-az-dz*t);
}
function pathDist(x,z){
  let d = 1e9;
  for(const P of PATHS) for(let i=0; i<P.length-1; i++)
    d = Math.min(d, segDist(x,z, P[i][0],P[i][1], P[i+1][0],P[i+1][1]));
  return d + Math.sin(x*0.13)*0.6 + Math.cos(z*0.11)*0.6;    // bords un peu irréguliers
}
// Points régulièrement espacés le long d'un chemin
function alongPath(P, stepLen){
  const out = [];
  let carry = 0;
  for(let i=0; i<P.length-1; i++){
    const [ax,az] = P[i], [bx,bz] = P[i+1], L = Math.hypot(bx-ax, bz-az);
    const dx = (bx-ax)/L, dz = (bz-az)/L;
    for(let s=carry; s<L; s+=stepLen) out.push({x:ax+dx*s, z:az+dz*s, dx, dz});
    carry = (carry - L) % stepLen; if(carry < 0) carry += stepLen;
  }
  return out;
}

/* ---------- CSS : voile sous l'eau, oxygène, minicarte, erreurs ---------- */
SAFE('css', () => {
  const st = document.createElement('style');
  st.textContent = `
    #under{position:fixed;inset:0;pointer-events:none;z-index:3;background:radial-gradient(ellipse at 50% 25%,rgba(80,190,235,.22),rgba(6,45,95,.62))}
    #oxyBox{position:fixed;top:160px;left:16px;background:rgba(0,0,0,.45);padding:8px 14px;border-radius:10px;border:2px solid rgba(255,255,255,.18)}
    #oxy div{background:linear-gradient(#bff2ff,#2a8fd6)}
    #minimap{position:fixed;right:16px;bottom:20px;width:200px;height:200px;border-radius:50%;box-shadow:0 0 0 3px #c9b79c,0 6px 20px #000}
    #errbox{position:fixed;left:10px;bottom:10px;background:#b00020;color:#fff;padding:8px 12px;border-radius:8px;z-index:99;max-width:80vw;font-size:13px}
  `;
  document.head.appendChild(st);
});

/* ---------- TERRAIN : plus de détails et vraies couleurs ---------- */
SAFE('terrain', () => {
  const geo = new THREE.PlaneGeometry(460, 460, 300, 300);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for(let i=0; i<pos.count; i++) pos.setY(i, getHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, cols = new Float32Array(pos.count*3);
  const C = h => new THREE.Color(h);
  const P = {g1:C(0x5dab3c), g2:C(0x479632), g3:C(0x7cc046), dry:C(0xb8b35c), alp:C(0x5c7a3a),
             dirt:C(0x8f6c44), path:C(0xc09868), plaza:C(0xb08a5c), sand:C(0xe3cf8f), mud:C(0x6b5636),
             rock:C(0x8c857b), rock2:C(0x6e6962), snow:C(0xf4f8ff)};
  const c = new THREE.Color();
  for(let i=0; i<pos.count; i++){
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nor.getY(i);
    const n = nz(x,z), n2 = nz(x*2.3+40, z*2.3-17);
    c.copy(P.g1).lerp(P.g2, clamp(n*0.5+0.5, 0, 1));                  // herbe
    c.lerp(P.g3, clamp(n2,0,1)*0.55);
    c.lerp(P.dry, clamp((n-0.5)*2, 0, 1)*0.7);                         // prairies sèches
    c.lerp(P.alp, sm((h-12)/8));                                       // alpages
    c.lerp(P.dirt, sm((h-19)/5)*0.6);
    c.lerp(n2 > 0 ? P.rock : P.rock2, Math.max(sm((h-23)/5), sm((0.9-ny)/0.08)));   // roche
    c.lerp(P.snow, sm((h-33)/3));                                      // neige au sommet
    if(h < 0.6)  c.lerp(P.mud, sm((0.6-h)/1.2)*0.7);                   // berges
    if(h < -1.4) c.lerp(P.sand, sm((-1.4-h)/0.8));                     // sable au fond
    const dv = hyp(x,z,VIL.x,VIL.z);
    c.lerp(P.plaza, (1 - sm((dv-8)/3))*0.85);                          // place du village
    if(h > -1.5 && h < 30) c.lerp(P.path, (1 - sm((pathDist(x,z)-1.5)/1.4))*0.9);   // chemins
    const v = 0.94 + Math.random()*0.1;
    cols[i*3] = c.r*v; cols[i*3+1] = c.g*v; cols[i*3+2] = c.b*v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const old = terrain.geometry;
  terrain.geometry = geo;
  old.dispose();
});

/* ---------- PANNEAUX EN BOIS (texte dessiné) ---------- */
const woodM = lam(0x6b4a2b, {map:TEX.bark});
function makeSign(text){
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = '#8a5a2b'; g.fillRect(0,0,256,96);
  g.fillStyle = 'rgba(0,0,0,.18)'; for(let y=0; y<96; y+=12) g.fillRect(0,y,256,2);
  g.strokeStyle = '#4a2e14'; g.lineWidth = 8; g.strokeRect(4,4,248,88);
  g.fillStyle = '#fff3d0'; g.font = 'bold 34px Fredoka, Trebuchet MS, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 50);
  const face = lam(0xffffff, {map:new THREE.CanvasTexture(cv)});
  const grp = new THREE.Group();
  const post = new THREE.Mesh(BOX, woodM); post.scale.set(0.16,2.2,0.16); post.position.y = 1.1; grp.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.9,0.72,0.1), [woodM,woodM,woodM,woodM,face,face]);
  board.position.y = 1.9; grp.add(board);
  shadowAll(grp);
  return grp;
}

/* ---------- ENTRÉE DE LA GROTTE ---------- */
SAFE('cave-mouth', () => {
  // On cache l'ancienne entrée (la boîte noire)
  worldScene.children.forEach(o => {
    if(o.isGroup && Math.abs(o.position.x-MOUTH.x) < 0.01 && Math.abs(o.position.z-MOUTH.z) < 0.01) o.visible = false;
  });

  // Repère local : z vers l'extérieur de la montagne, x sur le côté
  const th = Math.atan2(MOUTH.x-MOUNT.x, MOUTH.z-MOUNT.z);
  const fx = Math.sin(th), fz = Math.cos(th), rx = Math.cos(th), rz = -Math.sin(th);
  const W = (lx,lz) => ({x: MOUTH.x + rx*lx + fx*lz, z: MOUTH.z + rz*lx + fz*lz});
  const H = (lx,lz) => { const p = W(lx,lz); return getHeight(p.x, p.z); };
  const grp = new THREE.Group(); worldScene.add(grp);
  const y0 = H(0, 0.5), R = 2.6, LEG = 1.2;
  const put = (m, lx, ly, lz, ground) => {
    const p = W(lx,lz);
    m.position.set(p.x, (ground ? H(lx,lz) : y0) + ly, p.z);
    m.rotation.y = th; grp.add(m); return m;
  };

  const rockA = lam(0xffffff, {map:TEX.rock}), rockB = lam(0x8f877d, {map:TEX.rock}), rockC = lam(0x6c655d, {map:TEX.rock});
  const boulder = (lx,ly,lz,s,m,ground) => {
    const b = new THREE.Mesh(DODEC, m);
    b.scale.set(s*rnd(0.85,1.15), s*rnd(0.8,1.1), s*rnd(0.85,1.15));
    put(b, lx, ly, lz, ground);
    b.rotation.set(rnd(0,3), rnd(0,3), rnd(0,3));
    return b;
  };

  // Arche de rochers (2 couches) + falaise derrière
  const RA = R + 0.75, RB = R + 2.2;
  for(let i=0; i<=10; i++){ const a = i/10*Math.PI; boulder(Math.cos(a)*RA, LEG+Math.sin(a)*RA, 0.5, rnd(0.9,1.25), i%2 ? rockA : rockB); }
  for(const s of [-1,1]){ boulder(s*RA, 0.2, 0.5, 1.2, rockB); boulder(s*RA, 0.9, 0.6, 1.0, rockA); }
  for(let i=0; i<=8; i++){ const a = i/8*Math.PI; boulder(Math.cos(a)*RB, LEG+Math.sin(a)*RB-0.3, -0.6, rnd(1.4,1.9), rockC); }
  for(const s of [-1,1]) boulder(s*RB, 0.4, -0.2, 1.8, rockC);
  for(let i=0; i<16; i++) boulder(rnd(-8.5,8.5), rnd(2,8), rnd(-4.5,-1.5), rnd(2.2,3.8), [rockA,rockB,rockC][i%3]);
  for(const s of [-1,1]) for(let k=0; k<3; k++) boulder(s*rnd(5,8), 0.3, rnd(-1,2.5), rnd(1,1.8), rockB, true);

  // Le trou : une image de profondeur (rails qui s'enfoncent dans le noir)
  const hc = document.createElement('canvas'); hc.width = 280; hc.height = 210;
  const g = hc.getContext('2d');
  g.beginPath(); g.moveTo(10,210); g.lineTo(10,150); g.arc(140,150,130,Math.PI,0,false); g.lineTo(270,210); g.closePath();
  const gr = g.createRadialGradient(140,135,5,140,140,150);
  gr.addColorStop(0,'#000'); gr.addColorStop(0.45,'#030201'); gr.addColorStop(0.75,'#120c08'); gr.addColorStop(1,'#2e2219');
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(150,120,90,.55)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(100,212); g.lineTo(134,118); g.moveTo(180,212); g.lineTo(146,118); g.stroke();
  g.strokeStyle = 'rgba(110,80,50,.5)'; g.lineWidth = 2;
  for(let k=0; k<8; k++){
    const u = k/8, y = 210 - u*90, w = 44 - u*34;
    g.beginPath(); g.moveTo(140-w,y); g.lineTo(140+w,y); g.stroke();
  }
  const gl = g.createRadialGradient(140,110,0,140,110,24);
  gl.addColorStop(0,'rgba(255,170,80,.55)'); gl.addColorStop(1,'rgba(255,170,80,0)');
  g.fillStyle = gl; g.fillRect(100,80,80,70);
  g.shadowColor = '#66ffe0'; g.shadowBlur = 8; g.fillStyle = 'rgba(102,255,224,.85)';
  for(let k=0; k<7; k++) g.fillRect(rnd(60,220), rnd(60,170), 2, 3);
  g.restore();
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(2*R+0.4, LEG+R+0.4),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(hc), alphaTest:0.5}));
  put(hole, 0, -0.25 + (LEG+R+0.4)/2, -0.2);

  // Poutres de mine + lanterne
  const postH = LEG + R*0.62;
  for(const s of [-1,1]){ const p = new THREE.Mesh(BOX, woodM); p.scale.set(0.32, postH, 0.32); put(p, s*(R-0.35), postH/2-0.2, 0.15); }
  const lintel = new THREE.Mesh(BOX, woodM); lintel.scale.set(2*R-0.2, 0.34, 0.38); put(lintel, 0, postH-0.2, 0.15);
  const lampM = lam(0xffd27a, {emissive:0xffa53a});
  const lantern = new THREE.Mesh(BOX, lampM); lantern.scale.set(0.26,0.32,0.26); put(lantern, 0, postH-0.75, 0.25);
  const chain = new THREE.Mesh(BOX, lam(0x333333)); chain.scale.set(0.03,0.3,0.03); put(chain, 0, postH-0.45, 0.25);

  // Stalactites sous l'arche
  for(let k=0; k<6; k++){
    const a = 0.85 + k/5*1.45, h = rnd(0.4,0.8), st = new THREE.Mesh(CONE, rockB);
    st.scale.set(0.18, h, 0.18); put(st, Math.cos(a)*R*0.92, LEG + Math.sin(a)*R - h/2 + 0.1, 0.55);
    st.rotation.x = Math.PI;
  }

  // Lianes qui pendent et se balancent
  const vineM = lam(0x3f8f3a), leafM = lam(0x5fb84a);
  for(let k=0; k<8; k++){
    const a = 0.4 + k/7*2.35, len = rnd(0.8,2.2);
    const v = new THREE.Group(); put(v, Math.cos(a)*(RA+0.3), LEG + Math.sin(a)*(RA+0.3) - 0.2, 1.1);
    const s = new THREE.Mesh(BOX, vineM); s.scale.set(0.05,len,0.05); s.position.y = -len/2; v.add(s);
    for(let j=0; j<4; j++){ const l = new THREE.Mesh(BOX, leafM); l.scale.set(0.18,0.06,0.12); l.position.set(rnd(-0.06,0.06), -len*(j+0.5)/4, 0); l.rotation.y = rnd(0,3); v.add(l); }
    const ph = rnd(0,6);
    ANIM.push(t => { v.rotation.z = Math.sin(t*1.3+ph)*0.08; });
  }
  // Mousse sur le haut de l'arche
  for(let k=0; k<7; k++){
    const a = 0.5 + k/6*2.1, m = new THREE.Mesh(SPH, lam(0x4f8f35));
    m.scale.set(rnd(0.5,0.9), 0.18, rnd(0.5,0.8)); put(m, Math.cos(a)*RA, LEG + Math.sin(a)*RA + 0.75, 0.6);
  }
  // Cristaux qui sortent de la roche
  const crysM = lam(0x66ffe0, {emissive:0x1a9a80});
  for(let k=0; k<6; k++){
    const a = rnd(0.2, Math.PI-0.2), c = new THREE.Mesh(new THREE.OctahedronGeometry(1,0), crysM);
    c.scale.set(0.25, rnd(0.6,1.0), 0.25); put(c, Math.cos(a)*(RB+0.3), LEG + Math.sin(a)*(RB+0.3), 0.6);
    c.rotation.z = rnd(-0.6,0.6);
  }

  // Torches + une lumière qui vacille
  const flameO = new THREE.MeshBasicMaterial({color:0xff7a1a}), flameI = new THREE.MeshBasicMaterial({color:0xffe14d});
  for(const s of [-1,1]){
    const lx = s*(R+2.1), lz = 1.8;
    const pole = new THREE.Mesh(BOX, woodM); pole.scale.set(0.2,2.4,0.2); put(pole, lx, 1.2, lz, true);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.18,0.3,8), lam(0x2a2a2a)); put(cup, lx, 2.5, lz, true);
    const f1 = new THREE.Mesh(CONE, flameO); f1.scale.set(0.3,0.8,0.3); put(f1, lx, 2.95, lz, true);
    const f2 = new THREE.Mesh(CONE, flameI); f2.scale.set(0.16,0.5,0.16); put(f2, lx, 2.85, lz, true);
    const ph = rnd(0,6);
    ANIM.push(t => {
      const k = 1 + Math.sin(t*14+ph)*0.15 + Math.sin(t*23+ph)*0.08;
      f1.scale.y = 0.8*k; f2.scale.y = 0.5*(2-k);
    });
    const p = W(lx,lz); COL.push({x:p.x, z:p.z, r:0.3});
  }
  const tl = new THREE.PointLight(0xff8a3c, 1.4, 16, 1.5); put(tl, 0, 3.2, 2.2, true);
  ANIM.push(t => { tl.intensity = 1.3 + Math.sin(t*13)*0.2 + Math.sin(t*5.1)*0.12; });

  // Rails de mine qui sortent de la grotte
  const railM = lam(0x8a8a8a), sleeperM = lam(0x5a3a1a);
  const seg = (lx, lzA, lzB, sx, sy, m, yOff) => {
    const yA = H(lx,lzA), yB = H(lx,lzB), len = Math.abs(lzB-lzA), p = W(lx,(lzA+lzB)/2);
    const b = new THREE.Mesh(BOX, m); b.scale.set(sx, sy, len);
    b.position.set(p.x, (yA+yB)/2 + yOff, p.z);
    b.rotation.order = 'YXZ'; b.rotation.y = th; b.rotation.x = Math.atan2(yA-yB, len);
    b.castShadow = b.receiveShadow = true; grp.add(b); return b;
  };
  for(let lz=-0.1; lz<6; lz+=1){ seg(-0.55, lz, lz+1, 0.08, 0.1, railM, 0.12); seg(0.55, lz, lz+1, 0.08, 0.1, railM, 0.12); }
  for(let lz=0; lz<6; lz+=0.7){ const s = seg(0, lz, lz+0.3, 1.6, 0.1, sleeperM, 0.03); s.scale.x = 1.6; }

  // Wagonnet renversé, rempli de pierres et d'un cristal
  const cart = new THREE.Group();
  const cartM = lam(0x5a4a3a), ironM = lam(0x444444);
  part(cart, 1.4, 0.6, 1.0, 0x5a4a3a, 0, 0.55, 0);
  part(cart, 1.5, 0.08, 1.1, 0x444444, 0, 0.88, 0);
  for(const sx of [-0.5,0.5]) for(const sz of [-0.55,0.55]){
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.1,10), ironM);
    w.rotation.x = Math.PI/2; w.position.set(sx, 0.22, sz); cart.add(w);
  }
  for(let k=0; k<5; k++){ const r = new THREE.Mesh(DODEC, rockB); r.scale.setScalar(rnd(0.2,0.32)); r.position.set(rnd(-0.45,0.45), 0.95, rnd(-0.3,0.3)); cart.add(r); }
  const cc = new THREE.Mesh(new THREE.OctahedronGeometry(0.25,0), crysM); cc.scale.y = 1.8; cc.position.set(0.2,1.15,0); cart.add(cc);
  put(cart, 2.4, 0, 3.2, true); cart.rotation.y = th + 0.5; cart.rotation.z = 0.12;
  shadowAll(cart); void cartM;
  { const p = W(2.4,3.2); COL.push({x:p.x, z:p.z, r:0.9}); }

  // Os de dinosaure (cage thoracique) à côté de l'entrée
  const boneM = lam(0xe8e0c8);
  for(let k=0; k<4; k++){
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.8-k*0.08, 0.07, 5, 10, Math.PI), boneM);
    put(rib, -5.2 + k*0.45, 0, 3.4, true);
    rib.rotation.y = th + Math.PI/2;
  }
  const spine = new THREE.Mesh(BOX, boneM); spine.scale.set(0.12,0.12,2.2); put(spine, -4.5, 0.05, 3.4, true); spine.rotation.y = th + Math.PI/2;

  // Panneau
  const sign = makeSign('⛰ GROTTE');
  put(sign, -4.4, -0.1, 5, true);

  // Collisions : la falaise et les piliers
  { const p = W(0,-1.3); COL.push({x:p.x, z:p.z, r:2.4}); }
  for(const s of [-1,1]){ const p = W(s*RA,0.5); COL.push({x:p.x, z:p.z, r:1.2}); }
  shadowAll(grp);
  hole.castShadow = false;
});

/* ---------- SORTIE DE LA GROTTE (vue sur le jour) ---------- */
SAFE('cave-exit', () => {
  const S = caveScene, cx = ROOM.x, cz = ROOM.z, WR = ROOM.r + 1;
  S.children.forEach(o => {   // on cache l'ancien portail bleu
    if(o.isMesh && Math.abs(o.position.x-cx) < 0.01 && Math.abs(o.position.z-(cz+WR)) < 0.01 && Math.abs(o.position.y-3) < 0.01) o.visible = false;
  });
  const ec = document.createElement('canvas'); ec.width = 208; ec.height = 248;
  const g = ec.getContext('2d');
  g.beginPath(); g.moveTo(8,248); g.lineTo(8,112); g.arc(104,112,96,Math.PI,0,false); g.lineTo(200,248); g.closePath();
  g.save(); g.clip();
  const sky = g.createLinearGradient(0,16,0,248);
  sky.addColorStop(0,'#7cc8ff'); sky.addColorStop(0.6,'#dff4ff'); sky.addColorStop(1,'#fff6d8');
  g.fillStyle = sky; g.fillRect(0,0,208,248);
  const hill = (col, base, amp, f, ph) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0,248);
    for(let x=0; x<=208; x+=8) g.lineTo(x, base - amp*Math.sin(x*f+ph));
    g.lineTo(208,248); g.fill();
  };
  hill('#a8d98a', 185, 16, 0.04, 1);
  g.fillStyle = '#3f8a3a';
  for(let x=10; x<208; x+=22){ g.beginPath(); g.moveTo(x,200); g.lineTo(x+7,170+(x%3)*5); g.lineTo(x+14,200); g.fill(); }
  hill('#5fae45', 215, 10, 0.07, 0);
  const glw = g.createRadialGradient(104,140,10,104,140,140);
  glw.addColorStop(0,'rgba(255,255,255,.85)'); glw.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = glw; g.fillRect(0,0,208,248);
  g.restore();
  const day = new THREE.Mesh(new THREE.PlaneGeometry(5.2,6.2),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(ec), alphaTest:0.5, fog:false}));
  day.position.set(cx, 3.1, cz+WR+1.4); day.rotation.y = Math.PI; S.add(day);

  // Arche de rochers autour de l'ouverture
  const rm = lam(0xb7a894, {map:TEX.rock});
  const RA = 3.1, LEG = 3.4;
  for(let i=0; i<=10; i++){
    const a = i/10*Math.PI, b = new THREE.Mesh(DODEC, i%2 ? rm : rockMat);
    b.scale.setScalar(rnd(1.0,1.4)); b.position.set(cx+Math.cos(a)*RA, LEG+Math.sin(a)*RA, cz+WR+0.4);
    b.rotation.set(rnd(0,3),rnd(0,3),0); S.add(b);
  }
  for(const s of [-1,1]) for(let k=0; k<3; k++){
    const b = new THREE.Mesh(DODEC, rockMat); b.scale.setScalar(rnd(1.0,1.3));
    b.position.set(cx+s*RA, k*1.2+0.4, cz+WR+0.4); b.rotation.set(rnd(0,3),rnd(0,3),0); S.add(b);
  }
  for(let k=0; k<5; k++){
    const b = new THREE.Mesh(DODEC, rm); b.scale.setScalar(rnd(1.4,2));
    b.position.set(cx+rnd(-3,3), rnd(7.5,9.5), cz+WR+0.6); b.rotation.set(rnd(0,3),rnd(0,3),0); S.add(b);
  }

  // Rayons de lumière (cônes transparents, pointe vers l'ouverture)
  const rayGeo = new THREE.ConeGeometry(2.4, 16, 14, 1, true); rayGeo.translate(0,-8,0);
  const rayM = new THREE.MeshBasicMaterial({color:0xcfefff, transparent:true, opacity:0.08, depthWrite:false,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false});
  const down = new THREE.Vector3(0,-1,0);
  const rays = [];
  for(const o of [-1.2, 0, 1.3]){
    const r = new THREE.Mesh(rayGeo, rayM);
    r.position.set(cx+o, 5.2, cz+WR+0.8);
    r.quaternion.setFromUnitVectors(down, new THREE.Vector3(o*0.04, -0.28, -1).normalize());
    r.scale.set(rnd(0.7,1.1), 1, rnd(0.7,1.1)); S.add(r); rays.push(r);
  }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.5, 24),
    new THREE.MeshBasicMaterial({color:0xcfefff, transparent:true, opacity:0.22, depthWrite:false, blending:THREE.AdditiveBlending, fog:false}));
  pool.rotation.x = -Math.PI/2; pool.position.set(cx, 0.05, cz+WR-4); S.add(pool);

  // Rayon de lumière au-dessus du cristal
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(4.5, 12, 16, 1, true).translate(0,-6,0),
    new THREE.MeshBasicMaterial({color:0x9fe7ff, transparent:true, opacity:0.05, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false}));
  shaft.position.set(cx, 12.5, cz); S.add(shaft);
  ANIM.push(t => {
    rayM.opacity = 0.07 + Math.sin(t*0.8)*0.02;
    shaft.material.opacity = 0.045 + Math.sin(t*1.1)*0.015;
  });

  // Poussière qui flotte dans la grotte
  const N = 260, dp = new Float32Array(N*3), base = [];
  for(let i=0; i<N; i++){
    const a = rnd(0,TAU), d = Math.sqrt(Math.random())*30;
    base.push({x:cx+Math.cos(a)*d, y:rnd(0.5,10), z:cz+Math.sin(a)*d, ph:rnd(0,6)});
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp,3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({color:0xffe6c0, size:0.09, transparent:true, opacity:0.55, depthWrite:false}));
  dust.frustumCulled = false; S.add(dust);
  ANIM.push((t,dt) => {
    if(zone !== 'cave') return;
    for(let i=0; i<N; i++){
      const b = base[i];
      b.y += dt*0.15; if(b.y > 10.5) b.y = 0.3;
      dp[i*3] = b.x + Math.sin(t*0.3+b.ph)*0.8;
      dp[i*3+1] = b.y;
      dp[i*3+2] = b.z + Math.cos(t*0.25+b.ph)*0.8;
    }
    dg.attributes.position.needsUpdate = true;
  });
});

/* ---------- VILLAGE ---------- */
SAFE('village', () => {
  const FR = VIL.r + 3;
  const D = new THREE.Object3D();

  // Angles où les chemins traversent la palissade (= portails)
  const gates = [];
  PATHS.forEach((P, pi) => {
    for(const p of alongPath(P, 0.25)){
      if(hyp(p.x,p.z,VIL.x,VIL.z) >= FR){ gates.push({a:Math.atan2(p.z-VIL.z, p.x-VIL.x), name:PATH_NAMES[pi], dx:p.dx, dz:p.dz}); return; }
    }
  });

  // Palissade (poteaux + 2 barres), avec collisions
  const step = 1.45/FR, posts = [];
  for(let a=0; a<TAU-step*0.5; a+=step) if(gates.every(gt => angDiff(a,gt.a) > 0.12)) posts.push(a);
  const pGeo = new THREE.BoxGeometry(0.22,1.5,0.22); pGeo.translate(0,0.75,0);
  const pim = new THREE.InstancedMesh(pGeo, woodM, posts.length);
  const rim = new THREE.InstancedMesh(new THREE.BoxGeometry(1,0.1,0.08), woodM, posts.length*2);
  let nr = 0;
  posts.forEach((a,i) => {
    const x = VIL.x+Math.cos(a)*FR, z = VIL.z+Math.sin(a)*FR, y = getHeight(x,z);
    D.position.set(x, y-0.05, z); D.rotation.set(0, -a, rnd(-0.05,0.05)); D.scale.set(1, rnd(0.9,1.1), 1); D.updateMatrix();
    pim.setMatrixAt(i, D.matrix);
    COL.push({x, z, r:0.35});
    const b = posts[(i+1) % posts.length];
    if(angDiff(a,b) > step*1.5) return;
    const x2 = VIL.x+Math.cos(b)*FR, z2 = VIL.z+Math.sin(b)*FR, y2 = getHeight(x2,z2);
    const len = Math.hypot(x2-x, z2-z), yaw = Math.atan2(-(z2-z), x2-x);
    for(const hh of [0.55, 1.1]){
      D.position.set((x+x2)/2, (y+y2)/2+hh, (z+z2)/2); D.rotation.set(0,yaw,0); D.scale.set(len,1,1); D.updateMatrix();
      rim.setMatrixAt(nr++, D.matrix);
    }
  });
  rim.count = nr;
  [pim, rim].forEach(m => { m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; worldScene.add(m); });

  // Portails + bannières + panneaux
  const banM = [lam(0xd33a2a,{side:THREE.DoubleSide}), lam(0xe8c13a,{side:THREE.DoubleSide})];
  const lampM = lam(0xffd27a, {emissive:0xffa53a});
  gates.forEach(gt => {
    const pts = [gt.a-0.1, gt.a+0.1].map(a => ({x:VIL.x+Math.cos(a)*FR, z:VIL.z+Math.sin(a)*FR}));
    const grp = new THREE.Group();
    pts.forEach((p,i) => {
      const y = getHeight(p.x,p.z);
      const post = new THREE.Mesh(BOX, woodM); post.scale.set(0.32,3.8,0.32); post.position.set(p.x, y+1.9, p.z); grp.add(post);
      const lamp = new THREE.Mesh(BOX, lampM); lamp.scale.setScalar(0.28); lamp.position.set(p.x, y+3.0, p.z); grp.add(lamp);
      COL.push({x:p.x, z:p.z, r:0.35});
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.7,1.4), banM[i]);
      ban.position.set(p.x, y+2.6, p.z); ban.rotation.y = -gt.a; grp.add(ban);
      const ph = rnd(0,6); ANIM.push(t => { ban.rotation.x = Math.sin(t*2+ph)*0.12; });
    });
    const ya = getHeight(pts[0].x,pts[0].z), yb = getHeight(pts[1].x,pts[1].z);
    const len = Math.hypot(pts[1].x-pts[0].x, pts[1].z-pts[0].z) + 0.8;
    const beam = new THREE.Mesh(BOX, woodM); beam.scale.set(len, 0.35, 0.4);
    beam.position.set((pts[0].x+pts[1].x)/2, Math.max(ya,yb)+3.75, (pts[0].z+pts[1].z)/2);
    beam.rotation.y = Math.atan2(-(pts[1].z-pts[0].z), pts[1].x-pts[0].x); grp.add(beam);
    const roof = new THREE.Mesh(BOX, lam(0xb5452a)); roof.scale.set(len+0.4, 0.15, 1.0);
    roof.position.copy(beam.position); roof.position.y += 0.25; roof.rotation.y = beam.rotation.y; grp.add(roof);
    shadowAll(grp); worldScene.add(grp);
    // panneau à l'extérieur, tourné vers le village
    const sa = gt.a + 0.17, sx = VIL.x+Math.cos(sa)*(FR+3.5), sz = VIL.z+Math.sin(sa)*(FR+3.5);
    const sign = makeSign(gt.name);
    sign.position.set(sx, getHeight(sx,sz)-0.1, sz);
    sign.rotation.y = Math.atan2(VIL.x-sx, VIL.z-sz);
    worldScene.add(sign); COL.push({x:sx, z:sz, r:0.3});
  });

  const at = (dx,dz) => ({x:VIL.x+dx, z:VIL.z+dz, y:getHeight(VIL.x+dx, VIL.z+dz)});

  // Pierres et bancs autour du feu
  { const f = at(4,3);
    for(let k=0; k<9; k++){
      const a = k/9*TAU, s = new THREE.Mesh(DODEC, rockMat); s.scale.set(0.28,0.2,0.28);
      s.position.set(f.x+Math.cos(a)*0.95, f.y+0.1, f.z+Math.sin(a)*0.95); s.rotation.y = rnd(0,3);
      s.castShadow = true; worldScene.add(s);
    }
    for(const a of [0.6, 2.4, 4.2]){
      const b = new THREE.Mesh(CYL, woodM); b.scale.set(0.28,1.8,0.28);
      b.position.set(f.x+Math.cos(a)*2.6, f.y+0.25, f.z+Math.sin(a)*2.6);
      b.rotation.order = 'YXZ'; b.rotation.y = -a; b.rotation.x = Math.PI/2;
      b.castShadow = b.receiveShadow = true; worldScene.add(b);
    }
  }

  // Puits
  { const p = at(-10,9), g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.2,0.9,14,1,true), lam(0xffffff,{map:TEX.rock, side:THREE.DoubleSide}));
    ring.position.y = 0.45; g.add(ring);
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(1.12,0.13,6,18), lam(0x8a847b)); rimT.rotation.x = Math.PI/2; rimT.position.y = 0.9; g.add(rimT);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.05,16), new THREE.MeshPhongMaterial({color:0x1d5f8a, shininess:120}));
    water.rotation.x = -Math.PI/2; water.position.y = 0.55; g.add(water);
    for(const s of [-1,1]) part(g, 0.16, 2.3, 0.16, 0x6b4a2b, s*1.0, 1.15, 0);
    part(g, 2.2, 0.12, 0.12, 0x5a3a1a, 0, 1.9, 0);
    part(g, 0.03, 0.6, 0.03, 0xccb08a, 0, 1.55, 0);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.14,0.28,10), lam(0x7a5230)); bucket.position.y = 1.15; g.add(bucket);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8,1.1,4), lam(0xb5452a)); roof.rotation.y = Math.PI/4; roof.position.y = 2.75; g.add(roof);
    g.position.set(p.x, p.y, p.z); shadowAll(g); worldScene.add(g);
    COL.push({x:p.x, z:p.z, r:1.3});
  }

  // Étal du marché (toile rayée, fruits, poissons, tonneaux, caisses)
  { const p = at(3,-12), g = new THREE.Group();
    const sc = document.createElement('canvas'); sc.width = 64; sc.height = 64;
    const sg = sc.getContext('2d');
    for(let i=0; i<8; i++){ sg.fillStyle = i%2 ? '#ffffff' : '#d33a2a'; sg.fillRect(i*8,0,8,64); }
    part(g, 2.6, 0.12, 1.2, 0x8a5a2b, 0, 1.0, 0);
    part(g, 2.5, 0.9, 1.0, 0x6b4a2b, 0, 0.5, 0.05);
    for(const sx of [-1.2,1.2]) for(const sz of [-0.55,0.55]) part(g, 0.12, 2.6, 0.12, 0x5a3a1a, sx, 1.3, sz);
    const can = new THREE.Mesh(BOX, lam(0xffffff,{map:new THREE.CanvasTexture(sc)}));
    can.scale.set(2.9, 0.12, 1.7); can.position.set(0, 2.6, 0.15); can.rotation.x = 0.18; g.add(can);
    const fruit = [0xd42a2a, 0xffa62b, 0xe8c13a, 0x7a4ad9];
    for(let k=0; k<14; k++){
      const f = new THREE.Mesh(SPH, lam(fruit[k%4])); f.scale.setScalar(0.13);
      f.position.set(rnd(-1.1,0.2), 1.15, rnd(-0.4,0.4)); g.add(f);
    }
    for(let k=0; k<3; k++){
      const f = new THREE.Mesh(SPH, lam(0x9fc0d0)); f.scale.set(0.35,0.1,0.13);
      f.position.set(0.5+k*0.25, 1.12, rnd(-0.3,0.3)); f.rotation.y = rnd(-0.4,0.4); g.add(f);
    }
    g.position.set(p.x, p.y, p.z); g.rotation.y = Math.atan2(VIL.x-p.x, VIL.z-p.z);
    shadowAll(g); worldScene.add(g); COL.push({x:p.x, z:p.z, r:1.6});
  }
  const barrel = (dx,dz) => {
    const p = at(dx,dz), g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.38,1,12), lam(0x8a5a2b)); b.position.y = 0.5; g.add(b);
    for(const y of [0.2,0.8]){ const r = new THREE.Mesh(new THREE.CylinderGeometry(0.44,0.44,0.07,12), lam(0x333333)); r.position.y = y; g.add(r); }
    g.position.set(p.x,p.y,p.z); shadowAll(g); worldScene.add(g); COL.push({x:p.x, z:p.z, r:0.5});
  };
  const crate = (dx,dz) => {
    const p = at(dx,dz), g = new THREE.Group();
    part(g, 0.8, 0.8, 0.8, 0xa0743f, 0, 0.4, 0);
    const x1 = part(g, 1.05, 0.1, 0.02, 0x6b4a2b, 0, 0.4, -0.41); x1.rotation.z = 0.78;
    const x2 = part(g, 1.05, 0.1, 0.02, 0x6b4a2b, 0, 0.4, -0.41); x2.rotation.z = -0.78;
    g.position.set(p.x,p.y,p.z); g.rotation.y = rnd(0,3); worldScene.add(g); COL.push({x:p.x, z:p.z, r:0.55});
  };
  barrel(6,-13.5); barrel(6.9,-12.8); crate(-0.5,-13.8); crate(-8.5,10.8); barrel(-12,7);

  // Mâts et fanions de fête au-dessus de la place
  const poles = [1.25, 2.6, 4.0, 5.3].map(a => at(Math.cos(a)*9.5, Math.sin(a)*9.5));
  poles.forEach(p => {
    const m = new THREE.Mesh(BOX, woodM); m.scale.set(0.18,4.6,0.18); m.position.set(p.x, p.y+2.3, p.z);
    m.castShadow = true; worldScene.add(m); COL.push({x:p.x, z:p.z, r:0.25});
  });
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.2,0,0, 0.2,0,0, 0,-0.42,0], 3));
  flagGeo.computeVertexNormals();
  const flagM = [0xd33a2a,0xe8c13a,0x3fa34d,0x2f6fd6,0xe07ab0].map(c => lam(c, {side:THREE.DoubleSide}));
  const strM = new THREE.LineBasicMaterial({color:0x3a2a1a});
  for(let i=0; i<poles.length; i++){
    const A = poles[i], B = poles[(i+1) % poles.length];
    const pt = u => new THREE.Vector3(lerp(A.x,B.x,u), lerp(A.y,B.y,u)+4.4 - 0.9*4*u*(1-u), lerp(A.z,B.z,u));
    const linePts = []; for(let k=0; k<=20; k++) linePts.push(pt(k/20));
    worldScene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), strM));
    const yaw = Math.atan2(-(B.z-A.z), B.x-A.x);
    for(let k=1; k<14; k++){
      const f = new THREE.Mesh(flagGeo, flagM[(k+i)%5]);
      f.position.copy(pt(k/14)); f.rotation.y = yaw; worldScene.add(f);
      const ph = rnd(0,6); ANIM.push(t => { f.rotation.x = Math.sin(t*2.2+ph)*0.25; });
    }
  }

  // Petits massifs de fleurs devant les maisons
  const stemM = lam(0x3f8a2c), FLC = [0xff5577,0xffd34d,0xc68bff,0xffffff,0xff9a3c].map(c => lam(c));
  for(let k=0; k<5; k++){
    const a = k*1.26+0.5, hx = Math.cos(a)*15, hz = Math.sin(a)*15;
    const ix = -Math.cos(a), iz = -Math.sin(a), lx = -iz, lz = ix;
    for(const s of [-1,1]){
      const bx = hx + ix*1.5 + lx*s*1.3, bz = hz + iz*1.5 + lz*s*1.3;
      for(let j=0; j<6; j++){
        const p = at(bx+rnd(-0.4,0.4), bz+rnd(-0.4,0.4));
        const st = new THREE.Mesh(CYL, stemM); st.scale.set(0.03,0.45,0.03); st.position.set(p.x, p.y+0.22, p.z); worldScene.add(st);
        const hd = new THREE.Mesh(SPH, FLC[(j+k)%5]); hd.scale.setScalar(0.12); hd.position.set(p.x, p.y+0.48, p.z); worldScene.add(hd);
      }
    }
  }

  // Lampadaires le long des chemins (hors du village)
  const poleM = lam(0x3a2a1a);
  PATHS.forEach(P => {
    let side = 1;
    for(const p of alongPath(P, 18)){
      if(hyp(p.x,p.z,VIL.x,VIL.z) < FR+5) continue;
      if(hyp(p.x,p.z,MOUTH.x,MOUTH.z) < 10) continue;
      const x = p.x + (-p.dz)*2.6*side, z = p.z + p.dx*2.6*side; side = -side;
      const y = getHeight(x,z); if(y < -1) continue;
      const g = new THREE.Group();
      const m = new THREE.Mesh(BOX, poleM); m.scale.set(0.14,2.6,0.14); m.position.y = 1.3; g.add(m);
      const arm = new THREE.Mesh(BOX, poleM); arm.scale.set(0.5,0.08,0.08); arm.position.set(0.22,2.55,0); g.add(arm);
      const lamp = new THREE.Mesh(BOX, lampM); lamp.scale.set(0.26,0.3,0.26); lamp.position.set(0.42,2.3,0); g.add(lamp);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24,0.2,4), poleM); cap.rotation.y = Math.PI/4; cap.position.set(0.42,2.55,0); g.add(cap);
      g.position.set(x,y,z); g.rotation.y = Math.atan2(p.dx, p.dz) + (side > 0 ? 0 : Math.PI) + Math.PI/2;
      shadowAll(g); worldScene.add(g); COL.push({x, z, r:0.25});
    }
  });
});

/* ---------- LACS : eau animée, écume, nénuphars, ponton ---------- */
SAFE('water', () => {
  const wt = makeTex(256, (g,s) => {
    g.fillStyle = '#d4ecf6'; g.fillRect(0,0,s,s);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    for(let i=0; i<40; i++){
      const y = rnd(0,s), x = rnd(0,s), w = rnd(20,60);
      g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+w/2, y-rnd(3,7), x+w, y); g.stroke();
    }
    g.fillStyle = 'rgba(40,100,150,.12)';
    for(let i=0; i<30; i++){ g.beginPath(); g.arc(rnd(0,s), rnd(0,s), rnd(8,24), 0, TAU); g.fill(); }
  }, 6);
  waterMat.map = wt; waterMat.color.set(0x3aa8dc); waterMat.shininess = 140; waterMat.opacity = 0.74;
  waterMat.needsUpdate = true;

  const foamM = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.35, depthWrite:false});
  const padM = lam(0x3f9a3a, {side:THREE.DoubleSide}), lotus = lam(0xff9ac8);
  LAKES.forEach((L, li) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(L.r*0.97-1.0, L.r*0.97+0.4, 64), foamM);
    ring.rotation.x = -Math.PI/2; ring.position.set(L.x, WL+0.04, L.z); worldScene.add(ring);
    for(let k=0; k<10; k++){
      const a = rnd(0,TAU), d = rnd(0.45,0.85)*L.r, s = rnd(0.45,0.8);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 12, 0.3, 5.8), padM);
      pad.rotation.x = -Math.PI/2; pad.rotation.z = rnd(0,TAU); pad.scale.setScalar(s);
      pad.position.set(L.x+Math.cos(a)*d, WL+0.08, L.z+Math.sin(a)*d); worldScene.add(pad);
      if(k%3 === 0){ const f = new THREE.Mesh(CONE, lotus); f.scale.set(0.16,0.2,0.16); f.position.copy(pad.position); f.position.y += 0.1; worldScene.add(f); }
    }
    for(let k=0; k<12; k++){
      const a = rnd(0,TAU), d = L.r*rnd(0.95,1.1), s = rnd(0.5,1.3);
      const x = L.x+Math.cos(a)*d, z = L.z+Math.sin(a)*d;
      const r = new THREE.Mesh(DODEC, rockMat); r.scale.set(s, s*0.6, s);
      r.position.set(x, getHeight(x,z)-0.15, z); r.rotation.set(rnd(0,3),rnd(0,3),0);
      r.castShadow = r.receiveShadow = true; worldScene.add(r);
    }
    if(li === 0){                               // ponton en bois
      const dx = VIL.x-L.x, dz = VIL.z-L.z, dl = Math.hypot(dx,dz), ux = dx/dl, uz = dz/dl;
      const g = new THREE.Group();
      for(let k=0; k<16; k++){
        const p = part(g, 2.2, 0.12, 0.42, k%2 ? 0x9a6b3c : 0x8a5a2b, 0, 0, -k*0.55);
        p.rotation.y = rnd(-0.03,0.03);
      }
      for(const sx of [-1,1]) for(let k=0; k<4; k++) part(g, 0.2, 3, 0.2, 0x5a3a1a, sx*1.05, -1.4, -k*2.6);
      const sx0 = L.x + ux*(L.r*0.97+1.2), sz0 = L.z + uz*(L.r*0.97+1.2);
      g.position.set(sx0, WL+0.5, sz0); g.rotation.y = Math.atan2(ux, uz);
      worldScene.add(g);
    }
  });
  ANIM.push(t => {
    wt.offset.set(t*0.012, t*0.007);
    foamM.opacity = 0.28 + Math.sin(t*1.5)*0.1;
  });
});

/* ---------- ARBRES : feuillage plus touffu ---------- */
SAFE('trees', () => {
  const LEAF = [0x3f8f3a,0x4f9e3c,0x357a32,0x62a845,0x2f6b2e].map(c => lam(c));
  TREES.forEach(t => {
    const g = t.g, h = g.children[0] ? g.children[0].scale.y : 3;
    const add = (geo, m, x, y, z, s) => { const o = new THREE.Mesh(geo, m); o.position.set(x,y,z); o.scale.setScalar(s); o.castShadow = true; g.add(o); return o; };
    const L = () => LEAF[Math.floor(rnd(0,LEAF.length))];
    if(t.kind === 'chene' || t.kind === 'pommier'){
      for(let k=0; k<2; k++) add(BLOB, L(), rnd(-1.3,1.3), h+rnd(-0.2,1.5), rnd(-1.3,1.3), rnd(0.8,1.2));
    } else if(t.kind === 'bouleau'){
      for(let k=0; k<2; k++) add(DODEC, L(), rnd(-0.8,0.8), h+rnd(0.2,1.4), rnd(-0.8,0.8), rnd(0.7,1.0));
    } else if(t.kind === 'pin'){
      const c = add(CONE, TREE_MAT.pin, 0, h+3.3, 0, 1); c.scale.set(0.6,1.4,0.6);
    } else if(t.kind === 'palmier'){
      for(let k=0; k<3; k++){ const a = k/3*TAU; add(SPH, lam(0x6b4a2b), Math.cos(a)*0.25, h-0.1, Math.sin(a)*0.25, 0.2); }
    }
  });
});

/* ---------- Outils pour les objets en grand nombre ---------- */
const DUM = new THREE.Object3D(), TC = new THREE.Color();
function inst(geo, m, n, shadow){
  const im = new THREE.InstancedMesh(geo, m, n);
  im.frustumCulled = false; im.castShadow = !!shadow; im.receiveShadow = true;
  im.userData.n = 0; worldScene.add(im); return im;
}
function setI(im, x,y,z, ry, sx,sy,sz, color){
  const i = im.userData.n; if(i >= im.instanceMatrix.count) return;
  im.userData.n++;
  DUM.position.set(x,y,z); DUM.rotation.set(0,ry,0); DUM.scale.set(sx,sy,sz); DUM.updateMatrix();
  im.setMatrixAt(i, DUM.matrix);
  if(color) im.setColorAt(i, color);
}
function doneI(im){
  im.count = im.userData.n; im.instanceMatrix.needsUpdate = true;
  if(im.instanceColor) im.instanceColor.needsUpdate = true;
}
// Grille pour vérifier vite les collisions
let GRID = null;
function buildGrid(){
  GRID = new Map();
  for(const c of COL){ const k = Math.floor(c.x/8) + ',' + Math.floor(c.z/8); if(!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(c); }
}
function nearCol(x,z,r){
  const ix = Math.floor(x/8), iz = Math.floor(z/8);
  for(let a=-1; a<=1; a++) for(let b=-1; b<=1; b++){
    const L = GRID.get((ix+a) + ',' + (iz+b));
    if(L) for(const c of L) if(hyp(c.x,c.z,x,z) < c.r + r) return true;
  }
  return false;
}
const inLake = (x,z,m=0.5) => LAKES.some(L => hyp(x,z,L.x,L.z) < L.r + m);

/* ---------- MONTAGNE : gros rochers et sapins ---------- */
SAFE('mountain', () => {
  buildGrid();
  const pinM = lam(0x2e6b2e), pinM2 = lam(0x24582a);
  for(let i=0, n=0; i<1500 && n<40; i++){
    const a = rnd(0,TAU), d = rnd(6,36), x = MOUNT.x+Math.cos(a)*d, z = MOUNT.z+Math.sin(a)*d;
    if(hyp(x,z,MOUTH.x,MOUTH.z) < 14 || pathDist(x,z) < 5 || hyp(x,z,0,0) > 183) continue;
    const h = getHeight(x,z), s = rnd(1.8,4);
    if(h < 16 || nearCol(x,z,s)) continue;
    const r = new THREE.Mesh(DODEC, rockMat); r.scale.set(s, s*rnd(0.6,1.1), s);
    r.position.set(x, h + s*0.15, z); r.rotation.set(rnd(0,3),rnd(0,3),rnd(0,3));
    r.castShadow = r.receiveShadow = true; worldScene.add(r);
    const c = {x, z, r:s*0.75}; COL.push(c); n++;
    const k = Math.floor(x/8) + ',' + Math.floor(z/8); if(!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(c);
  }
  for(let i=0, n=0; i<1500 && n<50; i++){
    const a = rnd(0,TAU), d = rnd(10,48), x = MOUNT.x+Math.cos(a)*d, z = MOUNT.z+Math.sin(a)*d;
    if(hyp(x,z,MOUTH.x,MOUTH.z) < 12 || pathDist(x,z) < 4 || hyp(x,z,0,0) > 183) continue;
    const h = getHeight(x,z); if(h < 14 || h > 31 || nearCol(x,z,1)) continue;
    const g = new THREE.Group(), s = rnd(0.8,1.3);
    const tr = new THREE.Mesh(CYL, barkMat); tr.scale.set(0.22,2,0.22); tr.position.y = 1; g.add(tr);
    for(let k=0; k<3; k++){ const c = new THREE.Mesh(CONE, k%2 ? pinM2 : pinM); c.scale.set(1.8-k*0.5, 2.2, 1.8-k*0.5); c.position.y = 2.4+k*1.1; g.add(c); }
    g.scale.setScalar(s); g.position.set(x, h-0.2, z); g.rotation.y = rnd(0,TAU);
    shadowAll(g); worldScene.add(g);
    const c = {x, z, r:0.5*s}; COL.push(c); n++;
    const k = Math.floor(x/8) + ',' + Math.floor(z/8); if(!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(c);
  }
});

/* ---------- HERBE QUI ONDULE, FLEURS, BUISSONS, CAILLOUX ---------- */
SAFE('vegetation', () => {
  buildGrid();
  // Une touffe = 5 brins (triangles), normales vers le haut pour un éclairage doux
  const pos = [], col = [], nor = [];
  for(let i=0; i<5; i++){
    const a = i/5*Math.PI + rnd(-0.2,0.2), ca = Math.cos(a), sa = Math.sin(a), w = 0.06;
    const ox = rnd(-0.15,0.15), oz = rnd(-0.15,0.15), h = rnd(0.45,0.75);
    pos.push(ox-ca*w,0,oz-sa*w,  ox+ca*w,0,oz+sa*w,  ox+rnd(-0.12,0.12),h,oz+rnd(-0.12,0.12));
    col.push(0.28,0.45,0.15,  0.28,0.45,0.15,  0.66,0.88,0.36);
    nor.push(0,1,0, 0,1,0, 0,1,0);
  }
  const tuft = new THREE.BufferGeometry();
  tuft.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  tuft.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  tuft.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3));
  const gm = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide});
  gm.onBeforeCompile = sh => {
    sh.uniforms.uTime = U;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 ip = vec2(0.0);
      #endif
      float sw = sin(uTime*1.7 + ip.x*0.25 + ip.y*0.18)*0.12 + sin(uTime*3.1 + ip.x*0.7)*0.04;
      transformed.x += sw*position.y;
      transformed.z += sw*0.6*position.y;`);
  };
  const GN = 22000, grass = inst(tuft, gm, GN, false);
  const FN = 2600, fhead = inst(new THREE.SphereGeometry(1,5,4), lam(0xffffff), FN, false);
  const FCOL = [0xff5577,0xffd34d,0xc68bff,0xffffff,0xff9a3c,0x7fc8ff].map(c => new THREE.Color(c));
  const okSpot = (x,z,r,hMax) => {
    const h = getHeight(x,z);
    if(h < -0.9 || h > hMax || inLake(x,z) || hyp(x,z,VIL.x,VIL.z) < 11 || pathDist(x,z) < 1.8) return false;
    return !nearCol(x,z,r);
  };
  for(let c=0; c<4000 && grass.userData.n < GN; c++){
    const cx = rnd(-200,200), cz = rnd(-200,200);
    if(!okSpot(cx,cz,0.3,24)) continue;
    const flowers = Math.random() < 0.3, n = Math.floor(rnd(7,14)), FC = FCOL[Math.floor(rnd(0,FCOL.length))];
    for(let k=0; k<n; k++){
      const a = rnd(0,TAU), d = Math.sqrt(Math.random())*2.2, x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d;
      if(!okSpot(x,z,0.2,24)) continue;
      const h = getHeight(x,z), q = nz(x*1.7,z*1.7), s = rnd(0.7,1.4);
      TC.setRGB(0.95+q*0.15, 1.0+rnd(-0.08,0.08), 0.85-q*0.15);
      setI(grass, x, h-0.03, z, rnd(0,TAU), s, s*rnd(0.8,1.3), s, TC);
      if(flowers && Math.random() < 0.5) setI(fhead, x+rnd(-0.2,0.2), h+0.5*s, z+rnd(-0.2,0.2), 0, 0.08, 0.07, 0.08, FC);
    }
  }
  doneI(grass); doneI(fhead);

  // Buissons (deux boules)
  const BN = 420, b1 = inst(new THREE.IcosahedronGeometry(1,0), lam(0xffffff), BN, true), b2 = inst(new THREE.IcosahedronGeometry(1,0), lam(0xffffff), BN, true);
  const BC = [0x3f8f3a,0x4a9a3a,0x357a32,0x5aa845,0x2f6b2e];
  for(let i=0; i<4000 && b1.userData.n < BN; i++){
    const x = rnd(-185,185), z = rnd(-185,185);
    if(!okSpot(x,z,1.2,22)) continue;
    const h = getHeight(x,z), s = rnd(0.8,1.5), ry = rnd(0,TAU);
    TC.setHex(BC[i%5]);
    setI(b1, x, h+s*0.3, z, ry, s*1.2, s*0.85, s, TC);
    TC.offsetHSL(0,0,0.05);
    setI(b2, x+Math.cos(ry)*s*0.8, h+s*0.2, z+Math.sin(ry)*s*0.8, ry, s*0.75, s*0.6, s*0.7, TC);
  }
  doneI(b1); doneI(b2);

  // Cailloux (surtout au bord des chemins)
  const PN = 1100, peb = inst(DODEC, lam(0xffffff), PN, false);
  const addPeb = (x,z) => {
    const h = getHeight(x,z); if(h < -1.5 || inLake(x,z,0)) return;
    const s = rnd(0.08,0.3), v = rnd(0.55,0.8); TC.setRGB(v, v*0.97, v*0.92);
    setI(peb, x, h+s*0.2, z, rnd(0,TAU), s, s*0.6, s, TC);
  };
  PATHS.forEach(P => alongPath(P, 1.2).forEach(p => {
    const side = Math.random() < 0.5 ? -1 : 1, off = rnd(2,3.2)*side;
    addPeb(p.x + (-p.dz)*off, p.z + p.dx*off);
  }));
  for(let i=0; i<600; i++) addPeb(rnd(-185,185), rnd(-185,185));
  doneI(peb);
});

/* ---------- HORIZON : forêt de bordure, montagnes lointaines, sol ---------- */
SAFE('horizon', () => {
  // Forêt dense tout autour (hors de la zone de jeu)
  const N = 1000;
  const trunkG = new THREE.CylinderGeometry(0.25,0.4,2.4,6); trunkG.translate(0,1.2,0);
  const c1 = new THREE.ConeGeometry(2.2,4.2,7); c1.translate(0,4.0,0);
  const c2 = new THREE.ConeGeometry(1.6,3.4,7); c2.translate(0,6.0,0);
  const tM = inst(trunkG, barkMat, N, true), f1 = inst(c1, lam(0xffffff), N, true), f2 = inst(c2, lam(0xffffff), N, true);
  const FC = [0x2e6b2e,0x24582a,0x3a7a35,0x1f4f26,0x4a8a3a];
  for(let i=0; i<6000 && tM.userData.n < N; i++){
    const a = rnd(0,TAU), d = rnd(189,232), x = Math.cos(a)*d, z = Math.sin(a)*d;
    if(Math.abs(x) > 228 || Math.abs(z) > 228) continue;
    const h = getHeight(x,z); if(h < -1.5) continue;
    const s = rnd(0.9,1.6)*(1 + (d-189)/70), ry = rnd(0,TAU), sy = s*rnd(0.9,1.25);
    setI(tM, x, h-0.3, z, ry, s, sy, s);
    TC.setHex(FC[i%5]); setI(f1, x, h-0.3, z, ry, s, sy, s, TC);
    TC.offsetHSL(0,0,0.04); setI(f2, x, h-0.3, z, ry, s, sy, s, TC);
  }
  doneI(tM); doneI(f1); doneI(f2);

  // Sol au-delà du terrain (plus de vide à l'horizon)
  const ground = new THREE.Mesh(new THREE.RingGeometry(229, 900, 64, 1), lam(0x4f7f35));
  ground.rotation.x = -Math.PI/2; ground.position.y = -2.5; worldScene.add(ground);

  // Montagnes lointaines dans la brume (2 rangées)
  const rows = [{d:[380,430], h:[70,140], r:[50,85], c:0xa9c4dc, n:26}, {d:[290,330], h:[25,55], r:[40,70], c:0x7fa69a, n:22}];
  const snowM = lam(0xf4f8ff, {fog:false});
  rows.forEach(rw => {
    const m = lam(rw.c, {fog:false});
    for(let k=0; k<rw.n; k++){
      const a = k/rw.n*TAU + rnd(-0.08,0.08), d = rnd(...rw.d), h = rnd(...rw.h), r = rnd(...rw.r);
      const mt = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), m);
      mt.position.set(Math.cos(a)*d, h/2-10, Math.sin(a)*d); mt.rotation.y = rnd(0,3); worldScene.add(mt);
      if(h > 110){
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r*0.28, h*0.28, 7), snowM);
        cap.position.set(mt.position.x, h-10-h*0.14, mt.position.z); cap.rotation.y = mt.rotation.y; worldScene.add(cap);
      }
    }
  });
  worldScene.fog.near = 70; worldScene.fog.far = 280;
});

/* ---------- CIEL : soleil, nuages ronds ---------- */
SAFE('sky', () => {
  const sunM = new THREE.Mesh(new THREE.SphereGeometry(16,16,12), new THREE.MeshBasicMaterial({color:0xfff6d8, fog:false}));
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const g = gc.getContext('2d'), gr = g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,240,200,.9)'); gr.addColorStop(0.3,'rgba(255,220,150,.35)'); gr.addColorStop(1,'rgba(255,220,150,0)');
  g.fillStyle = gr; g.fillRect(0,0,128,128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc), transparent:true, depthWrite:false, fog:false, blending:THREE.AdditiveBlending}));
  glow.scale.setScalar(170);
  worldScene.add(sunM, glow);
  const SD = new THREE.Vector3(60,100,40).normalize();
  ANIM.push(() => {
    sunM.position.copy(camera.position).addScaledVector(SD, 560);
    glow.position.copy(sunM.position);
  });

  const cm = lam(0xffffff, {emissive:0x5a6068, fog:false});
  const geo = new THREE.SphereGeometry(1,10,8);
  clouds.forEach(c => {
    c.children.slice().forEach(ch => c.remove(ch));
    for(let j=0, n=Math.floor(rnd(6,10)); j<n; j++){
      const m = new THREE.Mesh(geo, cm), up = Math.random();
      m.scale.set(rnd(5,9), rnd(2.5,4)*(0.7+up*0.5), rnd(4,7));
      m.position.set(rnd(-11,11), up*2.5, rnd(-4,4)); c.add(m);
    }
  });
});

/* ---------- PERSONNAGES : visages, mains, chaussures ---------- */
SAFE('npcs', () => {
  const addFace = (g, gob) => {
    const zf = -0.215;
    if(gob){
      part(g, 0.08,0.1,0.1, 0x6a9a48, 0,1.76,-0.25);                        // gros nez
      part(g, 0.22,0.05,0.02, 0x2a0a0a, 0,1.68,zf);                         // bouche
      for(const s of [-1,1]){
        part(g, 0.04,0.05,0.02, 0xfff3d0, s*0.06,1.665,zf-0.012);           // crocs
        const br = part(g, 0.12,0.03,0.02, 0x1a2a10, s*0.1,1.84,zf); br.rotation.z = s*0.35;   // sourcils fâchés
      }
    } else {
      for(const s of [-1,1]){
        part(g, 0.09,0.07,0.02, 0xffffff, s*0.1,1.85,zf);
        part(g, 0.045,0.06,0.02, 0x2a1a10, s*0.1,1.85,zf-0.012);
        part(g, 0.02,0.02,0.01, 0xffffff, s*0.1+0.012,1.865,zf-0.025);    // reflet
        part(g, 0.1,0.025,0.02, 0x3a2a1a, s*0.1,1.92,zf);
        part(g, 0.07,0.035,0.01, 0xf0a090, s*0.14,1.76,zf-0.002);          // joues
      }
      part(g, 0.06,0.07,0.05, 0xe0b088, 0,1.79,zf-0.01);
      part(g, 0.12,0.03,0.02, 0x8a3b2a, 0,1.71,zf);
    }
  };
  const addLimbs = (g, arms, skin) => {
    arms.forEach(a => part(a, 0.2,0.18,0.2, skin, 0,-0.78,0));
    g.children.filter(o => o.isGroup && Math.abs(o.position.y-0.9) < 0.01)
      .forEach(l => part(l, 0.3,0.15,0.42, 0x3a2a1a, 0,-0.95,-0.05));
  };
  npcs.forEach(n => {
    const gob = n.id.startsWith('gob');
    addFace(n.g, gob);
    addLimbs(n.g, n.arms, gob ? 0x7fb35a : 0xf1c79a);
  });
  if(typeof CRIT !== 'undefined') CRIT.forEach(c => {
    if(c.kind !== 'gobelin') return;
    for(const s of [-1,1]) part(c.g, 0.08,0.06,0.03, 0xffe14d, s*0.1,1.82,-0.22);   // yeux jaunes
    addFace(c.g, true);
  });
});

SAFE('greg', () => {
  const _buildGreg = buildGreg;
  buildGreg = function(L = LOOK){
    const G = _buildGreg(L);
    try{
      const [hw,hh,hd] = [[0.42,0.42,0.42],[0.5,0.4,0.42],[0.37,0.5,0.4]][L.face];
      const skin = PAL.skin[L.skin], shirt = PAL.cloth[L.topC], hairC = PAL.hair[L.hairC];
      const ez = -(hd/2+0.01), ey = hh*0.57;
      const blush = new THREE.Color(skin).lerp(new THREE.Color(0xff8a7a), 0.45).getHex();
      for(const s of [-1,1]){
        part(G.head, 0.025,0.025,0.01, 0xffffff, s*hw*0.24+0.012, ey+0.018, ez-0.03);   // reflets dans les yeux
        part(G.head, 0.08,0.035,0.01, blush, s*hw*0.34, hh*0.33, ez-0.005);             // joues
      }
      // Petites mèches sur le dessus
      if(L.hair === 0 && !L.hat){
        [[-0.08,0.3],[0.04,-0.25],[0.11,0.4]].forEach(([x,r],i) => {
          const m = part(G.head, 0.09,0.09,0.12, hairC, x, hh+0.06, -0.06+i*0.06); m.rotation.z = r;
        });
      }
      // Haut : col, logo dino, cordons et poche du sweat
      const zf = -((L.top===2 ? 0.4 : L.top===1 ? 0.38 : 0.36)/2) - 0.006;
      const lc = (shirt===0xf2f2f2 || shirt===0xe8c13a) ? 0x2f6fd6 : 0xf2f2f2;
      if(L.top === 0) part(G.torso, 0.26,0.05,0.01, shade(shirt,0.7), 0,0.67,zf);
      part(G.torso, 0.16,0.07,0.01, lc, 0.05,0.46,zf);
      part(G.torso, 0.06,0.07,0.01, lc, 0.12,0.5,zf);
      part(G.torso, 0.09,0.03,0.01, lc, -0.05,0.44,zf);
      if(L.top === 2){
        for(const s of [-1,1]) part(G.torso, 0.02,0.14,0.01, 0xf2f2f2, s*0.07,0.6,zf);
        part(G.torso, 0.34,0.14,0.01, shade(shirt,0.85), 0,0.2,zf);
        part(G.torso, 0.5,0.22,0.12, shade(shirt,0.85), 0,0.64,0.21);
      }
      // Ceinture avec boucle dorée
      const hipW = L.bot===1 ? 0.62 : 0.52;
      part(G.hip, hipW+0.02,0.06,0.36, 0x2a1d12, 0,0.06,0);
      part(G.hip, 0.08,0.06,0.02, 0xe8c13a, 0,0.06,-0.185);
    }catch(e){ console.warn('Patch 9 (détails de Greg) :', e); }
    return G;
  };
  model.remove(GREG.root); GREG = buildGreg(LOOK); model.add(GREG.root); updateHands();
});

/* ---------- BOUCLE DES ANIMATIONS DU DÉCOR ---------- */
let last = performance.now();
(function loop9(){
  requestAnimationFrame(loop9);
  const now = performance.now(), dt = Math.min(0.05, (now-last)/1000), t = now/1000;
  last = now; U.value = t;
  if(window.VOITURE_ON) return;
  for(const f of ANIM){ try{ f(t,dt); }catch(e){} }
})();
})();
/* ==========================================================
   PATCH 10 : MONDE COLORÉ (style dessin animé)
   - Ciel bleu vif, lumière douce, herbe plus éclatante,
     arbres et buissons tout ronds
   - EAU PARTOUT où le terrain est sous le niveau de l'eau
     (fini les lacs vides) : vagues, eau claire au bord,
     bleu profond au centre, écume sur les rives
   - Mesas en couches orange avec de l'herbe dessus,
     mesas violettes au loin, une cascade qui tombe dans un lac
   - Pont en bois avec cordes au-dessus d'un lac (on marche dessus !)
     et ponton sur lequel on peut marcher
   - Dinosaures refaits : formes rondes, gros yeux, dents,
     mâchoire qui s'ouvre, queue qui ondule, rayures et taches
   - Grotte refaite : roche violette, piliers, stalagmites,
     bassin lumineux, cristaux, lianes qui brillent
   - Collisions : on ne traverse plus les dinosaures, les
     villageois, les gobelins, les buissons, les champignons…
   À coller TOUT EN BAS du script, APRÈS le patch 9.
   ========================================================== */
(function(){
if(window.__PATCH10) return;
window.__PATCH10 = true;

const SAFE = (name, fn) => { try{ fn(); }catch(e){ console.warn('Patch 10 (' + name + ') :', e); } };
const TAU = Math.PI*2;
const lam = (c, o={}) => new THREE.MeshLambertMaterial(Object.assign({color:c}, o));
const ANIM = [];
const U = {value:0};
const SPH12 = new THREE.SphereGeometry(1, 14, 10);
const SPH8 = new THREE.SphereGeometry(1, 8, 6);
const inLake = (x,z,m=0) => LAKES.some(L => hyp(x,z,L.x,L.z) < L.r + m);

/* Mêmes chemins que le patch 9 (pour ne rien poser dessus) */
const PATHS = [
  [[VIL.x,VIL.z], [-45,-10], [-60,-45], [MOUTH.x+3, MOUTH.z+3]],
  [[VIL.x,VIL.z], [15,0],   [42,-26]],
  [[VIL.x,VIL.z], [0,45],   [18,60]],
  [[VIL.x,VIL.z], [-70,30], [-102,36]]
];
function segDist(px,pz,ax,az,bx,bz){
  const dx = bx-ax, dz = bz-az, l2 = dx*dx + dz*dz;
  const t = clamp(((px-ax)*dx + (pz-az)*dz) / l2, 0, 1);
  return Math.hypot(px-ax-dx*t, pz-az-dz*t);
}
function pathDist(x,z){
  let d = 1e9;
  for(const P of PATHS) for(let i=0; i<P.length-1; i++) d = Math.min(d, segDist(x,z, P[i][0],P[i][1], P[i+1][0],P[i+1][1]));
  return d;
}

/* ---------- CIEL ET LUMIÈRE ---------- */
SAFE('sky', () => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#1c7ce0'); gr.addColorStop(0.35,'#4fb0f5'); gr.addColorStop(0.72,'#b8e8ff'); gr.addColorStop(1,'#eafbff');
  g.fillStyle = gr; g.fillRect(0,0,4,256);
  worldScene.background = new THREE.CanvasTexture(c);
  worldScene.fog.color.set(0xd2f0ff);
  worldScene.children.forEach(o => {
    if(o.isHemisphereLight){ o.color.set(0xeaf7ff); o.groundColor.set(0x5a9a3a); o.intensity = 1.05; }
  });
  sunW.color.set(0xfff2d6); sunW.intensity = 2.0;
  renderer.toneMappingExposure = 1.12;
  canvas.style.filter = 'saturate(1.18) contrast(1.05)';

  // De gros nuages en plus, tout ronds
  const cm = lam(0xffffff, {emissive:0x667080, fog:false});
  for(let i=0; i<10; i++){
    const cg = new THREE.Group();
    for(let j=0, n=Math.floor(rnd(8,13)); j<n; j++){
      const m = new THREE.Mesh(SPH12, cm), up = Math.random();
      m.scale.set(rnd(7,12), rnd(4,6)*(0.7+up*0.5), rnd(6,9));
      m.position.set(rnd(-16,16), up*4, rnd(-6,6)); cg.add(m);
    }
    cg.position.set(rnd(-220,220), rnd(70,95), rnd(-220,220));
    worldScene.add(cg); clouds.push(cg);
  }
});

/* ---------- HERBE PLUS ÉCLATANTE ---------- */
SAFE('terrain-colors', () => {
  const col = terrain.geometry.attributes.color, c = new THREE.Color(), hsl = {};
  for(let i=0; i<col.count; i++){
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i)); c.getHSL(hsl);
    if(hsl.h > 0.17 && hsl.h < 0.45 && hsl.s > 0.2){        // les verts
      hsl.h = lerp(hsl.h, 0.27, 0.5); hsl.s = Math.min(1, hsl.s*1.25 + 0.08); hsl.l = Math.min(0.75, hsl.l*1.1);
    } else if(hsl.h < 0.12 && hsl.s > 0.15){                   // terre et chemins plus chauds
      hsl.s = Math.min(1, hsl.s*1.2); hsl.l = Math.min(0.8, hsl.l*1.05);
    }
    c.setHSL(hsl.h, hsl.s, hsl.l);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  // Texture douce (taches d'herbe) à la place du grain gris
  terrain.material.map = makeTex(256, (g,s) => {
    g.fillStyle = '#ececec'; g.fillRect(0,0,s,s);
    for(let i=0; i<260; i++){
      const v = Math.floor(rnd(215,255));
      g.fillStyle = `rgba(${v},${v},${v},0.6)`;
      g.beginPath(); g.ellipse(rnd(0,s), rnd(0,s), rnd(4,14), rnd(3,9), rnd(0,3), 0, TAU); g.fill();
    }
    for(let i=0; i<900; i++){ const v = Math.floor(rnd(200,240)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd(0,s), rnd(0,s), 1, rnd(2,4)); }
  }, 40);
  terrain.material.needsUpdate = true;
});

/* ---------- ARBRES ET BUISSONS TOUT RONDS ---------- */
SAFE('round-trees', () => {
  TREES.forEach(t => t.g.traverse(o => {
    if(o.isMesh && (o.geometry === BLOB || o.geometry === DODEC)) o.geometry = SPH12;
  }));
  // Buissons du patch 9 : boules lisses + collisions
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  worldScene.children.forEach(o => {
    if(!o.isInstancedMesh || o.geometry.type !== 'IcosahedronGeometry' || !o.castShadow) return;
    o.geometry = SPH12;
    for(let i=0; i<o.count; i++){
      m4.fromArray(o.instanceMatrix.array, i*16); m4.decompose(p,q,s);
      if(hyp(p.x,p.z,0,0) < 186) COL.push({x:p.x, z:p.z, r:Math.max(0.5, s.x*0.75)});
    }
  });
});

/* ---------- EAU PARTOUT OÙ C'EST PLUS BAS QUE LE NIVEAU DE L'EAU ---------- */
SAFE('water', () => {
  WATERS.forEach(w => { w.visible = false; });              // les anciens disques
  const SEG = 230, SIZE = 460, N1 = SEG+1;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count*3), depth = new Float32Array(pos.count);
  const shallow = new THREE.Color(0x5fe6d6), mid = new THREE.Color(0x2fa8e0), deep = new THREE.Color(0x1a56b0), foam = new THREE.Color(0xffffff), c = new THREE.Color();
  for(let i=0; i<pos.count; i++){
    const d = WL - getHeight(pos.getX(i), pos.getZ(i)); depth[i] = d;
    if(d < 0.25) c.copy(foam).lerp(shallow, clamp((d+0.4)/0.65, 0, 1));
    else if(d < 1.2) c.copy(shallow).lerp(mid, (d-0.25)/0.95);
    else c.copy(mid).lerp(deep, clamp((d-1.2)/2.5, 0, 1));
    cols[i*3] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  // On ne garde que les carrés où il y a de l'eau (moins de calcul)
  const idx = [];
  for(let iz=0; iz<SEG; iz++) for(let ix=0; ix<SEG; ix++){
    const a = ix + N1*iz, b = ix + N1*(iz+1), cc = ix+1 + N1*(iz+1), d = ix+1 + N1*iz;
    if(Math.max(depth[a],depth[b],depth[cc],depth[d]) > -0.3) idx.push(a,b,d, b,cc,d);
  }
  geo.setIndex(idx);
  const tex = makeTex(256, (g,s) => {
    g.fillStyle = '#e8f6ff'; g.fillRect(0,0,s,s);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3;
    for(let i=0; i<26; i++){
      const x = rnd(0,s), y = rnd(0,s), w = rnd(18,50);
      g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+w/2, y-rnd(4,9), x+w, y); g.stroke();
    }
    g.fillStyle = 'rgba(60,120,190,.10)';
    for(let i=0; i<24; i++){ g.beginPath(); g.arc(rnd(0,s), rnd(0,s), rnd(10,30), 0, TAU); g.fill(); }
  }, 40);
  const wm = new THREE.MeshPhongMaterial({vertexColors:true, map:tex, transparent:true, opacity:0.86,
    shininess:120, specular:0xffffff, side:THREE.DoubleSide});
  wm.onBeforeCompile = sh => {
    sh.uniforms.uTime = U;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += sin(position.x*0.35 + uTime*1.3)*0.05 + cos(position.z*0.28 + uTime*1.05)*0.05;`);
  };
  const water = new THREE.Mesh(geo, wm);
  water.position.y = WL - 0.02; water.receiveShadow = true; water.frustumCulled = false;
  worldScene.add(water);
  ANIM.push(t => { tex.offset.set(t*0.01, t*0.006); });
});

/* ---------- MESAS EN COUCHES (proches, lointaines, cascade) ---------- */
const STRATA = makeTex(64, (g,s) => {}, 1);
SAFE('strata-tex', () => {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  const C = ['#d9733f','#e8905a','#c45a35','#f0a868','#b84c2e','#dc7d48','#f3b77a'];
  for(let y=0; y<256;){
    const h = rnd(10,32); g.fillStyle = C[Math.floor(rnd(0,C.length))]; g.fillRect(0,y,64,h);
    g.fillStyle = 'rgba(90,30,10,.28)'; g.fillRect(0,y+h-2,64,2);
    y += h;
  }
  for(let i=0; i<120; i++){ g.fillStyle = 'rgba(255,230,190,.25)'; g.fillRect(rnd(0,64), rnd(0,256), rnd(2,5), 1); }
  for(let i=0; i<10; i++){ g.fillStyle = 'rgba(80,30,10,.12)'; g.fillRect(rnd(0,64), 0, 1, 256); }
  STRATA.image = cv; STRATA.needsUpdate = true;
  STRATA.wrapS = STRATA.wrapT = THREE.RepeatWrapping;
});
const GRASS_CAP = lam(0x6fd14a);
const TOP_LEAF = lam(0x58c43c);
function addCap(g, r, y, m, far, ox=0, oz=0){
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r*1.03, r*1.03, 0.6, 22), m);
  cap.position.set(ox, y+0.25, oz); g.add(cap);
  const dome = new THREE.Mesh(SPH12, m); dome.scale.set(r*1.02, 0.7, r*1.02); dome.position.set(ox, y+0.5, oz); g.add(dome);
  if(far) return;
  const n = Math.round(r*2.6);
  for(let k=0; k<n; k++){                                    // herbe qui déborde
    const a = k/n*TAU + rnd(-0.1,0.1), h = rnd(0.4,1.2), d = new THREE.Mesh(CONE, m);
    d.scale.set(rnd(0.25,0.5), h, rnd(0.25,0.5)); d.rotation.x = Math.PI;
    d.position.set(ox+Math.cos(a)*r*1.02, y-h/2+0.1, oz+Math.sin(a)*r*1.02); g.add(d);
  }
  for(let k=0, n2=Math.floor(rnd(1,4)); k<n2; k++){            // petits arbres ronds dessus
    const a = rnd(0,TAU), d = rnd(0,r*0.6), tx = ox+Math.cos(a)*d, tz = oz+Math.sin(a)*d, s = rnd(0.8,1.3);
    const tr = new THREE.Mesh(CYL, barkMat); tr.scale.set(0.2*s, 1.6*s, 0.2*s); tr.position.set(tx, y+0.8+0.8*s, tz); g.add(tr);
    const lf = new THREE.Mesh(SPH12, TOP_LEAF); lf.scale.set(1.2*s, 1.0*s, 1.2*s); lf.position.set(tx, y+0.8+1.9*s, tz); g.add(lf);
  }
}
function buildMesa(x, z, r, o={}){
  let lo = 1e9, hi = -1e9;
  for(let k=0; k<10; k++){ const a = k/10*TAU, h = getHeight(x+Math.cos(a)*r, z+Math.sin(a)*r); lo = Math.min(lo,h); hi = Math.max(hi,h); }
  const base = lo - 3, top = hi + (o.h || rnd(7,14)), H = top - base;
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const tiers = o.far || o.h ? 1 : (Math.random() < 0.5 ? 2 : 1);
  const tex = STRATA.clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(2, Math.round(r*0.7)), H/10);
  const rockM = o.far ? lam(0xd6c4ee, {map:tex, fog:false}) : lam(0xffffff, {map:tex});
  const capM = o.far ? lam(0x9fd8c4, {fog:false}) : GRASS_CAP;
  const h1 = tiers === 2 ? H*0.62 : H;
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(r*1.04, r, h1, 22, 4), rockM);
  c1.position.y = base + h1/2; g.add(c1);
  addCap(g, r*1.04, base+h1, capM, o.far);
  if(tiers === 2){
    const r2 = r*0.62, h2 = H - h1, ox = rnd(-r*0.2, r*0.2), oz = rnd(-r*0.2, r*0.2);
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(r2*1.05, r2, h2+0.4, 18, 3), rockM);
    c2.position.set(ox, base+h1+h2/2-0.2, oz); g.add(c2);
    addCap(g, r2*1.05, base+H, capM, false, ox, oz);
  }
  if(!o.far) g.traverse(m => { if(m.isMesh){ m.castShadow = true; m.receiveShadow = true; } });
  worldScene.add(g);
  return {g, top, base, r};
}
SAFE('mesas', () => {
  // Lointaines (violettes dans la brume)
  for(let k=0; k<26; k++){
    const a = k/26*TAU + rnd(-0.08,0.08), d = rnd(250,330);
    buildMesa(Math.cos(a)*d, Math.sin(a)*d, rnd(12,22), {far:true, h:rnd(22,48)});
  }
  // Proches (avec collisions)
  const clearOf = (x,z,r) =>
    !pickups.some(p => p.scn === worldScene && hyp(p.g.position.x,p.g.position.z,x,z) < r+3) &&
    !monsters.some(m => hyp(m.root.position.x,m.root.position.z,x,z) < r+4 || hyp(m.home.x,m.home.z,x,z) < r+4) &&
    !(typeof CRIT !== 'undefined' && CRIT.some(c => hyp(c.g.position.x,c.g.position.z,x,z) < r+2)) &&
    !npcs.some(n => n.g.parent === worldScene && hyp(n.g.position.x,n.g.position.z,x,z) < r+3);
  for(let i=0, n=0; i<3000 && n<9; i++){
    const x = rnd(-170,170), z = rnd(-170,170), r = rnd(4.5,8);
    if(hyp(x,z,0,0) > 175 - r || hyp(x,z,VIL.x,VIL.z) < 60 || hyp(x,z,MOUNT.x,MOUNT.z) < 50) continue;
    if(pathDist(x,z) < r+6 || inLake(x,z,r+8) || !free(x,z,r) || !clearOf(x,z,r)) continue;
    const h = getHeight(x,z); if(h < 0 || h > 14) continue;
    buildMesa(x, z, r); COL.push({x, z, r:r*1.04}); n++;
  }
});

/* ---------- CASCADE (une mesa au bord du lac de l'ouest) ---------- */
SAFE('waterfall', () => {
  const L = LAKES[2], r = 6.5, x = L.x - L.r - r + 1.5, z = L.z;
  if(pickups.some(p => p.scn === worldScene && hyp(p.g.position.x,p.g.position.z,x,z) < r+3)) return;
  const M = buildMesa(x, z, r, {h:14});
  COL.push({x, z, r:r*1.04});
  const fx = x + r*1.04 + 0.35, top = M.top + 0.3, hgt = top - WL;
  const mkTex = (a) => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = `rgba(170,225,255,${a})`; g.fillRect(0,0,64,256);
    for(let i=0; i<60; i++){ g.fillStyle = `rgba(255,255,255,${rnd(0.3,0.9)})`; g.fillRect(rnd(0,64), rnd(0,256), rnd(1,3), rnd(20,70)); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, hgt/6);
    return t;
  };
  const t1 = mkTex(0.75), t2 = mkTex(0.35);
  const fall = (w, t, dx) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt),
      new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false, side:THREE.DoubleSide}));
    m.position.set(fx+dx, WL + hgt/2, z); m.rotation.y = Math.PI/2; worldScene.add(m); return m;
  };
  fall(3.6, t1, 0); fall(2.6, t2, 0.15);
  const lip = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({color:0xcff2ff}));
  lip.scale.set(1.2, 0.35, 3.8); lip.position.set(fx-0.4, top-0.1, z); worldScene.add(lip);
  // Écume, brume et gouttes en bas
  const foamM = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.85});
  const foams = [];
  for(let k=0; k<7; k++){
    const f = new THREE.Mesh(SPH8, foamM); f.scale.set(rnd(0.8,1.4), 0.4, rnd(0.8,1.4));
    f.position.set(fx+rnd(0.3,2), WL+0.1, z+rnd(-1.8,1.8)); worldScene.add(f); foams.push({f, ph:rnd(0,6), s:f.scale.x});
  }
  const mc = document.createElement('canvas'); mc.width = mc.height = 64;
  const mg = mc.getContext('2d'), gr = mg.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,.7)'); gr.addColorStop(1,'rgba(255,255,255,0)'); mg.fillStyle = gr; mg.fillRect(0,0,64,64);
  const mist = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mc), transparent:true, depthWrite:false}));
  mist.scale.set(9,5,1); mist.position.set(fx+1.5, WL+1.5, z); worldScene.add(mist);
  const N = 90, dp = new Float32Array(N*3), drops = [];
  for(let i=0; i<N; i++) drops.push({x:0,y:-99,z:0,vx:0,vy:0,vz:0});
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp,3));
  const pts = new THREE.Points(dg, new THREE.PointsMaterial({color:0xffffff, size:0.18, transparent:true, opacity:0.85, depthWrite:false}));
  pts.frustumCulled = false; worldScene.add(pts);
  ANIM.push((t,dt) => {
    t1.offset.y += dt*0.9; t2.offset.y += dt*1.4;
    foams.forEach(o => { const k = 1 + Math.sin(t*4+o.ph)*0.15; o.f.scale.x = o.s*k; o.f.scale.z = o.s*k; });
    for(let i=0; i<N; i++){
      const d = drops[i];
      if(d.y < WL){ d.x = fx+rnd(0,0.6); d.y = WL+0.1; d.z = z+rnd(-1.6,1.6); d.vx = rnd(0.5,2.5); d.vy = rnd(2,5); d.vz = rnd(-1,1); }
      d.vy -= 9*dt; d.x += d.vx*dt; d.y += d.vy*dt; d.z += d.vz*dt;
      dp[i*3] = d.x; dp[i*3+1] = d.y; dp[i*3+2] = d.z;
    }
    dg.attributes.position.needsUpdate = true;
  });
});

/* ---------- PONTS ET PONTON SUR LESQUELS ON MARCHE ---------- */
const WALK = [];          // {ax,az,bx,bz,w,y(u)}
SAFE('walkable', () => {
  const _groundY = groundY;
  groundY = function(x,z){
    let h = _groundY(x,z);
    if(zone !== 'world') return h;
    for(const b of WALK){
      const dx = b.bx-b.ax, dz = b.bz-b.az, L2 = dx*dx+dz*dz;
      const u = ((x-b.ax)*dx + (z-b.az)*dz) / L2;
      if(u < 0 || u > 1) continue;
      const lat = Math.abs((x-b.ax)*dz - (z-b.az)*dx) / Math.sqrt(L2);
      if(lat < b.w){ const y = b.y(u); if(y > h) h = y; }
    }
    return h;
  };
});
const ropeM = lam(0xefe6d2), postM = lam(0x8a5a30);
const plankMs = [lam(0xb07a45), lam(0xc08850), lam(0xa06c3a)];
function ropePost(x, yBot, yTop, z, grp){
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.19,yTop-yBot,10), postM);
  p.position.set(x, (yTop+yBot)/2, z); grp.add(p);
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.17,0.08,10), lam(0xc89a68)); capT.position.set(x, yTop+0.04, z); grp.add(capT);
  for(const dy of [0.3, 0.55]){
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.22,0.07,6,14), ropeM);
    r.rotation.x = Math.PI/2; r.position.set(x, yTop-dy, z); grp.add(r);
  }
}
function buildBridge(ax, az, bx, bz, deck){
  const L = Math.hypot(bx-ax, bz-az), dx = (bx-ax)/L, dz = (bz-az)/L, nx = -dz, nz = dx, yaw = Math.atan2(dx, dz);
  const grp = new THREE.Group(); worldScene.add(grp);
  let i = 0;
  for(let s=0.25; s<L; s+=0.55, i++){
    const u = s/L, x = ax+dx*s, z = az+dz*s, y = deck(u);
    if(y < getHeight(x,z) - 0.25) continue;
    const yA = deck(Math.max(0,u-0.005)), yB = deck(Math.min(1,u+0.005));
    const p = new THREE.Mesh(BOX, plankMs[i%3]);
    p.scale.set(2.7+rnd(-0.15,0.15), 0.16, 0.48);
    p.position.set(x+nx*rnd(-0.08,0.08), y-0.08, z+nz*rnd(-0.08,0.08));
    p.rotation.order = 'YXZ'; p.rotation.y = yaw + rnd(-0.04,0.04); p.rotation.x = Math.atan2(yA-yB, 0.01*L);
    grp.add(p);
  }
  for(const side of [-1,1]){
    const tops = [];
    for(let s=0; s<=L+0.01; s+=3.2){
      const u = s/L, x = ax+dx*s+nx*1.35*side, z = az+dz*s+nz*1.35*side, y = deck(u);
      if(y < getHeight(x,z) - 0.2) continue;
      ropePost(x, Math.min(getHeight(x,z), y) - 0.4, y+1.1, z, grp);
      tops.push(new THREE.Vector3(x, y+0.85, z));
    }
    if(tops.length > 1){
      const pts = [];
      for(let k=0; k<tops.length-1; k++){
        pts.push(tops[k]);
        const m = tops[k].clone().lerp(tops[k+1], 0.5); m.y -= 0.25; pts.push(m);
      }
      pts.push(tops[tops.length-1]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length*6, 0.06, 5), ropeM);
      grp.add(tube);
    }
  }
  grp.traverse(m => { if(m.isMesh){ m.castShadow = true; m.receiveShadow = true; } });
  WALK.push({ax, az, bx, bz, w:1.3, y:u => deck(u) + 0.02});
}
SAFE('bridge', () => {
  // Pont au-dessus du lac aux roseaux, dans le prolongement du chemin
  const L = LAKES[1];
  const ax = 16, az = 58, bx = L.x + (L.x-16), bz = L.z + (L.z-58);
  buildBridge(ax, az, bx, bz, u => WL + 1.2 + 0.7*Math.sin(Math.PI*u));
});
SAFE('dock', () => {
  // Le ponton du patch 9 (grand lac) : on peut marcher dessus + poteaux à cordes
  if(!window.__PATCH9) return;
  const L = LAKES[0], dx = VIL.x-L.x, dz = VIL.z-L.z, dl = Math.hypot(dx,dz), ux = dx/dl, uz = dz/dl;
  const s0 = L.r*0.97 + 1.2, sx = L.x + ux*s0, sz = L.z + uz*s0;
  const deckY = WL + 0.56;
  WALK.push({ax:sx+ux*0.4, az:sz+uz*0.4, bx:sx-ux*8.6, bz:sz-uz*8.6, w:1.15, y:() => deckY});
  const grp = new THREE.Group(); worldScene.add(grp);
  const nx = -uz, nz = ux;
  for(let k=0; k<4; k++) for(const s of [-1,1]){
    const x = sx - ux*k*2.6 + nx*1.05*s, z = sz - uz*k*2.6 + nz*1.05*s;
    ropePost(x, deckY-0.1, deckY+1.0, z, grp);
  }
  grp.traverse(m => { if(m.isMesh) m.castShadow = true; });
});

/* ---------- DINOSAURES REFAITS ---------- */
const EYE_W = new THREE.MeshBasicMaterial({color:0xffffff}), EYE_P = new THREE.MeshBasicMaterial({color:0x14100c});
const T_GEO = new THREE.ConeGeometry(1,1,6);
function dMats(base){
  const c = new THREE.Color(base);
  return {
    skin: lam(c.clone()),
    belly: lam(c.clone().lerp(new THREE.Color(0xfff1c8), 0.55)),
    dark: lam(c.clone().multiplyScalar(0.6)),
    bone: lam(0xfff6e0), claw: lam(0x3a3028), mouth: lam(0xa03040)
  };
}
function blob(par, m, x,y,z, sx,sy,sz, sh=true){
  const o = new THREE.Mesh(SPH12, m); o.position.set(x,y,z); o.scale.set(sx,sy,sz);
  o.castShadow = sh; o.receiveShadow = true; par.add(o); return o;
}
function cone(par, m, x,y,z, r,h, rx=0, ry=0, rz=0){
  const o = new THREE.Mesh(T_GEO, m); o.position.set(x,y,z); o.scale.set(r,h,r); o.rotation.set(rx,ry,rz); par.add(o); return o;
}
function eye(par, x,y,z, r, s){
  const g = new THREE.Group(); g.position.set(x,y,z); par.add(g);
  const w = new THREE.Mesh(SPH12, EYE_W); w.scale.setScalar(r); g.add(w);
  const p = new THREE.Mesh(SPH12, EYE_P); p.scale.setScalar(r*0.62); p.position.set(s*r*0.32, r*0.05, -r*0.55); g.add(p);
  const h = new THREE.Mesh(SPH8, EYE_W); h.scale.setScalar(r*0.2); h.position.set(s*r*0.3+r*0.15, r*0.32, -r*0.98); g.add(h);
  return g;
}
function teeth(par, m, xs, y, zs, s, down){
  for(const z of zs) for(const x of xs) cone(par, m, x, y, z, s*0.45, s, down ? Math.PI : 0);
}
// Patte : pivot à la hanche, le pied touche le sol à -len
function dLeg(body, M, x, hipY, z, len, th, claws=3){
  const piv = new THREE.Group(); piv.position.set(x, hipY, z); body.add(piv);
  blob(piv, M.skin, 0, -len*0.26, 0.02, th, len*0.33, th*1.15);
  blob(piv, M.skin, 0, -len*0.64, 0.05, th*0.62, len*0.3, th*0.7);
  const fh = th*0.28;
  blob(piv, M.dark, 0, -len+fh, -th*0.35, th*0.85, fh, th*1.3);
  for(let k=0; k<claws; k++){
    const cx = (k-(claws-1)/2)*th*0.5;
    cone(piv, M.claw, cx, -len+fh*0.8, -th*1.55, th*0.14, th*0.4, -Math.PI/2);
  }
  return piv;
}
function dTail(body, M, x,y,z, n, step, r0, drop=0.04, stripes=true){
  const base = new THREE.Group(); base.position.set(x,y,z); body.add(base);
  const segs = []; let par = base;
  for(let i=0; i<n; i++){
    const sg = new THREE.Group(); sg.position.set(0, i ? -drop : 0, i ? step : 0); par.add(sg); segs.push(sg);
    const r = r0*(1 - i/(n+1));
    blob(sg, M.skin, 0, 0, step*0.5, r, r*0.9, step*0.75);
    if(stripes && i%2 === 0) blob(sg, M.dark, 0, r*0.75, step*0.5, r*0.7, r*0.22, step*0.25, false);
    par = sg;
  }
  return {base, segs, tip:par};
}
const DINO = {
  trex(M){
    const body = new THREE.Group(), A = {};
    A.chest = blob(body, M.skin, 0,2.55,0.2, 1.05,0.95,1.65);
    blob(body, M.belly, 0,2.25,-0.25, 0.85,0.7,1.25);
    for(let k=0; k<4; k++) blob(body, M.dark, 0,3.38,-0.6+k*0.55, 0.72,0.12,0.18, false);
    blob(body, M.skin, 0,3.05,-1.25, 0.75,0.8,0.75);
    for(let k=0; k<6; k++) cone(body, M.dark, 0, 3.5-k*0.05, -1.2+k*0.5, 0.12, 0.3);
    const head = new THREE.Group(); head.position.set(0,3.55,-1.75); body.add(head);
    blob(head, M.skin, 0,0.2,-0.45, 0.72,0.62,0.9);
    blob(head, M.skin, 0,0.05,-1.15, 0.58,0.42,0.62);
    for(const s of [-1,1]){
      blob(head, M.dark, s*0.32,0.62,-0.6, 0.26,0.12,0.32, false);
      blob(head, M.dark, s*0.2,0.3,-1.66, 0.07,0.05,0.05, false);
      eye(head, s*0.5,0.38,-0.72, 0.17, s);
    }
    teeth(head, M.bone, [-0.42,0.42], -0.3, [-0.8,-1.02,-1.24,-1.46], 0.15, true);
    const jaw = new THREE.Group(); jaw.position.set(0,-0.1,-0.25); head.add(jaw);
    blob(jaw, M.belly, 0,-0.22,-0.6, 0.55,0.22,0.9);
    blob(jaw, M.mouth, 0,-0.08,-0.6, 0.4,0.06,0.65, false);
    teeth(jaw, M.bone, [-0.37,0.37], -0.03, [-0.65,-0.87,-1.09,-1.31], 0.12, false);
    A.jaw = jaw;
    const arms = [];
    for(const s of [-1,1]){
      const a = new THREE.Group(); a.position.set(s*0.62,2.85,-1.15); a.rotation.x = -0.6; body.add(a);
      blob(a, M.skin, 0,-0.18,-0.05, 0.15,0.25,0.15);
      blob(a, M.skin, 0,-0.42,-0.15, 0.11,0.18,0.11);
      cone(a, M.claw, -0.04,-0.6,-0.2, 0.04,0.12, Math.PI);
      cone(a, M.claw, 0.04,-0.6,-0.2, 0.04,0.12, Math.PI);
      arms.push(a);
    }
    const legs = [dLeg(body,M,0.72,2.1,0.35,2.1,0.6), dLeg(body,M,-0.72,2.1,0.35,2.1,0.6)];
    const T = dTail(body, M, 0,2.6,1.5, 6, 0.7, 0.78);
    A.tailSegs = T.segs; A.head = head; A.headAmp = 0.04;
    return {body, legs, arms, tail:T.base, head, A};
  },
  raptor(M){
    const body = new THREE.Group(), A = {}, crest = lam(0x2fb8ff);
    A.chest = blob(body, M.skin, 0,1.5,0.05, 0.46,0.44,0.85);
    blob(body, M.belly, 0,1.36,-0.15, 0.36,0.32,0.65);
    for(let k=0; k<4; k++) blob(body, M.dark, 0,1.87,-0.45+k*0.3, 0.4,0.08,0.09, false);
    const neck = blob(body, M.skin, 0,1.82,-0.72, 0.24,0.36,0.26); neck.rotation.x = 0.5;
    const head = new THREE.Group(); head.position.set(0,2.08,-1.0); body.add(head);
    blob(head, M.skin, 0,0,-0.15, 0.27,0.25,0.38);
    blob(head, M.skin, 0,-0.04,-0.5, 0.19,0.15,0.3);
    for(const s of [-1,1]) eye(head, s*0.21,0.07,-0.25, 0.085, s);
    for(let k=0; k<3; k++) cone(head, crest, 0, 0.27, -0.05+k*0.13, 0.06, 0.3, 0.7);
    teeth(head, M.bone, [-0.15,0.15], -0.15, [-0.4,-0.52,-0.64], 0.06, true);
    const jaw = new THREE.Group(); jaw.position.set(0,-0.1,-0.12); head.add(jaw);
    blob(jaw, M.belly, 0,-0.06,-0.35, 0.16,0.07,0.32);
    A.jaw = jaw;
    const arms = [];
    for(const s of [-1,1]){
      const a = new THREE.Group(); a.position.set(s*0.36,1.65,-0.55); a.rotation.x = -0.7; body.add(a);
      blob(a, M.skin, 0,-0.15,-0.05, 0.08,0.18,0.08);
      cone(a, crest, s*0.05,-0.15,0.08, 0.05,0.3, 0.9);
      cone(a, M.claw, 0,-0.35,-0.06, 0.03,0.1, Math.PI);
      arms.push(a);
    }
    const legs = [];
    for(const s of [-1,1]){
      const l = dLeg(body, M, s*0.3, 1.2, 0.15, 1.2, 0.3);
      cone(l, M.claw, -s*0.12, -1.0, -0.15, 0.05, 0.28, -0.6);        // griffe en faucille
      legs.push(l);
    }
    const T = dTail(body, M, 0,1.55,0.85, 7, 0.45, 0.32, 0.02);
    for(let k=0; k<3; k++) cone(T.tip, crest, 0, 0.05, 0.35+k*0.05, 0.07, 0.35, Math.PI/2 + (k-1)*0.4);
    A.tailSegs = T.segs; A.head = head; A.headAmp = 0.1;
    return {body, legs, arms, tail:T.base, head, A};
  },
  brachio(M){
    const body = new THREE.Group(), A = {};
    A.chest = blob(body, M.skin, 0,3.9,0, 1.35,1.25,2.1);
    blob(body, M.belly, 0,3.55,0, 1.15,0.95,1.8);
    for(let k=0; k<10; k++){
      const s = k%2 ? 1 : -1;
      if(k < 6) blob(body, M.dark, s*1.12, 4.1+rnd(-0.3,0.5), rnd(-1.4,1.4), 0.25,0.32,0.42, false);
      else blob(body, M.dark, rnd(-0.6,0.6), 5.1, rnd(-1.2,1.2), 0.36,0.1,0.36, false);
    }
    const neck = new THREE.Group(); neck.position.set(0,4.6,-1.7); body.add(neck);
    for(let i=0; i<8; i++){
      const r = lerp(0.62, 0.34, i/7);
      blob(neck, M.skin, 0, i*0.6, -i*0.28 + i*i*0.01, r, r*1.15, r);
    }
    const head = new THREE.Group(); head.position.set(0,4.6,-1.75); neck.add(head);
    blob(head, M.skin, 0,0,-0.2, 0.42,0.36,0.55);
    blob(head, M.skin, 0,-0.08,-0.65, 0.32,0.26,0.35);
    blob(head, M.dark, 0,0.3,-0.25, 0.25,0.18,0.3);
    for(const s of [-1,1]) eye(head, s*0.34,0.1,-0.3, 0.11, s);
    blob(head, M.mouth, 0,-0.22,-0.75, 0.2,0.03,0.14, false);
    const legs = [];
    [[0.9,-1.35],[-0.9,-1.35],[0.9,1.35],[-0.9,1.35]].forEach(([x,z]) => {
      const l = dLeg(body, M, x, 2.8, z, 2.8, 0.55, 0);
      for(let k=0; k<3; k++) blob(l, M.bone, (k-1)*0.2, -2.72, -0.68, 0.09,0.07,0.07, false);
      legs.push(l);
    });
    const T = dTail(body, M, 0,3.7,2.0, 7, 0.75, 0.75, 0.1, false);
    A.tailSegs = T.segs; A.neck = neck; A.head = head; A.headAmp = 0.05;
    return {body, legs, arms:[], tail:T.base, head, A};
  },
  stego(M){
    const body = new THREE.Group(), A = {};
    const plateA = lam(0xff8a3c), plateB = lam(0xffc04a);
    A.chest = blob(body, M.skin, 0,1.85,0.1, 0.95,0.85,1.45);
    blob(body, M.skin, 0,2.1,0.4, 0.85,0.75,0.95);
    blob(body, M.belly, 0,1.55,0.05, 0.8,0.55,1.25);
    blob(body, M.skin, 0,1.45,-1.25, 0.42,0.38,0.5);
    const head = new THREE.Group(); head.position.set(0,1.25,-1.65); body.add(head);
    blob(head, M.skin, 0,0,-0.15, 0.3,0.26,0.42);
    blob(head, M.belly, 0,-0.06,-0.5, 0.18,0.14,0.2);
    for(const s of [-1,1]) eye(head, s*0.24,0.08,-0.2, 0.08, s);
    const jaw = new THREE.Group(); jaw.position.set(0,-0.12,-0.1); head.add(jaw);
    blob(jaw, M.belly, 0,-0.04,-0.3, 0.17,0.06,0.25);
    A.jaw = jaw;
    const PL = new THREE.OctahedronGeometry(1,0);
    for(let i=0; i<8; i++){
      const u = i/7, z = -1.0 + u*2.4, h = 0.35 + Math.sin(Math.PI*u)*0.45, yb = 2.45 + Math.sin(Math.PI*u)*0.45, s = i%2 ? 1 : -1;
      const p = new THREE.Mesh(PL, i%2 ? plateA : plateB);
      p.scale.set(0.06, h, h*0.8); p.position.set(s*0.13, yb + h*0.5, z); p.rotation.z = s*0.12;
      p.castShadow = true; body.add(p);
    }
    const T = dTail(body, M, 0,1.9,1.4, 5, 0.5, 0.45, 0.06);
    for(const s of [-1,1]) for(const k of [0,1]) cone(T.tip, M.bone, s*0.15, 0.2, 0.2+k*0.3, 0.07, 0.6, 0, 0, s*1.0);
    const legs = [
      dLeg(body,M,0.55,1.05,-0.8,1.05,0.36), dLeg(body,M,-0.55,1.05,-0.8,1.05,0.36),
      dLeg(body,M,0.6,1.05,0.85,1.05,0.42), dLeg(body,M,-0.6,1.05,0.85,1.05,0.42)
    ];
    A.tailSegs = T.segs; A.head = head; A.headAmp = 0.06;
    return {body, legs, arms:[], tail:T.base, head, A};
  },
  ptero(M){
    const body = new THREE.Group(), A = {}, beak = lam(0xffc04a), crest = lam(0xff5a7a);
    const memb = lam(new THREE.Color(M.skin.color).lerp(new THREE.Color(0xffe0f0), 0.35), {side:THREE.DoubleSide});
    blob(body, M.skin, 0,0,0, 0.35,0.3,0.75);
    blob(body, M.belly, 0,-0.1,-0.1, 0.28,0.2,0.55);
    const head = new THREE.Group(); head.position.set(0,0.15,-0.85); body.add(head);
    blob(head, M.skin, 0,0,-0.1, 0.24,0.22,0.3);
    cone(head, beak, 0,-0.03,-0.75, 0.1, 0.9, -Math.PI/2);
    cone(head, crest, 0,0.18,0.3, 0.07, 0.7, Math.PI/2 - 0.3);
    for(const s of [-1,1]) eye(head, s*0.17,0.06,-0.12, 0.07, s);
    const sh = new THREE.Shape();
    sh.moveTo(0,0.4); sh.lineTo(1.6,0.7); sh.lineTo(3.3,0.2); sh.lineTo(2.4,-0.4); sh.lineTo(1.2,-0.6); sh.lineTo(0,-0.5); sh.lineTo(0,0.4);
    const wg = new THREE.ShapeGeometry(sh); wg.rotateX(-Math.PI/2);
    const mkWing = (s) => {
      const w = new THREE.Group(); w.position.set(s*0.25,0.05,0); body.add(w);
      const m = new THREE.Mesh(wg, memb); m.scale.x = s; m.castShadow = true; w.add(m);
      const bone = new THREE.Mesh(BOX, M.dark); bone.scale.set(3.3,0.08,0.1); bone.position.set(s*1.65,0.02,-0.45); w.add(bone);
      return w;
    };
    const wingL = mkWing(1), wingR = mkWing(-1);
    const T = dTail(body, M, 0,0,0.7, 3, 0.35, 0.12, 0, false);
    A.tailSegs = T.segs; A.head = head; A.headAmp = 0.08;
    return {body, legs:[], arms:[], tail:T.base, head, wingL, wingR, A};
  }
};
const DCOL = {trex:0x5fa83a, raptor:0xe08a3a, brachio:0x6fbfd0, stego:0x8a7fd8, ptero:0xd07a9a};
SAFE('dinos', () => {
  monsters.forEach(m => {
    const make = DINO[m.kind]; if(!make) return;
    const M = dMats(jit(DCOL[m.kind], 0.05));
    const d = make(M);
    m.root.remove(m.body); m.root.add(d.body);
    m.body = d.body; m.legs = d.legs; m.arms = d.arms; m.tail = d.tail; m.head = d.head;
    if(d.wingL){ m.wingL = d.wingL; m.wingR = d.wingR; }
    m.v10 = d.A; m.flashOn = undefined;
  });
  // Animations en plus : respiration, mâchoire, queue qui ondule, tête qui bouge
  const _updateMonster = updateMonster;
  updateMonster = function(m, dt, t){
    _updateMonster(m, dt, t);
    const A = m.v10; if(!A || m.dead) return;
    if(A.chest){ const b = 1 + Math.sin(t*2 + m.phase)*0.02; A.chest.scale.y = A.chest.userData.sy || (A.chest.userData.sy = A.chest.scale.y); A.chest.scale.y = A.chest.userData.sy*b; }
    if(A.jaw){
      const open = m.attackT > 0 ? Math.sin(clamp(1 - m.attackT/0.4, 0, 1)*Math.PI)*0.7 : 0.06 + Math.sin(t*1.3+m.phase)*0.04;
      A.jaw.rotation.x = -open;
    }
    if(A.tailSegs) A.tailSegs.forEach((s,i) => { s.rotation.y = Math.sin(t*2.2 + m.phase - i*0.55)*0.12; });
    if(A.neck){ A.neck.rotation.x = Math.sin(t*0.7+m.phase)*0.06; A.neck.rotation.y = Math.sin(t*0.4+m.phase)*0.18; }
    if(A.head) A.head.rotation.x = Math.sin(t*3 + m.phase)*(A.headAmp || 0.05);
  };
});

/* ---------- GROTTE REFAITE ---------- */
function lumpy(r, detail, amt){
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, seen = new Map();
  for(let i=0; i<p.count; i++){
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = x.toFixed(3)+','+y.toFixed(3)+','+z.toFixed(3);
    if(!seen.has(k)) seen.set(k, 1 + rnd(-amt, amt));
    const f = seen.get(k); p.setXYZ(i, x*f, y*f, z*f);
  }
  g.computeVertexNormals();
  return g;
}
SAFE('cave', () => {
  const S = caveScene, cx = ROOM.x, cz = ROOM.z, R = ROOM.r;
  S.background = new THREE.Color(0x150f28);
  S.fog.color.set(0x1a1434); S.fog.near = 22; S.fog.far = 95;
  S.children.forEach(o => { if(o.isHemisphereLight){ o.color.set(0xa8b4ff); o.groundColor.set(0x3a2440); o.intensity = 1.0; } });

  // Textures : sol en pierres, parois en couches violettes
  const floorTex = makeTex(256, (g,s) => {
    g.fillStyle = '#7a6a7e'; g.fillRect(0,0,s,s);
    for(let i=0; i<70; i++){
      const x = rnd(0,s), y = rnd(0,s), rx = rnd(8,22), ry = rnd(6,16), v = Math.floor(rnd(120,170));
      g.fillStyle = `rgb(${v},${v-12},${v+4})`; g.beginPath(); g.ellipse(x,y,rx,ry,rnd(0,3),0,TAU); g.fill();
      g.strokeStyle = 'rgba(40,25,45,.5)'; g.lineWidth = 2; g.stroke();
    }
    for(let i=0; i<40; i++){ g.fillStyle = 'rgba(80,200,170,.28)'; g.beginPath(); g.arc(rnd(0,s), rnd(0,s), rnd(3,9), 0, TAU); g.fill(); }
  }, 10);
  const strataC = makeTex(128, (g,s) => {
    const C = ['#5a4470','#6e5486','#4a3a60','#7d62a0','#3e3052'];
    for(let y=0; y<s;){ const h = rnd(6,20); g.fillStyle = C[Math.floor(rnd(0,C.length))]; g.fillRect(0,y,s,h); y += h; }
    for(let i=0; i<60; i++){ g.fillStyle = 'rgba(160,230,255,.35)'; g.fillRect(rnd(0,s), rnd(0,s), 2, 2); }
  }, 1);
  const rockC = makeTex(128, (g,s) => {
    g.fillStyle = '#8a7aa0'; g.fillRect(0,0,s,s);
    for(let i=0; i<500; i++){ const v = Math.floor(rnd(90,170)); g.fillStyle = `rgba(${v},${v-10},${v+20},.5)`; g.fillRect(rnd(0,s), rnd(0,s), rnd(2,6), rnd(2,6)); }
  }, 1);
  S.children.forEach(o => {
    if(!o.isMesh || !o.geometry.parameters) return;
    const p = o.geometry.parameters, t = o.geometry.type;
    if(t === 'CircleGeometry' && Math.abs(p.radius-(R+4)) < 0.01) o.material = lam(0xffffff, {map:floorTex});
    if(t === 'CylinderGeometry' && Math.abs(p.radiusTop-(R+8)) < 0.01){ strataC.repeat.set(8, 1.2); o.material = lam(0xffffff, {map:strataC, side:THREE.BackSide}); }
    if(t === 'SphereGeometry' && Math.abs(p.radius-(R+8)) < 0.01) o.material = lam(0x4a3a66, {map:rockC, side:THREE.BackSide});
  });

  // Murs cassables : de vrais rochers bosselés
  const LUMP = lumpy(0.62, 1, 0.14), LUMP2 = lumpy(1, 1, 0.18);
  const wallMs = [lam(0x9a88b4, {map:rockC}), lam(0x86749e, {map:rockC})];
  caveWalls.forEach((w,k) => {
    w.m.geometry = LUMP; w.m.material = wallMs[k%2];
    w.top.geometry = LUMP2; w.top.material = wallMs[(k+1)%2];
  });

  // Gros rochers derrière les murs (quand on casse un mur, on voit de la roche)
  for(let k=0; k<46; k++){
    const a = k/46*TAU + rnd(-0.05,0.05);
    if(angDiff(a, Math.PI/2) < 0.12) continue;
    const d = rnd(37.5,41), s = rnd(3,5.5), r = new THREE.Mesh(LUMP2, wallMs[k%2]);
    r.scale.set(s, rnd(4,8), s); r.position.set(cx+Math.cos(a)*d, rnd(1,4), cz+Math.sin(a)*d); r.rotation.y = rnd(0,3);
    S.add(r);
  }

  // Où peut-on poser un décor sans gêner le jeu ?
  const caveFree = (x,z,r) => hyp(x,z,cx,cz) < 30 && hyp(x,z,cx,cz) > 7 && hyp(x,z,EXIT.x,EXIT.z) > 8 &&
    CAVE_COL.every(c => hyp(c.x,c.z,x,z) > c.r + r + 0.6) &&
    (typeof TRAILS === 'undefined' || TRAILS.every(tr => tr.pts.every(p => hyp(p.x,p.z,x,z) > r + 1.5))) &&
    pickups.every(p => p.scn !== caveScene || hyp(p.g.position.x,p.g.position.z,x,z) > r + 1.5);
  const domeY = d => 0.35*Math.sqrt(Math.max(0, (R+8)*(R+8) - d*d));
  const colM = lam(0x9a88b4, {map:rockC});

  // Piliers du sol au plafond
  for(let i=0, n=0; i<600 && n<7; i++){
    const a = rnd(0,TAU), d = rnd(18,28), x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d;
    if(!caveFree(x,z,1.6)) continue;
    const top = domeY(d) + 1, g = new THREE.Group();
    const lo = new THREE.Mesh(CONE, colM); lo.scale.set(1.6, top*0.6, 1.6); lo.position.y = top*0.3; g.add(lo);
    const hi = new THREE.Mesh(CONE, colM); hi.scale.set(1.5, top*0.6, 1.5); hi.rotation.x = Math.PI; hi.position.y = top*0.7; g.add(hi);
    const mid = new THREE.Mesh(LUMP2, colM); mid.scale.set(0.7, 1.4, 0.7); mid.position.y = top*0.5; g.add(mid);
    g.position.set(x,0,z); S.add(g);
    CAVE_COL.push({x, z, r:1.5}); n++;
  }
  // Stalagmites
  for(let i=0, n=0; i<800 && n<22; i++){
    const a = rnd(0,TAU), d = rnd(9,29), x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d;
    if(!caveFree(x,z,0.6)) continue;
    const h = rnd(1.2,3.2), st = new THREE.Mesh(CONE, colM); st.scale.set(rnd(0.4,0.7), h, rnd(0.4,0.7));
    st.position.set(x, h/2, z); S.add(st);
    if(Math.random() < 0.5){ const s2 = new THREE.Mesh(CONE, colM); s2.scale.set(0.3, h*0.55, 0.3); s2.position.set(x+0.5, h*0.27, z+0.3); S.add(s2); }
    CAVE_COL.push({x, z, r:0.6}); n++;
  }
  // Stalactites avec bout lumineux + lianes qui brillent
  const tipMs = [0x66ffe0, 0xff7ad9, 0xb58cff].map(c => new THREE.MeshBasicMaterial({color:c}));
  const vineMs = [lam(0x2fd6a0, {emissive:0x0f6a50}), lam(0xb06aff, {emissive:0x40206a})];
  for(let k=0; k<34; k++){
    const a = rnd(0,TAU), d = rnd(3,31), x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d, y = domeY(d), h = rnd(1.5,4);
    const st = new THREE.Mesh(CONE, colM); st.scale.set(rnd(0.4,0.9), h, rnd(0.4,0.9)); st.rotation.x = Math.PI;
    st.position.set(x, y - h/2 + 0.3, z); S.add(st);
    if(k%2 === 0){ const tp = new THREE.Mesh(SPH8, tipMs[k%3]); tp.scale.setScalar(0.12); tp.position.set(x, y-h+0.35, z); S.add(tp); }
  }
  for(let k=0; k<26; k++){
    const a = rnd(0,TAU), d = rnd(6,30), x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d, y = domeY(d), len = rnd(2,5);
    const v = new THREE.Group(); v.position.set(x, y, z); S.add(v);
    const s = new THREE.Mesh(BOX, vineMs[k%2]); s.scale.set(0.06, len, 0.06); s.position.y = -len/2; v.add(s);
    for(let j=0; j<5; j++){ const l = new THREE.Mesh(SPH8, vineMs[k%2]); l.scale.set(0.12,0.06,0.09); l.position.set(0, -len*(j+0.5)/5, 0.04); v.add(l); }
    const ph = rnd(0,6); ANIM.push(t => { v.rotation.z = Math.sin(t*0.9+ph)*0.06; v.rotation.x = Math.cos(t*0.7+ph)*0.05; });
  }

  // Bassin lumineux entouré de pierres
  for(let i=0; i<400; i++){
    const a = rnd(0,TAU), d = rnd(14,24), x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d;
    if(!caveFree(x,z,4.2)) continue;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32),
      new THREE.MeshPhongMaterial({color:0x2fc8d8, emissive:0x0a4a5a, shininess:150, specular:0xffffff, transparent:true, opacity:0.88}));
    pool.rotation.x = -Math.PI/2; pool.position.set(x, 0.06, z); S.add(pool);
    for(let k=0; k<14; k++){
      const b = k/14*TAU, r = new THREE.Mesh(LUMP2, wallMs[k%2]); r.scale.set(rnd(0.5,0.8), rnd(0.3,0.5), rnd(0.5,0.8));
      r.position.set(x+Math.cos(b)*3.9, 0.15, z+Math.sin(b)*3.9); S.add(r);
    }
    const pl = new THREE.PointLight(0x4fe8ff, 0.9, 12, 1.5); pl.position.set(x, 1.2, z); S.add(pl);
    ANIM.push(t => { pool.material.emissive.setHSL(0.52, 0.8, 0.12 + Math.sin(t*1.4)*0.04); });
    CAVE_COL.push({x, z, r:3.9});
    break;
  }

  // Cercle de runes autour du cristal + lumières colorées
  const runes = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.07, 6, 60), new THREE.MeshBasicMaterial({color:0x66ffe0, transparent:true, opacity:0.8}));
  runes.rotation.x = Math.PI/2; runes.position.set(cx, 0.06, cz); S.add(runes);
  ANIM.push(t => { runes.material.opacity = 0.55 + Math.sin(t*2)*0.3; runes.rotation.z = t*0.2; });
  [[0x9a6aff, -18, -12], [0xff6ad0, 16, -16]].forEach(([c, dx, dz]) => {
    const L = new THREE.PointLight(c, 0.8, 30, 1.4); L.position.set(cx+dx, 6, cz+dz); S.add(L);
  });

  // Cailloux au sol
  const peb = new THREE.InstancedMesh(DODEC, lam(0xffffff), 300), D = new THREE.Object3D(), TC = new THREE.Color();
  for(let i=0; i<300; i++){
    const a = rnd(0,TAU), d = Math.sqrt(Math.random())*31, s = rnd(0.08,0.35);
    D.position.set(cx+Math.cos(a)*d, s*0.2, cz+Math.sin(a)*d); D.rotation.set(0,rnd(0,3),0); D.scale.set(s, s*0.6, s); D.updateMatrix();
    peb.setMatrixAt(i, D.matrix); const v = rnd(0.5,0.75); TC.setRGB(v*0.95, v*0.88, v); peb.setColorAt(i, TC);
  }
  peb.frustumCulled = false; peb.instanceMatrix.needsUpdate = true; if(peb.instanceColor) peb.instanceColor.needsUpdate = true;
  S.add(peb);

  // Les champignons lumineux du patch 4A deviennent solides
  S.children.forEach(o => {
    if(!o.isGroup || !o.children.some(ch => ch.geometry === SPH)) return;
    const x = o.position.x, z = o.position.z;
    if(npcs.some(n => n.g === o) || CAVE_COL.some(c => hyp(c.x,c.z,x,z) < c.r)) return;
    CAVE_COL.push({x, z, r:0.9});
  });
});
function angDiff(a,b){ return Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b))); }

/* ---------- COLLISIONS EN PLUS ---------- */
SAFE('collisions', () => {
  // Les rochers sur les côtés de l'entrée de la grotte
  const th = Math.atan2(MOUTH.x-MOUNT.x, MOUTH.z-MOUNT.z), fx = Math.sin(th), fz = Math.cos(th), rx = Math.cos(th), rz = -Math.sin(th);
  for(const s of [-1,1]) COL.push({x:MOUTH.x + rx*6.5*s + fx*0.8, z:MOUTH.z + rz*6.5*s + fz*0.8, r:2.2});

  // On ne traverse plus les dinosaures, les villageois ni les gobelins
  const DR = {trex:1.5, raptor:0.7, brachio:2.2, stego:1.4};
  const _updatePlayer = updatePlayer;
  updatePlayer = function(dt, t){
    _updatePlayer(dt, t);
    const pl = player.position;
    const push = (x, z, r) => {
      const dx = pl.x-x, dz = pl.z-z, d = Math.hypot(dx,dz), mn = r + 0.45;
      if(d < mn && d > 0.001){ pl.x = x + dx/d*mn; pl.z = z + dz/d*mn; }
    };
    if(zone === 'world') for(const m of monsters){
      if(m.dead || m.spec.fly || m.grabbed || !DR[m.kind]) continue;
      push(m.root.position.x, m.root.position.z, DR[m.kind]*m.spec.scale);
    }
    const scn = curScene();
    for(const n of npcs){
      if(n.g.parent !== scn) continue;
      if(typeof bigHeld !== 'undefined' && bigHeld && bigHeld.root === n.g) continue;
      push(n.g.position.x, n.g.position.z, 0.35);
    }
  };
});

/* ---------- BOUCLE DES ANIMATIONS ---------- */
let last = performance.now();
(function loop10(){
  requestAnimationFrame(loop10);
  const now = performance.now(), dt = Math.min(0.05, (now-last)/1000), t = now/1000;
  last = now; U.value = t;
  if(window.VOITURE_ON) return;
  for(const f of ANIM){ try{ f(t,dt); }catch(e){} }
})();
})();
/* ==========================================================
   PATCH 11 : DINOSAURES EN STYLE « PAPIER PLIÉ » (low-poly)
   - Corps d'un seul tenant, fait de facettes triangulaires
     bien nettes, comme une sculpture en papier
   - Deux couleurs : dos foncé, ventre clair, pattes brunes,
     avec une frontière en zigzag entre les deux
   - Formes réalistes : grosse tête, mâchoire avec rangées de
     dents pointues, petits yeux noirs, griffes noires
   - Les animations du patch 10 continuent de marcher
     (mâchoire, queue qui ondule, cou du brachiosaure)
   À coller TOUT EN BAS du script, APRÈS le patch 10.
   ========================================================== */
(function(){
if(window.__PATCH11) return;
window.__PATCH11 = true;

const V3 = THREE.Vector3, TAU = Math.PI*2;

/* ---------- MATÉRIAUX (un jeu par dinosaure, pour le flash rouge) ---------- */
const flat = (o) => new THREE.MeshPhongMaterial(Object.assign({flatShading:true, shininess:8, specular:0x222222, side:THREE.DoubleSide}, o));
function mats(P){
  return {
    // La couleur du matériau assombrit un peu les couleurs du papier (sinon elles paraissent délavées au soleil)
    body:  flat({vertexColors:true, color:0x9c9c9c}),
    top:   flat({color:new THREE.Color(P.top).multiplyScalar(0.6)}),
    bone:  flat({color:0xf4ecd8}),
    claw:  flat({color:0x2a2420}),
    mouth: flat({color:P.mouth || 0x7a1e22})
  };
}
const EYE = new THREE.MeshBasicMaterial({color:0x0a0a0a});
const EYE_GEO = new THREE.OctahedronGeometry(1, 0);
const TOOTH = new THREE.ConeGeometry(1, 1, 4);
const TETRA = new THREE.TetrahedronGeometry(1, 0);

/* ---------- LOFT : un tube à facettes qui suit une suite de sections ----------
   secs : [{p:[x,y,z], r:[largeur, hauteur]}, ...]
   o.col(s,u) : couleur selon la hauteur sur la section (s de -1 à 1) et la position (u de 0 à 1) */
function loft(secs, o={}){
  const N = o.sides || 6, jit = o.jit === undefined ? 0.07 : o.jit, rot = o.rot === undefined ? Math.PI/2 : o.rot;
  const P = secs.map(s => new V3(s.p[0], s.p[1], s.p[2]));
  const rings = [];
  for(let i=0; i<P.length; i++){
    const t = new V3().subVectors(P[Math.min(P.length-1,i+1)], P[Math.max(0,i-1)]).normalize();
    const ref = Math.abs(t.y) > 0.85 ? new V3(0,0,-1) : new V3(0,1,0);
    const side = new V3().crossVectors(t, ref).normalize(), up = new V3().crossVectors(side, t).normalize();
    // « Le haut » de la section : la verticale vue depuis l'axe (le dos du cou reste foncé)
    const dorsal = new V3(0,1,0).addScaledVector(t, -t.y);
    if(dorsal.lengthSq() < 0.01) dorsal.set(0,0,1); dorsal.normalize();
    const [rx, ry] = secs[i].r, ring = [];
    for(let k=0; k<N; k++){
      const a = k/N*TAU + rot, f = 1 + (Math.random()*2-1)*jit;
      const off = side.clone().multiplyScalar(Math.cos(a)*rx*f).addScaledVector(up, Math.sin(a)*ry*f);
      ring.push({v:P[i].clone().add(off), s:clamp(off.dot(dorsal) / Math.max(rx,ry,0.001), -1, 1)});
    }
    rings.push(ring);
  }
  const pos = [], col = [], c = new THREE.Color();
  const tri = (a, b, d, u) => {
    pos.push(a.v.x,a.v.y,a.v.z, b.v.x,b.v.y,b.v.z, d.v.x,d.v.y,d.v.z);
    c.setHex(o.col ? o.col((a.s+b.s+d.s)/3, u) : 0x888888);
    c.offsetHSL(0, 0, (Math.random()*2-1)*0.035);
    for(let k=0; k<3; k++) col.push(c.r, c.g, c.b);
  };
  const n = rings.length;
  for(let i=0; i<n-1; i++){
    const u = (i+0.5)/(n-1);
    for(let k=0; k<N; k++){
      const a = rings[i][k], b = rings[i][(k+1)%N], cc = rings[i+1][(k+1)%N], d = rings[i+1][k];
      if((i+k)%2){ tri(a,b,cc,u); tri(a,cc,d,u); } else { tri(a,b,d,u); tri(b,cc,d,u); }
    }
  }
  const cap = (ring, tip, u) => {
    const ctr = tip ? {v:new V3(...tip), s:0} : {v:ring.reduce((s,p) => s.add(p.v), new V3()).multiplyScalar(1/N), s:0};
    for(let k=0; k<N; k++) tri(ring[k], ring[(k+1)%N], ctr, u);
  };
  cap(rings[0], o.tip0, 0);
  cap(rings[n-1], o.tip1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function add(par, geo, m, x=0, y=0, z=0, shadow=true){
  const o = new THREE.Mesh(geo, m); o.position.set(x,y,z);
  o.castShadow = shadow; o.receiveShadow = true; par.add(o); return o;
}
// Dos / ventre avec une frontière en zigzag
const two = (top, belly, edge=-0.1) => (s) => (s + (Math.random()*2-1)*0.18 > edge ? top : belly);
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t,0,1)).getHex();
function eye(par, x, y, z, r){ const e = new THREE.Mesh(EYE_GEO, EYE); e.position.set(x,y,z); e.scale.set(r, r*0.8, r); par.add(e); return e; }
function tooth(par, m, x, y, z, w, h, down){ const t = new THREE.Mesh(TOOTH, m); t.position.set(x,y,z); t.scale.set(w, h, w); if(down) t.rotation.x = Math.PI; par.add(t); }
function claw(par, m, x, y, z, w, len, rx=-Math.PI/2){ const t = new THREE.Mesh(TOOTH, m); t.position.set(x,y,z); t.scale.set(w, len, w); t.rotation.x = rx; par.add(t); }

// Queue en plusieurs morceaux emboîtés (pour qu'elle puisse onduler)
function tail(body, M, P, base, parts){
  const root = new THREE.Group(); root.position.set(...base); body.add(root);
  const segs = []; let par = root;
  parts.forEach((pt, i) => {
    const sg = new THREE.Group(); if(i) sg.position.set(0, parts[i-1].drop, parts[i-1].len); par.add(sg); segs.push(sg);
    const last = i === parts.length-1;
    const col = (s, u) => two(mix(P.top, P.tailTop || P.top, (i+u)/parts.length), P.belly)(s);
    const geo = loft([
      {p:[0,0,-0.12], r:[pt.r0, pt.r0*0.93]},
      {p:[0,pt.drop*0.5,pt.len*0.5], r:[(pt.r0+pt.r1)/2, (pt.r0+pt.r1)/2*0.92]},
      {p:[0,pt.drop,pt.len], r:[pt.r1, pt.r1*0.9]}
    ], {sides:6, col, tip1: last ? [0, pt.drop + (pt.tipDrop||0), pt.len + (pt.tipLen||0.4)] : null});
    add(sg, geo, M.body);
    par = sg;
  });
  return {root, segs, tip:par};
}
// Patte : pivot à la hanche, pied au sol à -len
function leg(body, M, P, x, hip, z, len, th, o={}){
  const piv = new THREE.Group(); piv.position.set(x, hip, z); body.add(piv);
  const col = (s, u) => u < 0.3 ? two(P.top, P.belly)(s) : P.leg;
  const secs = o.column ? [
    {p:[0, 0.15, 0],          r:[th*0.95, th*1.05]},
    {p:[0, -len*0.35, 0.02],  r:[th*0.85, th*0.9]},
    {p:[0, -len*0.7, -0.02],  r:[th*0.7, th*0.72]},
    {p:[0, -len+th*0.22, 0],  r:[th*0.78, th*0.8]}
  ] : [
    {p:[0, 0.15, 0.05],       r:[th*0.8, th*0.95]},
    {p:[0, -len*0.28, 0.12],  r:[th*0.95, th*1.05]},
    {p:[0, -len*0.52, -0.12], r:[th*0.5, th*0.55]},
    {p:[0, -len*0.82, 0.22],  r:[th*0.3, th*0.32]},
    {p:[0, -len+th*0.22, 0.05], r:[th*0.33, th*0.25]}
  ];
  add(piv, loft(secs, {sides:6, col, tip1: o.column ? [0, -len, 0] : null}), M.body);
  const toes = o.toes === undefined ? 3 : o.toes;
  for(let k=0; k<toes; k++){
    const dx = (k-(toes-1)/2)*th*0.45, fy = -len+th*0.18, tz = -th*(o.column ? 0.85 : 1.35);
    add(piv, loft([{p:[dx*0.5, fy, 0], r:[th*0.17, th*0.15]}, {p:[dx, fy-0.02, tz], r:[th*0.14, th*0.12]}],
      {sides:4, col:() => P.leg, jit:0.03}), M.body);
    claw(piv, o.column ? M.bone : M.claw, dx, fy-0.03, tz-th*0.12, th*0.09, th*0.3);
  }
  return piv;
}

/* ---------- LES ESPÈCES ---------- */
const PAL = {
  trex:    {top:0x5e8f2a, belly:0xc8843f, leg:0x6e4426, tailTop:0x7a4a2a},
  raptor:  {top:0x5fbf3a, belly:0x9fd870, leg:0x4f9a35, mouth:0xc0302a},
  brachio: {top:0x5f84a0, belly:0xd0b88a, leg:0x4d6a84, tailTop:0x55779a},
  stego:   {top:0x5f7a32, belly:0xc89a5a, leg:0x4e6328, plate:0xc0401f},
  ptero:   {top:0xa04a2a, belly:0xd88a50, leg:0x6e3018, wing:0xc8763a}
};
const BUILD = {
  trex(P, M){
    const body = new THREE.Group(), A = {headAmp:0.03}, tb = two(P.top, P.belly);
    add(body, loft([
      {p:[0,3.35,-1.6], r:[0.5,0.55]}, {p:[0,3.0,-1.05], r:[0.82,0.95]}, {p:[0,2.62,-0.2], r:[1.0,1.0]},
      {p:[0,2.72,0.7], r:[0.9,0.85]},  {p:[0,2.72,1.45], r:[0.68,0.62]}
    ], {sides:7, col:tb}), M.body);
    const head = new THREE.Group(); head.position.set(0,3.55,-1.75); body.add(head);
    add(head, loft([
      {p:[0,0.05,0.25], r:[0.42,0.45]}, {p:[0,0.22,-0.3], r:[0.52,0.52]}, {p:[0,0.15,-0.85], r:[0.44,0.38]},
      {p:[0,0.05,-1.3], r:[0.34,0.27]}, {p:[0,0,-1.58], r:[0.2,0.14]}
    ], {sides:6, col:tb, tip1:[0,-0.02,-1.7]}), M.body);
    const pal = new THREE.Mesh(BOX, M.mouth); pal.scale.set(0.6,0.05,1.1); pal.position.set(0,-0.12,-0.8); head.add(pal);
    for(let k=0; k<6; k++) for(const s of [-1,1]) tooth(head, M.bone, s*(0.4-k*0.035), -0.2, -0.45-k*0.2, 0.055, 0.18, true);
    for(const s of [-1,1]){
      eye(head, s*0.42, 0.42, -0.5, 0.07);
      const br = new THREE.Mesh(TETRA, M.top); br.scale.setScalar(0.13); br.position.set(s*0.36,0.6,-0.5); head.add(br);
    }
    const jaw = new THREE.Group(); jaw.position.set(0,-0.14,-0.15); head.add(jaw);
    add(jaw, loft([{p:[0,-0.02,0.1], r:[0.38,0.2]}, {p:[0,-0.1,-0.6], r:[0.37,0.16]}, {p:[0,-0.08,-1.2], r:[0.24,0.1]}],
      {sides:6, col:two(mix(P.belly,P.top,0.25), P.belly, 0.2), tip1:[0,-0.06,-1.38]}), M.body);
    const tg = new THREE.Mesh(BOX, M.mouth); tg.scale.set(0.5,0.05,1.0); tg.position.set(0,0.02,-0.6); jaw.add(tg);
    for(let k=0; k<5; k++) for(const s of [-1,1]) tooth(jaw, M.bone, s*(0.33-k*0.03), 0.1, -0.4-k*0.18, 0.05, 0.15, false);
    A.jaw = jaw; A.head = head;
    const arms = [];
    for(const s of [-1,1]){
      const a = new THREE.Group(); a.position.set(s*0.62,2.85,-1.15); a.rotation.x = -0.6; body.add(a);
      add(a, loft([{p:[0,0,0], r:[0.15,0.16]}, {p:[0,-0.3,-0.05], r:[0.11,0.12]}, {p:[0,-0.5,-0.18], r:[0.08,0.08]}], {sides:5, col:tb}), M.body);
      claw(a, M.claw, -0.04,-0.58,-0.24, 0.035, 0.14, -Math.PI*0.8);
      claw(a, M.claw,  0.04,-0.58,-0.24, 0.035, 0.14, -Math.PI*0.8);
      arms.push(a);
    }
    const legs = [leg(body,M,P,0.72,2.1,0.35,2.1,0.6), leg(body,M,P,-0.72,2.1,0.35,2.1,0.6)];
    const T = tail(body, M, P, [0,2.72,1.45], [
      {len:1.3, r0:0.66, r1:0.48, drop:-0.05}, {len:1.3, r0:0.5, r1:0.3, drop:-0.1}, {len:1.5, r0:0.32, r1:0.1, drop:-0.12, tipLen:0.5}
    ]);
    A.tailSegs = T.segs;
    return {body, legs, arms, tail:T.root, head, A};
  },
  raptor(P, M){
    const body = new THREE.Group(), A = {headAmp:0.08}, tb = two(P.top, P.belly);
    add(body, loft([
      {p:[0,1.62,-0.55], r:[0.22,0.26]}, {p:[0,1.55,-0.3], r:[0.38,0.4]}, {p:[0,1.5,0.1], r:[0.42,0.42]},
      {p:[0,1.55,0.6], r:[0.35,0.35]},   {p:[0,1.55,0.9], r:[0.27,0.27]}
    ], {sides:6, col:tb}), M.body);
    add(body, loft([{p:[0,1.6,-0.5], r:[0.2,0.22]}, {p:[0,1.88,-0.72], r:[0.16,0.19]}, {p:[0,2.06,-0.92], r:[0.14,0.16]}], {sides:5, col:tb}), M.body);
    const head = new THREE.Group(); head.position.set(0,2.08,-1.0); body.add(head);
    add(head, loft([
      {p:[0,0.05,0.12], r:[0.16,0.18]}, {p:[0,0.06,-0.15], r:[0.19,0.19]}, {p:[0,0.01,-0.45], r:[0.13,0.11]}, {p:[0,-0.03,-0.65], r:[0.07,0.06]}
    ], {sides:5, col:tb, tip1:[0,-0.04,-0.75]}), M.body);
    const pal = new THREE.Mesh(BOX, M.mouth); pal.scale.set(0.2,0.03,0.55); pal.position.set(0,-0.07,-0.4); head.add(pal);
    for(let k=0; k<4; k++) for(const s of [-1,1]) tooth(head, M.bone, s*(0.12-k*0.012), -0.1, -0.3-k*0.1, 0.022, 0.07, true);
    for(const s of [-1,1]) eye(head, s*0.17, 0.12, -0.18, 0.04);
    const jaw = new THREE.Group(); jaw.position.set(0,-0.08,-0.05); head.add(jaw);
    add(jaw, loft([{p:[0,-0.02,0.05], r:[0.13,0.07]}, {p:[0,-0.04,-0.35], r:[0.1,0.05]}, {p:[0,-0.03,-0.58], r:[0.05,0.03]}], {sides:5, col:() => P.belly}), M.body);
    const tg = new THREE.Mesh(BOX, M.mouth); tg.scale.set(0.16,0.03,0.5); tg.position.set(0,0.02,-0.3); jaw.add(tg);
    A.jaw = jaw; A.head = head;
    const arms = [];
    for(const s of [-1,1]){
      const a = new THREE.Group(); a.position.set(s*0.3,1.6,-0.5); a.rotation.x = -0.5; body.add(a);
      add(a, loft([{p:[0,0,0], r:[0.08,0.09]}, {p:[0,-0.25,-0.05], r:[0.06,0.06]}, {p:[0,-0.42,-0.15], r:[0.045,0.045]}], {sides:5, col:tb}), M.body);
      for(let k=0; k<3; k++) claw(a, M.claw, (k-1)*0.03, -0.48, -0.2, 0.02, 0.12, -Math.PI*0.75);
      arms.push(a);
    }
    const legs = [];
    for(const s of [-1,1]){
      const l = leg(body, M, P, s*0.3, 1.2, 0.15, 1.2, 0.3, {toes:2});
      claw(l, M.claw, -s*0.08, -1.0, -0.12, 0.04, 0.2, -0.4);               // griffe en faucille
      legs.push(l);
    }
    const T = tail(body, M, P, [0,1.55,0.9], [
      {len:0.8, r0:0.27, r1:0.2, drop:0.05}, {len:0.8, r0:0.21, r1:0.12, drop:-0.02}, {len:0.9, r0:0.13, r1:0.04, drop:-0.15, tipLen:0.3, tipDrop:-0.1}
    ]);
    A.tailSegs = T.segs;
    return {body, legs, arms, tail:T.root, head, A};
  },
  brachio(P, M){
    const body = new THREE.Group(), A = {headAmp:0.04}, tb = two(P.top, P.belly);
    add(body, loft([
      {p:[0,4.1,-1.7], r:[0.75,0.8]}, {p:[0,4.0,-1.1], r:[1.15,1.15]}, {p:[0,3.9,-0.2], r:[1.32,1.25]},
      {p:[0,3.85,1.0], r:[1.15,1.1]},  {p:[0,3.65,2.0], r:[0.75,0.7]}
    ], {sides:7, col:tb}), M.body);
    const neck = new THREE.Group(); neck.position.set(0,4.6,-1.7); body.add(neck);
    const np = []; for(let i=0; i<8; i++) np.push({p:[0, i*0.6, -i*0.28+i*i*0.01], r:[lerp(0.62,0.3,i/7), lerp(0.66,0.32,i/7)]});
    np[0].p[1] = -0.5; np[0].p[2] = 0.2;
    add(neck, loft(np, {sides:6, col:tb}), M.body);
    const head = new THREE.Group(); head.position.set(0,4.6,-1.75); neck.add(head);
    add(head, loft([
      {p:[0,0.05,0.25], r:[0.3,0.32]}, {p:[0,0.1,-0.15], r:[0.4,0.36]}, {p:[0,0,-0.55], r:[0.3,0.24]}, {p:[0,-0.05,-0.85], r:[0.2,0.15]}
    ], {sides:6, col:tb, tip1:[0,-0.07,-0.95]}), M.body);
    const crest = new THREE.Mesh(TETRA, M.top); crest.scale.set(0.22,0.18,0.3); crest.position.set(0,0.38,-0.15); head.add(crest);
    for(const s of [-1,1]) eye(head, s*0.34, 0.15, -0.3, 0.05);
    const ml = new THREE.Mesh(BOX, M.mouth); ml.scale.set(0.34,0.025,0.5); ml.position.set(0,-0.12,-0.6); head.add(ml);
    A.neck = neck; A.head = head;
    const legs = [];
    [[0.9,-1.35],[-0.9,-1.35],[0.9,1.35],[-0.9,1.35]].forEach(([x,z]) => legs.push(leg(body,M,P,x,2.8,z,2.8,0.55,{column:true})));
    const T = tail(body, M, P, [0,3.65,2.0], [
      {len:1.5, r0:0.74, r1:0.5, drop:-0.25}, {len:1.5, r0:0.52, r1:0.28, drop:-0.35}, {len:1.8, r0:0.3, r1:0.08, drop:-0.3, tipLen:0.6}
    ]);
    A.tailSegs = T.segs;
    return {body, legs, arms:[], tail:T.root, head, A};
  },
  stego(P, M){
    const body = new THREE.Group(), A = {headAmp:0.04}, tb = two(P.top, P.belly);
    const plate = flat({color:P.plate}), plate2 = flat({color:mix(P.plate,0xffc04a,0.4)});
    add(body, loft([
      {p:[0,1.45,-1.35], r:[0.3,0.3]},  {p:[0,1.8,-0.75], r:[0.75,0.7]}, {p:[0,2.12,0.3], r:[0.95,0.88]},
      {p:[0,2.05,0.95], r:[0.8,0.75]},  {p:[0,1.85,1.45], r:[0.45,0.42]}
    ], {sides:7, col:tb}), M.body);
    const head = new THREE.Group(); head.position.set(0,1.25,-1.65); body.add(head);
    add(head, loft([{p:[0,0.05,0.3], r:[0.24,0.24]}, {p:[0,0.03,-0.1], r:[0.28,0.24]}, {p:[0,-0.05,-0.45], r:[0.16,0.13]}],
      {sides:6, col:tb, tip1:[0,-0.1,-0.62]}), M.body);
    for(const s of [-1,1]) eye(head, s*0.22, 0.1, -0.12, 0.04);
    const jaw = new THREE.Group(); jaw.position.set(0,-0.12,-0.05); head.add(jaw);
    add(jaw, loft([{p:[0,0,0.1], r:[0.17,0.07]}, {p:[0,-0.02,-0.35], r:[0.11,0.05]}], {sides:5, col:() => P.belly, tip1:[0,-0.02,-0.45]}), M.body);
    A.jaw = jaw; A.head = head;
    const PL = new THREE.OctahedronGeometry(1,0);
    for(let i=0; i<9; i++){
      const u = i/8, z = -1.1 + u*2.6, h = 0.3 + Math.sin(Math.PI*u)*0.5, yb = 2.35 + Math.sin(Math.PI*u)*0.55, s = i%2 ? 1 : -1;
      const p = new THREE.Mesh(PL, i%2 ? plate : plate2);
      p.scale.set(0.05, h, h*0.75); p.position.set(s*0.12, yb + h*0.45, z); p.rotation.z = s*0.12; p.castShadow = true; body.add(p);
    }
    const T = tail(body, M, P, [0,1.85,1.45], [
      {len:0.7, r0:0.43, r1:0.3, drop:-0.08}, {len:0.8, r0:0.31, r1:0.12, drop:-0.08, tipLen:0.35}
    ]);
    for(const s of [-1,1]) for(const k of [0,1]){
      const sp = new THREE.Mesh(TOOTH, M.bone); sp.scale.set(0.07,0.65,0.07);
      sp.position.set(s*0.2, 0.15, 0.25+k*0.35); sp.rotation.z = -s*1.1; sp.rotation.x = 0.3; T.tip.add(sp);
    }
    const legs = [
      leg(body,M,P,0.55,1.05,-0.8,1.05,0.36,{column:true}), leg(body,M,P,-0.55,1.05,-0.8,1.05,0.36,{column:true}),
      leg(body,M,P,0.6,1.05,0.85,1.05,0.42,{column:true}),  leg(body,M,P,-0.6,1.05,0.85,1.05,0.42,{column:true})
    ];
    A.tailSegs = T.segs;
    return {body, legs, arms:[], tail:T.root, head, A};
  },
  ptero(P, M){
    const body = new THREE.Group(), A = {headAmp:0.06}, tb = two(P.top, P.belly);
    add(body, loft([{p:[0,0.05,-0.55], r:[0.18,0.18]}, {p:[0,0,-0.1], r:[0.32,0.28]}, {p:[0,0,0.45], r:[0.2,0.18]}], {sides:6, col:tb, tip1:[0,0,0.85]}), M.body);
    const head = new THREE.Group(); head.position.set(0,0.15,-0.8); body.add(head);
    add(head, loft([{p:[0,0,0.15], r:[0.15,0.16]}, {p:[0,0.02,-0.12], r:[0.17,0.16]}, {p:[0,-0.02,-0.5], r:[0.08,0.06]}],
      {sides:5, col:tb, tip1:[0,-0.04,-1.2]}), M.body);
    const crest = new THREE.Mesh(TETRA, flat({color:mix(P.top,0xff5a3a,0.5)})); crest.scale.set(0.08,0.2,0.45); crest.position.set(0,0.18,0.25); head.add(crest);
    for(const s of [-1,1]) eye(head, s*0.13, 0.07, -0.08, 0.035);
    // Ailes : membrane à facettes + os du bord d'attaque
    const E = [[0,0,-0.4],[1.2,0.12,-0.65],[2.2,0.05,-0.5],[3.3,-0.05,-0.15]];
    const Tr = [[0,0,0.45],[1.0,-0.05,0.55],[1.9,0.02,0.3],[3.3,-0.05,-0.15]];
    const mkWing = (s) => {
      const w = new THREE.Group(); w.position.set(s*0.25,0.05,0); body.add(w);
      const pos = [], col = [], c = new THREE.Color();
      const pt = p => [p[0]*s, p[1], p[2]];
      const tri = (a,b,d) => {
        pos.push(...pt(a), ...pt(b), ...pt(d));
        c.setHex(P.wing); c.offsetHSL(0,0,(Math.random()*2-1)*0.05);
        for(let k=0; k<3; k++) col.push(c.r, c.g, c.b);
      };
      for(let i=0; i<3; i++){ tri(E[i], E[i+1], Tr[i]); if(i < 2) tri(E[i+1], Tr[i+1], Tr[i]); else tri(E[i+1], Tr[i+1], Tr[i]); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
      g.computeVertexNormals();
      add(w, g, M.body);
      add(w, loft(E.map(p => ({p:pt(p), r:[0.05,0.05]})), {sides:4, col:() => P.leg, jit:0.02}), M.body);
      return w;
    };
    const wingL = mkWing(1), wingR = mkWing(-1);
    A.head = head;
    return {body, legs:[], arms:[], tail:new THREE.Group(), head, wingL, wingR, A};
  }
};

/* ---------- ON REMPLACE LES DINOSAURES ---------- */
try{
  monsters.forEach(m => {
    const make = BUILD[m.kind]; if(!make) return;
    const base = PAL[m.kind], P = {};
    for(const k in base) P[k] = typeof base[k] === 'number' && k !== 'mouth' ? jit(base[k], 0.04) : base[k];
    const M = mats(P), d = make(P, M);
    m.root.remove(m.body); m.root.add(d.body);
    m.body = d.body; m.legs = d.legs; m.arms = d.arms; m.tail = d.tail; m.head = d.head;
    if(d.wingL){ m.wingL = d.wingL; m.wingR = d.wingR; }
    m.v10 = d.A;              // les animations du patch 10 utilisent ces pièces
    m.flashOn = undefined;
  });
}catch(e){ console.warn('Patch 11 (dinosaures) :', e); }
})();
/* =====================================================================
   MODÈLES 3D (kits gratuits « Stylized Nature » et « Medieval Village »
   de Quaternius, licence CC0 : utilisation libre)
   - Village : maisons médiévales construites pièce par pièce
     (murs, coins, portes, fenêtres, volets, toits, cheminées)
   - Arbres, sapins, rochers, buissons du jeu remplacés par les modèles
   - Herbe, fleurs, fougères, champignons, cailloux, pierres de chemin
   - Si les modèles ne se chargent pas, le jeu garde l'ancien décor
   ===================================================================== */
(function(){
if(window.__MODELES3D || /sans3d/.test(location.search)) return;   // ?sans3d dans l'adresse = ancien décor
window.__MODELES3D = true;

// Dossier des modèles. Sur CodePen, remplacer par l'adresse où ils sont hébergés
// (voir LISEZ-MOI.txt), par exemple 'https://cdn.jsdelivr.net/gh/pseudo/depot@main/models/'
const MODELS_URL = window.MODELS_URL || 'models/';

const SAFE = (name, fn) => { try{ fn(); }catch(e){ console.warn('Modèles 3D (' + name + ') :', e); } };
const TAU = Math.PI*2;
const info = $('loadInfo');
const say = t => { if(info) info.textContent = t; };

const NATURE = [
  'CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_4','CommonTree_5',
  'Pine_1','Pine_2','Pine_3','Pine_4','Pine_5',
  'TwistedTree_1','TwistedTree_2','TwistedTree_3',
  'DeadTree_1','DeadTree_2','DeadTree_3',
  'Bush_Common','Bush_Common_Flowers',
  'Rock_Medium_1','Rock_Medium_2','Rock_Medium_3',
  'Grass_Common_Short','Grass_Common_Tall',
  'Fern_1','Flower_3_Group','Clover_1','Clover_2','Plant_1_Big','Plant_7',
  'Mushroom_Common',
  'Pebble_Round_1','Pebble_Round_2','Pebble_Round_3',
  'RockPath_Round_Small_1','RockPath_Round_Small_2','RockPath_Round_Small_3','RockPath_Round_Wide'
];
const VILLAGE = [
  'Wall_UnevenBrick_Straight','Wall_UnevenBrick_Door_Round','Wall_UnevenBrick_Window_Wide_Round',
  'Wall_Plaster_Straight','Wall_Plaster_Window_Wide_Round','Wall_Plaster_Door_Round','Wall_Plaster_WoodGrid',
  'Corner_Exterior_Wood',
  'Floor_WoodDark','Floor_UnevenBrick',
  'Roof_RoundTiles_4x4','Roof_RoundTiles_6x6','Roof_RoundTiles_4x6','Roof_RoundTiles_6x8',
  'Roof_Front_Brick4','Roof_Front_Brick6',
  'Door_1_Round','Window_Wide_Round1','WindowShutters_Wide_Round_Open',
  'Prop_Chimney','Prop_Crate','Prop_Wagon','Prop_WoodenFence_Single','Prop_Vine1','Prop_Vine4'
];

/* ---------- CHARGEMENT ---------- */
const M = {};
function prep(root){
  root.traverse(o => {
    if(!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      // Le jeu n'utilise pas la correction sRGB : on lit les textures telles quelles
      ['map','emissiveMap'].forEach(k => { if(m[k]){ m[k].encoding = THREE.LinearEncoding; m[k].anisotropy = 4; } });
      if(m.metalness !== undefined) m.metalness = 0;
      m.needsUpdate = true;
    });
  });
  return root;
}
function loadAll(){
  if(!THREE.GLTFLoader){ say(''); console.warn('GLTFLoader absent : décor classique.'); return Promise.resolve(false); }
  const loader = new THREE.GLTFLoader();
  const list = NATURE.map(n => ['nature', n]).concat(VILLAGE.map(n => ['village', n]));
  let done = 0, ok = 0;
  say('Chargement des modèles 3D… 0 %');
  return Promise.all(list.map(([kit, n]) => new Promise(res => {
    loader.load(MODELS_URL + kit + '/' + n + '.gltf', g => {
      M[n] = prep(g.scene); ok++; done++;
      say('Chargement des modèles 3D… ' + Math.round(done/list.length*100) + ' %'); res();
    }, undefined, err => { done++; console.warn('Modèle introuvable : ' + n, err); res(); });
  }))).then(() => {
    // Les buissons du kit utilisent le feuillage rouge des érables : on leur donne le feuillage vert
    let green = null;
    if(M.CommonTree_1) M.CommonTree_1.traverse(o => { if(o.isMesh && /Leaves/.test(o.material.name)) green = o.material; });
    if(green) ['Bush_Common','Bush_Common_Flowers'].forEach(n => M[n] && M[n].traverse(o => {
      if(o.isMesh && /TwistedTree/.test(o.material.name)) o.material = green;
    }));
    // Rochers et pierres un peu moins blancs
    ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'].forEach(n => M[n] && M[n].traverse(o => {
      if(o.isMesh && !o.material.userData.dim){ o.material.color.setRGB(0.72,0.72,0.68); o.material.userData.dim = true; }
    }));
    ['RockPath_Round_Small_1','RockPath_Round_Small_2','RockPath_Round_Small_3','RockPath_Round_Wide'].forEach(n => M[n] && M[n].traverse(o => {
      if(o.isMesh && !o.material.userData.dim){ o.material.color.setRGB(0.62,0.6,0.56); o.material.userData.dim = true; }
    }));
    say(ok ? '' : 'Modèles 3D introuvables : décor classique.'); return ok > 0;
  });
}
// Copie d'un modèle (géométries et matériaux partagés)
function C(name){ return M[name] ? M[name].clone(true) : null; }
function put(par, name, x, y, z, ry=0, s=1){
  const o = C(name); if(!o) return null;
  o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); par.add(o); return o;
}
const pick = a => a[Math.floor(Math.random()*a.length)];

/* ---------- MAISONS MÉDIÉVALES ----------
   Repère local : façade (porte) vers +z, centre de la maison en (0,0,0).
   w et d en mètres (multiples de 2), floors = nombre d'étages. */
function buildHouse(w, d, floors, o={}){
  const g = new THREE.Group();
  const nx = w/2, nz = d/2;
  const sides = [
    {n:nx, ry:0,          at:i => [-w/2+1+2*i, d/2]},   // façade
    {n:nx, ry:Math.PI,    at:i => [ w/2-1-2*i,-d/2]},   // arrière
    {n:nz, ry:Math.PI/2,  at:i => [ w/2,  d/2-1-2*i]},  // droite
    {n:nz, ry:-Math.PI/2, at:i => [-w/2, -d/2+1+2*i]}   // gauche
  ];
  const doorAt = o.doorAt === undefined ? Math.floor((nx-1)/2) : o.doorAt;
  for(let f=0; f<floors; f++){
    const y = f*3, brick = f === 0;
    sides.forEach((sd, si) => {
      for(let i=0; i<sd.n; i++){
        const [x, z] = sd.at(i);
        let wall, win = false, door = false;
        if(f === 0 && si === 0 && i === doorAt){ wall = 'Wall_UnevenBrick_Door_Round'; door = true; }
        else if(brick) { win = (i+si) % 2 === 1; wall = win ? 'Wall_UnevenBrick_Window_Wide_Round' : 'Wall_UnevenBrick_Straight'; }
        else { win = (i+si) % 2 === 0 || si === 0; wall = win ? 'Wall_Plaster_Window_Wide_Round' : 'Wall_Plaster_WoodGrid'; }
        const piece = new THREE.Group(); piece.position.set(x, y, z); piece.rotation.y = sd.ry; g.add(piece);
        put(piece, wall, 0, 0, 0);
        if(door) put(piece, 'Door_1_Round', -0.53, 0, -0.11);
        if(win){
          put(piece, 'Window_Wide_Round1', 0, 0, -0.1);
          if(Math.random() < 0.6) put(piece, 'WindowShutters_Wide_Round_Open', 0, 0, 0);
        }
      }
    });
    for(const sx of [-1,1]) for(const sz of [-1,1])
      put(g, 'Corner_Exterior_Wood', sx*w/2, y, sz*d/2, Math.atan2(sx, sz) - Math.PI/4);
    // Plancher / plafond (pour ne pas voir le ciel par les fenêtres)
    for(let ix=0; ix<nx; ix++) for(let iz=0; iz<nz; iz++)
      put(g, 'Floor_WoodDark', -w/2+1+2*ix, y+3, -d/2+1+2*iz);
  }
  const top = floors*3;
  put(g, 'Roof_RoundTiles_' + w + 'x' + d, 0, top, 0);
  put(g, 'Roof_Front_Brick' + w, 0, top, d/2);
  put(g, 'Roof_Front_Brick' + w, 0, top, -d/2, Math.PI);
  if(o.chimney !== false) put(g, 'Prop_Chimney', w*0.25, top, -d*0.15);
  if(o.vine) put(g, pick(['Prop_Vine1','Prop_Vine4']), w/2-1.1, 2.6, d/2+0.12);
  return mergeByMaterial(g);
}
// Fusionne toutes les pièces d'un même matériau en un seul objet (beaucoup plus rapide à dessiner)
function mergeByMaterial(root){
  const U = THREE.BufferGeometryUtils;
  if(!U || !U.mergeBufferGeometries) return root;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse(o => {
    if(!o.isMesh || Array.isArray(o.material)) return;
    const geo = o.geometry.index ? o.geometry : null;
    if(!geo) return;
    const key = o.material.uuid + '|' + Object.keys(geo.attributes).sort().join(',');
    const g2 = geo.clone(); g2.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if(!buckets.has(key)) buckets.set(key, {mat:o.material, geos:[]});
    buckets.get(key).geos.push(g2);
  });
  const out = new THREE.Group();
  buckets.forEach(b => {
    const merged = U.mergeBufferGeometries(b.geos, false);
    if(!merged) return;
    const m = new THREE.Mesh(merged, b.mat); m.castShadow = m.receiveShadow = true; out.add(m);
  });
  return out.children.length ? out : root;
}
// Cercles de collision qui couvrent un rectangle (repère du monde)
function houseCols(cx, cz, rot, w, d){
  const out = [], r = 1.25, sx = Math.sin(rot), cxr = Math.cos(rot);
  for(let ix=-w/2+r; ix<=w/2-r+0.01; ix+=1.6) for(let iz=-d/2+r; iz<=d/2-r+0.01; iz+=1.6){
    // local (ix, iz) -> monde : x' = cos*ix + sin*iz, z' = -sin*ix + cos*iz
    out.push({x:cx + cxr*ix + sx*iz, z:cz - sx*ix + cxr*iz, r:r+0.1});
  }
  return out;
}
// Groupes des anciennes maisons-champignons (trouvés par leur position)
function findGroupAt(x, z){
  return worldScene.children.find(o => o.isGroup && Math.abs(o.position.x-x) < 0.01 && Math.abs(o.position.z-z) < 0.01);
}
function replaceKids(grp, obj){
  grp.children.slice().forEach(c => grp.remove(c));
  grp.add(obj);
}

function buildVillage3D(){
  // Maison du chef : grande, 2 étages, reculée pour libérer la place
  const chef = findGroupAt(VIL.x, VIL.z-4);
  if(chef){
    const h = buildHouse(6, 6, 2, {vine:true, door2:true, doorAt:1});
    h.position.z = -3.5; replaceKids(chef, h);
    const c = COL.find(c => Math.abs(c.x-VIL.x) < 0.01 && Math.abs(c.z-(VIL.z-4)) < 0.01);
    if(c){ const i = COL.indexOf(c); COL.splice(i,1); }
    houseCols(VIL.x, VIL.z-7.5, 0, 6, 6).forEach(c => COL.push(c));
  }
  // 5 maisons autour de la place
  for(let k=0; k<5; k++){
    const a = k*1.26+0.5, x = VIL.x+Math.cos(a)*15, z = VIL.z+Math.sin(a)*15;
    const grp = findGroupAt(x, z); if(!grp) continue;
    const w = 4, d = k % 2 ? 6 : 4, floors = k === 2 ? 1 : 2;
    const h = buildHouse(w, d, floors, {vine: k % 2 === 0});
    h.position.z = -(d/2 - 1); replaceKids(grp, h);
    const c = COL.find(c => Math.abs(c.x-x) < 0.01 && Math.abs(c.z-z) < 0.01);
    if(c) COL.splice(COL.indexOf(c), 1);
    const cx = x + Math.cos(a)*(d/2-1), cz = z + Math.sin(a)*(d/2-1);
    houseCols(cx, cz, grp.rotation.y, w, d).forEach(c => COL.push(c));
  }
  // 8 maisons à construire (mission) : même chose, révélées par la quête
  growHouses.forEach((hh, k) => {
    const d = k % 3 === 0 ? 6 : 4;
    const h = buildHouse(4, d, 1 + (k % 2), {vine: k % 3 === 1});
    h.position.z = -(d/2 - 1); replaceKids(hh.g, h);
    hh.d = d;
  });
  const _reveal = revealHouse;
  revealHouse = function(i){
    const h = growHouses[i];
    if(!h || h.g.visible) return;
    _reveal(i);
    const c = COL.find(c => c.x === h.x && c.z === h.z);
    if(c) COL.splice(COL.indexOf(c), 1);
    const a = Math.atan2(h.z-VIL.z, h.x-VIL.x), d = h.d || 4;
    houseCols(h.x + Math.cos(a)*(d/2-1), h.z + Math.sin(a)*(d/2-1), h.g.rotation.y, 4, d).forEach(c => COL.push(c));
  };

  // Charrette et caisses sur la place
  const wag = put(worldScene, 'Prop_Wagon', VIL.x+9, getHeight(VIL.x+9, VIL.z-6), VIL.z-6, 0.9);
  if(wag) COL.push({x:VIL.x+9.4, z:VIL.z-7.2, r:1.4});
  for(const [dx,dz] of [[-6,-9],[-6.9,-8.3],[11,4]]){
    const cr = put(worldScene, 'Prop_Crate', VIL.x+dx, getHeight(VIL.x+dx, VIL.z+dz), VIL.z+dz, rnd(0,3), 0.8);
    if(cr) COL.push({x:VIL.x+dx, z:VIL.z+dz, r:0.55});
  }
}

/* ---------- PALISSADE : clôtures en bois du kit ---------- */
function buildFence3D(){
  const fence = worldScene.children.filter(o => o.isInstancedMesh && o.geometry.type === 'BoxGeometry');
  if(fence.length < 2 || !M.Prop_WoodenFence_Single) return;
  const posts = fence.find(o => o.count < 200 && o.count >= 50) || fence[0];
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const pts = [];
  for(let i=0; i<posts.count; i++){ m4.fromArray(posts.instanceMatrix.array, i*16); m4.decompose(p,q,s); pts.push(p.clone()); }
  fence.forEach(o => { o.visible = false; });
  const items = [];
  for(let i=0; i<pts.length; i++){
    const a = pts[i], b = pts[(i+1) % pts.length], L = Math.hypot(b.x-a.x, b.z-a.z);
    if(L > 2.2) continue;
    items.push({x:(a.x+b.x)/2, y:(getHeight(a.x,a.z)+getHeight(b.x,b.z))/2, z:(a.z+b.z)/2,
                ry:Math.atan2(-(b.z-a.z), b.x-a.x), sx:L/2.0, sy:1.4, sz:1});
  }
  scatter('Prop_WoodenFence_Single', items, {far:220, shadow:true});
}

/* ---------- ARBRES, ROCHERS, BUISSONS ---------- */
const TREE_MODELS = {
  pin:     ['Pine_1','Pine_2','Pine_3','Pine_4','Pine_5'],
  chene:   ['CommonTree_1','CommonTree_2','CommonTree_4','CommonTree_5'],
  bouleau: ['CommonTree_3','CommonTree_2'],
  pommier: ['CommonTree_1','CommonTree_5']
};
function replaceTrees(){
  const appleM = new THREE.MeshLambertMaterial({color:0xd42a2a});
  TREES.forEach(t => {
    const names = TREE_MODELS[t.kind]; if(!names) return;           // le palmier garde son modèle
    const o = C(pick(names)); if(!o) return;
    t.g.children.slice().forEach(c => t.g.remove(c));
    o.scale.setScalar(t.kind === 'pin' ? 0.85 : 0.75);
    o.rotation.y = rnd(0, TAU);
    t.g.add(o);
    if(t.kind === 'pommier'){                                      // des pommes dans le feuillage
      for(let k=0; k<10; k++){
        const ap = new THREE.Mesh(SPH, appleM); ap.scale.setScalar(0.16);
        const a = rnd(0,TAU), r = rnd(0.9,1.7);
        ap.position.set(Math.cos(a)*r, rnd(3.6,5.6), Math.sin(a)*r); t.g.add(ap);
      }
    }
  });
  // Sapins de la montagne (ajoutés par le patch 9)
  const treeGroups = new Set(TREES.map(t => t.g));
  worldScene.children.forEach(g => {
    if(!g.isGroup || treeGroups.has(g) || g.children.length !== 4) return;
    const c0 = g.children[0];
    if(!(c0.isMesh && c0.geometry === CYL && c0.material === barkMat && g.children[1].geometry === CONE)) return;
    g.children.slice().forEach(c => g.remove(c));
    put(g, pick(TREE_MODELS.pin), 0, 0, 0, rnd(0,TAU), 0.85);
  });
}
function replaceRocks(){
  const INVIS = new THREE.MeshBasicMaterial({visible:false});
  const rocks = ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'];
  worldScene.children.forEach(r => {
    if(!(r.isMesh && r.geometry === DODEC && r.material === rockMat)) return;
    const o = C(pick(rocks)); if(!o) return;
    r.rotation.set(0, rnd(0,TAU), 0);
    r.material = INVIS; r.castShadow = false;
    const base = getHeight(r.position.x, r.position.z) - 0.15;
    o.scale.setScalar(0.68);
    o.position.y = (base - r.position.y) / r.scale.y + 0.18;
    r.add(o);
  });
}
// Buissons du patch 9 (déjà solides grâce au patch 10) : même place, vrais buissons
function replaceBushes(){
  const bushes = worldScene.children.filter(o => o.isInstancedMesh && o.geometry.type === 'SphereGeometry' && o.castShadow);
  if(!bushes.length || !M.Bush_Common) return;
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const A = [], B = [];
  bushes.forEach((o, bi) => {
    for(let i=0; i<o.count; i++){
      m4.fromArray(o.instanceMatrix.array, i*16); m4.decompose(p,q,s);
      if(bi > 0){                       // petite boule d'à côté : on retire sa collision (plus rien à cet endroit)
        const c = COL.find(c => Math.abs(c.x-p.x) < 0.001 && Math.abs(c.z-p.z) < 0.001);
        if(c) COL.splice(COL.indexOf(c), 1);
        continue;
      }
      const it = {x:p.x, y:getHeight(p.x,p.z)-0.1, z:p.z, ry:rnd(0,TAU), s:s.x*0.95};
      (Math.random() < 0.3 ? B : A).push(it);
    }
    o.visible = false;
  });
  scatter('Bush_Common', A, {far:170, shadow:true});
  scatter('Bush_Common_Flowers', B, {far:170, shadow:true});
}

/* ---------- OBJETS EN GRAND NOMBRE (par zones, cachés de loin) ---------- */
const CHUNK = 64, CHUNKS = [];
const SWAY = {value:0};
function swayMat(m){
  const m2 = m.clone();
  m2.onBeforeCompile = sh => {
    sh.uniforms.uTime = SWAY;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 ip = vec2(0.0);
      #endif
      float sw = sin(uTime*1.6 + ip.x*0.31 + ip.y*0.17)*0.07 + sin(uTime*2.9 + ip.x*0.8)*0.025;
      transformed.x += sw*max(position.y, 0.0);
      transformed.z += sw*0.6*max(position.y, 0.0);`);
  };
  return m2;
}
const D = new THREE.Object3D(), MX = new THREE.Matrix4();
function scatter(name, items, o={}){
  const src = M[name]; if(!src || !items.length) return;
  const scn = o.scene || worldScene;
  src.updateMatrixWorld(true);
  const parts = [];
  src.traverse(m => { if(m.isMesh) parts.push({geo:m.geometry, mat:o.sway ? (m.userData.sw || (m.userData.sw = swayMat(m.material))) : m.material, mw:m.matrixWorld.clone()}); });
  const groups = new Map();
  items.forEach(it => {
    const k = Math.floor(it.x/CHUNK) + ',' + Math.floor(it.z/CHUNK);
    if(!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  });
  groups.forEach((list, k) => {
    const [ix, iz] = k.split(',').map(Number), cx = (ix+0.5)*CHUNK, cz = (iz+0.5)*CHUNK;
    const grp = new THREE.Group(); grp.position.set(cx, 0, cz);
    parts.forEach(pt => {
      const im = new THREE.InstancedMesh(pt.geo, pt.mat, list.length);
      list.forEach((it, i) => {
        D.position.set(it.x-cx, it.y, it.z-cz); D.rotation.set(0, it.ry || 0, 0);
        if(it.sx) D.scale.set(it.sx, it.sy, it.sz); else D.scale.setScalar(it.s || 1);
        D.updateMatrix(); MX.multiplyMatrices(D.matrix, pt.mw); im.setMatrixAt(i, MX);
      });
      im.castShadow = !!o.shadow; im.receiveShadow = true; im.frustumCulled = false;
      grp.add(im);
    });
    scn.add(grp);
    CHUNKS.push({grp, cx, cz, far:o.far || 80, scn});
  });
}

/* Chemins et zones à éviter (mêmes chemins que les patchs 9 et 10) */
const PATHS = [
  [[VIL.x,VIL.z], [-45,-10], [-60,-45], [MOUTH.x+3, MOUTH.z+3]],
  [[VIL.x,VIL.z], [15,0],   [42,-26]],
  [[VIL.x,VIL.z], [0,45],   [18,60]],
  [[VIL.x,VIL.z], [-70,30], [-102,36]]
];
function segDist(px,pz,ax,az,bx,bz){
  const dx = bx-ax, dz = bz-az, l2 = dx*dx + dz*dz;
  const t = clamp(((px-ax)*dx + (pz-az)*dz) / l2, 0, 1);
  return Math.hypot(px-ax-dx*t, pz-az-dz*t);
}
function pathDist(x,z){
  let d = 1e9;
  for(const P of PATHS) for(let i=0; i<P.length-1; i++) d = Math.min(d, segDist(x,z, P[i][0],P[i][1], P[i+1][0],P[i+1][1]));
  return d;
}
let GRID = null;
function buildGrid(){
  GRID = new Map();
  for(const c of COL){ const k = Math.floor(c.x/8) + ',' + Math.floor(c.z/8); if(!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(c); }
}
function nearCol(x,z,r){
  const ix = Math.floor(x/8), iz = Math.floor(z/8);
  for(let a=-1; a<=1; a++) for(let b=-1; b<=1; b++){
    const L = GRID.get((ix+a) + ',' + (iz+b));
    if(L) for(const c of L) if(hyp(c.x,c.z,x,z) < c.r + r) return true;
  }
  return false;
}
const inLake = (x,z,m=0.6) => LAKES.some(L => hyp(x,z,L.x,L.z) < L.r + m);
function okSpot(x, z, r, o={}){
  if(hyp(x,z,0,0) > 186) return false;
  const h = getHeight(x,z);
  if(h < (o.hMin === undefined ? -0.9 : o.hMin) || h > (o.hMax || 22)) return false;
  if(inLake(x,z) || pathDist(x,z) < (o.path || 1.8)) return false;
  if(hyp(x,z,VIL.x,VIL.z) < (o.vil || 10)) return false;
  return !nearCol(x, z, r);
}

function scatterNature(){
  buildGrid();
  // Herbe : touffes regroupées en prairies
  const G = {Grass_Common_Short:[], Grass_Common_Tall:[]};
  const FL = {Flower_3_Group:[], Clover_1:[], Clover_2:[]};
  const kinds = Object.keys(G), fk = Object.keys(FL);
  for(let c=0; c<3400; c++){
    const cx = rnd(-190,190), cz = rnd(-190,190);
    if(!okSpot(cx, cz, 0.3)) continue;
    const n = Math.floor(rnd(4,9)), main = pick(kinds), flowers = Math.random() < 0.3 ? pick(fk) : null;
    for(let k=0; k<n; k++){
      const a = rnd(0,TAU), d = Math.sqrt(Math.random())*2.6, x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d;
      if(!okSpot(x, z, 0.2)) continue;
      const it = {x, y:getHeight(x,z)-0.05, z, ry:rnd(0,TAU), s:rnd(0.55,0.9)};
      if(flowers && Math.random() < 0.35) FL[flowers].push(it);
      else G[Math.random() < 0.8 ? 'Grass_Common_Short' : 'Grass_Common_Tall'].push(it);
    }
  }
  // Un peu d'herbe aussi dans le village, entre les maisons
  for(let i=0; i<700; i++){
    const a = rnd(0,TAU), d = rnd(10,31), x = VIL.x+Math.cos(a)*d, z = VIL.z+Math.sin(a)*d;
    if(!okSpot(x, z, 0.3, {vil:9, path:1.4})) continue;
    G.Grass_Common_Short.push({x, y:getHeight(x,z)-0.05, z, ry:rnd(0,TAU), s:rnd(0.7,1.1)});
  }
  kinds.forEach(k => scatter(k, G[k], {far:75, sway:true}));
  fk.forEach(k => scatter(k, FL[k], {far:70, sway:true}));

  // Fougères, plantes, champignons
  const add = (names, n, o, sc) => {
    const L = {}; names.forEach(k => L[k] = []);
    for(let i=0, got=0; i<n*6 && got<n; i++){
      const x = rnd(-185,185), z = rnd(-185,185);
      if(!okSpot(x, z, o.r || 0.6, o)) continue;
      L[pick(names)].push({x, y:getHeight(x,z)-0.05, z, ry:rnd(0,TAU), s:rnd(sc[0], sc[1])}); got++;
    }
    names.forEach(k => scatter(k, L[k], {far:o.far || 90, shadow:o.shadow, sway:o.sway}));
  };
  add(['Fern_1'], 260, {r:0.8, sway:true}, [0.22,0.35]);
  add(['Plant_1_Big','Plant_7'], 220, {r:0.7, sway:true}, [0.35,0.6]);
  add(['Mushroom_Common'], 160, {r:0.3, far:55}, [0.9,1.6]);
  add(['Pebble_Round_1','Pebble_Round_2','Pebble_Round_3'], 900, {r:0.2, far:60, path:0}, [0.6,1.4]);

  // Pierres plates qui dessinent les chemins
  const P = {RockPath_Round_Small_1:[], RockPath_Round_Small_2:[], RockPath_Round_Small_3:[]}, pk = Object.keys(P);
  PATHS.forEach(path => {
    for(let i=0; i<path.length-1; i++){
      const [ax,az] = path[i], [bx,bz] = path[i+1], L = Math.hypot(bx-ax, bz-az), ux = (bx-ax)/L, uz = (bz-az)/L;
      for(let s=0; s<L; s+=rnd(1.4,2.2)){
        const off = rnd(-1.1,1.1), x = ax+ux*s - uz*off, z = az+uz*s + ux*off;
        if(hyp(x,z,VIL.x,VIL.z) < 8 || inLake(x,z,0.3) || hyp(x,z,MOUTH.x,MOUTH.z) < 4) continue;
        P[pick(pk)].push({x, y:getHeight(x,z)-0.02, z, ry:rnd(0,TAU), s:rnd(0.8,1.1)});
      }
    }
  });
  pk.forEach(k => scatter(k, P[k], {far:110}));
  // Pavés sur la place du village
  const plaza = [];
  for(let i=0; i<10; i++){
    const a = rnd(0,TAU), d = Math.sqrt(Math.random())*8;
    const x = VIL.x+Math.cos(a)*d, z = VIL.z+Math.sin(a)*d;
    if(hyp(x,z,VIL.x+4,VIL.z+3) < 2.2) continue;                  // pas sur le feu de camp
    plaza.push({x, y:getHeight(x,z)-0.03, z, ry:rnd(0,TAU), s:rnd(0.9,1.2)});
  }
  scatter('RockPath_Round_Wide', plaza, {far:120});

  // Quelques grands arbres tordus et arbres morts (solides)
  buildGrid();
  const big = (names, n, o, sc, rCol) => {
    for(let i=0, got=0; i<n*40 && got<n; i++){
      const x = rnd(-175,175), z = rnd(-175,175), s = rnd(sc[0], sc[1]);
      if(!okSpot(x, z, rCol*3, o)) continue;
      const t = put(worldScene, pick(names), x, getHeight(x,z)-0.2, z, rnd(0,TAU), s);
      if(!t) return;
      const c = {x, z, r:rCol}; COL.push(c);
      const k = Math.floor(x/8) + ',' + Math.floor(z/8); if(!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(c);
      got++;
    }
  };
  big(['TwistedTree_1','TwistedTree_2','TwistedTree_3'], 7, {vil:45}, [0.42,0.55], 1.0);
  big(['DeadTree_1','DeadTree_2','DeadTree_3'], 10, {vil:40, hMin:8, hMax:26}, [0.55,0.8], 0.6);
}

/* ---------- GROTTE : rochers, champignons et cailloux ---------- */
function decorateCave(){
  const cx = ROOM.x, cz = ROOM.z;
  const ok = (x,z,r) => hyp(x,z,cx,cz) > 6 && hyp(x,z,cx,cz) < 30 && hyp(x,z,EXIT.x,EXIT.z) > 7 && hyp(x,z,cx,cz-20) > r+5 &&
    CAVE_COL.every(c => hyp(c.x,c.z,x,z) > c.r + r) &&
    (typeof TRAILS === 'undefined' || TRAILS.every(tr => tr.pts.every(p => hyp(p.x,p.z,x,z) > r + 1.2)));
  const L = {Mushroom_Common:[], Pebble_Round_1:[], Pebble_Round_2:[]};
  for(let i=0; i<260; i++){
    const a = rnd(0,TAU), d = rnd(6,31), x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d;
    if(!ok(x, z, 0.3)) continue;
    const k = pick(Object.keys(L));
    L[k].push({x, y:0, z, ry:rnd(0,TAU), s:k.startsWith('Mush') ? rnd(1.2,2.2) : rnd(0.8,1.6)});
  }
  Object.keys(L).forEach(k => scatter(k, L[k], {scene:caveScene, far:400}));
  for(let i=0, n=0; i<300 && n<10; i++){
    const a = rnd(0,TAU), d = rnd(10,28), x = cx+Math.cos(a)*d, z = cz+Math.sin(a)*d;
    if(!ok(x, z, 1.8)) continue;
    const r = put(caveScene, pick(['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3']), x, -0.2, z, rnd(0,TAU), rnd(0.7,1.1));
    if(r){ CAVE_COL.push({x, z, r:1.5}); n++; }
  }
}

/* ---------- APPLICATION ---------- */
function apply(){
  SAFE('village', buildVillage3D);
  SAFE('arbres', replaceTrees);
  SAFE('rochers', replaceRocks);
  SAFE('buissons', replaceBushes);
  SAFE('clotures', buildFence3D);
  SAFE('herbe', () => {
    // On retire l'herbe en triangles, les petites fleurs et les cailloux du patch 9
    worldScene.children.forEach(o => {
      if(!o.isInstancedMesh) return;
      const t = o.geometry.type;
      if(o.material.onBeforeCompile && t === 'BufferGeometry' && !o.castShadow) o.visible = false;   // herbe
      else if(t === 'SphereGeometry' && !o.castShadow) o.visible = false;                              // têtes de fleurs
      else if(o.geometry === DODEC) o.visible = false;                                                 // cailloux
    });
    scatterNature();
  });
  SAFE('grotte', decorateCave);
  window.M3D = {M, CHUNKS, buildHouse};
}

// Les zones loin de Greg ou hors de la caméra ne sont pas dessinées
const FRUST = new THREE.Frustum(), PV = new THREE.Matrix4(), SPHB = new THREE.Sphere();
let treeT = 0;
(function loop3d(){
  requestAnimationFrame(loop3d);
  const now = performance.now();
  SWAY.value = now/1000;
  if(window.VOITURE_ON) return;
  const px = player.position.x, pz = player.position.z, scn = curScene();
  camera.updateMatrixWorld();
  PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FRUST.setFromProjectionMatrix(PV);
  for(const c of CHUNKS){
    let v = c.scn === scn && Math.hypot(c.cx-px, c.cz-pz) < c.far + CHUNK*0.72;
    if(v){ SPHB.center.set(c.cx, player.position.y, c.cz); SPHB.radius = CHUNK*0.75 + 12; v = FRUST.intersectsSphere(SPHB); }
    c.grp.visible = v;
  }
  // Arbres : seuls les proches projettent une ombre (2 fois par seconde)
  if(now - treeT > 500 && zone === 'world'){
    treeT = now;
    for(const t of TREES){
      const d = Math.hypot(t.x-px, t.z-pz), sh = d < 70;
      if(t.sh !== sh){ t.sh = sh; t.g.traverse(o => { if(o.isMesh) o.castShadow = sh; }); }
    }
  }
})();

loadAll().then(ok => { if(ok) apply(); });
})();
