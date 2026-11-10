import '../mute-auto.mjs'   // ブラウザでは絶対に音を出さない。音は記録して ffmpeg で後から重ねる
// X 投稿用の縦長プレイ動画（1080x1920・30fps・H.264＋AAC）。node promo/film.mjs
// 1) 作戦ボードで線を描く 2) 技名を付ける 3) 試合でその技がネットを破る 4) 同じ技を続けてキーパーに「見切った」
// 5) 足が尽きて転ぶ 6) 新聞の一面 → 題名。時計は仮想（_shared/promo-film.mjs）
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { serve, open, Recorder, mix, encode, inspect, stills } from '../../_shared/promo-film.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const SLUG = 'hissatsu-shoot'
const TMP = process.env.FRAMES || join(tmpdir(), `${SLUG}-frames-${Date.now()}`)
const OUT_DIR = join(homedir(), 'Desktop/バカゲー動画'); mkdirSync(OUT_DIR, { recursive: true })
const NAME = '雷鳴ジグザグ蹴り'

const srv = await serve(ROOT)
const { b, p, errs } = await open({ chromium, port: srv.port, path: '/?seed=3&notut', ready: '__hsReady' })
await p.evaluate(() => { try { localStorage.setItem('hs_tut', '{"draw":1,"card":1}') } catch (e) {} })
await p.evaluate(() => { const F = window.__film; F.hookSnd(); F.on() })
await p.evaluate(() => { document.getElementById('loading').hidden = true; Snd.init(); document.getElementById('bStart').click() })
// 描く線（ジグザグしながらゴール右上へ。画面の点）
const pts = await p.evaluate(() => {
  const c = hs.dbg.cam('edit'), HS = hs.HS, b = HS.proj(c, { x: 0, y: 0.11, z: -20 }), g = HS.proj(c, { x: 2.4, y: 1.7, z: 0 })
  const o = []; const n = 26
  for (let i = 0; i <= n; i++) { const k = i / n; o.push([b.x + (g.x - b.x) * k + Math.sin(k * Math.PI * 4) * 55 * (1 - k * 0.5), b.y + (g.y - b.y) * k - Math.sin(k * Math.PI * 0.5) * 30]) }
  return o
})
const rec = new Recorder(p, TMP)
// 1) 少し間をおいて描く
await rec.run((F, a) => { F.k = (F.k || 0) + 1; return F.k > 12 }, { max: 20 })
await rec.run((F, pts) => {
  const c = document.getElementById('cv'); F.i = F.i || 0
  const ev = (type, q) => c.dispatchEvent(new PointerEvent(type, { pointerId: 3, clientX: q[0], clientY: q[1], bubbles: true, pointerType: 'touch' }))
  if (F.i === 0) ev('pointerdown', pts[0])
  if (F.i < pts.length) ev('pointermove', pts[F.i])
  if (F.i === pts.length) ev('pointerup', pts[pts.length - 1])
  F.i++
  return F.i > pts.length
}, { max: 80, arg: pts })
// 2) 名前を付けて登録（試し撃ちを少し見せる）
await p.evaluate(name => { const n = document.getElementById('nameIn'); n.value = name; n.dispatchEvent(new Event('input')); const ch = document.querySelector('#chips button'); if (ch) ch.textContent = name }, NAME)
await rec.run((F) => { F.k2 = (F.k2 || 0) + 1; return F.k2 > 40 }, { max: 50 })
// 試合用: 残り3つは bot の技。描いた技が1本目でネットを破る試合を探す
const seed = await p.evaluate(name => {
  document.getElementById('bSave').click()
  const L = HSBots.BOT_TECHS.mix(); L[1].name = '三日月バナナ弾'; L[2].name = '流星ドロップ砲'; L[3].name = '地獄ローリング撃'
  const mine = hs.techs()[0]; mine.name = name
  hs.dbg.setTechs([mine, L[1], L[2], L[3]])
  for (let s = 1; s < 400; s++) { const m = hs.HS.makeMatch(s); const r = hs.HS.simulateShot(m.scenes[0], mine, false, 0); if (r.outcome === 'goal' && (mine.cost >= 12 || r.speed > 22) && m.scenes[1].type !== 'wall') { const r2 = hs.HS.simulateShot(m.scenes[1], mine, false, 3); if (r2.outcome === 'save') return s } }
  return 0
}, NAME)
console.log('seed', seed, await p.evaluate(() => { const t = hs.techs()[0]; return [t.kind, t.cost, t.speed.toFixed(1)] }))
await p.evaluate(s => hs.dbg.start(s), seed)
// 3) 札を選んで蹴る → ゴール
const tick = (F, a) => {
  const m = hs.M.match; F.c = (F.c || 0) + 1
  if (a.mode === 'aim') { if (m.st === 'aim' && F.c > 6 && m.sel < 0) hs.dbg.choose(a.card); if (m.sel >= 0 && F.c > 30) { hs.dbg.kick(); return true } return false }
  if (a.mode === 'until') return m.st === a.st && m.t >= (a.t || 0)
  return F.c >= a.n
}
const reset = () => p.evaluate(() => { window.__film.c = 0 })
await rec.run(tick, { ff: true, max: 60, arg: { mode: 'until', st: 'aim' } }); await reset()
await rec.run(tick, { max: 60, arg: { mode: 'aim', card: 0 } }); await reset()
await rec.run(tick, { max: 30 * 8, arg: { mode: 'until', st: 'after', t: 1.6 } }); await reset()
// 4) 同じ技を続けた（見を3つためた）ことにして、次の攻めで「見切った」
await rec.run(tick, { ff: true, max: 30 * 8, arg: { mode: 'until', st: 'aim' } }); await reset()
await p.evaluate(() => { const G = hs.dbg.G(); G.marks[G.techs[0].id] = [3, 1.5] })
await rec.run(tick, { max: 60, arg: { mode: 'aim', card: 0 } }); await reset()
await rec.run(tick, { max: 30 * 8, arg: { mode: 'until', st: 'after', t: 1.2 } }); await reset()
// 5) 足が尽きて転ぶ
await rec.run(tick, { ff: true, max: 30 * 10, arg: { mode: 'until', st: 'aim' } }); await reset()
await p.evaluate(() => hs.dbg.setLeg(4))
await rec.run(tick, { max: 60, arg: { mode: 'aim', card: 1 } }); await reset()
await rec.run(tick, { max: 30 * 6, arg: { mode: 'until', st: 'concede', t: 0.9 } }); await reset()
// 6) 新聞の一面
await p.evaluate(() => { const G = hs.dbg.G(); G.us = 3; G.them = 2; G.used[G.techs[1].id] = 1; G.used[G.techs[2].id] = 1; hs.dbg.end() })
await rec.run(tick, { ff: true, max: 45, arg: { n: 40 } }); await reset()
await rec.run(tick, { max: 30 * 3, arg: { n: 75 } }); await reset()
await p.evaluate(() => {
  const c = document.createElement('div'); c.textContent = '必殺シュートを描け！'
  c.style.cssText = 'position:fixed;left:0;right:0;top:80%;height:11%;display:flex;align-items:center;justify-content:center;background:#e0322b;z-index:99998;font:400 40px "Yuji Boku",serif;color:#fff;-webkit-text-stroke:2px #17161a;paint-order:stroke fill;pointer-events:none'
  document.body.appendChild(c)
})
await rec.run(tick, { max: 45, arg: { n: 45 } })
const log = await p.evaluate(() => ({ rec: window.__film.rec, gains: window.__film.gains, notes: window.__film.notes }))
await b.close(); srv.close()
const dur = rec.sec
const wav = join(TMP, 'mix.wav'), out = join(OUT_DIR, `${SLUG}-x-1080x1920.mp4`)
mix({ rec: log.rec, gains: log.gains, dur, root: ROOT, out: wav })
encode({ frames: TMP, wav, out })
const info = inspect(out)
const st = stills(out, [0.5, 3, 6.5, 9, 13, dur - 4, dur - 0.6], join(TMP, 'still'))
writeFileSync(join(ROOT, 'promo/film-log.json'), JSON.stringify({ seed, info, errs, frames: TMP, stills: st }, null, 1))
console.log(JSON.stringify({ out, dur, info, errs, st }, null, 1))
