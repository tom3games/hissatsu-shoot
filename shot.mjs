import './mute-auto.mjs'
// 画面を撮って目で見る用。node shot.mjs [幅] [高さ]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 5971
mkdirSync(ROOT + '/shots', { recursive: true })
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const w = +(process.argv[2] || 390), h = +(process.argv[3] || 844), tag = process.argv[4] || ''
const b = await chromium.launch()
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
await p.goto(`http://localhost:${PORT}/?seed=11`); await p.waitForFunction(() => window.__hsReady)
await p.waitForTimeout(2800)
await p.screenshot({ path: `${ROOT}/shots/s-title${tag}.png` })
await p.click('#bStart'); await p.waitForTimeout(500)
await p.screenshot({ path: `${ROOT}/shots/s-edit0${tag}.png` })
// 本物のポインタで線を描く（ボールから上へ、右にふくらむカーブ）
const cam = await p.evaluate(() => { const c = hs.dbg.cam('edit'); const HS = hs.HS; const b = HS.proj(c, { x: 0, y: 0.11, z: -20 }), g = HS.proj(c, { x: -2.6, y: 1.2, z: 0 }); return { b, g } })
await p.mouse.move(cam.b.x, cam.b.y); await p.mouse.down()
for (let i = 1; i <= 30; i++) { const k = i / 30; await p.mouse.move(cam.b.x + (cam.g.x - cam.b.x) * k + Math.sin(k * Math.PI) * w * 0.3, cam.b.y + (cam.g.y - cam.b.y) * k - Math.sin(k * Math.PI) * 40); await p.waitForTimeout(16) }
await p.mouse.up(); await p.waitForTimeout(900)
await p.screenshot({ path: `${ROOT}/shots/s-edit1${tag}.png` })
await p.click('#bSave'); await p.waitForTimeout(300)
await p.screenshot({ path: `${ROOT}/shots/s-edit2${tag}.png` })
await p.click('#bPlay'); await p.waitForTimeout(1200)
await p.screenshot({ path: `${ROOT}/shots/s-match0${tag}.png` })
await p.click('.card'); await p.waitForTimeout(300)
await p.screenshot({ path: `${ROOT}/shots/s-match1${tag}.png` })
await p.click('#bKick'); await p.waitForTimeout(500)
await p.screenshot({ path: `${ROOT}/shots/s-tame${tag}.png` })
await p.waitForTimeout(1100)
await p.screenshot({ path: `${ROOT}/shots/s-fly${tag}.png` })
await p.waitForTimeout(1500)
await p.screenshot({ path: `${ROOT}/shots/s-after${tag}.png` })
console.log(JSON.stringify(await p.evaluate(() => ({ st: hs.dbg.st(), res: hs.M.match.res.outcome, techs: hs.techs().map(t => [t.name, t.kind, t.cost, t.speed.toFixed(1), t.maxH.toFixed(1)]) }))))
console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
