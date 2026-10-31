const assert = require('node:assert/strict');
const { createRitualService } = require('../src/services/ritualService');
const { DEFAULT_NARRATION, validateTemplates, renderNarration } = require('../src/services/narrationService');
const deck = require('../src/data/fortuneDeck');
assert.equal(deck.length, 100);
assert.equal(new Set(deck.map(f=>f.number)).size, 100);
assert.equal(new Set(deck.map(f=>f.title)).size, 100);
assert.equal(Object.values(DEFAULT_NARRATION).flatMap(s=>s.split('\n')).length,30);
validateTemplates(DEFAULT_NARRATION);
assert.throws(()=>validateTemplates({incense:'Hello {unknown}'}));
assert.throws(()=>validateTemplates({incense:'x'.repeat(241)}));
for(const kind of Object.keys(DEFAULT_NARRATION)) {
 let previous='';
 for(let i=0;i<30;i++){const text=renderNarration({},kind,{user:'Minh Tâm',wish:'Bình an',count:3,giftName:'hoa sen',fortune:'Quẻ một'});assert.notEqual(text,previous);assert(!/[{}]/.test(text));previous=text;}
}
const state={settings:{narrationTemplates:{...DEFAULT_NARRATION}},fortuneCount:0};
const stateModel={state,recordDevotee:(user)=>({name:user,uniqueId:user}),pushEventLog:e=>e,saveState(){},getPublicState(){return state;}};
const rituals=createRitualService({stateModel,realtime:{broadcastNotification(){}},ttsManager:{getStatus:()=>({ready:true,voices:['maichi']})},fortuneDeck:deck});
const draws=Array.from({length:100},()=>rituals.drawFortune({user:'Minh Tâm'}).event.fortune.number);
assert.equal(new Set(draws).size,100);
assert.notEqual(rituals.drawFortune({user:'Minh Tâm'}).event.fortune.number,draws[99]);
const filtered=Array.from({length:20},()=>rituals.drawFortune({category:'binh-an'}).event.fortune);
assert(filtered.every(f=>f.category==='binh-an'));assert.equal(new Set(filtered.map(f=>f.number)).size,20);
assert.throws(()=>rituals.drawFortune({category:'invalid'}));
assert.throws(()=>rituals.updateSettings({musicTrack:'unknown'}));
assert.throws(()=>rituals.updateSettings({musicVolume:-1}));
rituals.updateSettings({musicTrack:'rain',musicAutoRotate:true,fortuneReadingMode:'full'});
assert.equal(state.settings.musicTrack,'rain');
console.log('PASS: 100 unique fortunes, category shuffle bags, 30 narration variants, placeholders and settings validation.');
