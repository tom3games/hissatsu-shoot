import './mute-auto.mjs'
// 必殺シュートを描け！ の検証。node verify.mjs
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5974
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, q = '?seed=11', tut = false) {
  const ctx = await browser.newContext({ locale: opts.locale || 'ja-JP', viewport: { width: 390, height: 844 }, hasTouch: true, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(tt => { try { localStorage.clear(); if (!tt) localStorage.setItem('hs_tut', '{"draw":1,"card":1}') } catch (e) {} }, tut)
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__hsReady && window.HSBots, null, { timeout: 15000 })
  await p.waitForTimeout(300)
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *, .ovl:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('#paper')) continue   // 新聞は少し傾けてある
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button, main:not([hidden]) input, .ovl:not([hidden]) button, #tmSupport')) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
// 本物のポインタで線を描く（画面座標の点列）
async function drawStroke(p, pts, ms = 500) {
  await p.evaluate(() => { if (hs.M.mode === 'edit' && !document.getElementById('sheet').hidden && hs.M.edit.tech && !window.__keep) document.getElementById('bRedo').click() })
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down()
  const step = Math.max(8, ms / pts.length)
  for (const [x, y] of pts.slice(1)) { await p.mouse.move(x, y); await p.waitForTimeout(step) }
  await p.mouse.up(); await p.waitForTimeout(250)
}
// 練習場の画面の点（3D→画面）
const scr = (p, list) => p.evaluate(list => { const c = hs.dbg.cam('edit'); return list.map(q => { const s = hs.HS.proj(c, q); return [s.x, s.y] }) }, list)
const path = (a, b, n, bend = 0, up = 0) => { const o = []; for (let i = 0; i <= n; i++) { const k = i / n; o.push([a[0] + (b[0] - a[0]) * k + Math.sin(k * Math.PI) * bend, a[1] + (b[1] - a[1]) * k - Math.sin(k * Math.PI) * up]) } return o }
const lastTech = async p => { const r = await p.evaluate(() => { const t = hs.M.edit.tech; return t && { kind: t.kind, cost: t.cost, muri: t.muri, maxH: +t.maxH.toFixed(2), maxL: +t.maxL.toFixed(2), turn: +t.turn.toFixed(2), speed: +t.speed.toFixed(1), f0: t.rel[0], names: hs.M.edit.names } }); if (!r) return r; await p.evaluate(() => { const b = document.getElementById('bRedo'); if (!document.getElementById('sheet').hidden) setTimeout(() => {}, 0) }); return r }
const redo = p => p.evaluate(() => { if (!document.getElementById('sheet').hidden) document.getElementById('bRedo').click() })

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser, {}, '?seed=11', true)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect, cv: getComputedStyle(document.getElementById('cv')).touchAction }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none' && r.cv === 'none', JSON.stringify(r)); return r
})
await t('OGP・canonical・転送 script・計測・支援', async () => {
  const r = await p.evaluate(() => ({ og: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].every(k => document.querySelector(`meta[property="${k}"]`)), tw: !!document.querySelector('meta[name="twitter:card"]'), can: document.querySelector('link[rel=canonical]').href, gh: !!document.getElementById('ghMove'), tm: !!window.TM, sup: !!document.getElementById('tmSupport'), home: !!document.getElementById('tmHome') }))
  expect(r.og && r.tw && r.can === 'https://tom3games.com/play/hissatsu-shoot/' && r.gh && r.tm && r.sup && r.home, JSON.stringify(r))
})
await t('タイトル: 背景が描けている（輝度の散らばり）', async () => {
  const v = await p.evaluate(() => { const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2) })
  expect(v > 200, v); return v
})
await p.click('#bStart'); await p.waitForTimeout(400)
await t('作戦ボード: 初回は指のお手本が出る', async () => { expect(await p.evaluate(() => !document.getElementById('finger').hidden), 'no finger') })

// ---- 線→軌道の変換（本物のポインタで描く）
const P = await scr(p, [{ x: 0, y: 0.11, z: -20 }, { x: 2.6, y: 0.11, z: 0 }, { x: -2.8, y: 1.6, z: 0 }, { x: 0, y: 0.11, z: -10 }, { x: 2.5, y: 2.6, z: 0 }])
const [ball, goalLowR, goalHiL, mid] = P
await t('ちょんと触るだけでは技にならない（固まらない）', async () => {
  await drawStroke(p, [ball, [ball[0] + 3, ball[1] - 4]], 80)
  const r = await p.evaluate(() => ({ tech: !!hs.M.edit.tech, sheet: !document.getElementById('sheet').hidden, drawing: hs.M.edit.drawing }))
  expect(!r.tech && !r.sheet && !r.drawing, JSON.stringify(r)); return r
})
await t('地面に沿ってまっすぐ描く → ゴロ（低い）', async () => {
  await drawStroke(p, path(ball, goalLowR, 24), 420); const r = await lastTech(p)
  expect(r && r.maxH < 0.6 && r.muri < 0, JSON.stringify(r)); await redo(p); return { maxH: r.maxH, kind: r.kind, cost: r.cost }
})
await t('上にふくらませて描く → 浮く（高さ 2m 以上）', async () => {
  await drawStroke(p, path(ball, goalHiL, 26, 0, 260), 600); const r = await lastTech(p)
  expect(r && r.maxH > 2, JSON.stringify(r)); await redo(p); return { maxH: r.maxH, kind: r.kind, names: r.names }
})
await t('横にふくらませて描く → カーブ（横に 1.6m 以上ずれる）', async () => {
  await drawStroke(p, path(ball, goalLowR, 26, -150, 0), 600); const r = await lastTech(p)
  expect(r && r.maxL > 1.6, JSON.stringify(r)); await redo(p); return { maxL: r.maxL, kind: r.kind, cost: r.cost }
})
await t('急な折り返し（V字）→ 物理的に無理の印', async () => {
  const v = [ball, [ball[0] + 70, ball[1] - 200], [ball[0] + 74, ball[1] - 206], [ball[0] + 5, ball[1] - 70], [ball[0] + 3, ball[1] - 66]]
  const pts = []; for (let i = 0; i < v.length - 1; i++) for (let k = 0; k < 8; k++) pts.push([v[i][0] + (v[i + 1][0] - v[i][0]) * k / 8, v[i][1] + (v[i + 1][1] - v[i][1]) * k / 8])
  pts.push(v[v.length - 1])
  await drawStroke(p, pts, 500); const r = await lastTech(p)
  const warn = await p.evaluate(() => !document.getElementById('costWarn').hidden)
  expect(r && r.muri >= 0 && warn, JSON.stringify(r)); await redo(p); return { muri: r.muri, kind: r.kind }
})
await t('ぐるっと輪を描く → ループで足の負担が重い（まっすぐの3倍以上）', async () => {
  const pts = []; const cx = mid[0], cy = mid[1] + 40, R = 70
  for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push([ball[0] + (cx - ball[0]) * k, ball[1] + (cy + R - ball[1]) * k]) }
  for (let i = 0; i <= 40; i++) { const a = Math.PI / 2 - i / 40 * Math.PI * 2; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]) }
  for (let i = 1; i <= 10; i++) { const k = i / 10; pts.push([cx + (goalLowR[0] - cx) * k, cy + R + (goalLowR[1] - cy - R) * k]) }
  await drawStroke(p, pts, 1100); const r = await lastTech(p)
  expect(r && r.turn > 4 && r.cost >= 18 && r.muri < 0, JSON.stringify(r)); await redo(p); return { turn: r.turn, cost: r.cost, kind: r.kind }
})
await t('ボールから離れた所から描いても、ボールから始まる', async () => {
  await drawStroke(p, path([ball[0] + 80, ball[1] - 60], goalLowR, 20), 400); const r = await lastTech(p)
  expect(r && Math.abs(r.f0.f) < 1e-6 && Math.abs(r.f0.l) < 1e-6, JSON.stringify(r.f0)); await redo(p)
})
await t('速く描くほど速い球', async () => {
  await drawStroke(p, path(ball, goalLowR, 12), 120); const a = await lastTech(p); await redo(p)
  await drawStroke(p, path(ball, goalLowR, 40), 1300); const b = await lastTech(p); await redo(p)
  expect(a.speed > b.speed + 5, a.speed + ' vs ' + b.speed); return [a.speed, b.speed]
})
await t('描いた線の上をボールが飛ぶ（試し撃ちの球が線から 25px 以内）', async () => {
  const line = path(ball, goalHiL, 26, 120, 160)
  await drawStroke(p, line, 700)
  await p.evaluate(() => hs.dbg.pause())
  const d = await p.evaluate(line => {
    const E = hs.M.edit, c = hs.dbg.cam('edit'), fr = E.prev.sim.frames, out = []
    const pathEnd = fr.findIndex(f => f.b.z > -0.5)
    for (let i = 3; i < (pathEnd > 0 ? pathEnd : fr.length); i += 4) { const s = hs.HS.proj(c, fr[i].b); let m = 1e9; for (const q of line) m = Math.min(m, Math.hypot(q[0] - s.x, q[1] - s.y)); out.push(m) }
    return { max: Math.round(Math.max(...out)), n: out.length }
  }, line)
  await p.evaluate(() => hs.dbg.resume())
  expect(d.max < 25 && d.n > 5, JSON.stringify(d)); return d
})
await t('名前の候補3つ・大げさな名前・登録で札に入る・保存される', async () => {
  const r = await p.evaluate(() => ({ chips: document.querySelectorAll('#chips button').length, name: document.getElementById('nameIn').value }))
  await p.fill('#nameIn', 'テスト砲'); await p.click('#bSave'); await p.waitForTimeout(250)
  const s = await p.evaluate(() => ({ n: hs.techs().length, name: hs.techs()[0].name, ls: JSON.parse(localStorage.getItem('hs_techs') || '[]').length, play: !document.getElementById('bPlay').hidden }))
  expect(r.chips === 3 && r.name.length >= 3 && s.n === 1 && s.name === 'テスト砲' && s.ls === 1 && s.play, JSON.stringify([r, s])); return [r.name]
})
await t('技は4つまで（5つ目は選んだ札を上書き）', async () => {
  for (let i = 0; i < 4; i++) { await drawStroke(p, path(ball, i % 2 ? goalLowR : goalHiL, 18, (i - 1.5) * 60, i * 40), 400); await p.click('#bSave'); await p.waitForTimeout(150) }
  const n = await p.evaluate(() => hs.techs().length); expect(n === 4, n); return n
})
await t('作戦ボードの描画中に別の指が触れても固まらない', async () => {
  await p.mouse.move(ball[0], ball[1]); await p.mouse.down(); await p.mouse.move(ball[0], ball[1] - 80)
  await p.evaluate(() => { const c = document.getElementById('cv'); c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: 50, clientY: 300, bubbles: true })); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: 50, clientY: 300, bubbles: true })) })
  await p.mouse.move(goalLowR[0], goalLowR[1]); await p.mouse.up(); await p.waitForTimeout(200)
  const ok = await p.evaluate(() => !!hs.M.edit.tech); await redo(p); expect(ok, 'no tech'); return ok
})
await p.screenshot({ path: `${ROOT}/shots/v-edit.png` })

// ---- 試合（本物のクリックで札を選んで蹴る）
await p.click('#bPlay'); await p.waitForFunction(() => hs.dbg.st() === 'aim', null, { timeout: 5000 })
await t('試合: 蹴る前は札を押すまで「蹴る」が出ない・押すと通り道が出る', async () => {
  const a = await p.evaluate(() => document.getElementById('actRow').hidden)
  await p.click('#bKick', { force: true, trial: false }).catch(() => {})
  const st0 = await p.evaluate(() => hs.dbg.st())
  await p.locator('.card').nth(1).click(); await p.waitForTimeout(150)
  const b = await p.evaluate(() => ({ act: !document.getElementById('actRow').hidden, sel: hs.M.match.sel }))
  expect(a && st0 === 'aim' && b.act && b.sel === 1, JSON.stringify([a, st0, b])); return b
})
await p.screenshot({ path: `${ROOT}/shots/v-aim.png` })
await t('試合: 左右反転・同じ札をもう一度押すと蹴る・結果が出て次へ', async () => {
  await p.click('#bFlip'); const f = await p.evaluate(() => hs.M.match.flip)
  await p.locator('.card').nth(1).click()
  await p.waitForFunction(() => ['after', 'concede', 'fall', 'ref'].includes(hs.dbg.st()), null, { timeout: 12000 })
  const o = await p.evaluate(() => hs.M.match.res.outcome)
  await p.waitForFunction(() => hs.dbg.st() === 'aim' || hs.dbg.st() === 'intro', null, { timeout: 12000 })
  const i = await p.evaluate(() => hs.M.match.G.i)
  expect(f && o && (i === 1 || o === 'ref'), JSON.stringify([f, o, i])); return o
})
await t('試合: 同じ技を続けるとキーパーの「見」がたまる', async () => {
  const r = await p.evaluate(() => { const G = hs.M.match.G, id = G.techs[1].id; return [hs.HS.readLevel(G.marks, id, true), hs.HS.readLevel(G.marks, G.techs[0].id, false)] })
  expect(r[0] >= 1 && r[1] === 0, JSON.stringify(r)); return r
})
await t('試合: 変な時に押しても固まらない（蹴る連打・飛んでいる最中の札・反転・画面の連打・回転）', async () => {
  await p.waitForFunction(() => hs.dbg.st() === 'aim', null, { timeout: 8000 })
  await p.locator('.card').nth(0).click(); await p.click('#bKick')
  for (let i = 0; i < 6; i++) { await p.evaluate(() => { document.getElementById('bKick').click(); document.getElementById('bFlip').click(); document.querySelectorAll('.card').forEach(c => c.click()) }); await p.mouse.click(100 + i * 30, 400); await p.waitForTimeout(60) }
  await p.setViewportSize({ width: 360, height: 640 }); await p.waitForTimeout(200); await p.setViewportSize({ width: 390, height: 844 })
  await p.waitForFunction(() => hs.dbg.st() === 'aim', null, { timeout: 15000 })
  const r = await p.evaluate(() => ({ i: hs.M.match.G.i, log: hs.M.match.G.log.length }))
  expect(r.i >= 2 && p.errs.length === 0, JSON.stringify(r) + p.errs.join('|')); return r
})
await t('試合: 何もしないと時間切れで失点（カウンター）', async () => {
  const before = await p.evaluate(() => hs.M.match.G.them)
  await p.evaluate(() => hs.dbg.rate(6))
  await p.waitForFunction(() => hs.M.match.res && hs.M.match.res.outcome === 'timeout', null, { timeout: 15000 })
  await p.waitForFunction(() => hs.dbg.st() === 'aim' || hs.dbg.st() === 'intro' || !document.getElementById('half').hidden, null, { timeout: 15000 })
  const after = await p.evaluate(() => hs.M.match.G.them); await p.evaluate(() => hs.dbg.rate(1))
  expect(after >= before + 1, before + '->' + after); return [before, after]
})
// 1試合を bot で最後まで（早回し）
await t('1試合を最後まで: ハーフタイム → 新聞の一面（見出し・写真・支援ボタン）', async () => {
  await p.evaluate(() => { hs.dbg.bot('mix'); hs.dbg.rate(5) })
  for (let k = 0; k < 400; k++) {
    await p.waitForTimeout(150)
    const s = await p.evaluate(() => ({ half: !document.getElementById('half').hidden, mode: hs.M.mode }))
    if (s.half) { await p.screenshot({ path: `${ROOT}/shots/v-half.png` }); await p.click('#bSecond') }
    if (s.mode === 'end') break
  }
  await p.waitForTimeout(900)
  const r = await p.evaluate(() => ({ mode: hs.M.mode, head: document.getElementById('pHead').textContent, photo: document.getElementById('pImg').naturalWidth, stamp: document.getElementById('pStamp').textContent, sup: document.getElementById('tmSupport').getBoundingClientRect().height, played: Snd.played }))
  expect(r.mode === 'end' && r.head.length > 4 && r.photo > 100 && r.stamp && r.sup > 20, JSON.stringify(r)); return { head: r.head, stamp: r.stamp }
})
await p.screenshot({ path: `${ROOT}/shots/v-end.png` })
await t('音: 録音素材を呼んでいる（蹴る・笛・歓声か溜息・太鼓）', async () => {
  const r = await p.evaluate(() => Snd.played); expect(r.kick >= 3 && (r.whistleL || 0) >= 2 && (r.roar || r.ooh) && r.don >= 3 && r['loop:amb'] >= 1, JSON.stringify(r)); return r
})
await t('Chromium: 実際には無音', async () => { expect(await p.evaluate(() => window.__muteOk()), 'not muted') })
await t('結果: 画像を作れる（1080x1350）', async () => {
  const r = await p.evaluate(async () => { const c = document.getElementById('card'); return [c.width, c.height] })
  expect(r[0] === 1080, r); return r
})
await t('もう一回で次の試合が始まる', async () => {
  await p.evaluate(() => hs.dbg.bot(null)); await p.click('#bAgain'); await p.waitForTimeout(300)
  const r = await p.evaluate(() => ({ mode: hs.M.mode, i: hs.M.match.G.i, us: hs.M.match.G.us }))
  expect(r.mode === 'match' && r.i === 0 && r.us === 0, JSON.stringify(r)); return r
})
await t('起動からここまでエラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- 同時に出ている文字の数（bot の1試合で 0.1 秒ごとに数える）
{
  const q = await open(browser)
  await q.evaluate(() => { hs.dbg.setTechs(HSBots.BOT_TECHS.mix()); hs.dbg.start(3, 'mix'); hs.dbg.rate(3) })
  let maxN = 0, worst = ''
  for (let k = 0; k < 250; k++) {
    await q.waitForTimeout(100)
    const r = await q.evaluate(() => { const on = []; if (document.getElementById('live').classList.contains('on')) on.push('live'); if (document.getElementById('bubble').classList.contains('on')) on.push('bubble'); if (document.getElementById('shout').classList.contains('go')) on.push('shout'); return { on, mode: hs.M.mode, half: !document.getElementById('half').hidden } })
    if (r.half) await q.click('#bSecond')
    if (r.on.length > maxN) { maxN = r.on.length; worst = r.on.join('+') }
    if (r.mode === 'end') break
  }
  await t('遊び中に同時に出る文字は2つまで（技名の大書きは別）', async () => { expect(maxN <= 2, worst); return { maxN, worst } })
  await q.close()
}

// ---- 3サイズ × 全画面で一画面に収まる
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await q.click('#howClose')
  await q.click('#bStart'); await q.waitForTimeout(200); views.edit = await fit(q)
  const b = await q.evaluate(() => { const c = hs.dbg.cam('edit'), s = hs.HS.proj(c, { x: 0, y: 0.11, z: -20 }), g = hs.HS.proj(c, { x: 2, y: 1, z: 0 }); return [[s.x, s.y], [g.x, g.y]] })
  await drawStroke(q, path(b[0], b[1], 20, 70, 60), 400); views.sheet = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-sheet.png` })
  await q.click('#bSave'); await q.waitForTimeout(150)
  await q.evaluate(() => { const L = HSBots.BOT_TECHS.mix(); hs.dbg.setTechs([hs.techs()[0], L[1], L[2], L[3]]) })
  await q.click('#bPlay'); await q.waitForFunction(() => hs.dbg.st() === 'aim'); await q.locator('.card').nth(0).click(); await q.waitForTimeout(150)
  views.aim = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-aim.png` })
  const ballVis = await q.evaluate(() => { const c = hs.dbg.cam('match'), sc = hs.M.match.G.m.scenes[0], s = hs.HS.proj(c, { ...sc.ball, y: 0.11 }), cards = document.getElementById('actRow').getBoundingClientRect().top; return { by: Math.round(s.y), cards: Math.round(cards) } })
  await t(`${name}: 試合のボールが札とボタンに隠れない`, async () => { expect(ballVis.by < ballVis.cards - 8, JSON.stringify(ballVis)); return ballVis })
  await q.evaluate(() => { hs.dbg.bot('mix'); hs.dbg.rate(8) })
  for (let k = 0; k < 300; k++) { await q.waitForTimeout(120); const s = await q.evaluate(() => ({ half: !document.getElementById('half').hidden, mode: hs.M.mode })); if (s.half && !views.half) { views.half = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-half.png` }); await q.click('#bSecond') } else if (s.half) await q.click('#bSecond'); if (s.mode === 'end') break }
  await q.waitForTimeout(1000); views.end = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-end.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}

// ---- 英語
{
  const q = await open(browser, { locale: 'en-US' }, '?seed=4')
  await t('英語: タイトルとボタンが英語', async () => {
    const r = await q.evaluate(() => [document.getElementById('tT1').textContent, document.getElementById('bStart').textContent, document.getElementById('bHow').textContent].join('|'))
    expect(!/[ぁ-んァ-ヶ一-龠]/.test(r), r); return r
  })
  await q.click('#bStart'); await q.waitForTimeout(200)
  const b = await q.evaluate(() => { const c = hs.dbg.cam('edit'), s = hs.HS.proj(c, { x: 0, y: 0.11, z: -20 }), g = hs.HS.proj(c, { x: -2, y: 1, z: 0 }); return [[s.x, s.y], [g.x, g.y]] })
  await drawStroke(q, path(b[0], b[1], 20, 90, 40), 400)
  await t('英語: 技の名前の候補も英語', async () => { const r = await q.evaluate(() => [...document.querySelectorAll('#chips button')].map(x => x.textContent)); expect(r.length === 3 && r.every(s => !/[ぁ-んァ-ヶ一-龠]/.test(s)), r.join('|')); return r })
  await q.screenshot({ path: `${ROOT}/shots/en-sheet.png` })
  await q.click('#bSave'); await q.click('#bPlay'); await q.waitForTimeout(400)
  await t('英語: 試合の画面に日本語が出ない（札の名前以外）', async () => { const r = await q.evaluate(() => [document.getElementById('ledUs').textContent, document.getElementById('ledThem').textContent, document.getElementById('legLab').textContent, document.getElementById('live').textContent].join('|')); expect(!/[ぁ-んァ-ヶ一-龠]/.test(r), r); return r })
  await q.screenshot({ path: `${ROOT}/shots/en-match.png` })
  await q.close()
}
await browser.close()

// ---- WebKit（iPhone 相当）
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await wp.tap('#bStart'); await wp.waitForTimeout(300)
await t('WebKit: 線を描いて技にできる', async () => {
  const b = await wp.evaluate(() => { const c = hs.dbg.cam('edit'), s = hs.HS.proj(c, { x: 0, y: 0.11, z: -20 }), g = hs.HS.proj(c, { x: 2, y: 1, z: 0 }); return [[s.x, s.y], [g.x, g.y]] })
  await drawStroke(wp, path(b[0], b[1], 20, 60, 40), 400)
  const r = await wp.evaluate(() => !!hs.M.edit.tech); expect(r, r)
})
await wp.tap('#bSave'); await wp.waitForTimeout(150); await wp.tap('#bPlay'); await wp.waitForFunction(() => hs.dbg.st() === 'aim')
await wp.tap('.card'); await wp.tap('#bKick'); await wp.waitForTimeout(2500)
await wp.screenshot({ path: `${ROOT}/shots/wk-fly.png` })
await t('WebKit: 蹴ったあとも実際には無音', async () => { const r = await wp.evaluate(() => window.__muteOk()); expect(r, r) })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
