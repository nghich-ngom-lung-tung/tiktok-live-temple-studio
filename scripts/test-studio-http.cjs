const assert=require('node:assert/strict');
const WebSocket=require('ws');
const base='http://127.0.0.1:3012';
const headers={'Content-Type':'application/json',Authorization:'Bearer studio-local-review-token-000000000000',Origin:base};
async function rpc(method,params={}){const r=await fetch(base+'/rpc',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const d=await r.json();assert(!d.error,JSON.stringify(d.error));return d.result;}
(async()=>{
 assert.equal((await rpc('temple.listFortunes')).length,100);
 const config=await rpc('temple.voiceConfig');assert.equal(Object.keys(config.defaults).length,6);
 await rpc('temple.updateSettings',{musicTrack:'stream',musicAutoRotate:true});
 assert.equal((await rpc('temple.getState')).settings.musicTrack,'stream');
 for(const track of ['lotus','rain','stream','bamboo','night','dawn']){const r=await fetch(`${base}/assets/music/${track}.wav`);assert.equal(r.status,200);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.toString('ascii',0,4),'RIFF');assert(b.length>2000000);}
 const ws=new WebSocket('ws://127.0.0.1:3012/ws',{headers});
 const welcome=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Missing welcome event')),5000);ws.on('message',raw=>{const d=JSON.parse(raw);if(d.method==='temple.member'){clearTimeout(timer);resolve(d.params);}});});
 await new Promise(resolve=>ws.on('open',resolve));
 await rpc('temple.previewWelcome',{user:'Minh Tâm'});assert.equal((await welcome).user,'Minh Tâm');ws.close();
 const chatSocket=new WebSocket('ws://127.0.0.1:3012/ws',{headers});
 const chat=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Missing chat event')),5000);chatSocket.on('message',raw=>{const d=JSON.parse(raw);if(d.method==='temple.chat'){clearTimeout(timer);resolve(d.params);}});});
 await new Promise(resolve=>chatSocket.on('open',resolve));
 await rpc('temple.comment',{user:'Bảo An',uniqueId:'chat-review-'+Date.now(),avatar:'/assets/avatar-demo.svg',comment:'Xin chào mọi người trong chánh điện'});
 const message=await chat;assert.equal(message.user,'Bảo An');assert(message.comment.includes('Xin chào'));chatSocket.close();
 assert((await rpc('temple.getState')).leaderboard.some(user=>user.name==='Bảo An'&&user.avatar==='/assets/avatar-demo.svg'));
 const result=await rpc('temple.speak',{text:'Nam mô A Di Đà Phật. Xin kính chào quý vị đã ghé thăm chánh điện. Một lời nguyện nhẹ nhàng gửi đến mọi người. Xin dành một phút trở về với hơi thở và thả lỏng đôi vai. Chúc quý vị một ngày an vui, biết lắng nghe và chăm sóc những người thân yêu.',broadcast:false});
 assert.equal(result.ok,true,JSON.stringify(result));const audio=await fetch(base+result.url,{headers});assert.equal(audio.status,200);const bytes=Buffer.from(await audio.arrayBuffer());assert(bytes.length>100000);
 console.log('PASS: authenticated RPC, 6 WAV assets, music persistence, WebSocket welcome event, multi-chunk TTS (>160 characters) and protected audio playback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
