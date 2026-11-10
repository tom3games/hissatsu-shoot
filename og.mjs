import './mute-auto.mjs'
// SNS 用の画像 og.png（1200x630）。人間タワーが崩れる瞬間を止めて撮り、題名を重ねる。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 5975
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch()
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('hs_tut', '{"draw":1,"card":1}') } catch (e) {} })
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/?seed=5`); await p.waitForFunction(() => window.__hsReady && window.HSBots)
await p.waitForTimeout(1500)
// 人間タワーに当てて崩れる瞬間（v4。バカな守りが一目で分かる絵）
await p.evaluate(() => { const L = HSBots.BOT_TECHS.mix(); L[0].name = '雷鳴ジグザグ蹴り'; L[1].name = '三日月バナナ弾'; L[2].name = '流星ドロップ砲'; hs.dbg.setTechs(L); hs.dbg.start(5) })
await p.evaluate(() => {
  const G = hs.M.match.G, i = G.m.scenes.findIndex(s => s.type === 'tower'), sc = G.m.scenes[i], d = sc.defs.find(d => d.kind === 'tower')
  const D = Math.hypot(sc.ball.x, sc.ball.z), u = { x: -sc.ball.x / D, z: -sc.ball.z / D }, R = { x: u.z, z: -u.x }, dx = d.x - sc.ball.x, dz = d.z - sc.ball.z, f = (dx * u.x + dz * u.z) / D, lat = dx * R.x + dz * R.z
  const rel = []; for (let k = 0; k < 72; k++) { const t = k / 71; rel.push({ f: t * 1.02, l: lat * (t / f) / 20, y: Math.max(0.11, 0.11 + Math.sin(Math.PI * Math.min(1, t / f / 2)) * 1.5) }) }
  const T = hs.HS.makeTech(rel, 600, 'aim'); T.id = 'og'; T.name = '一直線ストレート砲'; G.techs[3] = T; G.refUsed = true; hs.dbg.goto(i)
})
await p.waitForFunction(() => hs.dbg.st() === 'aim')
await p.evaluate(() => { hs.dbg.choose(3); hs.dbg.kick() })
for (let i = 0; i < 400; i++) { await p.waitForTimeout(20); const s = await p.evaluate(() => { const m = hs.M.match; return m.st === 'fly' && m.pb.t > m.res.outT + 0.32 }); if (s) { await p.evaluate(() => hs.dbg.pause()); break } }
await p.evaluate(() => { document.getElementById('corner').style.display = 'none'; document.getElementById('shout').style.animation = 'none'; document.getElementById('shout').style.opacity = 1; document.getElementById('bigName').style.animation = 'none'; document.getElementById('bigName').style.opacity = 1 })
await p.waitForTimeout(200)
const shot = await p.screenshot({ clip: { x: 0, y: 0, width: 390, height: 600 } })
await ctx.close()
const img = 'data:image/png;base64,' + shot.toString('base64')
const c2 = await b.newContext({ viewport: { width: 1200, height: 630 } }); const q = await c2.newPage()
await q.setContent(`<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Yuji+Boku&family=Klee+One:wght@600&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;background:#0b1128;position:relative;font-family:"Klee One",sans-serif}
.bg{position:absolute;inset:-40px;background:url(${img}) center/cover;filter:blur(18px) brightness(.45)}
.ph{position:absolute;left:70px;top:22px;width:390px;height:600px;transform:rotate(-3deg);box-shadow:0 20px 50px rgba(0,0,0,.7);border:6px solid #f3f5f2;background:url(${img}) 0 0/100% auto}
h1{position:absolute;left:520px;top:70px;color:#fff;font-family:"Yuji Boku",serif;font-weight:400;line-height:1;transform:rotate(-4deg);text-shadow:0 6px 0 #a31f1a,0 10px 24px rgba(0,0,0,.6)}
h1 .a{display:block;font-size:72px}h1 .b{display:block;font-size:178px;color:#e0322b;-webkit-text-stroke:4px #fff;paint-order:stroke fill;text-shadow:none;margin-left:90px}
p{position:absolute;left:560px;top:438px;color:#fff;font-size:38px;font-weight:600;background:rgba(8,12,28,.7);padding:8px 18px;transform:rotate(-4deg)}
small{position:absolute;left:600px;top:520px;color:#ffd79a;font-size:28px;font-weight:600;transform:rotate(-4deg)}
svg{position:absolute;left:470px;top:330px}
</style></head><body><div class="bg"></div><div class="ph"></div>
<svg width="700" height="140" viewBox="0 0 700 140"><path d="M10 120 C 160 10, 300 150, 440 60 S 640 20, 690 40" fill="none" stroke="#e0322b" stroke-width="12" stroke-linecap="round"/></svg>
<h1><span class="a">必殺シュートを</span><span class="b">描け！</span></h1><p>守りは、なぜか人間タワー</p><small>棒人間サッカー</small></body></html>`)
await q.waitForTimeout(1500); await q.evaluate(() => document.fonts.ready)
await q.screenshot({ path: `${ROOT}/og.png` })
await b.close(); server.kill()
console.log('og.png', readFileSync(`${ROOT}/og.png`).length)
