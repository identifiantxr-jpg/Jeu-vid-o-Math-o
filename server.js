const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PAGE=fs.readFileSync(path.join(__dirname,'index.html'));
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];
 if(u==='/health'){r.end('ok');return}
 if(u==='/'||u==='/index.html'){r.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});r.end(PAGE);return}
 r.writeHead(404);r.end()});
const wss=new WebSocketServer({server:srv,maxPayload:2048});
const rooms=new Map(),OK=new Set(['p','vote','b','kick','goal','chat','push','hit','throw']);let nid=1;
const out=(room,from,o)=>{const s=JSON.stringify(o);for(const c of room)if(c!==from&&c.readyState===1)c.send(s)};
wss.on('connection',ws=>{ws.id=nid++;ws.room=null;ws.dead=false;ws.on('pong',()=>{ws.dead=false});
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}if(!m||typeof m!=='object')return;
  if(m.t==='join'&&!ws.room){
   const code=String(m.room||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)||'MAIN';
   let room=rooms.get(code);if(!room){room=new Set();rooms.set(code,room)}
   if(room.size>=10){ws.send(JSON.stringify({t:'full'}));return}
   ws.name=String(m.name||'Joueur').slice(0,14);ws.code=code;ws.room=room;
   ws.send(JSON.stringify({t:'welcome',id:ws.id,time:Date.now(),peers:[...room].map(c=>({id:c.id,name:c.name}))}));
   room.add(ws);out(room,ws,{t:'join',id:ws.id,name:ws.name});return}
  if(ws.room&&OK.has(m.t)){if(m.t==='chat'){const n=Date.now();ws.ct=(ws.ct||[]).filter(x=>n-x<5000);if(ws.ct.length>=6)return;ws.ct.push(n);m.s=String(m.s||'').slice(0,120)}m.id=ws.id;out(ws.room,ws,m)}});
 ws.on('close',()=>{if(!ws.room)return;ws.room.delete(ws);out(ws.room,ws,{t:'leave',id:ws.id});if(!ws.room.size)rooms.delete(ws.code)})});
setInterval(()=>wss.clients.forEach(c=>{if(c.dead){c.terminate();return}c.dead=true;c.ping()}),25000);
srv.listen(process.env.PORT||3000,()=>console.log('ok'));
