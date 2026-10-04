const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
require('../assets/secretariat.js');
const d = JSON.parse(fs.readFileSync('content/departments/secretariat.json'));
const manifest = JSON.parse(fs.readFileSync('content/departments/secretariat-originals.json'));
assert.equal(manifest.files.length,10);
for (const item of manifest.files) {
 const bytes=fs.readFileSync(item.file);
 assert.equal(bytes.length,item.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256,item.file);
}
for (const lang of ['zh','en']) {
 const html=globalThis.MCSASecretariat.render(d,lang);
 assert.deepEqual([...html.matchAll(/secretariat\/(64\d)\.(?:png|jpeg)/g)].map(m=>Number(m[1])),Array.from({length:10},(_,i)=>640+i));
 assert.equal((html.match(/<h1>/g)||[]).length,1);
 assert.doesNotMatch(html,/<script|undefined/);
 assert.match(html,/2026/);
 const unsafe=globalThis.MCSASecretariat.render({...d,name:'<script>alert(1)</script>',sourceUrl:'javascript:alert(1)'},lang);
 assert.match(unsafe,/&lt;script&gt;/);
 assert.doesNotMatch(unsafe,/href="javascript:/);
}
const app=fs.readFileSync('assets/app.js','utf8');
const fn=app.slice(app.indexOf('  function departmentPage()'),app.indexOf('  function content()'));
const context={window:globalThis,URL,page:'department-secretariat',lang:'en',data:{departments:[d]},t:v=>typeof v==='string'?v:v?.en||'',ui:(_,en)=>en,esc:String,a:()=>''};
assert.match(vm.runInNewContext(fn+';departmentPage()',context),/Jennifer/);
context.data.departments=[{...d,published:false}];
assert.match(vm.runInNewContext(fn+';departmentPage()',context),/Department unavailable/);
console.log('Secretariat: original hashes, image order, translations, escaping and publication gate passed.');

const shell=fs.readFileSync("department-secretariat.html","utf8");
assert.ok(shell.indexOf("assets/secretariat.js") >= 0 && shell.indexOf("assets/secretariat.js") < shell.indexOf("assets/app.js"));
