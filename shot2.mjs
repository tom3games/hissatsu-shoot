import './mute-auto.mjs'
// bot に1試合やらせて、見せ場を撮る。node shot2.mjs [bot] [seed]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5972
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const bot = process.argv[2] || 'mix', seed = +(process.argv[3] || 5)
const b = await chromium.launch()
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('hs_tut', '{"draw":1,"card":1}') } catch (e) {} })
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
await p.goto(`http://localhost:${PORT}/?seed=${seed}&r=${process.env.RATE || 1}`); await p.waitForFunction(() => window.__hsReady && window.HSBots)
await p.waitForTimeout(600)
await p.evaluate(([bot, seed]) => { hs.dbg.setTechs(HSBots.BOT_TECHS[bot]().map((t, i) => { t.name = ['雷鳴ジグザグ蹴り', '三日月バナナ弾', '流星ドロップ砲', '地獄ローリング撃'][i]; return t })); hs.dbg.start(seed, bot); hs.dbg.rate(+(new URLSearchParams(location.search).get('r') || 1)) }, [bot, seed])
const seen = {}
let shots = 0
for (let i = 0; i < 1200; i++) {
  await p.waitForTimeout(100)
  const s = await p.evaluate(() => { const m = hs.M.match; return { mode: hs.M.mode, st: m.st, o: m.res && m.res.outcome, t: m.t, pbt: m.pb && m.pb.t, g: m.res && m.res.goalT, half: !document.getElementById('half').hidden } })
  if (s.half) { await p.screenshot({ path: `${ROOT}/shots/b-half.png` }); await p.click('#bSecond') }
  const key = s.st + ':' + s.o
  if (s.st === 'fly' && s.o === 'goal' && s.pbt > s.g && !seen.goal) { seen.goal = 1; await p.screenshot({ path: `${ROOT}/shots/b-goal.png` }) }
  if (s.st === 'after' && !seen['after:' + s.o]) { seen['after:' + s.o] = 1; await p.screenshot({ path: `${ROOT}/shots/b-after-${s.o}.png` }) }
  if ((s.st === 'ref' || s.st === 'fall' || s.st === 'concede') && !seen[s.st] && s.t > 0.9) { seen[s.st] = 1; await p.screenshot({ path: `${ROOT}/shots/b-${s.st}.png` }) }
  if (s.mode === 'end') { await p.waitForTimeout(1200); await p.screenshot({ path: `${ROOT}/shots/b-end.png` }); break }
}
console.log(await p.evaluate(() => { const r = hs.M.result; const im = document.getElementById('pImg'); return [r && r.photo && r.photo.length, im.naturalWidth, im.hidden, getComputedStyle(im).display, im.getBoundingClientRect().height] }))
console.log(JSON.stringify(await p.evaluate(() => ({ us: hs.M.match.G.us, them: hs.M.match.G.them, log: hs.M.match.G.log.map(r => r.outcome).join(' '), rank: hs.M.result && hs.M.result.gr.rank }))), Object.keys(seen).join(','))
console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
