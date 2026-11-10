// 必殺シュートを描け！ 画面・描画・操作
;(function () {
  'use strict'
  window.__jsUp = true
  const HS = window.HS, D = window.HS_DATA
  const { clamp, lerp, V, proj, BR, HALF, GH } = HS
  const $ = id => document.getElementById(id)
  const Q = new URLSearchParams(location.search)
  const cv = $('cv'), ctx = cv.getContext('2d')
  let W = 390, H = 844, DPR = 1
  const store = { get(k, d) { try { const v = localStorage.getItem('hs_' + k); return v == null ? d : JSON.parse(v) } catch (e) { return d } }, set(k, v) { try { localStorage.setItem('hs_' + k, JSON.stringify(v)) } catch (e) {} } }
  let lang = store.get('lang', (navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
  if (Q.get('lang')) lang = Q.get('lang')
  const T = () => D.t[lang]
  const touchy = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window
  const R0 = HS.rng(+(Q.get('seed') || Date.now() % 100000))
  const pick = a => a[Math.floor(R0() * a.length)]
  const AUTO_Q = !!Q.get('auto')

  // ---------------- 音（全部録音素材）
  Snd.def({
    kick: ['snd/kick1.mp3', 'snd/kick2.mp3', 'snd/kick3.mp3'], whistleS: 'snd/whistle_s.mp3', whistleL: 'snd/whistle_l.mp3', roar: 'snd/roar.mp3', ooh: 'snd/ooh.mp3',
    don: ['snd/don.mp3', 'snd/don2.mp3'], crash: 'snd/crash.mp3', fall: 'snd/fall1.mp3', thud: 'snd/thud.mp3', grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'],
    muri: 'snd/muri1.mp3', squeak: 'snd/squeak.mp3', rip: ['snd/rip1.mp3', 'snd/rip2.mp3'], catch: 'snd/catch.mp3', block: 'snd/block.mp3', boing: 'snd/boing.mp3',
    win: 'snd/win.mp3', lose: 'snd/lose.mp3', ok: 'snd/ok.mp3', sel: 'snd/sel.mp3', swish: 'snd/swish.mp3',
    sand: 'snd/sand.mp3', topple: 'snd/topple.mp3', giggle: 'snd/giggle.mp3', whoosh: 'snd/whoosh.mp3', boom: 'snd/boom.mp3',
  })
  Snd.setMute(store.get('mute', false))
  let sndOn = false
  function sndStart() { if (sndOn) { Snd.init(); return } sndOn = true; Snd.init(); Snd.loop('amb', 'snd/amb_crowd.mp3', 0.42) }
  window.addEventListener('pointerdown', sndStart, { capture: true })

  // ---------------- 画面の大きさ
  const views = { title: $('vTitle'), edit: $('vEdit'), match: $('vMatch'), end: $('vEnd') }
  function resize() {
    W = Math.max(280, innerWidth); H = Math.max(400, innerHeight); DPR = Math.min(2, devicePixelRatio || 1)
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR)
    camCache.clear(); bgCache.clear()
    // 狙う前（札を選ぶ前）だけカメラを画面に合わせ直す。札を選んだ後は蹴り終わるまで固定
    const m = M.match; if (m && (m.st === 'intro' || (m.st === 'aim' && m.sel < 0))) { m.cam = null; m.spot = null }
  }
  const camCache = new Map(), bgCache = new Map()
  function camFor(ball, kind) {
    const key = kind + ':' + ball.x.toFixed(2) + ',' + ball.z.toFixed(2) + ':' + W + 'x' + H
    if (!camCache.has(key)) {
      const o = kind === 'edit' ? { yb: 0.6, yg: 0.27, back: 8, gw: 0.8 } : kind === 'title' ? { yb: 0.86, yg: 0.47, back: 6 } : { yb: 0.66, yg: 0.3, back: 15, gw: 0.8, hmin: 6, hmax: 10, fovMin: 18 }
      if (H < 700) { o.yb -= 0.02; o.yg -= 0.02 }
      const c = HS.fitCam(ball, W, H, o); c.key = key; camCache.set(key, c)
    }
    return camCache.get(key)
  }

  // ---------------- 3D の小道具
  const toCam = (cam, p) => { const d = V.sub(p, cam.C); return { x: V.dot(d, cam.R), y: V.dot(d, cam.U), z: V.dot(d, cam.F) } }
  const scr = (cam, c) => ({ x: cam.cx + c.x * cam.f / c.z, y: cam.cy - c.y * cam.f / c.z })
  function poly(g, cam, pts) {
    const cs = pts.map(p => toCam(cam, p)), out = [], N = 0.25
    for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[(i + 1) % cs.length]; if (a.z >= N) out.push(a); if ((a.z >= N) !== (b.z >= N)) { const t = (N - a.z) / (b.z - a.z); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: N }) } }
    if (out.length < 3) return false
    g.beginPath(); out.forEach((c, i) => { const s = scr(cam, c); i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y) }); g.closePath(); return true
  }
  function seg(g, cam, a, b) {
    let A = toCam(cam, a), B = toCam(cam, b); const N = 0.25
    if (A.z < N && B.z < N) return false
    if (A.z < N) { const t = (N - A.z) / (B.z - A.z); A = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: N } }
    if (B.z < N) { const t = (N - B.z) / (A.z - B.z); B = { x: B.x + (A.x - B.x) * t, y: B.y + (A.y - B.y) * t, z: N } }
    const s1 = scr(cam, A), s2 = scr(cam, B); g.moveTo(s1.x, s1.y); g.lineTo(s2.x, s2.y); return true
  }
  // 地面の白線（幅のある帯）
  function ribbon(g, cam, pts, w = 0.12) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2
      if (poly(g, cam, [{ x: a.x + nx, y: 0.005, z: a.z + nz }, { x: b.x + nx, y: 0.005, z: b.z + nz }, { x: b.x - nx, y: 0.005, z: b.z - nz }, { x: a.x - nx, y: 0.005, z: a.z - nz }])) g.fill()
    }
  }
  const arcPts = (cx, cz, r, a0, a1, n = 24) => { const a = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; a.push({ x: cx + Math.cos(t) * r, z: cz + Math.sin(t) * r }) } return a }

  // ---------------- 背景（スタジアム。場面ごとに1回だけ描いて使い回す）
  function buildBG(cam) {
    const key = cam.key
    if (bgCache.has(key)) return bgCache.get(key)
    if (bgCache.size > 6) bgCache.clear()
    const c = document.createElement('canvas'); c.width = Math.round(W * DPR); c.height = Math.round(H * DPR)
    const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0)
    const r = HS.rng(77)
    // 夜空と照明のもや
    const hz = proj(cam, { x: cam.C.x + cam.u.x * 400, y: 0, z: cam.C.z + cam.u.z * 400 })
    const hy = hz ? hz.y : H * 0.3
    const sk = g.createLinearGradient(0, 0, 0, hy + 40); sk.addColorStop(0, '#05081a'); sk.addColorStop(0.55, '#121c3f'); sk.addColorStop(1, '#2c3a68')
    g.fillStyle = sk; g.fillRect(0, 0, W, H)
    // 照明塔
    for (const sx of [-1, 1]) {
      const top = proj(cam, { x: sx * 46, y: 34, z: 34 }); const bot = proj(cam, { x: sx * 46, y: 6, z: 34 })
      if (top && bot) {
        g.strokeStyle = '#1a2036'; g.lineWidth = Math.max(2, top.s * 0.9); g.beginPath(); g.moveTo(bot.x, bot.y); g.lineTo(top.x, top.y); g.stroke()
        const R = Math.max(30, top.s * 14), gr = g.createRadialGradient(top.x, top.y, 0, top.x, top.y, R * 3)
        gr.addColorStop(0, 'rgba(255,248,225,.95)'); gr.addColorStop(0.08, 'rgba(255,240,200,.55)'); gr.addColorStop(0.4, 'rgba(255,230,180,.10)'); gr.addColorStop(1, 'rgba(255,230,180,0)')
        g.fillStyle = gr; g.fillRect(top.x - R * 3, top.y - R * 3, R * 6, R * 6)
        g.fillStyle = '#fffbe9'; for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) { g.fillRect(top.x + i * top.s * 1.3 - 2, top.y - top.s * 1.2 + j * top.s * 1.1, Math.max(2, top.s), Math.max(2, top.s * 0.7)) }
      }
    }
    // スタンド（ゴール裏）と観客
    const tiers = 22, cols = ['#d23a32', '#f2f2f2', '#2f5fb8', '#f0c43a', '#1f1f24', '#e86a3a', '#6b3f9a', '#3a9a5a']
    for (let k = tiers - 1; k >= 0; k--) {
      const z0 = 5 + k * 1.25, y0 = 1.3 + k * 0.72
      g.fillStyle = k % 2 ? '#1b2340' : '#20294a'
      if (poly(g, cam, [{ x: -52, y: y0, z: z0 }, { x: 52, y: y0, z: z0 }, { x: 52, y: y0 + 0.72, z: z0 + 1.25 }, { x: -52, y: y0 + 0.72, z: z0 + 1.25 }])) g.fill()
      const n = 70
      for (let i = 0; i < n; i++) {
        const x = -50 + (i + r() * 0.8) * 100 / n, p = proj(cam, { x, y: y0 + 0.5, z: z0 + 0.5 }); if (!p) continue
        const s = p.s; if (s < 0.6) continue
        g.fillStyle = cols[Math.floor(r() * cols.length)]
        g.fillRect(p.x - s * 0.22, p.y - s * 0.1, s * 0.44, s * 0.42)
        g.fillStyle = r() < 0.5 ? '#e9c3a0' : '#b98a62'; g.beginPath(); g.arc(p.x, p.y - s * 0.24, s * 0.14, 0, 7); g.fill()
        if (r() < 0.12) { g.fillStyle = cols[Math.floor(r() * 3)]; g.fillRect(p.x - s * 0.5, p.y - s * 0.85, s * 1, s * 0.25) }   // 旗・マフラー
      }
    }
    // 横のスタンド
    for (const sx of [-1, 1]) for (let k = 14; k >= 0; k--) {
      const x0 = sx * (40 + k * 1.2), y0 = 1 + k * 0.7
      g.fillStyle = k % 2 ? '#182038' : '#1d2645'
      if (poly(g, cam, [{ x: x0, y: y0, z: -70 }, { x: x0, y: y0, z: 6 }, { x: x0 + sx * 1.2, y: y0 + 0.7, z: 6 }, { x: x0 + sx * 1.2, y: y0 + 0.7, z: -70 }])) g.fill()
      for (let i = 0; i < 40; i++) { const z = -66 + i * 1.8 + r(); const p = proj(cam, { x: x0 + sx * 0.6, y: y0 + 0.45, z }); if (!p || p.s < 0.6) continue; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(p.x - p.s * 0.2, p.y - p.s * 0.2, p.s * 0.4, p.s * 0.45) }
    }
    // 芝（刈り目のしま）
    g.fillStyle = '#245f30'; if (poly(g, cam, [{ x: -60, y: 0, z: -80 }, { x: 60, y: 0, z: -80 }, { x: 60, y: 0, z: 5 }, { x: -60, y: 0, z: 5 }])) g.fill()
    for (let z = -80, i = 0; z < 0; z += 5.5, i++) {
      g.fillStyle = i % 2 ? '#2f7a3b' : '#2a7035'
      if (poly(g, cam, [{ x: -40, y: 0, z }, { x: 40, y: 0, z }, { x: 40, y: 0, z: Math.min(0, z + 5.5) }, { x: -40, y: 0, z: Math.min(0, z + 5.5) }])) g.fill()
    }
    // 芝のざらつき
    for (let i = 0; i < 900; i++) { const x = -34 + r() * 68, z = -60 + r() * 60, p = proj(cam, { x, y: 0, z }); if (!p || p.y > H || p.y < 0) continue; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(p.x, p.y, Math.max(1, p.s * 0.25), Math.max(1, p.s * 0.08)) }
    // 照明の明るみ
    const lg = g.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, H * 0.8); lg.addColorStop(0, 'rgba(255,250,230,.10)'); lg.addColorStop(1, 'rgba(0,0,0,.28)')
    g.fillStyle = lg; g.fillRect(0, 0, W, H)
    // 白線
    g.fillStyle = 'rgba(245,248,240,.92)'
    ribbon(g, cam, [{ x: -34, z: 0 }, { x: 34, z: 0 }])
    ribbon(g, cam, [{ x: -20.16, z: 0 }, { x: -20.16, z: -16.5 }, { x: 20.16, z: -16.5 }, { x: 20.16, z: 0 }])
    ribbon(g, cam, [{ x: -9.16, z: 0 }, { x: -9.16, z: -5.5 }, { x: 9.16, z: -5.5 }, { x: 9.16, z: 0 }])
    ribbon(g, cam, arcPts(0, -11, 9.15, Math.PI + 0.93, Math.PI * 2 - 0.93).map(p => ({ x: p.x, z: p.z })))
    ribbon(g, cam, [{ x: -34, z: 0 }, { x: -34, z: -70 }]); ribbon(g, cam, [{ x: 34, z: 0 }, { x: 34, z: -70 }])
    ribbon(g, cam, [{ x: -40, z: -52.5 }, { x: 40, z: -52.5 }])
    ribbon(g, cam, arcPts(0, -52.5, 9.15, 0, Math.PI, 30))
    ribbon(g, cam, arcPts(0, -11, 0.12, 0, Math.PI * 2, 8), 0.2)
    // 看板（ゴール裏）
    const ads = lang === 'ja' ? ['まがりかど商店街', '大盛り無料', '棒人間 募集中', '芝 刈ります', '夜ふかし定食', '町内会'] : ['CORNER STREET', 'FREE REFILLS', 'STICKMEN WANTED', 'LAWN CARE', 'LATE DINER', 'BLOCK 3']
    const adc = [['#c62c26', '#fff'], ['#f3f0e6', '#1a1a1a'], ['#1c3f8f', '#fff'], ['#f0c43a', '#1a1a1a']]
    for (let i = 0; i < 12; i++) {
      const x0 = -36 + i * 6, cc = adc[i % adc.length]
      g.fillStyle = cc[0]; if (poly(g, cam, [{ x: x0, y: 0, z: 3.4 }, { x: x0 + 5.9, y: 0, z: 3.4 }, { x: x0 + 5.9, y: 0.9, z: 3.4 }, { x: x0, y: 0.9, z: 3.4 }])) g.fill()
      const p = proj(cam, { x: x0 + 2.95, y: 0.45, z: 3.4 }); if (p && p.s > 3) { g.fillStyle = cc[1]; g.font = `700 ${Math.round(p.s * 0.5)}px ${getComputedStyle(document.body).getPropertyValue('--sans')}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ads[i % ads.length], p.x, p.y, p.s * 5.4) }
    }
    bgCache.set(key, c)
    return c
  }

  // ---------------- ゴール（ポスト・ネット）
  function drawGoalBack(g, cam, net) {
    const back = 2.0, top = 2.0
    g.strokeStyle = 'rgba(240,244,248,.55)'; g.lineWidth = 1
    const bulge = (p) => {
      if (!net.b) return p
      const d2 = (p.x - net.x) ** 2 + (p.y - net.y) ** 2, k = Math.exp(-d2 / 1.8) * net.b
      return { x: p.x + (p.x - net.x) * k * 0.08, y: p.y - k * 0.2, z: p.z + k }
    }
    const torn = p => net.tear && ((p.x - net.tx) ** 2 + (p.y - net.ty) ** 2) < net.tr * net.tr
    g.beginPath()
    // 奥の面
    for (let x = -HALF; x <= HALF + 0.01; x += 0.3) { let prev = null; for (let y = 0; y <= top + 0.01; y += 0.25) { const p = bulge({ x, y, z: back }); if (prev && !torn(p) && !torn(prev)) seg(g, cam, prev, p); prev = p } }
    for (let y = 0; y <= top + 0.01; y += 0.3) { let prev = null; for (let x = -HALF; x <= HALF + 0.01; x += 0.25) { const p = bulge({ x, y, z: back }); if (prev && !torn(p) && !torn(prev)) seg(g, cam, prev, p); prev = p } }
    // 屋根
    for (let x = -HALF; x <= HALF + 0.01; x += 0.3) seg(g, cam, { x, y: GH, z: 0 }, { x, y: top, z: back })
    for (let k = 0; k <= 1.001; k += 0.2) seg(g, cam, { x: -HALF, y: lerp(GH, top, k), z: k * back }, { x: HALF, y: lerp(GH, top, k), z: k * back })
    // 横
    for (const sx of [-HALF, HALF]) { for (let k = 0; k <= 1.001; k += 0.2) seg(g, cam, { x: sx, y: 0, z: k * back }, { x: sx, y: lerp(GH, top, k), z: k * back }); for (let y = 0; y <= 2.2; y += 0.3) seg(g, cam, { x: sx, y, z: 0 }, { x: sx, y: Math.min(y, top), z: back }) }
    g.stroke()
    if (net.tear) {   // 破れた穴のふち
      const c = proj(cam, { x: net.tx, y: net.ty, z: back }); if (c) {
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath()
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = net.tr * (0.8 + ((i * 37) % 7) / 14); const p = proj(cam, { x: net.tx + Math.cos(a) * rr, y: net.ty + Math.sin(a) * rr, z: back }); if (!p) continue; g.moveTo(p.x, p.y); g.lineTo(lerp(p.x, c.x, 0.25), lerp(p.y, c.y, 0.25)) }
        g.stroke()
      }
    }
    // 奥の柱
    g.strokeStyle = 'rgba(230,235,240,.8)'; g.lineWidth = 1.5; g.beginPath(); seg(g, cam, { x: -HALF, y: 0, z: back }, { x: -HALF, y: top, z: back }); seg(g, cam, { x: HALF, y: 0, z: back }, { x: HALF, y: top, z: back }); seg(g, cam, { x: -HALF, y: top, z: back }, { x: HALF, y: top, z: back }); g.stroke()
  }
  function drawGoalFront(g, cam, shake) {
    const p1 = proj(cam, { x: -HALF, y: 0, z: 0 }), p2 = proj(cam, { x: -HALF, y: GH, z: 0 }), p3 = proj(cam, { x: HALF, y: GH, z: 0 }), p4 = proj(cam, { x: HALF, y: 0, z: 0 })
    if (!p1 || !p4) return
    const w = Math.max(2, p1.s * 0.12), sx = shake ? (Math.random() - 0.5) * shake : 0
    g.lineCap = 'butt'; g.lineJoin = 'miter'
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = w + 2; g.beginPath(); g.moveTo(p1.x + sx, p1.y); g.lineTo(p2.x + sx, p2.y); g.lineTo(p3.x + sx, p3.y); g.lineTo(p4.x + sx, p4.y); g.stroke()
    g.strokeStyle = '#fbfbf8'; g.lineWidth = w; g.stroke()
  }

  // ---------------- 棒人間
  // 体の各点（m・腰が原点に近い）。pose ごとに組む
  // 蹴る瞬間の足先（体の中心から右へ 0.3m・高さは球の中心）。キッカーはこの点が球に重なる所に立つ
  const KICK_FOOT = { x: 0.3, y: 0.11 }, KICK_HIT = 0.6
  function skel(pose, ph, o = {}) {
    const S = (x, y) => ({ x, y })
    const sw = Math.sin(ph), cw = Math.cos(ph)
    let j
    switch (pose) {
      case 'run': j = { hip: S(0, 0.95), neck: S(0.04, 1.5), lE: S(-0.18 - sw * 0.1, 1.22), lH: S(-0.12 - sw * 0.25, 1.0), rE: S(0.18 + sw * 0.1, 1.22), rH: S(0.12 + sw * 0.25, 1.0), lK: S(-0.08 + sw * 0.22, 0.5), lF: S(-0.1 + sw * 0.35, 0.05 + Math.max(0, sw) * 0.12), rK: S(0.08 - sw * 0.22, 0.5), rF: S(0.1 - sw * 0.35, 0.05 + Math.max(0, -sw) * 0.12) }; break
      case 'kick': {
        // 蹴る足: 0〜0.45 振り上げ → KICK_HIT で足先が KICK_FOOT（＝球の位置）に当たる → 1 まで振り抜き
        const k = o.k || 0, F = KICK_FOOT, a = (k - 0.45) / (KICK_HIT - 0.45), b = (k - KICK_HIT) / (1 - KICK_HIT)
        const kf = k < 0.45 ? [lerp(0.12, -0.42, k / 0.45), lerp(0.04, 0.45, k / 0.45)] : k < KICK_HIT ? [lerp(-0.42, F.x, a), lerp(0.45, F.y, a)] : [lerp(F.x, 0.55, b), lerp(F.y, 0.75, b)]
        const lean = k < 0.45 ? k / 0.45 * 0.06 : 0.06 - (k - 0.45) * 0.2
        j = { hip: S(0, 0.95), neck: S(-lean, 1.47), lE: S(-0.32, 1.35), lH: S(-0.55, 1.45), rE: S(0.3, 1.2), rH: S(0.48, 1.05), lK: S(-0.12, 0.5), lF: S(-0.14, 0.03), rK: S((kf[0] + 0.02) * 0.55, (kf[1] + 0.95) * 0.5 + 0.02), rF: S(kf[0], kf[1]) }; break }
      case 'ready': j = { hip: S(0, 0.82), neck: S(0, 1.38), lE: S(-0.42, 1.25), lH: S(-0.62, 1.42), rE: S(0.42, 1.25), rH: S(0.62, 1.42), lK: S(-0.25, 0.45), lF: S(-0.32, 0.03), rK: S(0.25, 0.45), rF: S(0.32, 0.03) }; break
      case 'dive': j = { hip: S(0, 0.95), neck: S(0, 1.5), lE: S(-0.12, 1.85), lH: S(-0.15, 2.15), rE: S(0.12, 1.85), rH: S(0.15, 2.15), lK: S(-0.1, 0.5), lF: S(-0.18, 0.08), rK: S(0.14, 0.55), rF: S(0.22, 0.15) }; break
      case 'jump': j = { hip: S(0, 0.95), neck: S(0, 1.5), lE: S(-0.25, 1.75), lH: S(-0.3, 2.0), rE: S(0.25, 1.75), rH: S(0.3, 2.0), lK: S(-0.12, 0.52), lF: S(-0.08, 0.12), rK: S(0.12, 0.52), rF: S(0.08, 0.12) }; break
      case 'wall': j = { hip: S(0, 0.95), neck: S(0, 1.5), lE: S(-0.16, 1.15), lH: S(0.02, 0.92), rE: S(0.16, 1.15), rH: S(-0.02, 0.92), lK: S(-0.07, 0.5), lF: S(-0.1, 0.03), rK: S(0.07, 0.5), rF: S(0.1, 0.03) }; break
      case 'spin': { const a = ph * 2; j = { hip: S(0, 0.95), neck: S(0, 1.5), lE: S(-Math.cos(a) * 0.35, 1.42 + Math.sin(a) * 0.05), lH: S(-Math.cos(a) * 0.7, 1.42 + Math.sin(a) * 0.1), rE: S(Math.cos(a) * 0.35, 1.42 - Math.sin(a) * 0.05), rH: S(Math.cos(a) * 0.7, 1.42 - Math.sin(a) * 0.1), lK: S(-0.1, 0.5), lF: S(-0.18, 0.03), rK: S(0.1, 0.5), rF: S(0.18, 0.03) }; break }
      case 'cheer': j = { hip: S(0, 0.95 + Math.abs(sw) * 0.1), neck: S(0, 1.5 + Math.abs(sw) * 0.1), lE: S(-0.3, 1.8), lH: S(-0.42, 2.1 + sw * 0.05), rE: S(0.3, 1.8), rH: S(0.42, 2.1 - sw * 0.05), lK: S(-0.12, 0.52), lF: S(-0.15, 0.05), rK: S(0.12, 0.52), rF: S(0.15, 0.05) }; break
      case 'juggle': { const up = Math.max(0, Math.sin(ph * 2)); j = { hip: S(0, 0.95), neck: S(0, 1.5), lE: S(-0.32, 1.3), lH: S(-0.45, 1.2), rE: S(0.32, 1.3), rH: S(0.45, 1.2), lK: S(-0.08, 0.5), lF: S(-0.1, 0.03), rK: S(0.18, 0.5 + up * 0.15), rF: S(0.2, 0.08 + up * 0.35) }; break }
      case 'hold': j = { hip: S(0, 0.9), neck: S(0, 1.45), lE: S(-0.34, 1.36), lH: S(-0.14, 1.48), rE: S(0.34, 1.36), rH: S(0.14, 1.48), lK: S(-0.17, 0.47), lF: S(-0.2, 0.03), rK: S(0.17, 0.47), rF: S(0.2, 0.03) }; break   // 上の人の足首を持って支える
      case 'ride': j = { hip: S(0, 0.95), neck: S(0, 1.5), lE: S(-0.27, 1.24), lH: S(-0.06, 1.06), rE: S(0.27, 1.24), rH: S(0.06, 1.06), lK: S(-0.22, 0.86), lF: S(-0.2, 0.44), rK: S(0.22, 0.86), rF: S(0.2, 0.44) }; break   // 肩車の上（手で下の人の目をふさぐ）
      case 'crawl': j = { hip: S(0, 0.6), neck: S(0, 0.66), lE: S(-0.22, 0.38), lH: S(-0.25, 0.02), rE: S(0.22, 0.38), rH: S(0.25, 0.02), lK: S(-0.15, 0.08), lF: S(-0.2, 0.02), rK: S(0.15, 0.08), rF: S(0.2, 0.02) }; break   // 四つんばい（正面から）
      case 'squat': j = { hip: S(0, 0.45), neck: S(0.05, 0.95), lE: S(-0.17, 0.68), lH: S(0.02, 0.42), rE: S(0.28, 0.72), rH: S(0.42, 0.4), lK: S(-0.22, 0.52), lF: S(-0.18, 0.02), rK: S(0.24, 0.52), rF: S(0.2, 0.02) }; break   // しゃがんで砂をならす
      case 'sad': j = { hip: S(0, 0.92), neck: S(0.12, 1.38), lE: S(-0.05, 1.1), lH: S(0.0, 0.85), rE: S(0.25, 1.1), rH: S(0.22, 0.85), lK: S(-0.07, 0.5), lF: S(-0.1, 0.03), rK: S(0.07, 0.5), rF: S(0.1, 0.03) }; break
      default: j = { hip: S(0, 0.95), neck: S(0, 1.5 + sw * 0.01), lE: S(-0.18, 1.22), lH: S(-0.22, 0.95), rE: S(0.18, 1.22), rH: S(0.22, 0.95), lK: S(-0.09, 0.5), lF: S(-0.13, 0.03), rK: S(0.09, 0.5), rF: S(0.13, 0.03) }
    }
    return j
  }
  // x,z の地面に立つ棒人間を描く（看板のようにいつもこちらを向く）
  function stick(g, cam, x, z, P) {
    const base = proj(cam, { x, y: P.y0 || 0, z }); if (!base) return null
    const h = P.h || 1, s = base.s * h
    const j = skel(P.pose || 'idle', P.ph || 0, P)
    const rot = P.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot), pv = j.hip
    const flipX = P.mirror ? -1 : 1
    // 手描きのゆれ（1秒に8回だけ変える）
    const boil = Math.floor(now() * 8) + (P.seed || 0) * 17
    const wob = k => (((Math.sin(boil * 12.9898 + k * 78.233) * 43758.5453) % 1) - 0.5) * 0.025
    const tf = (p, k) => { const dx = (p.x * flipX - pv.x) + wob(k), dy = p.y - pv.y + wob(k + 3); return { x: base.x + (pv.x + dx * cr - dy * sr) * s, y: base.y - (pv.y + dx * sr + dy * cr) * s } }
    const J = {}; let k = 0; for (const n in j) J[n] = tf(j[n], k++)
    // 頭は首の先
    const hd = tf({ x: (j.neck.x + (j.neck.x - j.hip.x) * 0.3) * flipX, y: j.neck.y + 0.17 }, 40)
    const hr = Math.max(2.4, 0.14 * s), lw = Math.max(1.6, 0.055 * s)
    // 影
    if (!P.noShadow) { const sp = proj(cam, { x, y: 0, z }); if (sp) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(sp.x, sp.y, Math.max(3, 0.35 * sp.s * h), Math.max(1.5, 0.1 * sp.s * h), 0, 0, 7); g.fill() } }
    g.lineCap = 'round'; g.lineJoin = 'round'
    const ink = P.ink || '#141318'
    // 白いふち（夜の芝の上で読めるように）
    const path = () => {
      g.beginPath(); g.moveTo(J.lF.x, J.lF.y); g.lineTo(J.lK.x, J.lK.y); g.lineTo(J.hip.x, J.hip.y); g.lineTo(J.rK.x, J.rK.y); g.lineTo(J.rF.x, J.rF.y)
      g.moveTo(J.hip.x, J.hip.y); g.lineTo(J.neck.x, J.neck.y)
      g.moveTo(J.lH.x, J.lH.y); g.lineTo(J.lE.x, J.lE.y); g.lineTo(J.neck.x, J.neck.y); g.lineTo(J.rE.x, J.rE.y); g.lineTo(J.rH.x, J.rH.y)
    }
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = lw + Math.max(1.5, lw * 0.6); path(); g.stroke()
    g.strokeStyle = ink; g.lineWidth = lw; path(); g.stroke()
    // ユニフォームの印（腰の短パン・腕章）
    if (P.col) {
      g.fillStyle = P.col; g.beginPath(); g.moveTo(J.hip.x - 0.13 * s, J.hip.y - 0.03 * s); g.lineTo(J.hip.x + 0.13 * s, J.hip.y - 0.03 * s); g.lineTo(lerp(J.hip.x, J.rK.x, 0.45) + 0.04 * s, lerp(J.hip.y, J.rK.y, 0.45)); g.lineTo(J.hip.x, J.hip.y + 0.08 * s); g.lineTo(lerp(J.hip.x, J.lK.x, 0.45) - 0.04 * s, lerp(J.hip.y, J.lK.y, 0.45)); g.closePath(); g.fill()
      g.strokeStyle = P.col; g.lineWidth = lw * 1.9; g.beginPath(); g.moveTo(lerp(J.neck.x, J.hip.x, 0.15), lerp(J.neck.y, J.hip.y, 0.15)); g.lineTo(lerp(J.neck.x, J.hip.x, 0.6), lerp(J.neck.y, J.hip.y, 0.6)); g.stroke()
    }
    if (P.gloves) { g.fillStyle = '#f3d23a'; for (const hnd of [J.lH, J.rH]) { g.beginPath(); g.arc(hnd.x, hnd.y, Math.max(2.5, 0.09 * s), 0, 7); g.fill(); g.strokeStyle = ink; g.lineWidth = Math.max(1, lw * 0.5); g.stroke() } }
    // 頭
    g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = lw * 0.9; g.beginPath(); g.arc(hd.x, hd.y, hr, 0, 7); g.fill(); g.stroke()
    if (P.band) { g.strokeStyle = P.band; g.lineWidth = Math.max(1.5, hr * 0.42); g.beginPath(); g.arc(hd.x, hd.y, hr * 0.92, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); if (P.bandTail) { g.beginPath(); g.moveTo(hd.x + hr * 0.9, hd.y - hr * 0.3); g.lineTo(hd.x + hr * 1.9, hd.y - hr * 0.1 + Math.sin(now() * 14) * hr * 0.3); g.stroke() } }
    if (P.cap) { g.fillStyle = P.cap; g.beginPath(); g.arc(hd.x, hd.y, hr, Math.PI, Math.PI * 2); g.fill(); g.fillRect(hd.x - hr * 0.2, hd.y - hr * 0.15, hr * 1.5, hr * 0.32) }
    if (hr > 5) {   // 顔
      g.fillStyle = ink; const e = P.face || 'n', ex = hr * 0.35, ey = hd.y - hr * 0.05
      if (e === 'x') { g.strokeStyle = ink; g.lineWidth = Math.max(1, hr * 0.13); g.beginPath(); for (const sx of [-1, 1]) { const cx = hd.x + sx * ex, d = hr * 0.16; g.moveTo(cx - d, ey - d); g.lineTo(cx + d, ey + d); g.moveTo(cx + d, ey - d); g.lineTo(cx - d, ey + d) } g.stroke() }
      else if (e === 'zz' || e === 'grit' || e === 'cry') { g.strokeStyle = ink; g.lineWidth = Math.max(1, hr * 0.12); g.beginPath(); g.moveTo(hd.x - ex - hr * 0.15, ey); g.lineTo(hd.x - ex + hr * 0.15, ey); g.moveTo(hd.x + ex - hr * 0.15, ey); g.lineTo(hd.x + ex + hr * 0.15, ey); g.stroke() }
      else { g.beginPath(); g.arc(hd.x - ex, ey, Math.max(0.9, hr * 0.11), 0, 7); g.arc(hd.x + ex, ey, Math.max(0.9, hr * 0.11), 0, 7); g.fill() }
      if (e === 'o') { g.beginPath(); g.arc(hd.x, hd.y + hr * 0.42, hr * 0.17, 0, 7); g.fill() }
      else if (e === 'smug') { g.strokeStyle = ink; g.lineWidth = Math.max(1, hr * 0.12); g.beginPath(); g.moveTo(hd.x - hr * 0.3, hd.y + hr * 0.38); g.quadraticCurveTo(hd.x, hd.y + hr * 0.55, hd.x + hr * 0.38, hd.y + hr * 0.25); g.stroke() }
      else if (e === 'joy') { g.beginPath(); g.arc(hd.x, hd.y + hr * 0.3, hr * 0.3, 0, Math.PI); g.fill() }
      else if (e === 'grit') { g.strokeStyle = ink; g.lineWidth = Math.max(1, hr * 0.1); g.strokeRect(hd.x - hr * 0.32, hd.y + hr * 0.3, hr * 0.64, hr * 0.2); g.beginPath(); for (let q = 1; q < 4; q++) { g.moveTo(hd.x - hr * 0.32 + q * hr * 0.16, hd.y + hr * 0.3); g.lineTo(hd.x - hr * 0.32 + q * hr * 0.16, hd.y + hr * 0.5) } g.stroke() }
      else if (e === 'cry') { g.beginPath(); g.arc(hd.x, hd.y + hr * 0.5, hr * 0.22, Math.PI, 0); g.fill(); g.fillStyle = '#5fb6ff'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(hd.x + sx * ex, ey + hr * 0.35 + ((now() * 3) % 1) * hr * 0.5, Math.max(1, hr * 0.12), 0, 7); g.fill() } }
      if (P.mustache) { g.strokeStyle = ink; g.lineWidth = Math.max(1.2, hr * 0.18); g.beginPath(); g.moveTo(hd.x - hr * 0.45, hd.y + hr * 0.35); g.quadraticCurveTo(hd.x, hd.y + hr * 0.15, hd.x + hr * 0.45, hd.y + hr * 0.35); g.stroke() }
    }
    if (P.bento) { g.fillStyle = '#c4402a'; g.fillRect(J.lH.x - 0.12 * s, J.lH.y - 0.06 * s, 0.24 * s, 0.14 * s); g.fillStyle = '#fff'; g.fillRect(J.lH.x - 0.1 * s, J.lH.y - 0.05 * s, 0.1 * s, 0.06 * s) }
    if (P.whistle) { g.fillStyle = '#d8d8d8'; g.beginPath(); g.arc(hd.x + hr * 0.6, hd.y + hr * 0.6, Math.max(1.2, hr * 0.22), 0, 7); g.fill() }
    return { head: hd, hr, s, rF: J.rF, base }
  }
  function dog(g, cam, x, z, ph) {
    const b = proj(cam, { x, y: 0, z }); if (!b) return
    const s = b.s, lw = Math.max(1.5, 0.05 * s), sw = Math.sin(ph * 2)
    g.strokeStyle = '#141318'; g.lineWidth = lw; g.lineCap = 'round'
    g.beginPath(); g.moveTo(b.x - 0.35 * s, b.y - 0.45 * s); g.lineTo(b.x + 0.35 * s, b.y - 0.45 * s)
    for (const [hx, d] of [[-0.3, 1], [0.3, -1]]) { g.moveTo(b.x + hx * s, b.y - 0.45 * s); g.lineTo(b.x + (hx + sw * 0.12 * d) * s, b.y) }
    g.moveTo(b.x - 0.35 * s, b.y - 0.45 * s); g.lineTo(b.x - 0.5 * s, b.y - 0.62 * s - Math.abs(sw) * 0.05 * s)
    g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x + 0.45 * s, b.y - 0.58 * s, 0.13 * s, 0, 7); g.fill(); g.stroke()
    g.beginPath(); g.moveTo(b.x + 0.42 * s, b.y - 0.7 * s); g.lineTo(b.x + 0.38 * s, b.y - 0.82 * s); g.stroke()
  }
  function ballAt(g, cam, p, spin, glow) {
    const sp = proj(cam, { x: p.x, y: 0, z: p.z })
    if (sp) { const a = clamp(0.4 - p.y * 0.05, 0.08, 0.4); g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(sp.x, sp.y, Math.max(2, BR * 1.6 * sp.s), Math.max(1, BR * 0.6 * sp.s), 0, 0, 7); g.fill() }
    const q = proj(cam, p); if (!q) return null
    const r = Math.max(3, BR * q.s)
    if (glow) { const gg = g.createRadialGradient(q.x, q.y, r * 0.5, q.x, q.y, r * 4); gg.addColorStop(0, 'rgba(255,220,120,.6)'); gg.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gg; g.fillRect(q.x - r * 4, q.y - r * 4, r * 8, r * 8) }
    g.fillStyle = '#fbfbf7'; g.strokeStyle = '#141318'; g.lineWidth = Math.max(1, r * 0.18); g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill(); g.stroke()
    g.fillStyle = '#141318'
    for (let i = 0; i < 3; i++) { const a = spin + i * 2.1; const dx = Math.cos(a) * r * 0.5, dy = Math.sin(a * 0.7) * r * 0.45; if (Math.cos(a) > -0.3) { g.beginPath(); g.arc(q.x + dx, q.y + dy, r * 0.24, 0, 7); g.fill() } }
    return q
  }

  // ---------------- 時計（固定 60Hz・止められる）
  let vt = 0
  const now = () => vt
  const dbgState = { paused: false, steps: 0, rate: 1 }

  // ---------------- 状態
  const M = { mode: 'title', edit: null, match: null }
  let techs = (store.get('techs', []) || []).filter(t => t && t.rel && t.rel.length > 3).slice(0, 4)
  techs.forEach((t, i) => { if (!t.id) t.id = 'u' + Date.now() + i })
  const saveTechs = () => store.set('techs', techs.map(t => ({ id: t.id, rel: t.rel.map(p => ({ f: +p.f.toFixed(4), l: +p.l.toFixed(4), y: +p.y.toFixed(3) })), dur: t.dur, name: t.name, muri: t.muri })))
  techs = techs.map(t => { const n = HS.makeTech(t.rel, t.dur, t.name, t.muri); n.id = t.id; return n })
  let tut = Q.has('notut') ? { draw: 1, card: 1 } : store.get('tut', {})
  const fx = { shake: 0, flash: 0, parts: [], flashes: 0, dark: 0, lines: 0, zoom: 1, zoomAt: null, stop: 0, words: [], wp: [], rings: [] }
  // 擬音（画面に大きく出す字。0.7秒で消える）
  function word(text, at, o = {}) { if (!at) return; fx.words.push({ text, x: at.x, y: at.y, t: 0, life: o.life || 0.75, size: o.size || 44, col: o.col || '#ffe14a', rot: o.rot ?? (Math.random() - 0.5) * 0.3 }) }

  // ---------------- 文言
  function applyLang() {
    const t = T(); document.documentElement.lang = lang
    $('tT1').textContent = t.title1; $('tT2').textContent = t.title2; $('tSub').textContent = t.sub
    $('bStart').textContent = t.start; $('bHow').textContent = t.how
    $('bRedo').textContent = t.redo; $('bSave').textContent = t.save; $('bPlay').textContent = t.play
    $('costLab').textContent = t.leg; $('legLab').textContent = t.leg
    $('bBack').textContent = t.back; $('pickHint').textContent = t.pick
    $('bFlip').textContent = t.flip; $('bKick').textContent = t.kick
    $('ledUs').textContent = t.you; $('ledThem').textContent = D.teams[lang][(M.match && M.match.G.m.team) || 0] || ''
    $('halfH').textContent = t.half; $('halfP').textContent = t.halfSub; $('bRedraw').textContent = t.redraw; $('bSecond').textContent = t.second
    $('howH').textContent = t.howTitle; $('howBody').innerHTML = t.howBody.map(s => `<p>${s}</p>`).join(''); $('howCred').textContent = t.credits; $('howClose').textContent = t.close
    $('bAgain').textContent = t.again; $('bSaveImg').textContent = t.saveImg; $('bPost').textContent = t.post; $('bBoard').textContent = t.board
    $('bLang').textContent = lang === 'ja' ? 'EN' : 'JP'; $('loadTxt').textContent = t.loading
    $('bigName').classList.toggle('en', lang === 'en')
    $('pHead').classList.toggle('en', lang === 'en'); $('pBody').classList.toggle('en', lang === 'en')
    if (M.mode === 'edit') renderSlots()
    if (M.mode === 'match') renderCards()
    if (M.mode === 'end' && M.result) renderPaper()
    bgCache.clear()
  }
  $('bBack').onclick = () => {
    $('how').hidden = true; $('half').hidden = true; bigName('', false)
    if (M.mode === 'edit') { if (M.edit && M.edit.from === 'half' && M.match) backToMatch(); else show('title') }
    else if (M.mode === 'match') { if (M.match) M.match.st = 'over'; openEdit('title') }
    else show('title')
  }
  $('bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('lang', lang); applyLang() }
  function setMuteIcon() { $('icoWave').style.display = Snd.muted ? 'none' : '' }
  $('bMute').onclick = () => { Snd.setMute(!Snd.muted); store.set('mute', Snd.muted); setMuteIcon() }
  setMuteIcon()
  $('bHow').onclick = () => { $('how').hidden = false }
  $('howClose').onclick = () => { $('how').hidden = true }

  function show(mode) {
    M.mode = mode
    for (const k in views) views[k].hidden = k !== mode
    $('bBack').hidden = mode === 'title' || mode === 'end'
    $('bigName').className = lang === 'en' ? 'en' : ''; $('shout').className = ''
    bubble(null)
  }

  // ---------------- 吹き出し・実況
  let bubT = 0, bubAt = null
  function bubble(text, at, sec = 1.6) { const b = $('bubble'); if (!text) { b.classList.remove('on'); bubAt = null; return } b.textContent = text; bubAt = at; bubT = sec + [...text].length * 0.09; b.classList.add('on'); placeBubble() }
  function placeBubble() { if (!bubAt) return; const p = typeof bubAt === 'function' ? bubAt() : bubAt; if (!p) return; const b = $('bubble'); b.style.left = clamp(p.x, 60, W - 60) + 'px'; b.style.top = clamp(p.y, 90, H - 60) + 'px' }
  let liveT = 0
  function live(text, sec = 2.4) { const l = $('live'); if (!text) { l.classList.remove('on'); return } l.textContent = text; l.classList.add('on'); liveT = sec + [...text].length * 0.09 }
  function shout(text) { const s = $('shout'); s.textContent = text; s.className = ''; void s.offsetWidth; s.className = 'go' }
  function bigName(text, on) { const b = $('bigName'); if (on) { b.textContent = text; b.className = (lang === 'en' ? 'en ' : '') + ''; void b.offsetWidth; b.className = (lang === 'en' ? 'en ' : '') + 'go' } else if (b.classList.contains('go')) { b.className = (lang === 'en' ? 'en ' : '') + 'out' } }

  // ---------------- 技の小さい絵（作戦ボードの札）
  function thumb(c, tech) {
    const w = c.width = (c.clientWidth || 80) * DPR, h = c.height = (c.clientHeight || 50) * DPR
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h)
    const cam = HS.makeCam({ x: 0, y: 0, z: -20 }, w, h, { h: 6, pitch: 0.42, back: 4, yb: 0.92, yg: 0.2 })
    g.strokeStyle = 'rgba(40,120,60,.45)'; g.lineWidth = 1 * DPR
    g.beginPath(); seg(g, cam, { x: -20.16, y: 0, z: 0 }, { x: -20.16, y: 0, z: -16.5 }); seg(g, cam, { x: -20.16, y: 0, z: -16.5 }, { x: 20.16, y: 0, z: -16.5 }); seg(g, cam, { x: 20.16, y: 0, z: -16.5 }, { x: 20.16, y: 0, z: 0 }); seg(g, cam, { x: -30, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }); g.stroke()
    g.strokeStyle = '#333'; g.lineWidth = 1.5 * DPR; g.beginPath(); seg(g, cam, { x: -HALF, y: 0, z: 0 }, { x: -HALF, y: GH, z: 0 }); seg(g, cam, { x: -HALF, y: GH, z: 0 }, { x: HALF, y: GH, z: 0 }); seg(g, cam, { x: HALF, y: GH, z: 0 }, { x: HALF, y: 0, z: 0 }); g.stroke()
    if (!tech) return
    const pts = HS.toWorld(tech.rel, { x: 0, y: 0, z: -20 }, false)
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5 * DPR; g.setLineDash([3 * DPR, 3 * DPR]); g.beginPath(); pts.forEach((p, i) => { const q = proj(cam, { x: p.x, y: 0, z: p.z }); if (q) i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y) }); g.stroke(); g.setLineDash([])
    g.strokeStyle = '#d72a24'; g.lineWidth = 3 * DPR; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => { const q = proj(cam, p); if (q) i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y) }); g.stroke()
  }

  // ================= 作戦ボード（技を描く）
  const EDIT_BALL = { x: 0, y: 0, z: -HS.D_EDIT }
  function openEdit(from) {
    show('edit')
    const E = M.edit = { from: from || 'title', stroke: null, drawing: false, tech: null, prev: null, slot: Math.min(techs.length, 3), names: [], name: '', pid: -1 }
    if (techs.length >= 4) E.slot = 0
    $('sheet').hidden = true; renderSlots(); updateEditHint()
    if (!tut.draw) startFinger()
  }
  function renderSlots() {
    const box = $('slots'); box.innerHTML = ''
    for (let i = 0; i < 4; i++) {
      const t = techs[i], b = document.createElement('button'); b.className = 'slot' + (t ? '' : ' empty') + (M.edit && M.edit.slot === i ? ' on' : '')
      if (t) { const c = document.createElement('canvas'); b.appendChild(c); const s = document.createElement('span'); s.textContent = t.name; b.appendChild(s); requestAnimationFrame(() => thumb(c, t)) }
      else { const s = document.createElement('span'); s.textContent = T().slotEmpty; b.appendChild(s) }
      b.onclick = () => { if (!M.edit || M.edit.drawing) return; M.edit.slot = t ? i : Math.min(i, techs.length); Snd.play('sel', { vol: 0.5 }); renderSlots() }
      box.appendChild(b)
    }
    $('bPlay').hidden = !(techs.length && $('sheet').hidden)
    $('bPlay').textContent = M.edit && M.edit.from === 'half' ? T().second : T().play
  }
  function updateEditHint() {
    const E = M.edit, h = $('editHint')
    h.hidden = !!(E && (E.drawing || E.tech))
    h.textContent = touchy ? T().drawHint : T().drawHintPc
  }
  function editStrokeDone() {
    const E = M.edit, cam = camFor(EDIT_BALL, 'edit')
    const st = E.stroke; E.drawing = false
    if (!st || st.pts.length < 3) { E.stroke = null; updateEditHint(); return }
    const tech = HS.strokeTo3D(cam, EDIT_BALL, st.pts, st.t1 - st.t0)
    if (!tech) { E.stroke = null; updateEditHint(); return }
    tut.draw = 1; store.set('tut', tut); stopFinger()
    E.tech = tech; E.names = HS.techNames(tech, lang, (Date.now() & 0xffff) + st.pts.length); E.name = E.names[0]
    E.prev = { sim: HS.simulateShot({ ball: EDIT_BALL, defs: [], type: 'edit' }, tech, false, 0, { noKeeper: true }), t: 0 }
    E.prev.noKeeper = true
    Snd.play('swish', { vol: 0.6 })
    openSheet()
  }
  function openSheet() {
    const E = M.edit, t = E.tech
    $('sheet').hidden = false; $('bPlay').hidden = true
    $('nameIn').value = E.name; $('nameIn').placeholder = T().nameLabel
    const chips = $('chips'); chips.innerHTML = ''
    for (const n of E.names) { const b = document.createElement('button'); b.textContent = n; b.className = n === E.name ? 'on' : ''; b.onclick = () => { E.name = n; $('nameIn').value = n; for (const x of chips.children) x.className = x.textContent === n ? 'on' : ''; Snd.play('sel', { vol: 0.5 }) }; chips.appendChild(b) }
    const pct = clamp(t.cost / 50, 0.06, 1), bar = $('costBar').firstElementChild
    bar.style.width = pct * 100 + '%'; bar.className = t.cost >= 30 ? 'xx' : t.cost >= 18 ? 'hv' : ''
    $('costNum').textContent = '-' + t.cost
    const w = $('costWarn'); w.hidden = !(t.muri >= 0 || t.cost >= 30); w.textContent = t.muri >= 0 ? T().muriWarn : T().costHeavy
    updateEditHint()
  }
  $('nameIn').addEventListener('input', () => { if (M.edit) M.edit.name = $('nameIn').value })
  $('nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur() })
  $('bRedo').onclick = () => { const E = M.edit; E.tech = null; E.stroke = null; E.prev = null; $('sheet').hidden = true; renderSlots(); updateEditHint() }
  $('bSave').onclick = () => {
    const E = M.edit; if (!E.tech) return
    const t = E.tech; t.name = ($('nameIn').value || E.name || E.names[0] || T().noTech).trim().slice(0, 12); t.id = 'u' + Date.now()
    if (E.slot < techs.length) techs[E.slot] = t; else techs.push(t)
    techs = techs.slice(0, 4); saveTechs()
    Snd.play('ok', { vol: 0.7 })
    E.tech = null; E.stroke = null; E.prev = null; E.slot = Math.min(techs.length, 3)   // 4つ埋まったら最初の札を上書き（選べば変えられる）
    $('sheet').hidden = true; renderSlots(); updateEditHint()
    if (E.from === 'half' && M.match) { /* ハーフタイムから: 描き直しは1回で後半へ */ setTimeout(() => backToMatch(), 250) }
  }
  $('bPlay').onclick = () => { if (!techs.length) return; if (M.edit && M.edit.from === 'half') backToMatch(); else startMatch() }

  // ---------------- 指のお手本
  let finger = null
  function startFinger() { finger = { t: 0 }; $('finger').hidden = false }
  function stopFinger() { finger = null; $('finger').hidden = true }

  // ---------------- 入力（描く）
  cv.addEventListener('pointerdown', e => {
    if (M.mode !== 'edit') return
    const E = M.edit; if (!E || E.tech || E.drawing) return
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId) } catch (er) {}
    E.drawing = true; E.pid = e.pointerId; E.stroke = { pts: [{ x: e.clientX, y: e.clientY }], t0: performance.now(), t1: performance.now() }
    updateEditHint(); stopFinger()
  })
  cv.addEventListener('pointermove', e => {
    const E = M.edit; if (M.mode !== 'edit' || !E || !E.drawing || e.pointerId !== E.pid) return
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    for (const ev of (evs.length ? evs : [e])) { const l = E.stroke.pts[E.stroke.pts.length - 1]; if (Math.hypot(ev.clientX - l.x, ev.clientY - l.y) >= 2) E.stroke.pts.push({ x: ev.clientX, y: ev.clientY }) }
    E.stroke.t1 = performance.now()
    if (E.stroke.pts.length > 600) editStrokeDone()
  })
  const endStroke = e => { const E = M.edit; if (M.mode !== 'edit' || !E || !E.drawing || e.pointerId !== E.pid) return; E.stroke.t1 = performance.now(); editStrokeDone() }
  cv.addEventListener('pointerup', endStroke); cv.addEventListener('pointercancel', endStroke)

  // ================= 試合
  function startMatch(seed) {
    seed = seed || +(Q.get('seed') || 0) || (Date.now() % 1e6)
    const G = HS.newGame(seed, techs.map(t => t))
    M.match = { G, st: 'intro', t: 0, sel: -1, flip: false, clock: HS.CLOCK, pb: null, net: {}, photo: null, photoScore: -1, lastTech: null, kx: 0, trail: [], bot: M.match && M.match.bot }
    show('match'); applyLang(); renderCards(); updateLed()
    Snd.play('whistleL', { vol: 0.8 })
    TMs('start')
    beginAttack()
  }
  function backToMatch() { show('match'); applyLang(); renderCards(); updateLed(); M.match.G.techs = techs.map(t => t); beginAttack() }
  // いま描いている攻めの場面。蹴った瞬間に G.i は次へ進むので、攻めの最初に決めた m.sc を最後まで使う（2026-11-10 蹴る瞬間に次の場面のカメラと立ち位置に切り替わっていた）
  function sceneNow() { const m = M.match; return m.sc || m.G.m.scenes[m.G.i] }
  function beginAttack() {
    const m = M.match, sc = m.sc = m.G.m.scenes[m.G.i]
    m.shown = { us: m.G.us, them: m.G.them }
    fx.zoom = 1; fx.zoomT = 1; fx.shake = 0; fx.dark = 0; m.cam = null; m.spot = null; m.probe = null
    fx.stop = 0; fx.wp.length = 0; fx.words.length = 0; fx.rings.length = 0
    // バカな守りの場面は、最初に守りへ寄って見せてから引く（札が押せるようになる前に必ず元の画角に戻る）
    m.funny = HS.FUNNY.includes(sc.type); m.introLen = m.funny ? 1.9 : 0.7
    m.st = 'intro'; m.t = 0; m.sel = -1; m.flip = false; m.clock = HS.CLOCK; m.pb = null; m.net = {}; m.trail = []; m.botT = 0
    m.kx = clamp(sc.ball.x * 0.12, -1.2, 1.2); m.defs = sc.defs.map(d => ({ ...d, jump: 0 })); m.shooter = { pose: 'idle', fall: 0 }
    m.dog = sc.dog ? { x: -26, z: sc.ball.z * 0.5 } : null
    $('actRow').hidden = true; $('pickHint').hidden = true; renderCards(); updateLed()
    const lines = T().live[sc.type] || ['']
    live(sc.bento ? T().bento : sc.dog ? T().dog : lines[sc.idx % lines.length])
  }
  // 掲示板は攻めの頭と結果が出た時だけ書き換える（蹴った瞬間に点や時間が先に変わって結果がばれていた）
  function minute() { const m = M.match, i = m.sc ? m.sc.idx : m.G.i; return Math.min(90, i < HS.ATTACKS / 2 ? 6 + i * 10 : 50 + (i - HS.ATTACKS / 2) * 10) }
  function updateLed() {
    const m = M.match; if (!m) return
    const sh = m.shown || (m.shown = { us: m.G.us, them: m.G.them })
    $('ledScore').textContent = sh.us + '-' + sh.them; $('ledMin').textContent = minute() + "'"
    $('legFill').style.width = clamp(m.G.leg / HS.LEG_MAX, 0, 1) * 100 + '%'
    const t = m.sel >= 0 ? m.G.techs[m.sel] : null, lc = $('legCost')
    if (t) { const a = clamp((m.G.leg - t.cost) / HS.LEG_MAX, 0, 1), b = clamp(m.G.leg / HS.LEG_MAX, 0, 1); lc.style.left = a * 100 + '%'; lc.style.width = (b - a) * 100 + '%'; lc.hidden = false } else lc.style.width = '0'
  }
  function renderCards() {
    const m = M.match, box = $('cards'); if (!m) return
    box.innerHTML = ''
    m.G.techs.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'card' + (m.sel === i ? ' on' : '')
      const c = document.createElement('canvas'); b.appendChild(c)
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = t.name; b.appendChild(nm)
      const co = document.createElement('span'); co.className = 'co' + (t.cost > m.G.leg ? ' no' : ''); co.textContent = T().leg + ' -' + t.cost; b.appendChild(co)
      b.disabled = m.st !== 'aim'
      b.onclick = () => chooseCard(i)
      box.appendChild(b); requestAnimationFrame(() => thumb(c, t))
    })
  }
  function chooseCard(i) {
    const m = M.match; if (!m || m.st !== 'aim') return
    if (m.sel === i) return kick()
    m.sel = i; Snd.play('sel', { vol: 0.5 })
    for (const [k, el] of [...$('cards').children].entries()) el.classList.toggle('on', k === i)
    $('actRow').hidden = false; updateLed()
    if (!tut.card) { tut.card = 1; store.set('tut', tut); live(T().tut3, 2) }
  }
  $('bFlip').onclick = () => { const m = M.match; if (!m || m.st !== 'aim') return; m.flip = !m.flip; Snd.play('sel', { vol: 0.4, rate: m.flip ? 1.1 : 0.95 }) }
  $('bKick').onclick = () => kick()
  function kick() {
    const m = M.match; if (!m || m.st !== 'aim' || m.sel < 0) return
    const tech = m.G.techs[m.sel], sc = sceneNow()
    const level = HS.readLevel(m.G.marks, tech.id, m.flip)
    const res = HS.playAttack(m.G, { id: tech.id, flip: m.flip })
    m.res = res; m.tech = tech; m.lastTech = tech.id; m.level = level; m.lastFlip = m.flip
    m.st = 'tame'; m.t = 0; $('actRow').hidden = true
    for (const el of $('cards').children) el.disabled = true
    live(null); bigName(tech.name, true)
    Snd.play('don', { vol: 0.9 }); Snd.duck(0.35, 2.2)
    fx.dark = 1; fx.lines = 1; $('pickHint').hidden = true
    if (level >= 3 && res.outcome !== 'fall') setTimeout(() => { if (M.match === m) bubble(T().r_saveRead, () => keeperHead(), 1.6) }, 200)
    updateLed()
  }
  function timeoutAttack() {
    const m = M.match; m.res = HS.playAttack(m.G, null); m.tech = null; m.st = 'steal'; m.t = 0; $('actRow').hidden = true; $('pickHint').hidden = true
    for (const el of $('cards').children) el.disabled = true
    bubble(T().r_timeout, () => ballScreen(), 1.4); Snd.play('ooh', { vol: 0.5 })
  }
  let keeperHead = () => null, ballScreen = () => null
  function finishAttack() {
    const m = M.match, r = m.res
    m.shown = { us: m.G.us, them: m.G.them }
    updateLed()
    if (r.oppGoal || r.outcome === 'fall' || r.outcome === 'timeout') {
      m.st = 'concede'; m.t = 0
      live(r.outcome === 'fall' || r.outcome === 'timeout' ? T().counter : T().oppGoal, 1.6)
      Snd.play('whistleS', { vol: 0.6 }); setTimeout(() => Snd.play('ooh', { vol: 0.6 }), 250)
      return
    }
    nextAttack()
  }
  function nextAttack() {
    const m = M.match, r = m.res
    if (r.over) return endMatch()
    if (r.half) { m.st = 'half'; Snd.play('whistleL', { vol: 0.7 }); $('half').hidden = false; if (m.bot && AUTO_Q) setTimeout(() => $('bSecond').click(), 1500); return }
    beginAttack()
  }
  $('bSecond').onclick = () => { $('half').hidden = true; beginAttack() }
  $('bRedraw').onclick = () => { $('half').hidden = true; openEdit('half') }

  // ---------------- 1フレームの試合の進行
  function updMatch(dt) {
    const m = M.match; if (!m) return
    const sc = sceneNow() || m.G.m.scenes[HS.ATTACKS - 1]
    m.t += dt
    if (m.dog) { m.dog.x += dt * 7; if (m.dog.x > 30) m.dog = null }
    for (const d of m.defs || []) if (d.kind === 'spin') d.ph = (d.ph || 0) + dt * 6
    if (m.st === 'intro') {
      fx.zoomT = m.funny && m.t < m.introLen - 0.75 ? 2.1 : 1
      if (m.t > m.introLen) { m.st = 'aim'; m.t = 0; fx.zoom = 1; fx.zoomT = 1; renderCards(); if (!tut.card) live(T().tut2, 3) }
    }
    else if (m.st === 'aim') {
      { const ph = $('pickHint'), want = m.sel < 0; if (ph.hidden === want) ph.hidden = !want }
    m.clock -= dt; $('clock').firstElementChild.style.width = clamp(m.clock / HS.CLOCK, 0, 1) * 100 + '%'
      if (m.bot) { m.botT += dt; if (m.botT > 0.9 && m.sel < 0) { const c = window.HSBots.botChoose(m.bot, m.G, m.G.m.seed); if (!c) m.botT = -99; else { m.sel = m.G.techs.findIndex(t => t.id === c.id); m.flip = c.flip; renderCards(); updateLed() } } else if (m.botT > 1.7 && m.sel >= 0) kick() }
      if (m.clock <= 0) timeoutAttack()
    } else if (m.st === 'tame') {
      // 溜め → 助走
      const cost = m.res.cost || 0
      if (m.t > 0.75) { fx.dark = Math.max(0, fx.dark - dt * 3) }
      if (m.t > 0.75 && !m.ran) { m.ran = true }
      if (m.t > 1.15) {
        m.ran = false
        if (m.res.outcome === 'fall') { m.st = 'fall'; m.t = 0; Snd.play('grunt', { vol: 0.9 }); return }
        m.st = 'fly'; m.t = 0; m.pb = { t: 0, rate: 1, i: 0, said: {} }
        // 蹴った瞬間: 一瞬止めて、足元に衝撃の輪と擬音。画面は揺らさない（2026-11-10 蹴る瞬間に画面が動くと言われた）
        const spd = m.res.speed || 20, at = m.cam ? proj(m.cam, { x: sc.ball.x, y: BR, z: sc.ball.z }) : null
        fx.stop = spd > 30 ? 0.08 : 0.05
        if (at) { fx.rings.push({ x: at.x, y: at.y, t: 0, big: spd > 30 }); const o = T().ono, k = spd >= 34 ? 'big' : spd >= 22 ? 'mid' : 'small'; word(o[k], { x: at.x + (spd >= 22 ? 38 : 24), y: at.y - 40 }, { size: k === 'big' ? 58 : k === 'mid' ? 46 : 26, col: k === 'small' ? '#fff' : '#ffe14a' }) }
        Snd.play('kick', { vol: 1, rate: cost > 25 ? 0.85 : 1 })
        Snd.play('boom', { vol: clamp((spd - 14) / 30, 0.15, 0.85), rate: 1.15 })
        Snd.play('whoosh', { vol: clamp(spd / 40, 0.3, 0.9), rate: clamp(spd / 30, 0.8, 1.3), delay: 0.06 })
        if (m.level >= 3) m.kx = m.res.frames[0].k.x
      }
    } else if (m.st === 'fly') updPlayback(dt, sc)
    else if (m.st === 'fall') {
      if (m.t > 0.25 && !m.saidFall) { m.saidFall = true; bubble(T().r_fall, () => shooterHead(), 1.6); Snd.play('thud', { vol: 0.9, delay: 0.15 }); Snd.play('fall', { vol: 0.6, delay: 0.2 }); bigName('', false) }
      if (m.t > 2.0) { m.saidFall = false; finishAttack() }
    } else if (m.st === 'steal') { if (m.t > 1.6) finishAttack() }
    else if (m.st === 'after') { if (m.t > (m.res.outcome === 'goal' ? 2.4 : 1.7)) { bigName('', false); finishAttack() } }
    else if (m.st === 'ref') { if (m.t > 3.0) { live(null); m.G.techs = techs.map(t => t); beginAttack() } }
    else if (m.st === 'concede') { if (m.t > 1.8) nextAttack() }
  }
  function updPlayback(dt, sc) {
    const m = M.match, pb = m.pb, r = m.res
    // スロー: ゴールの瞬間と、見切られた瞬間
    // ゴールは決まるまで全速、ネットに刺さった瞬間に止めて（ヒットストップ）、ネットがふくらむ間だけ少しゆっくり
    if (r.outcome === 'goal') pb.rate = pb.t > r.goalT && pb.t < r.goalT + 0.35 ? 0.45 : 1
    else pb.rate = r.outcome === 'save' && m.level >= 2 && pb.t > r.outT - 0.3 && pb.t < r.outT + 0.2 ? 0.3 : 1
    pb.t += dt * pb.rate
    const n = r.frames.length, i = Math.min(n - 1, Math.floor(pb.t * 60)); pb.i = i
    const f = r.frames[i]
    m.kx = f.k.x; m.kdive = f.k.dive; m.kdir = f.k.dir
    f.d.forEach((d, k) => { if (m.defs[k]) { m.defs[k].x = d[0]; m.defs[k].jump = d[1] } })
    // ネット
    if (r.outcome === 'goal' && pb.t >= r.goalT && !pb.said.goal) {
      pb.said.goal = 1; const b = f.b
      m.shown = { us: m.G.us, them: m.shown ? m.shown.them : m.G.them }; updateLed()
      const tearIt = (m.tech.cost >= 12 || r.speed > 36)
      m.net = { b: 0.05, v: 6 + r.speed * 0.16, x: b.x, y: b.y, tear: tearIt, tx: b.x, ty: clamp(b.y, 0.4, 1.8), tr: 0, t0: pb.t }
      shout(T().r_goal); bigName(m.tech.name, true); Snd.play('crash', { vol: 0.8 }); Snd.play('boom', { vol: 0.9, rate: 0.85 }); Snd.play('roar', { vol: 1 }); if (tearIt) Snd.play('rip', { vol: 0.9, delay: 0.12 })
      fx.flash = 0.65; fx.shake = 16; fx.flashes = 2.5; fx.stop = 0.13; confetti()
      const np = proj(m.cam, { x: b.x, y: b.y, z: 1.6 }); word(T().ono.net, np && { x: np.x, y: np.y - 30 }, { size: 54, col: '#fff', life: 0.9 })
    }
    if (r.outcome === 'goal' && pb.t >= r.goalT + 0.1 && !pb.said.photo) { pb.said.photo = 1; takePhoto(true) }
    fx.zoomT = r.outcome === 'goal' && pb.t > r.goalT ? 1.35 : 1   // 寄るのは決まった後だけ（蹴る前と飛んでいる間は画角を変えない）
    // ネット: ばねでふくらんで揺れて戻る（球が刺さった所を中心に）
    if (m.net.b != null && r.outcome === 'goal') { const N = m.net, tgt = 0.45; N.v += (-55 * (N.b - tgt) - 5 * N.v) * dt; N.b = clamp(N.b + N.v * dt, 0, 1.6); if (N.tear) N.tr = Math.min(0.55, N.tr + dt * 2) }
    // バカな守りのすぐ横を抜けた
    if (r.near && pb.t >= r.near.t && !pb.said.near) { pb.said.near = 1; const h = defHead(r.near.i); word(T().ono.near, h && { x: h.x + 26, y: h.y - 8 }, { size: 24, col: '#fff', life: 0.8 }) }
    if (r.muriT > 0 && pb.t >= r.muriT && !pb.said.muri) { pb.said.muri = 1; bubble(T().r_muri, () => ballScreen(), 1.5); Snd.play('muri', { vol: 0.9 }); fx.shake = 2 }
    if (pb.t >= r.outT && !pb.said.out) {
      pb.said.out = 1
      const o = r.outcome
      if (o === 'save') { bubble(m.level >= 2 ? T().r_saveRead : pick(T().r_save), () => keeperHead(), 1.6); Snd.play('catch', { vol: 1 }); Snd.play('ooh', { vol: 0.6 }); fx.shake = 3 }
      else if ((o === 'block' || o === 'ref') && r.hitKind && T().hit[r.hitKind]) {   // バカな守りに当たった: 崩れる・埋まる・つぶれる。観客が笑う
        const hk = r.hitKind, h = defHead(r.hitBy)
        bubble(pick(T().hit[hk]), () => defHead(r.hitBy), 1.6); fx.shake = 7; fx.stop = 0.09
        word(T().ono[hk], h && { x: h.x + (h.x < W / 2 ? 100 : -100), y: h.y + 60 }, { size: 46, col: hk === 'mound' ? '#f3d58a' : '#ffe14a', life: 0.9 })
        if (hk === 'mound') { Snd.play('sand', { vol: 1 }); Snd.play('squeak', { vol: 0.5, delay: 0.25 }); sandSpray(m.defs[r.hitBy], f.b) }
        else if (hk === 'tower' || hk === 'pyr') { Snd.play('block', { vol: 0.9 }); Snd.play('topple', { vol: 1, delay: 0.12 }); Snd.play('grunt', { vol: 0.8, delay: 0.3 }) }
        else { Snd.play('block', { vol: 1 }); Snd.play('boing', { vol: 0.6, delay: 0.08 }); Snd.play('grunt', { vol: 0.7, delay: 0.2 }) }
        Snd.play('giggle', { vol: 0.55, delay: 0.55 })
      }
      else if (o === 'block' || o === 'ref') { bubble(pick(T().r_block), () => defHead(r.hitBy), 1.3); Snd.play('block', { vol: 1 }); Snd.play('boing', { vol: 0.5, delay: 0.08 }); fx.shake = 4 }
      else if (o === 'post') { bubble(T().r_post, () => ballScreen(), 1.3); Snd.play('thud', { vol: 1, rate: 1.4 }); Snd.play('ooh', { vol: 0.8 }); fx.shake = 5 }
      else if (o === 'miss') { bubble(pick(T().r_miss), () => ballScreen(), 1.3); Snd.play('ooh', { vol: 0.7 }) }
      else if (o === 'short') { bubble(T().r_short, () => ballScreen(), 1.3); Snd.play('squeak', { vol: 0.6 }) }
      if (o !== 'goal') { bigName('', false); setTimeout(() => takePhoto(false), 30) }
    }
    if (pb.t > r.dur || i >= n - 1) {
      if (r.outcome === 'ref') { m.st = 'ref'; m.t = 0; m.refBall = { ...r.frames[n - 1].b }; live(T().r_ref, 2.8); Snd.play('roar', { vol: 0.5 }); return }
      if (r.outcome === 'muri' && !pb.said.muri) { bubble(T().r_muri, () => ballScreen(), 1.3); Snd.play('muri') }
      m.st = 'after'; m.t = 0
      if (r.outcome !== 'goal') bigName('', false)
    }
  }
  // 砂山に当たった: 砂が飛び散る（3D の粒）
  function sandSpray(d, b) {
    if (!d) return
    for (let i = 0; i < 46; i++) { const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5; fx.wp.push({ x: d.x + (b ? (b.x - d.x) * 0.5 : 0), y: 0.5, z: d.z + (b ? (b.z - d.z) * 0.5 : 0), vx: Math.cos(a) * sp, vz: Math.sin(a) * sp - 1, vy: 2.5 + Math.random() * 4, life: 1.2 + Math.random() * 0.6, c: Math.random() < 0.5 ? '#e2c88e' : '#c9a463', r: 0.04 + Math.random() * 0.05 }) }
  }
  function confetti() { for (let i = 0; i < 120; i++) fx.parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, r: Math.random() * 6, c: Math.random() < 0.5 ? '#fff' : (Math.random() < 0.5 ? '#e0322b' : '#ffb43a'), a: Math.random() * 6, life: 3 + Math.random() }) }
  function takePhoto(isGoal) {
    const m = M.match; if (!m) return
    const score = isGoal ? 100 + (m.tech ? m.tech.cost : 0) : 1
    if (score <= m.photoScore) return
    try {
      const c = document.createElement('canvas'), sw = 540, sh = Math.round(540 * Math.min(1.2, H / W * 0.75))
      c.width = sw; c.height = sh; const g = c.getContext('2d')
      // ゴール周りを切り出す
      const gp = proj(camFor((sceneNow() || m.G.m.scenes[HS.ATTACKS - 1]).ball, 'match'), { x: 0, y: 1, z: 0 })
      const cw = W * 0.92, ch = cw * sh / sw, cx = clamp((gp ? gp.x : W / 2) - cw / 2, 0, W - cw), cy = clamp((gp ? gp.y : H * 0.3) - ch * 0.45, 0, H - ch)
      g.drawImage(cv, cx * DPR, cy * DPR, cw * DPR, ch * DPR, 0, 0, sw, sh)
      m.photo = c.toDataURL('image/jpeg', 0.82); m.photoScore = score
    } catch (e) { window.__photoErr = String(e) }
  }

  // ================= 結果（スポーツ新聞の一面）
  function endMatch() {
    const m = M.match, G = m.G
    const gr = HS.grade(G)
    const goals = G.log.filter(r => r.outcome === 'goal'), cnt = {}
    for (const r of goals) cnt[r.tech] = (cnt[r.tech] || 0) + 1
    let star = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]
    if (!star) { const u = Object.keys(G.used).sort((a, b) => G.used[b] - G.used[a]); star = u[0] }
    const st = G.techs.find(t => t.id === star)
    M.result = { gr, us: G.us, them: G.them, star: st ? st.name : T().noTech, photo: m.photo, team: G.m.team, kinds: gr.kinds, gk: gr.goalKinds, hi: R0() < 0.5 ? 0 : 1 }
    const best = store.get('best', null); if (!best || gr.score > best) store.set('best', gr.score)
    Snd.play('whistleL', { vol: 0.8 }); setTimeout(() => Snd.play(gr.d > 0 ? 'win' : 'lose', { vol: 0.8 }), 900)
    TMe(gr.score, gr.d > 0)
    setTimeout(() => { if (M.match !== m) return; show('end'); renderPaper(); $('paper').classList.remove('in'); void $('paper').offsetWidth; $('paper').classList.add('in') }, 1400)
    m.st = 'over'
  }
  function headline() { const r = M.result, t = T(); const hs = t.heads[r.gr.rank]; return hs[r.hi % hs.length].replace('{t}', lang === 'ja' ? '「' + r.star + '」' : '"' + r.star + '"') }
  function renderPaper() {
    const r = M.result, t = T()
    $('pMast').textContent = t.newsName
    const d = new Date(); $('pDate').textContent = lang === 'ja' ? `${d.getMonth() + 1}月${d.getDate()}日 夕刊` : d.toDateString()
    const h = headline()
    if (lang === 'ja') { const m = h.match(/^(「[^」]+」)(.*)$/); $('pHead').innerHTML = m ? `<em>${esc(m[1])}</em>${esc(m[2])}` : esc(h) }
    else $('pHead').textContent = h
    $('pImg').src = r.photo || ''; $('pImg').hidden = !r.photo
    const team = D.teams[lang][r.team]
    $('pScore').innerHTML = `<span class="t">${esc(t.you)}</span><span class="n">${r.us} - ${r.them}</span><span class="t">${esc(team)}</span>`
    $('pStat').textContent = t.statLine.replace('{u}', r.us).replace('{t}', r.them).replace('{k}', r.kinds).replace('{g}', r.gk)
    const rk = t.ranks[r.gr.rank]; $('pStamp').textContent = rk; $('pStamp').style.fontSize = (lang === 'ja' ? Math.min(26, Math.floor(64 / [...rk].length)) : Math.min(18, Math.floor(110 / rk.length))) + 'px'
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  $('bAgain').onclick = () => { startMatch() }
  $('bBoard').onclick = () => { openEdit('title') }
  $('bPost').onclick = () => {
    const r = M.result, t = T(); if (!r) return
    const txt = (lang === 'ja' ? `必殺「${r.star}」で${r.us}-${r.them}（${t.ranks[r.gr.rank]}）` : `"${r.star}": ${r.us}-${r.them} (${t.ranks[r.gr.rank]})`)
    open('https://x.com/intent/post?text=' + encodeURIComponent(txt) + '&hashtags=' + encodeURIComponent(t.hashtag) + '&url=' + encodeURIComponent('https://tom3games.com/play/hissatsu-shoot/'), '_blank', 'noopener')
    if (window.TM) TM.share('x')
  }
  $('bSaveImg').onclick = async () => {
    const c = await drawCard(); if (!c) return
    c.toBlob(b => { if (!b) return; const f = new File([b], 'hissatsu-shoot.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(() => {}) } else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'hissatsu-shoot.png'; a.click() } }, 'image/png')
    if (window.TM) TM.share('save')
  }
  function drawCard() {
    return new Promise(ok => {
      const r = M.result, t = T(), c = $('card'), g = c.getContext('2d'), Wc = 1080, Hc = 1350
      g.fillStyle = '#eee7d8'; g.fillRect(0, 0, Wc, Hc)
      g.fillStyle = '#e0322b'; g.fillRect(0, 0, Wc, 120); g.fillStyle = '#fff'; g.font = '900 64px ' + 'Hiragino Sans, sans-serif'; g.textBaseline = 'middle'; g.fillText(t.newsName, 40, 62)
      g.font = '700 28px Hiragino Sans, sans-serif'; g.textAlign = 'right'; g.fillText($('pDate').textContent, Wc - 40, 62); g.textAlign = 'left'
      const done = () => {
        // 見出し（縦書き）
        g.fillStyle = '#17161a'; const h = headline()
        if (lang === 'ja') { const chars = [...h.replace(/[「」]/g, m => m === '「' ? '﹁' : '﹂')]; let x = Wc - 110, y = 190, fs = 96; g.font = `900 ${fs}px Hiragino Sans, sans-serif`; g.textAlign = 'center'; for (const ch of chars) { if (y > 1060) { y = 190; x -= fs * 1.08 } g.fillStyle = /[﹁﹂]/.test(ch) || chars.indexOf(ch) < (h.indexOf('」') + 1) ? '#c62c26' : '#17161a'; g.fillText(ch, x, y); y += fs * 1.02 } g.textAlign = 'left' }
        else { g.font = '900 76px Hiragino Sans, sans-serif'; wrapText(g, h, 40, 210, Wc - 80, 84) }
        g.fillStyle = '#17161a'; g.fillRect(40, 1110, Wc - 80, 6)
        g.font = '900 120px Hiragino Sans, sans-serif'; g.textAlign = 'center'; g.fillText(`${r.us} - ${r.them}`, Wc / 2, 1210)
        g.font = '700 34px Hiragino Sans, sans-serif'; g.textAlign = 'left'; g.fillText(t.you, 60, 1210); g.textAlign = 'right'; g.fillText(D.teams[lang][r.team], Wc - 60, 1210)
        g.textAlign = 'center'; g.font = '600 30px Hiragino Sans, sans-serif'; g.fillText((lang === 'ja' ? '必殺シュートを描け！ ' : 'Draw Your Super Shot! ') + 'tom3games.com', Wc / 2, 1305)
        g.save(); g.translate(170, 1020); g.rotate(-0.25); g.strokeStyle = '#e0322b'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 110, 0, 7); g.stroke(); g.fillStyle = '#e0322b'; g.font = '400 64px "Yuji Boku", serif'; g.fillText(t.ranks[r.gr.rank], 0, 22, 190); g.restore()
        ok(c)
      }
      if (r.photo) { const im = new Image(); im.onload = () => { const pw = lang === 'ja' ? 780 : 1000, ph = lang === 'ja' ? 860 : 700, px = 40, py = lang === 'ja' ? 160 : 400; g.drawImage(im, px, py, pw, ph); g.strokeStyle = '#17161a'; g.lineWidth = 4; g.strokeRect(px, py, pw, ph); done() }; im.onerror = done; im.src = r.photo } else done()
    })
  }
  function wrapText(g, s, x, y, w, lh) { const words = s.split(' '); let line = ''; for (const wd of words) { const tst = line ? line + ' ' + wd : wd; if (g.measureText(tst).width > w && line) { g.fillText(line, x, y); line = wd; y += lh } else line = tst } g.fillText(line, x, y) }
  const TMs = () => { if (window.TM) TM.start() }, TMe = (s, c) => { if (window.TM) TM.end(s, c) }

  // ================= 描画
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    let cam, sc = null
    if (M.mode === 'edit') cam = camFor(EDIT_BALL, 'edit')
    else if (M.mode === 'match' || (M.mode === 'end' && M.match)) { sc = sceneNow() || M.match.G.m.scenes[HS.ATTACKS - 1]; cam = (M.match.cam && M.match.cam.sc === sc) ? M.match.cam : (M.match.cam = Object.assign(Object.create(camFor(sc.ball, 'match')), { sc })) }   // 攻めの間はカメラを固定
    else cam = camFor({ x: -3, y: 0, z: -17 }, 'title')
    // 寄り（溜め・ゴールの瞬間に少しズーム）
    ctx.save()
    const z = fx.zoom
    if (fx.shake > 0.3) { ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake) }
    if (z !== 1 && fx.zoomAt) { ctx.translate(fx.zoomAt.x, fx.zoomAt.y); ctx.scale(z, z); ctx.translate(-fx.zoomAt.x, -fx.zoomAt.y) }
    ctx.drawImage(buildBG(cam), 0, 0, W, H)
    // スタンドのフラッシュ
    if (fx.flashes > 0) { for (let i = 0; i < 14; i++) { const x = Math.random() * W, y = Math.random() * H * 0.35; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x, y, 2, 2) } }
    const items = []
    const add = (p, fn) => { const c = toCam(cam, p); if (c.z > 0.3) items.push([c.z, fn]) }
    add({ x: 0, y: 1, z: 2.0 }, () => drawGoalBack(ctx, cam, (M.match && M.mode !== 'edit') ? M.match.net : {}))
    const gm = M.mode !== 'edit' && M.match, gpb = gm && gm.pb, gres = gm && gm.res
    const postShake = gres && gpb && gpb.said.out && gres.outcome === 'post' ? 3 : gres && gpb && gres.outcome === 'goal' && gpb.t > gres.goalT ? Math.max(0, 5 * (1 - (gpb.t - gres.goalT) / 0.7)) : 0
    add({ x: 0, y: 1, z: -0.05 }, () => drawGoalFront(ctx, cam, postShake))
    if (M.mode === 'edit') drawEdit(cam, add)
    else if (sc) drawMatch(cam, sc, add)
    else drawTitle(cam, add)
    items.sort((a, b) => b[0] - a[0]); for (const it of items) it[1]()
    // 描いている線・下書き（いちばん手前）
    if (M.mode === 'edit') drawStrokeOverlay(cam)
    if (M.mode === 'match' && M.match.st === 'aim' && M.match.sel >= 0) drawGhost(cam, sc)
    for (const q of fx.wp) { const s = proj(cam, q); if (!s) continue; ctx.fillStyle = q.c; ctx.fillRect(s.x - 1, s.y - 1, Math.max(2, q.r * s.s), Math.max(2, q.r * s.s)) }
    ctx.restore()
    // 蹴った瞬間の衝撃の輪
    for (const g of fx.rings) { const k = g.t / 0.35, rr = (g.big ? 16 : 10) + k * (g.big ? 90 : 55); ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.95})`; ctx.lineWidth = (g.big ? 7 : 4) * (1 - k) + 1; ctx.beginPath(); ctx.arc(g.x, g.y, rr, 0, 7); ctx.stroke(); if (g.big) { ctx.strokeStyle = `rgba(255,210,80,${(1 - k) * 0.8})`; ctx.lineWidth = 3; ctx.beginPath(); for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2; ctx.moveTo(g.x + Math.cos(an) * rr * 0.6, g.y + Math.sin(an) * rr * 0.6); ctx.lineTo(g.x + Math.cos(an) * rr * 1.15, g.y + Math.sin(an) * rr * 1.15) } ctx.stroke() } }
    // 溜めの暗転と集中線
    if (fx.dark > 0.01) {
      const sp = M.match ? proj(cam, { x: sc.ball.x, y: 0.8, z: sc.ball.z }) : { x: W / 2, y: H * 0.7 }
      const gg = ctx.createRadialGradient(sp.x, sp.y, 40, sp.x, sp.y, Math.max(W, H)); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, `rgba(0,0,0,${0.5 * fx.dark})`)
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * fx.dark})`; ctx.lineWidth = 2
      const rr = HS.rng(Math.floor(vt * 20)); ctx.beginPath()
      for (let i = 0; i < 48; i++) { const a = rr() * Math.PI * 2, r1 = 120 + rr() * 80, r2 = Math.max(W, H); ctx.moveTo(sp.x + Math.cos(a) * r1, sp.y + Math.sin(a) * r1); ctx.lineTo(sp.x + Math.cos(a) * r2, sp.y + Math.sin(a) * r2) }
      ctx.stroke()
    }
    if (M.mode === 'match' && M.match.st === 'tame' && M.match.sel >= 0 && M.match.t < 1.0) { ctx.save(); ctx.globalAlpha = clamp(1 - (M.match.t - 0.7) / 0.3, 0, 1); drawGhost(cam, sc); ctx.restore() }
    if (fx.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.7})`; ctx.fillRect(0, 0, W, H) }
    // 擬音（ドゴォッ・バサァッ・ガラガラ…）
    for (const w of fx.words) {
      const k = w.t / w.life, sc2 = k < 0.15 ? 0.4 + k / 0.15 * 0.8 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4), al = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
      ctx.save(); ctx.translate(clamp(w.x, 60, W - 60), clamp(w.y, 110, H - 80)); ctx.rotate(w.rot); ctx.scale(sc2, sc2); ctx.globalAlpha = al
      ctx.font = `400 ${w.size}px ${getComputedStyle(document.body).getPropertyValue('--brush')}, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
      ctx.strokeStyle = '#141318'; ctx.lineWidth = Math.max(4, w.size * 0.16); ctx.strokeText(w.text, 0, 0); ctx.fillStyle = w.col; ctx.fillText(w.text, 0, 0)
      ctx.restore()
    }
    // 紙吹雪
    for (const p of fx.parts) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8); ctx.restore() }
    placeBubble()
    if (finger) placeFinger(cam)
  }
  function drawTitle(cam, add) {
    // ゴール前でリフティングする棒人間とキーパー
    const t = vt, up = Math.abs(Math.sin(t * 3.2))
    const bx = -3, bz = -17
    add({ x: 0, y: 0, z: -0.5 }, () => stick(ctx, cam, Math.sin(t * 0.8) * 0.6, -0.5, { pose: 'ready', gloves: 1, cap: '#2c4f9e', col: '#f0c43a', face: 'o', seed: 3 }))
    add({ x: bx, y: 0, z: bz }, () => stick(ctx, cam, bx, bz, { pose: 'juggle', ph: t * 3.2 / 2, band: '#e0322b', bandTail: 1, col: '#e0322b', face: 'smug', seed: 1 }))
    add({ x: bx + 0.25, y: 0.3, z: bz - 0.05 }, () => ballAt(ctx, cam, { x: bx + 0.25, y: 0.25 + up * 0.9, z: bz - 0.05 }, t * 6))
    add({ x: 6, y: 0, z: -9 }, () => stick(ctx, cam, 6, -9, { pose: 'wall', cap: '#2c4f9e', col: '#2c4f9e', face: 'o', seed: 5 }))
    add({ x: -8, y: 0, z: -6 }, () => stick(ctx, cam, -8, -6, { pose: 'spin', ph: t * 4, cap: '#2c4f9e', col: '#2c4f9e', seed: 6 }))
  }
  function drawEdit(cam, add) {
    const E = M.edit
    add({ x: 0, y: 0, z: -0.6 }, () => {   // 練習用の板（キーパーの形の板）
      const a = proj(cam, { x: -0.45, y: 0, z: -0.6 }), b = proj(cam, { x: 0.45, y: 1.9, z: -0.6 }); if (!a || !b) return
      ctx.fillStyle = 'rgba(214,180,120,.85)'; ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(a.x, b.y, b.x - a.x, a.y - b.y, 4) : ctx.rect(a.x, b.y, b.x - a.x, a.y - b.y); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#3a2a18'; ctx.font = `600 ${Math.max(9, a.s * 0.22)}px ${getComputedStyle(document.body).getPropertyValue('--hand')}`; ctx.textAlign = 'center'; ctx.fillText(lang === 'ja' ? '練習用' : 'DUMMY', (a.x + b.x) / 2, (a.y + b.y) / 2)
    })
    const sh = { x: EDIT_BALL.x - 0.55, z: EDIT_BALL.z - 0.7 }
    add(sh, () => stick(ctx, cam, sh.x, sh.z, { pose: E && E.prev ? 'kick' : 'idle', k: E && E.prev ? clamp(E.prev.t * 3, 0, 1) : 0, ph: vt * 2, band: '#e0322b', bandTail: 1, col: '#e0322b', face: 'n', seed: 1 }))
    // 試し撃ち（描いた技を練習場で再生）
    let bp = { x: EDIT_BALL.x, y: BR, z: EDIT_BALL.z }
    if (E && E.prev) {
      const s = E.prev.sim, i = clamp(Math.floor(E.prev.t * 60), 0, s.frames.length - 1); bp = s.frames[i].b   // くり返しの間（t<0）は蹴る前の位置
      if (E.prev.t > s.dur + 0.6) E.prev.t = -0.4   // くり返す
      if (s.muriT > 0 && E.prev.t >= s.muriT && E.prev.t < s.muriT + 1.2 && !E.prev.saidM) { E.prev.saidM = 1; bubble(T().r_muri, () => proj(cam, bp), 1) }
      if (E.prev.t < 0.1) E.prev.saidM = 0
      trailDraw(cam, s.frames, i, add)
    }
    const bpp = bp; add(bpp, () => ballAt(ctx, cam, bpp, vt * 8))
  }
  function trailDraw(cam, frames, i, add, spd = 20) {
    const pts = []; for (let k = Math.max(0, i - (spd > 30 ? 26 : 20)); k <= i; k++) pts.push(frames[k].b)
    if (pts.length < 2) return
    add(pts[0], () => {
      for (let k = 1; k < pts.length; k++) {
        const a = proj(cam, pts[k - 1]), b = proj(cam, pts[k]); if (!a || !b) continue
        const al = k / pts.length; ctx.strokeStyle = spd > 32 ? `rgba(255,${Math.round(120 + al * 110)},60,${al * 0.85})` : `rgba(255,214,90,${al * 0.75})`; ctx.lineWidth = Math.max(3, BR * (spd > 32 ? 3 : 2.4) * b.s) * al; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      for (let k = 0; k < pts.length - 2; k += 4) { const q = proj(cam, pts[k]); if (!q) continue; ctx.fillStyle = `rgba(255,255,255,${k / pts.length * 0.35})`; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, BR * q.s), 0, 7); ctx.fill() }
    })
  }
  function drawStrokeOverlay(cam) {
    const E = M.edit; if (!E || !E.stroke) return
    const p = E.stroke.pts; if (p.length < 2) return
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(20,10,10,.55)'; ctx.lineWidth = 11; ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke()
    ctx.strokeStyle = E.tech ? 'rgba(224,50,43,.55)' : '#e0322b'; ctx.lineWidth = 6.5; ctx.stroke()
  }
  function drawGhost(cam, sc) {
    const m = M.match, t = m.G.techs[m.sel]; if (!t) return
    const pts = HS.toWorld(t.rel, { x: sc.ball.x, y: BR, z: sc.ball.z }, m.flip)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    // 地面の影の線（高さが分かる）
    // 地面の影（高さが分かる）: 黒い太めの点線
    ctx.strokeStyle = 'rgba(10,20,10,.6)'; ctx.lineWidth = 4; ctx.setLineDash([6, 6]); ctx.beginPath(); pts.forEach((p, i) => { const q = proj(cam, { x: p.x, y: 0, z: p.z }); if (q) i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y) }); ctx.stroke(); ctx.setLineDash([])
    // 通り道: 黒い外枠＋白い縁＋赤の実線（芝の上でもスタンドの前でも読める）。流れる白い点で向きを見せる
    const path = () => { ctx.beginPath(); pts.forEach((p, i) => { const q = proj(cam, p); if (q) i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y) }) }
    path(); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 13; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 9.5; ctx.stroke(); ctx.strokeStyle = '#e0322b'; ctx.lineWidth = 6; ctx.stroke()
    ctx.setLineDash([2, 22]); ctx.lineDashOffset = -vt * 60; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0
    // 行き先の印
    const e = proj(cam, pts[pts.length - 1]); if (e) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, 7); ctx.stroke(); ctx.strokeStyle = '#e0322b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, 7); ctx.stroke() }
    // 守りにぶつかる所に印（ギザギザの星）
    const hi = HS.pathHitInfo(sc, t, m.flip, pts)
    if (hi.first >= 0) { const q = proj(cam, pts[hi.first]); if (q) { const R1 = 13, R2 = 6; ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + vt * 2, rr = k % 2 ? R2 : R1; k ? ctx.lineTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr) : ctx.moveTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr) } ctx.closePath(); ctx.fillStyle = '#ffb43a'; ctx.fill(); ctx.strokeStyle = '#141318'; ctx.lineWidth = 2; ctx.stroke() } }
    if (t.muri >= 0) { const k = Math.floor(t.muri * (pts.length - 1)), q = proj(cam, pts[k]); if (q) { ctx.strokeStyle = '#ffb43a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x - 8, q.y - 8); ctx.lineTo(q.x + 8, q.y + 8); ctx.moveTo(q.x + 8, q.y - 8); ctx.lineTo(q.x - 8, q.y + 8); ctx.stroke() } }
  }
  function drawMatch(cam, sc, add) {
    const m = M.match
    let fr = m.st === 'fly' && m.pb ? m.res.frames[m.pb.i] : null
    // キーパー
    const kx = m.kx, kz = -0.5
    fx.zoomAt = proj(cam, { x: 0, y: 1.1, z: 0 })
    if (m.st === 'intro' && m.funny) { const f = sc.defs.find(d => HS.DEF_KIND[d.kind].funny && d.kind !== 'squat'); const fp = f && proj(cam, { x: f.x, y: f.kind === 'tower' ? 2.2 : f.kind === 'mound' ? 0.4 : 1.2, z: f.z }); if (fp) fx.zoomAt = fp }
    let kp = { pose: 'ready', gloves: 1, cap: '#2c4f9e', col: '#f0c43a', face: 'n', seed: 3, mustache: 1 }
    if (sc.bento && (m.st === 'aim' || m.st === 'intro' || m.st === 'tame')) kp = { ...kp, pose: 'idle', bento: 1, face: 'joy' }
    if (fr && fr.k.dive) { kp.pose = 'dive'; kp.rot = -fr.k.dir * fr.k.dive * 1.25; kp.y0 = Math.sin(Math.min(1, fr.k.dive) * Math.PI) * 0.45 }
    if (m.level >= 3 && (m.st === 'tame' || m.st === 'fly')) kp.face = 'smug'
    if (m.st === 'after' && m.res.outcome === 'goal') { kp.pose = 'sad'; kp.rot = 0; kp.y0 = 0; kp.face = 'o' }
    if (m.st === 'after' && m.res.outcome === 'save') { kp.pose = 'cheer'; kp.ph = vt * 8; kp.rot = 0; kp.y0 = 0; kp.face = 'smug' }
    let khead = null
    add({ x: kx, y: 1, z: kz }, () => { khead = stick(ctx, cam, kx, kz, kp); drawMarks(cam, khead) })
    keeperHead = () => { const p = proj(cam, { x: m.kx, y: 2.1, z: kz }); return p && { x: p.x, y: p.y - 6 } }
    // ディフェンダー
    m.defs.forEach((d, i) => {
      const k = HS.DEF_KIND[d.kind]
      if (k.funny) return drawFormation(cam, sc, d, i, add)
      const P = { pose: d.kind === 'wall' ? 'wall' : d.kind === 'spin' ? 'spin' : 'idle', ph: d.ph || vt * 2 + i, cap: '#2c4f9e', col: '#2c4f9e', seed: 10 + i, face: 'n', h: d.kind === 'tall' ? 1.68 : 1 }
      if (d.jump > 0.05) { P.pose = 'jump'; P.y0 = d.jump * 0.4 }
      if (d.kind === 'sleep') { P.pose = 'idle'; P.rot = Math.PI / 2; P.face = 'zz'; P.y0 = 0.15 }
      if (m.st === 'fly' && m.res.outcome === 'block' && m.res.hitBy === i && m.pb.t > m.res.outT) { P.face = 'o'; P.rot = (P.rot || 0) + Math.min(0.5, (m.pb.t - m.res.outT) * 2) }
      add({ x: d.x, y: 1, z: d.z }, () => { const r = stick(ctx, cam, d.x, d.z, P); if (d.kind === 'sleep' && r) { ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.max(10, r.hr * 1.4)}px sans-serif`; ctx.fillText('z', r.head.x + r.hr * 1.4, r.head.y - r.hr * (1.5 + Math.sin(vt * 2) * 0.3)) } })
    })
    m.defHead = i => { const d = m.defs[i]; if (!d) return null; const p = proj(cam, { x: d.x, y: Math.min(3.2, HS.DEF_KIND[d.kind].reach + 0.3), z: d.z }); return p }
    // 審判（いつもは横で見ている）
    const refP = m.st === 'ref' ? refPos(sc) : { x: sc.ball.x * 0.4 + (sc.ball.x > 0 ? -9 : 9), z: sc.ball.z * 0.55 }
    add({ x: refP.x, y: 1, z: refP.z }, () => stick(ctx, cam, refP.x, refP.z, { pose: m.st === 'ref' && m.t > 0.8 && m.t < 2.4 ? 'juggle' : m.st === 'ref' ? 'run' : 'idle', ph: vt * (m.st === 'ref' ? 9 : 2), ink: '#141318', col: '#141318', mustache: 1, whistle: 1, face: m.st === 'ref' ? 'smug' : 'n', seed: 20, mirror: refP.x > sc.ball.x }))
    if (m.dog) { const dd = m.dog; add({ x: dd.x, y: 0.5, z: dd.z }, () => dog(ctx, cam, dd.x, dd.z, vt * 8)) }
    // 蹴る人
    const u = { x: -sc.ball.x, z: -sc.ball.z }, ul = Math.hypot(u.x, u.z); u.x /= ul; u.z /= ul
    const rgt = { x: u.z, z: -u.x }
    // 立ち位置は攻めごとに1回だけ決める（kickerSpot）。札を選んでから球が飛び出すまで動かない。左右反転は狙う間だけ反映
    const spot = kickerSpot(m, sc)
    let sp = { pose: 'idle', ph: vt * 2, band: '#e0322b', bandTail: 1, col: '#e0322b', face: 'n', seed: 1, mirror: spot.mirror }
    if (m.st === 'aim' || m.st === 'intro') { sp.pose = 'kick'; sp.k = 0; sp.face = m.sel >= 0 ? 'smug' : 'n' }
    else if (m.st === 'tame') { sp.pose = 'kick'; sp.k = m.t < 0.75 ? 0 : clamp((m.t - 0.75) / 0.4, 0, 1) * KICK_HIT; sp.face = 'smug' }
    else if (m.st === 'fly') { sp.pose = 'kick'; sp.k = clamp(KICK_HIT + m.pb.t * 1.6, 0, 1); if (m.res.cost >= 30 && m.pb.t > 0.35) { sp.pose = 'idle'; sp.rot = Math.min(1.5, (m.pb.t - 0.35) * 5); sp.face = 'o' } }
    else if (m.st === 'fall') { sp.pose = 'kick'; sp.k = 0.3; sp.rot = Math.min(1.55, m.t * 5); sp.face = 'o'; sp.y0 = 0 }
    else if (m.st === 'after') { if (m.res.outcome === 'goal') { sp.pose = 'cheer'; sp.ph = vt * 10; sp.face = 'joy' } else if (m.res.cost >= 30) { sp.pose = 'idle'; sp.rot = 1.5; sp.face = 'o' } else { sp.pose = 'sad'; sp.face = 'o' } }
    else if (m.st === 'steal') { sp.pose = 'sad'; sp.face = 'o' }
    const shx = spot.x, shz = spot.z
    let shead = null
    add({ x: shx, y: 1, z: shz }, () => { shead = stick(ctx, cam, shx, shz, sp); lockProbe(m, cam, spot, shead, sc) })
    shooterHead = () => { const p = proj(cam, { x: shx, y: 2.0, z: shz }); return p }
    // ボール
    let bp = { x: sc.ball.x, y: BR, z: sc.ball.z }
    if (fr && m.pb.t < 1 / 60) fr = null   // 蹴った瞬間（ヒットストップ中）は足先の球のまま
    if (fr) { bp = fr.b; trailDraw(cam, m.res.frames, m.pb.i, add, m.res.speed); if (m.pb.rate === 1) streaks(cam, m.res.frames, m.pb.i, add) }
    else if (m.st === 'after' && m.res.frames) bp = m.res.frames[m.res.frames.length - 1].b
    else if (m.st === 'fall') { const k = clamp(m.t / 1.2, 0, 1); bp = { x: sc.ball.x + u.x * k * 1.6, y: BR, z: sc.ball.z + u.z * k * 1.6 } }
    else if (m.st === 'steal') { const k = clamp(m.t / 1.4, 0, 1); bp = { x: sc.ball.x - rgt.x * k * 6, y: BR, z: sc.ball.z - rgt.z * k * 6 }; const ox = bp.x - rgt.x * 0.4, oz = bp.z - rgt.z * 0.4; add({ x: ox, y: 1, z: oz }, () => stick(ctx, cam, ox, oz, { pose: 'run', ph: vt * 16, cap: '#2c4f9e', col: '#2c4f9e', face: 'smug', seed: 31 })) }
    else if (m.st === 'ref') { const R = refPos(sc); const up = m.t > 0.8 && m.t < 2.4 ? Math.abs(Math.sin((m.t - 0.8) * 6)) : 0; bp = m.t < 0.8 ? { x: lerp(m.refBall.x, R.x + 0.2, m.t / 0.8), y: BR, z: lerp(m.refBall.z, R.z, m.t / 0.8) } : m.t < 2.4 ? { x: R.x + 0.22, y: BR + up * 1.1, z: R.z } : { x: lerp(R.x, sc.ball.x, clamp((m.t - 2.4) / 0.5, 0, 1)), y: BR, z: lerp(R.z, sc.ball.z, clamp((m.t - 2.4) / 0.5, 0, 1)) } }
    const bb = bp, spin = m.pb ? m.pb.t * 30 : 0
    add(bb, () => ballAt(ctx, cam, bb, spin, m.st === 'fly' && (m.pb.rate < 1 || m.res.speed > 32)))
    ballScreen = () => { const p = proj(cam, bb); return p && { x: p.x, y: p.y - 14 } }
  }
  // 速さの線: 球の後ろに、画面で見た進む向きの細い線
  function streaks(cam, frames, i, add) {
    if (i < 3) return
    const a = proj(cam, frames[i].b), b = proj(cam, frames[i - 3].b); if (!a || !b) return
    let dx = a.x - b.x, dy = a.y - b.y; const L = Math.hypot(dx, dy); if (L < 4) return
    dx /= L; dy /= L
    const r = Math.max(3, BR * a.s), len = Math.min(140, L * 3.2)
    add(frames[i].b, () => {
      ctx.lineCap = 'round'
      for (const [o, w, al] of [[-1.5, 1.5, 0.5], [-0.7, 2.5, 0.8], [0.7, 2.5, 0.8], [1.5, 1.5, 0.5]]) {
        const ox = -dy * r * o, oy = dx * r * o, l = len * (0.6 + Math.abs(o) * 0.25)
        const gr = ctx.createLinearGradient(a.x + ox, a.y + oy, a.x + ox - dx * l, a.y + oy - dy * l); gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = gr; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x + ox - dx * r * 0.8, a.y + oy - dy * r * 0.8); ctx.lineTo(a.x + ox - dx * l, a.y + oy - dy * l); ctx.stroke()
      }
    })
  }
  // バカな守り（人間タワー・肩車・砂場・ピラミッド）。当たったら崩れる
  function drawFormation(cam, sc, d, i, add) {
    const m = M.match, r = m.res
    const u = { x: -sc.ball.x, z: -sc.ball.z }, ul = Math.hypot(u.x, u.z); u.x /= ul; u.z /= ul
    const R = { x: u.z, z: -u.x }
    const live = r && m.pb && (m.st === 'fly' || m.st === 'after' || m.st === 'concede' || m.st === 'ref')
    const hit = live && (r.outcome === 'block' || r.outcome === 'ref') && r.hitBy === i && m.pb.t > r.outT
    const tt = hit ? m.pb.t - r.outT : 0, dir = r && r.frames && hit ? (r.frames[Math.min(r.frames.length - 1, Math.round(r.outT * 60))].b.x > d.x ? -1 : 1) : 1
    const near = live && r.near && r.near.i === i && m.pb.t >= r.near.t && m.pb.t < r.near.t + 1.2
    const team = { cap: '#2c4f9e', col: '#2c4f9e' }
    const at = (lat, dep = 0) => ({ x: d.x + R.x * lat + u.x * dep, z: d.z + R.z * lat + u.z * dep })
    if (d.kind === 'tower') {
      add({ x: d.x, y: 1, z: d.z }, () => {
        const wob = Math.sin(vt * 2.6 + i)
        for (let k = 0; k < 3; k++) {
          const y0 = k * 1.45, fall = Math.min(1, tt * (1.6 + k * 0.35))
          const p = { ...team, pose: k === 2 ? 'cheer' : 'hold', ph: vt * 3, seed: 40 + k, face: k === 0 ? 'grit' : k === 2 ? (near ? 'o' : 'o') : 'n', noShadow: k > 0 }
          let x = d.x + R.x * wob * 0.05 * k, z = d.z + R.z * wob * 0.05 * k
          p.rot = wob * 0.035 * k; p.y0 = y0
          if (hit) { const sh = dir * k * 1.3 * fall; x += R.x * sh; z += R.z * sh; p.y0 = Math.max(0, y0 * (1 - fall * fall)); p.rot = dir * fall * (k === 0 ? 0.5 : 1.5); p.face = k === 0 ? 'cry' : 'x'; p.pose = k === 0 ? 'sad' : 'idle' }
          stick(ctx, cam, x, z, p)
        }
      })
    } else if (d.kind === 'kata') {
      add({ x: d.x, y: 1, z: d.z }, () => {
        const sway = Math.sin(vt * 1.7 + i * 2) * 0.03, fall = Math.min(1, tt * 2.2)
        const rider = { ...team, pose: 'ride', seed: 50 + i, face: near ? 'o' : 'smug', y0: 0.62, noShadow: true, rot: sway }
        const base = { ...team, pose: 'hold', seed: 55 + i, face: 'o', rot: -sway * 0.5 }
        let rx = d.x, rz = d.z
        if (hit) { rider.y0 = Math.max(0, 0.62 * (1 - fall)); rider.rot = -dir * fall * 1.5; rider.pose = 'idle'; rider.face = 'x'; rx += R.x * dir * fall * 0.9; rz += R.z * dir * fall * 0.9; base.pose = 'sad'; base.face = 'o' }
        stick(ctx, cam, rx, rz, rider)
        const b = stick(ctx, cam, d.x, d.z, base)
        // 上の人の手が、下の人の目をふさいでいる（崩れたら外れる）
        if (b && !hit && b.hr > 3) {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#141318'; ctx.lineWidth = Math.max(1, b.hr * 0.11)
          for (const sx of [-1, 1]) {   // 手のひら＋指3本（外から目の上へ）
            const cx = b.head.x + sx * b.hr * 0.42, cy = b.head.y - b.hr * 0.1
            ctx.beginPath(); ctx.ellipse(cx + sx * b.hr * 0.18, cy, b.hr * 0.3, b.hr * 0.24, 0, 0, 7); ctx.fill(); ctx.stroke()
            ctx.beginPath(); for (let q = -1; q <= 1; q++) { const fy = cy + q * b.hr * 0.13; ctx.moveTo(cx + sx * b.hr * 0.05, fy); ctx.lineTo(cx - sx * b.hr * 0.38, fy) } ctx.stroke()
          }
        }
      })
    } else if (d.kind === 'mound') {
      // 砂場（地面）、砂山、看板の順。地面の物なので奥の方から描く
      const far = at(0, 1.3)
      add({ x: far.x, y: 0, z: far.z + 0.01 }, () => {
        const c = [at(-1.7, -1.3), at(1.7, -1.3), at(1.7, 1.3), at(-1.7, 1.3)].map(p => ({ x: p.x, y: 0.01, z: p.z }))
        ctx.fillStyle = '#d6bb82'; if (poly(ctx, cam, c)) ctx.fill()
        ctx.fillStyle = '#8a5a2b'; ribbon(ctx, cam, [...c, c[0]].map(p => ({ x: p.x, z: p.z })), 0.16)
        // 砂山（当たると低くなる）
        const H = 0.72 * (hit ? Math.max(0.35, 1 - tt * 3) : 1), w = 1.0
        const top = [], bot = []
        for (let k = 0; k <= 16; k++) { const s = -1 + k / 8; const q = at(s * w); top.push(proj(cam, { x: q.x, y: H * (1 - s * s), z: q.z })) }
        for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16, q = at(Math.cos(a) * w, -Math.sin(a) * w); bot.push(proj(cam, { x: q.x, y: 0, z: q.z })) }
        if (top.every(Boolean) && bot.every(Boolean)) {
          ctx.beginPath(); top.forEach((q, k) => k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); for (const q of bot) ctx.lineTo(q.x, q.y); ctx.closePath()
          ctx.fillStyle = '#c99f5e'; ctx.fill(); ctx.strokeStyle = '#7a5428'; ctx.lineWidth = 1.5; ctx.stroke()
          const hl = proj(cam, { ...at(-0.25 * w, -0.2), y: H * 0.7 }); if (hl) { ctx.fillStyle = 'rgba(255,240,200,.35)'; ctx.beginPath(); ctx.ellipse(hl.x, hl.y, Math.max(2, hl.s * 0.3), Math.max(1, hl.s * 0.12), -0.3, 0, 7); ctx.fill() }
          // 決まらなかった後で、山のてっぺんに旗を立てる（当たっていなければ）
          if (!hit && r && m.st === 'after' && m.t > 0.4) { const fb = proj(cam, { ...at(0), y: H }), ft = proj(cam, { ...at(0), y: H + 0.5 }); if (fb && ft) { ctx.strokeStyle = '#141318'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fb.x, fb.y); ctx.lineTo(ft.x, ft.y); ctx.stroke(); ctx.fillStyle = '#e0322b'; ctx.beginPath(); ctx.moveTo(ft.x, ft.y); ctx.lineTo(ft.x + ft.s * 0.28, ft.y + ft.s * 0.08); ctx.lineTo(ft.x, ft.y + ft.s * 0.16); ctx.fill() } }
        }
        // 看板「工事中」
        const sp = at(-1.55, 1.1), s0 = proj(cam, { x: sp.x, y: 0, z: sp.z }), s1 = proj(cam, { x: sp.x, y: 0.9, z: sp.z })
        if (s0 && s1 && s1.s > 4) { ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = Math.max(1.5, s1.s * 0.05); ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke(); const bw = s1.s * 0.95, bh = s1.s * 0.38; ctx.fillStyle = '#f0c43a'; ctx.fillRect(s1.x - bw / 2, s1.y - bh, bw, bh); ctx.strokeStyle = '#141318'; ctx.lineWidth = 1.2; ctx.strokeRect(s1.x - bw / 2, s1.y - bh, bw, bh); ctx.fillStyle = '#141318'; ctx.font = `700 ${Math.max(7, Math.round(bh * 0.62))}px ${getComputedStyle(document.body).getPropertyValue('--sans')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(T().sign, s1.x, s1.y - bh / 2, bw * 0.92) }
      })
    } else if (d.kind === 'squat') {
      add({ x: d.x, y: 1, z: d.z }, () => {
        const mi = m.defs.findIndex(q => q.kind === 'mound'), mHit = live && r.hitBy === mi && (r.outcome === 'block' || r.outcome === 'ref') && m.pb.t > r.outT
        const p = { ...team, cap: '#f0c43a', pose: hit ? 'sad' : 'squat', seed: 60, face: mHit ? 'cry' : hit ? 'x' : near ? 'o' : 'n', mirror: (d.x - sc.ball.x) * R.x + (d.z - sc.ball.z) * R.z > 0 }
        if (hit) p.rot = dir * Math.min(1.5, tt * 4)
        const st = stick(ctx, cam, d.x, d.z, p)
        if (st && !hit && st.hr > 2) {   // シャベルとバケツ
          const sg = p.mirror ? -1 : 1, hx = st.base.x + 0.42 * st.s * sg, hy = st.base.y - 0.4 * st.s
          ctx.strokeStyle = '#141318'; ctx.lineWidth = Math.max(1.2, st.s * 0.03); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 0.12 * st.s * sg, st.base.y - 0.05 * st.s); ctx.stroke()
          ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.ellipse(hx + 0.13 * st.s * sg, st.base.y - 0.03 * st.s, 0.06 * st.s, 0.035 * st.s, 0, 0, 7); ctx.fill()
          const bx = st.base.x - 0.45 * st.s * sg, by = st.base.y; ctx.fillStyle = '#e0322b'; ctx.beginPath(); ctx.moveTo(bx - 0.13 * st.s, by - 0.25 * st.s); ctx.lineTo(bx + 0.13 * st.s, by - 0.25 * st.s); ctx.lineTo(bx + 0.1 * st.s, by); ctx.lineTo(bx - 0.1 * st.s, by); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#141318'; ctx.lineWidth = 1; ctx.stroke()
        }
      })
    } else if (d.kind === 'pyr') {
      add({ x: d.x, y: 1, z: d.z }, () => {
        const fall = Math.min(1, tt * 2.4), wob = Math.sin(vt * 2.2 + i) * 0.02
        // 奥から（下の段の真ん中が一番奥）。上の段ほど手前に描く
        HS.PYR.forEach(([lat, y0], k) => {
          const q = at(lat + (hit ? Math.sign(lat || dir) * fall * 0.4 : 0), k < 3 ? 0.12 : k < 5 ? 0.04 : -0.04)
          const top = k === 5
          const p = { ...team, pose: top ? 'cheer' : 'crawl', ph: vt * 4, seed: 70 + k, face: top ? (near ? 'o' : 'joy') : 'grit', y0: y0, noShadow: y0 > 0, rot: wob * (y0 + 0.5) }
          if (hit) { p.y0 = y0 * (1 - fall); p.rot = (k === 1 ? 0 : Math.sign(lat || dir)) * fall * 1.45; p.face = k === 1 ? 'cry' : 'x'; if (top) p.pose = 'idle' }
          stick(ctx, cam, q.x, q.z, p)
        })
      })
    }
  }
  // キッカーの立ち位置: 蹴る瞬間の足先（KICK_FOOT）がちょうど球に重なる所。カメラの右（R）の向きでずらす
  function kickerSpot(m, sc) {
    const aiming = m.st === 'aim' || m.st === 'intro', mirror = !!(m.sel >= 0 && m.flip)
    if (m.spot && m.spot.sc === sc && (!aiming || m.spot.mirror === mirror)) return m.spot   // 蹴り始めたら変えない
    const cam = m.cam || camFor(sc.ball, 'match'), sg = mirror ? -1 : 1
    m.spot = { x: sc.ball.x - cam.R.x * KICK_FOOT.x * sg - cam.F.x * 0.04, z: sc.ball.z - cam.R.z * KICK_FOOT.x * sg - cam.F.z * 0.04, mirror, sc }
    return m.spot
  }
  // 検査用: 狙いの線が出てから球が飛び出すまで、カメラとキッカーが動かないか・球の出発点が足先か を記録する
  function lockProbe(m, cam, spot, sh, sc) {
    if (!sh) return
    const camSig = [cam.C.x, cam.C.y, cam.C.z, cam.F.x, cam.F.y, cam.F.z, cam.f, cam.cx, cam.cy, fx.zoom].map(v => +v.toFixed(4)).join(',')
    const sig = camSig + '|' + spot.x.toFixed(4) + ',' + spot.z.toFixed(4) + ',' + spot.mirror + '|' + Math.round(sh.base.x) + ',' + Math.round(sh.base.y)
    if (m.st === 'aim' && m.sel >= 0) { if (!m.probe || m.probe.sig0 !== sig && m.probe.phase === 'aim') m.probe = { sig0: sig, phase: 'aim', diff: 0 } }
    else if (m.probe && (m.st === 'tame' || (m.st === 'fly' && m.probe.foot == null))) {
      m.probe.phase = m.st; if (sig !== m.probe.sig0) { m.probe.diff++; m.probe.bad = sig }
      // 足先が球に当たる点（蹴る瞬間の姿勢の足先）と、球の出発点の距離（画面 px）
      if (m.st === 'fly' && m.probe.foot == null && m.pb) { const b = proj(cam, { x: sc.ball.x, y: BR, z: sc.ball.z }), sg = spot.mirror ? -1 : 1, hx = sh.base.x + KICK_FOOT.x * sh.s * sg, hy = sh.base.y - KICK_FOOT.y * sh.s; m.probe.foot = b ? Math.round(Math.hypot(b.x - hx, b.y - hy)) : 999 }
    }
  }
  function refPos(sc) { const u = { x: -sc.ball.x, z: -sc.ball.z }, l = Math.hypot(u.x, u.z); return { x: sc.ball.x + u.x / l * 6 + 2.5, z: sc.ball.z + u.z / l * 6 } }
  let shooterHead = () => null
  const defHead = i => M.match && M.match.defHead ? M.match.defHead(i) : null
  // キーパーの頭の上の「見」（選んだ技を何回見られたか）
  function drawMarks(cam, kh) {
    const m = M.match; if (!kh) return
    const id = m.sel >= 0 ? m.G.techs[m.sel].id : m.lastTech, flip = m.sel >= 0 ? m.flip : m.lastFlip
    if (!id) return
    const lv = HS.readLevel(m.G.marks, id, flip)
    const r = Math.max(8, kh.hr * 0.95)
    for (let i = 0; i < 3; i++) {
      const x = kh.head.x + (i - 1) * r * 2.3, y = kh.head.y - kh.hr - r * 1.6
      ctx.globalAlpha = i < lv ? 1 : 0.28
      ctx.fillStyle = i < lv ? '#fff' : 'rgba(0,0,0,.25)'; ctx.strokeStyle = '#e0322b'; ctx.lineWidth = Math.max(1.5, r * 0.18)
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#e0322b'; ctx.font = `400 ${Math.round(r * 1.3)}px ${getComputedStyle(document.body).getPropertyValue('--brush')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lang === 'ja' ? '見' : 'R', x, y + r * 0.08)
    }
    ctx.globalAlpha = 1
  }
  function placeFinger(cam) {
    finger.t += 1 / 60
    const k = (finger.t % 2.2) / 1.6, el = $('finger')
    if (k > 1) { el.style.opacity = 0; return }
    const b = proj(cam, { x: EDIT_BALL.x, y: BR, z: EDIT_BALL.z }), g = proj(cam, { x: 2.2, y: 1.5, z: 0 })
    if (!b || !g) return
    const x = lerp(b.x, g.x, k) + Math.sin(k * Math.PI) * W * 0.22, y = lerp(b.y, g.y, k) - Math.sin(k * Math.PI) * 30
    el.style.opacity = 1; el.style.left = x + 'px'; el.style.top = y + 'px'
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.beginPath()
    for (let i = 0; i <= 20; i++) { const kk = i / 20 * k; const xx = lerp(b.x, g.x, kk) + Math.sin(kk * Math.PI) * W * 0.22, yy = lerp(b.y, g.y, kk) - Math.sin(kk * Math.PI) * 30; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy) }
    ctx.stroke(); ctx.setLineDash([])
  }

  // ================= ループ
  function update(dt) {
    vt += dt
    fx.zoom += ((fx.zoomT || 1) - fx.zoom) * Math.min(1, dt * 6); if (!(M.mode === 'match' && M.match && (M.match.st === 'fly' || M.match.st === 'after' || M.match.st === 'intro'))) fx.zoomT = 1
    fx.shake = fx.shake > 0.3 ? fx.shake * 0.88 : 0; fx.flash = Math.max(0, fx.flash - dt * 2.5); fx.flashes = Math.max(0, fx.flashes - dt)
    fx.dark = M.mode === 'match' && M.match && M.match.st === 'tame' ? (M.match.t < 0.75 ? Math.min(1, fx.dark + dt * 5) : Math.max(0, fx.dark - dt * 4)) : Math.max(0, fx.dark - dt * 4)
    for (let i = fx.parts.length - 1; i >= 0; i--) { const p = fx.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.a += dt * 4; p.life -= dt; if (p.life <= 0 || p.y > H + 20) fx.parts.splice(i, 1) }
    if (bubT > 0) { bubT -= dt; if (bubT <= 0) bubble(null) }
    if (liveT > 0) { liveT -= dt; if (liveT <= 0) live(null) }
    if (M.mode === 'edit' && M.edit && M.edit.prev) M.edit.prev.t += dt
    for (let i = fx.words.length - 1; i >= 0; i--) { fx.words[i].t += dt; if (fx.words[i].t > fx.words[i].life) fx.words.splice(i, 1) }
    for (let i = fx.rings.length - 1; i >= 0; i--) { fx.rings[i].t += dt; if (fx.rings[i].t > 0.35) fx.rings.splice(i, 1) }
    // ヒットストップ: 当たった瞬間だけ試合の時間を止める（字と輪は動く）
    if (fx.stop > 0) { fx.stop -= dt; return }
    for (let i = fx.wp.length - 1; i >= 0; i--) { const q = fx.wp[i]; q.vy -= 9.8 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 0.02) { q.y = 0.02; q.vy = 0; q.vx *= 0.8; q.vz *= 0.8 } q.life -= dt; if (q.life <= 0) fx.wp.splice(i, 1) }
    if (M.mode === 'match' || (M.match && M.match.st === 'over')) updMatch(dt)
  }
  let last = performance.now(), acc = 0
  // 描画で例外が出てもループを止めない。?auto の時は画面に出す（実機の確認用）
  let errShown = 0
  function drawErr(e) { window.__drawErr = String(e && (e.stack || e.message) || e); try { ctx.restore() } catch (x) {} if (AUTO_Q && !errShown) { errShown = 1; const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:8px;right:8px;top:120px;z-index:999;background:#fff;color:#b00;font:12px/1.4 monospace;white-space:pre-wrap;padding:8px'; d.textContent = window.__drawErr; document.body.appendChild(d) } }
  function frame() {
    const n = performance.now(); let d = (n - last) / 1000; last = n
    if (d > 0.25) d = 0.25
    // 例外が出てもループは止めない（止まると試合が進まなくなる）
    const upd = () => { try { update(1 / 60) } catch (e) { drawErr(e) } }
    if (!dbgState.paused) { acc += d * dbgState.rate; while (acc >= 1 / 60) { upd(); acc -= 1 / 60 } }
    else if (dbgState.steps > 0) { const k = dbgState.steps; dbgState.steps = 0; for (let i = 0; i < k; i++) upd() }
    try { draw() } catch (e) { drawErr(e) }
    requestAnimationFrame(frame)
  }

  // ---------------- 起動
  $('bStart').onclick = () => { Snd.play('ok', { vol: 0.6 }); openEdit('title') }
  addEventListener('resize', () => { resize() })
  resize(); applyLang(); show('title')
  requestAnimationFrame(frame)
  // 読み込み画面: 字が届くか 2.5 秒で消す（遅い回線でも 12 秒で必ず消す）
  const lb = $('loadBar').firstElementChild; lb.style.width = '40%'
  const hideLoad = () => { const l = $('loading'); if (l.hidden) return; lb.style.width = '100%'; l.style.opacity = 0; l.style.pointerEvents = 'none'; setTimeout(() => { l.hidden = true; bgCache.clear() }, 350) }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lb.style.width = '80%'; setTimeout(hideLoad, 150) })
  setTimeout(hideLoad, 2500); setTimeout(hideLoad, 12000)

  // ---------------- 検証用の窓口
  window.hs = {
    M, techs: () => techs, HS,
    dbg: {
      pause() { dbgState.paused = true }, resume() { dbgState.paused = false }, step(n = 1) { dbgState.steps += n }, rate(r) { dbgState.rate = r },
      setTechs(list) { techs = list.slice(0, 4); techs.forEach((t, i) => t.id = t.id || 'd' + i); saveTechs() },
      bot(kind) { if (M.match) M.match.bot = kind; window.__hsBot = kind },
      start(seed, bot) { startMatch(seed); if (bot) M.match.bot = bot },
      goto(i) { const G = M.match.G; G.i = i; if (i >= HS.ATTACKS / 2) G.half = true; beginAttack() },
      edit() { openEdit('title') }, kick, choose: chooseCard, cam: kind => kind === 'edit' ? camFor(EDIT_BALL, 'edit') : (M.match.cam || camFor(sceneNow().ball, 'match')), probe: () => M.match && M.match.probe,
      end: () => endMatch(), G: () => M.match && M.match.G, setLeg: v => { M.match.G.leg = v; updateLed(); renderCards() },
      mode: () => M.mode, photo: ok => takePhoto(ok), photoErr: () => window.__photoErr, st: () => M.match && M.match.st, vt: () => vt,
    },
  }
  // 実機・シミュレーターの確認用（?auto=edit|sheet|match|end）。読み込み時に画面を進める
  const AUTO = Q.get('auto')
  if (AUTO) setTimeout(() => {
    $('bStart').click()
    const cam = camFor(EDIT_BALL, 'edit'), b = proj(cam, { x: 0, y: BR, z: -20 }), g = proj(cam, { x: 2.4, y: 1.4, z: 0 })
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }))
    let i = 0; const n = 24
    if (AUTO === 'edit') return
    ev('pointerdown', b.x, b.y)
    const tk = setInterval(() => {
      i++; const k = i / n; ev('pointermove', b.x + (g.x - b.x) * k + Math.sin(k * Math.PI) * W * 0.25, b.y + (g.y - b.y) * k - Math.sin(k * Math.PI) * 40)
      if (i >= n) { clearInterval(tk); ev('pointerup', g.x, g.y); if (AUTO === 'sheet') return
        setTimeout(() => { $('bSave').click(); const L = window.HSBots.BOT_TECHS.mix(); L[1].name = '三日月バナナ弾'; L[2].name = '流星ドロップ砲'; L[3].name = '地獄ローリング撃'; window.hs.dbg.setTechs([techs[0], L[1], L[2], L[3]]); window.hs.dbg.start(+(Q.get('seed') || 5), AUTO === 'aim' || AUTO === 'kick' ? null : 'mix'); if (AUTO === 'end') dbgState.rate = 6; if (Q.get('at')) { const G = M.match.G; G.i = +Q.get('at'); if (G.i >= HS.ATTACKS / 2) G.half = true; beginAttack() }
          if (AUTO === 'aim' || AUTO === 'kick') setTimeout(() => { chooseCard(+(Q.get('card') || 1)); if (Q.get('flip')) $('bFlip').click(); if (AUTO === 'kick') setTimeout(kick, 1200) }, 1500) }, 900) }
    }, 30)
  }, 1200)
  window.__hsReady = true
})()
