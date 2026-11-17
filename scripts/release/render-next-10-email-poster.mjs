import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const encode = async (path, type) => `data:${type};base64,${(await readFile(resolve(path))).toString('base64')}`;
const [background, logo, ...posters] = await Promise.all([
  encode('public/marketing/email/the-next-10-backdrop.png', 'image/png'),
  encode('output/AFFIMATIK-THE-NEXT-10-PRODUCTION-KIT/01_BRAND/affimatik-logo-primary-2400.png', 'image/png'),
  ...Array.from({ length: 10 }, (_, index) => encode(`public/style-posters/NX${21 + index}.webp`, 'image/webp')),
]);

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><style>
    *{box-sizing:border-box}html,body{margin:0;width:1200px;height:1500px;overflow:hidden;font-family:Arial,sans-serif;background:#0f1020}
    main{position:relative;width:1200px;height:1500px;background:linear-gradient(180deg,rgba(6,7,22,.18),rgba(6,7,22,.82)),url('${background}') center/cover}
    .brand{position:absolute;left:64px;top:48px;width:500px;height:174px;padding:28px;background:rgba(255,255,255,.96);border-radius:28px;display:flex;align-items:center}
    .brand img{width:100%;height:auto}.copy{position:absolute;left:72px;top:275px;color:white}.eyebrow{font-size:34px;font-weight:900;letter-spacing:.15em;color:#c4b5fd}
    h1{margin:16px 0 0;font-size:108px;line-height:.92;letter-spacing:-.05em}.sub{margin-top:30px;font-size:45px;font-weight:900}.grid{position:absolute;left:64px;top:610px;width:1072px;height:670px;padding:12px;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(2,1fr);gap:10px;background:rgba(255,255,255,.14);border:3px solid rgba(255,255,255,.3);border-radius:34px;box-shadow:0 28px 90px rgba(0,0,0,.5);overflow:hidden}.grid img{width:100%;height:100%;object-fit:cover;border-radius:18px}
    .footer{position:absolute;left:50px;right:50px;bottom:44px;text-align:center;color:white}.footer strong{display:block;font-size:55px}.footer span{display:block;margin-top:10px;color:#ddd6fe;font-size:28px;font-weight:700}
  </style><main><div class="brand"><img src="${logo}" alt="AffiMatik by Pawarna"></div><div class="copy"><div class="eyebrow">AFFIMATIK</div><h1>THE NEXT 10</h1><div class="sub">10 GAYA BAHARU · 6 FASHION + 4 KITCHEN</div></div><div class="grid">${posters.map((src,index)=>`<img src="${src}" alt="NX${21+index}">`).join('')}</div><div class="footer"><strong>Kini 30 gaya video affiliate</strong><span>Avatar dan background sendiri untuk gaya yang menyokong</span></div></main></html>`, { waitUntil: 'load' });
  await page.screenshot({ path: resolve('public/marketing/email/affimatik-the-next-10-launch.jpg'), type: 'jpeg', quality: 86 });
} finally { await browser.close(); }
