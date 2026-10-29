// みちさん向けページを鍵で暗号化して GitHub Pages 用に書き出す
// 使い方: node build.mjs $(cat .key)   ／ 共有リンク = URL + #k=鍵
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';

const PW = process.argv[2];
if (!PW) { console.error('鍵を引数に'); process.exit(1); }
const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://mm738966m-boop.github.io/michi-share/';
const PAGES = [
  { src: 'src/college_1029.html', out: 'college/index.html', title: '金融AIカレッジの今', ogTitle: '金融AIカレッジの今（みちさん向け）', ogDesc: '全体像・コンテンツ・集客の流れ・お願いしたいこと' },
];

const b64 = u8 => Buffer.from(u8).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(PW.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
const KEY = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

for (const p of PAGES) {
  const html = readFileSync(`${ROOT}/${p.src}`, 'utf8')
    .replace(/<title>.*?<\/title>/s, '')
    .replace(/<meta name="claude:[^>]*>/g, '')
    .replace(/<link [^>]*fonts\.g[^>]*>/g, '');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, KEY, new TextEncoder().encode(html)));
  const data = new Uint8Array(12 + ct.length); data.set(iv); data.set(ct, 12);
  const url = SITE + p.out.replace(/index\.html$/, '');
  const shell = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${p.ogTitle}</title>
<meta name="description" content="${p.ogDesc}">
<meta property="og:title" content="${p.ogTitle}">
<meta property="og:description" content="${p.ogDesc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}img/og.png">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<style>
#gate{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 20px;box-sizing:border-box;background:#FBFBF8;font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;margin:0}
#gate .in{max-width:420px;background:#fff;border:1px solid #BFE0E3;border-top:6px solid #0E7C86;border-radius:18px;padding:28px 24px;text-align:center}
#gate .e{font-size:14px;letter-spacing:.14em;color:#0E7C86;font-weight:700}
#gate h1{font-size:23px;font-weight:900;color:#1E2A2B;margin:8px 0 10px}
#gate p{margin:0;font-size:17px;color:#5B6B6C;line-height:1.8}
</style>
</head>
<body style="margin:0">
<div id="gate"><div class="in">
  <div class="e">fulfull × みちさん</div>
  <h1>${p.ogTitle}</h1>
  <p id="msg">開いています…</p>
</div></div>
<div id="page" hidden></div>
<script>
const SALT="${b64(salt)}",DATA="${b64(data)}",TITLE=${JSON.stringify(p.title)};
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const msg=document.getElementById('msg');
async function open_(pw){
  try{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw.normalize('NFKC')),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(SALT),iterations:250000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['decrypt']);
    const d=b64(DATA);const buf=await crypto.subtle.decrypt({name:'AES-GCM',iv:d.slice(0,12)},key,d.slice(12));
    const page=document.getElementById('page');page.innerHTML=new TextDecoder().decode(buf);
    document.getElementById('gate').remove();page.hidden=false;document.title=TITLE;
    for(const old of page.querySelectorAll('script')){const s=document.createElement('script');s.textContent=old.textContent;old.replaceWith(s)}
    try{localStorage.setItem('k'+location.pathname,pw)}catch(e){}
    return true;
  }catch(e){return false}}
(async function(){
  const m=(location.hash+'&'+location.search).match(/[#?&]k=([A-Za-z0-9]+)/);
  const tries=[];if(m)tries.push(m[1]);
  try{const k=localStorage.getItem('k'+location.pathname);if(k&&!tries.includes(k))tries.push(k)}catch(e){}
  for(const pw of tries){if(await open_(pw))return}
  msg.textContent='LINEでお送りしたリンクから開いてください。開けないときは森川までご連絡ください。';
})();
</script>
</body>
</html>
`;
  mkdirSync(`${ROOT}/${dirname(p.out)}`, { recursive: true });
  writeFileSync(`${ROOT}/${p.out}`, shell);
  console.log('wrote', p.out, shell.length, url + '#k=' + PW);
}
