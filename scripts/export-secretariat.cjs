// Run from the official repository: node scripts/export-secretariat.cjs ../MCSA-website-provisional-
const fs = require('node:fs');
const path = require('node:path');
require('../assets/secretariat.js');
const source = path.resolve(__dirname,'..');
const destination = path.resolve(process.argv[2] || '');
if (!process.argv[2] || destination === source) throw new Error('Provide the provisional checkout path');
const d = JSON.parse(fs.readFileSync(path.join(source,'content/departments/secretariat.json')));
for (const lang of ['zh','en']) {
 const suffix = lang === 'en' ? '-en' : '';
 const target = path.join(destination,`department-secretariat${suffix}.html`);
 const shell = fs.readFileSync(target,'utf8');
 if (!/<main\b[^>]*>[\s\S]*?<\/main>/.test(shell)) throw new Error('Missing static main element');
 const article = globalThis.MCSASecretariat.render(d,lang).replace('href="recruitment.html"',`href="departments${suffix}.html"`);
 fs.writeFileSync(target,shell.replace(/(<main\b[^>]*>)[\s\S]*?(<\/main>)/,(_,a,b)=>a+article+b));
}
for (const file of ['secretariat.json','secretariat-originals.json']) fs.copyFileSync(path.join(source,'content/departments',file),path.join(destination,'content/departments',file));
const imageDir = 'images/departments/secretariat';
fs.mkdirSync(path.join(destination,imageDir),{recursive:true});
for (const name of fs.readdirSync(path.join(source,imageDir))) fs.copyFileSync(path.join(source,imageDir,name),path.join(destination,imageDir,name));
const marker = '/* Secretariat:';
const officialCSS = fs.readFileSync(path.join(source,'assets/style.css'),'utf8');
const targetCSS = path.join(destination,'assets/departments-static.css');
const staticCSS = fs.readFileSync(targetCSS,'utf8');
fs.writeFileSync(targetCSS,staticCSS.split(marker)[0]+marker+officialCSS.split(marker)[1]);
console.log('Exported Secretariat content and unchanged original assets to the provisional static pages.');
