// 必殺シュートを描け！ の中身（画面に依存しない。Node の sim.mjs からも読む）
// 座標: x=横（m） y=高さ（m） z=ゴールへ向かう向き。ゴールラインは z=0、ゴールの中心は (0,0,0)
;(function (root) {
  'use strict'
  const GW = 7.32, GH = 2.44, BR = 0.11            // ゴールの幅・高さ・ボールの半径
  const HALF = GW / 2
  const D_EDIT = 20                                  // 技を描く練習場の距離
  const LEG_MAX = 100, LEG_HALF = 40                 // 足の体力（試合全体）とハーフタイムの回復
  const ATTACKS = 8, CLOCK = 12                      // 攻めの回数・1回の持ち時間（秒）
  const SPEED_BOOST = 1.6                            // 描いた速さから実際に飛ぶ速さへの倍率（v4）
  const COUNTER_FROM = 4                              // この攻め（0 始まり）から、守りに当てるとカウンターで失点
  const KS = 1.5                                     // キーパーの足の速さ（球を 1.6 倍にした分だけ上げる。v3 の勝ち具合に近づける）

  // ---- 乱数（同じ seed なら同じ試合）
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v
  const lerp = (a, b, t) => a + (b - a) * t
  const V = {
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }), add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    mul: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }), dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    len: a => Math.hypot(a.x, a.y, a.z), dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
  }

  // ---- カメラ（蹴る人の斜め後ろ・高めからゴールを見る）
  // W,H は画面の大きさ。ボールが画面の下 yb、クロスバーが上 yg に来るように角度と焦点を解く
  function makeCam(ball, W, H, opt = {}) {
    const g = { x: 0, y: 0, z: 0 }
    let ux = g.x - ball.x, uz = g.z - ball.z; const D = Math.hypot(ux, uz); ux /= D; uz /= D
    const u = { x: ux, y: 0, z: uz }
    const back = opt.back ?? 5.2, h = opt.h ?? 2.7, th = opt.pitch ?? 0.2
    const C = { x: ball.x - ux * back, y: h, z: ball.z - uz * back }
    const s = Math.sin(th), c = Math.cos(th)
    const F = { x: ux * c, y: -s, z: uz * c }, R = { x: uz, y: 0, z: -ux }, U = { x: ux * s, y: c, z: uz * s }
    const cam = { C, F, R, U, u, D, W, H, cx: W / 2, cy: H / 2, f: 800 }
    // 縦の位置合わせ: ボール中心を yb、クロスバー中央を yg に
    const yb = H * (opt.yb ?? 0.70), yg = H * (opt.yg ?? 0.30)
    const k = p => { const d = V.sub(p, C); return V.dot(d, U) / V.dot(d, F) }
    const kb = k({ x: ball.x, y: BR, z: ball.z }), kg = k({ x: 0, y: GH, z: 0 })
    cam.f = (yb - yg) / (kg - kb); cam.cy = yb + cam.f * kb
    return cam
  }
  // 画面の大きさに合わせてカメラの高さと角度を選ぶ（ゴールの幅が画面の 45〜60%）
  function fitCam(ball, W, H, opt = {}) {
    const D = Math.hypot(ball.x, ball.z)
    const want = W * clamp((opt.gw || 0.62) * Math.pow(18 / D, 0.3), 0.42, 0.88)
    let best = null
    for (let h = opt.hmin || 1.6; h <= (opt.hmax || 6); h += 0.2) for (let th = 0.02; th <= 0.42; th += 0.02) {
      const cam = makeCam(ball, W, H, { ...opt, h, pitch: th })
      if (!(cam.f > 0)) continue
      const a = proj(cam, { x: -HALF, y: 0, z: 0 }), b = proj(cam, { x: HALF, y: 0, z: 0 })
      if (!a || !b) continue
      const gw = Math.abs(b.x - a.x)
      // 焦点は縦の画角 40〜62 度
      const fov = 2 * Math.atan(H / 2 / cam.f) * 180 / Math.PI
      const fmin = opt.fovMin || 40, e = (gw - want) ** 2 + (fov < fmin ? (fmin - fov) * 400 : 0) + (fov > 64 ? (fov - 64) * 400 : 0) + h * 2 + (h > 4.4 && !opt.hmin ? 1e6 : 0)
      if (!best || e < best.e) best = { e, cam }
    }
    return best.cam
  }
  function proj(cam, p) {
    const d = V.sub(p, cam.C), zc = V.dot(d, cam.F)
    if (zc < 0.05) return null
    const s = cam.f / zc
    return { x: cam.cx + V.dot(d, cam.R) * s, y: cam.cy - V.dot(d, cam.U) * s, s, zc }
  }
  function ray(cam, sx, sy) {
    const a = (sx - cam.cx) / cam.f, b = (sy - cam.cy) / cam.f
    return { o: cam.C, d: { x: cam.F.x + cam.R.x * a - cam.U.x * b, y: cam.F.y + cam.R.y * a - cam.U.y * b, z: cam.F.z + cam.R.z * a - cam.U.z * b } }
  }

  // ---- 描いた線（画面の点）を3Dの軌道にする
  // 画面で見えている線＝ボールの通り道。奥行きは「地面に落ちていると見たときの奥行き」と「線の長さに比例した奥行き」の小さい方。
  // 地面より上に描いた分が高さになる（ボールの影でわかる）
  function strokeTo3D(cam, ball, pts, durMs) {
    const u = cam.u, D = cam.D
    let P = pts.slice()
    const bs = proj(cam, { x: ball.x, y: BR, z: ball.z })
    if (!P.length) return null
    if (Math.hypot(P[0].x - bs.x, P[0].y - bs.y) > 6) P.unshift({ x: bs.x, y: bs.y })
    else P[0] = { x: bs.x, y: bs.y }
    // 画面の長さで等間隔に取り直す
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y))
    const L = cum[cum.length - 1]
    if (L < 30) return null
    const N = 72, S = []
    for (let k = 0, j = 0; k < N; k++) {
      const t = k / (N - 1) * L; while (j < P.length - 2 && cum[j + 1] < t) j++
      const f = (t - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]); S.push({ x: lerp(P[j].x, P[j + 1].x, f), y: lerp(P[j].y, P[j + 1].y, f), s: t / L })
    }
    const fwd = p => (p.x - ball.x) * u.x + (p.z - ball.z) * u.z
    const ground = (sx, sy) => { const r = ray(cam, sx, sy); if (r.d.y >= -1e-4) return null; const t = -r.o.y / r.d.y; return { x: r.o.x + r.d.x * t, y: 0, z: r.o.z + r.d.z * t } }
    const atDepth = (sx, sy, a) => { const r = ray(cam, sx, sy); const dd = r.d.x * u.x + r.d.z * u.z; const a0 = (r.o.x - ball.x) * u.x + (r.o.z - ball.z) * u.z; const t = (a - a0) / dd; return { x: r.o.x + r.d.x * t, y: r.o.y + r.d.y * t, z: r.o.z + r.d.z * t } }
    // 線の終わりの奥行き: 地面に落ちていればそこ、ゴールより奥や空ならゴールライン
    const ge = ground(S[N - 1].x, S[N - 1].y)
    let aEnd = ge ? fwd(ge) : D + 0.4
    if (aEnd > D) aEnd = D + 0.4
    aEnd = Math.max(aEnd, 2)
    const out = []; let aPrev = 0
    for (const q of S) {
      const g = ground(q.x, q.y); const aG = g ? fwd(g) : Infinity
      let a = Math.min(aG, q.s * aEnd); a = Math.max(a, aPrev); aPrev = a
      let p = atDepth(q.x, q.y, a)
      if (p.y < BR) { p = { x: p.x, y: BR, z: p.z } }
      out.push(p)
    }
    out[0] = { x: ball.x, y: BR, z: ball.z }
    // ならす（手のふるえを消す。端は固定）
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < out.length - 1; i++) { const a = out[i - 1], b = out[i], c = out[i + 1]; out[i] = { x: (a.x + b.x * 2 + c.x) / 4, y: Math.max(BR, (a.y + b.y * 2 + c.y) / 4), z: (a.z + b.z * 2 + c.z) / 4 } }
    // ボールの向き基準（前・横・高さ）に直して、距離で割る
    const R = { x: u.z, z: -u.x }
    const rel = out.map(p => { const dx = p.x - ball.x, dz = p.z - ball.z; return { f: (dx * u.x + dz * u.z) / D, l: (dx * R.x + dz * R.z) / D, y: p.y } })
    // 画面で見て急に折り返している所（物理的に無理）。前後 4 点の向きが 160 度より大きく変わる所（来た道を戻る）
    let muri = -1
    for (let i = 4; i < N - 4 && muri < 0; i++) { const ax = S[i].x - S[i - 4].x, ay = S[i].y - S[i - 4].y, bx = S[i + 4].x - S[i].x, by = S[i + 4].y - S[i].y, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by); if (la < 4 || lb < 4) continue; if ((ax * bx + ay * by) / la / lb < Math.cos(160 * Math.PI / 180)) muri = i / (N - 1) }
    return makeTech(rel, durMs, '', muri)
  }

  // 正規化した点から技を作る（形の特徴・負担・無理な所を計算）
  function makeTech(rel, durMs, name, muriHint) {
    const path = toWorld(rel, { x: 0, y: 0, z: -D_EDIT }, false)
    let len = 0; for (let i = 1; i < path.length; i++) len += V.dist(path[i], path[i - 1])
    // 曲がり（3Dの折れ角）と無理な折り返し
    let turn = 0, muri = -1, maxTurn = 0, flips = 0, lastSide = 0
    const seg = []; { let acc = 0, last = path[0]; seg.push(0); for (let i = 1; i < path.length; i++) { acc += V.dist(path[i], last); last = path[i]; if (acc >= 0.9) { seg.push(i); acc = 0 } } if (seg[seg.length - 1] !== path.length - 1) seg.push(path.length - 1) }
    for (let k = 1; k < seg.length - 1; k++) {
      const a = V.sub(path[seg[k]], path[seg[k - 1]]), b = V.sub(path[seg[k + 1]], path[seg[k]])
      const la = V.len(a), lb = V.len(b); if (la < 0.05 || lb < 0.05) continue
      const ang = Math.acos(clamp(V.dot(a, b) / la / lb, -1, 1))
      turn += ang; maxTurn = Math.max(maxTurn, ang)
      if (ang > 2.6 && muri < 0 && muriHint === undefined) muri = seg[k]            // 3Dで150度より急に折り返すと無理（画面で見た折り返しは strokeTo3D で見る）
    }
    // 左右に振れた回数（ジグザグ）
    // 始点と終点を結ぶまっすぐな線からのずれ（曲がり・ジグザグを見る）
    const e = rel[rel.length - 1], dev = rel.map(p => p.l - (e.f ? p.f / e.f : 0) * e.l)
    for (let i = 1; i < dev.length; i++) { const d = dev[i] - dev[i - 1]; const sd = Math.abs(d) < 0.0015 ? 0 : Math.sign(d); if (sd && lastSide && sd !== lastSide) flips++; if (sd) lastSide = sd }
    const maxH = Math.max(...rel.map(p => p.y)), endH = e.y
    const maxL = Math.max(...dev.map(Math.abs)) * D_EDIT, endF = e.f
    const dur = clamp(durMs || 600, 120, 4000)
    const flight = clamp(dur / 1000 * 1.6, len / 30, len / 10)  // 速く描いた線ほど速い
    const speed = len / flight
    // 足の負担: 長い・曲がる・速い・高い ほど重い
    let cost = 5 + 8 * Math.max(0, len / D_EDIT - 1.03) + 2.6 * turn + 0.5 * Math.max(0, speed - 18) + 0.6 * Math.max(0, maxH - 3)
    cost = Math.round(clamp(cost, 5, 60))
    if (muriHint >= 0) muri = Math.round(muriHint * (path.length - 1))
    const t = { rel, len, turn, maxTurn, muri: muri >= 0 ? muri / (path.length - 1) : -1, flips, maxH, endH, maxL, endF, speed, flight, cost, dur }
    t.kind = kindOf(t)
    t.name = name || ''
    return t
  }
  function kindOf(t) {
    if (t.muri >= 0) return 'muri'
    if (t.turn > 5.2) return 'loop'
    if (t.flips >= 3 && t.maxL > 0.8) return 'zigzag'
    if (t.maxH > 4.5) return 'lob'
    if (t.maxL > 1.6) return 'curve'
    if (t.maxH < 0.5) return 'ground'
    if (t.speed > 27) return 'fast'
    if (t.speed < 13) return 'slow'
    return 'straight'
  }
  // 正規化した技を、ある位置のボールから撃つ3Dの点列にする
  function toWorld(rel, ball, flip) {
    let ux = -ball.x, uz = -ball.z; const D = Math.hypot(ux, uz); ux /= D; uz /= D
    const Rx = uz, Rz = -ux, sg = flip ? -1 : 1
    // 横は練習場（20m）と同じメートルで置く。距離が変わっても、狙ったゴールの隅にそのまま行く
    return rel.map(p => ({ x: ball.x + ux * p.f * D + Rx * p.l * D_EDIT * sg, y: p.y, z: ball.z + uz * p.f * D + Rz * p.l * D_EDIT * sg }))
  }

  // ---- 技の名前（大げさな候補を3つ）
  function techNames(t, lang, seed) {
    const N = root.HS_DATA.names[lang] || root.HS_DATA.names.ja
    const r = rng(seed || 7)
    const pick = a => a[Math.floor(r() * a.length)]
    const feats = [t.kind]
    if (t.speed > 25 && t.kind !== 'fast') feats.push('fast')
    if (t.maxH > 3.2 && t.kind !== 'lob') feats.push('lob')
    if (t.maxL > 2 && t.kind !== 'curve') feats.push('curve')
    if (t.speed < 14 && t.kind !== 'slow') feats.push('slow')
    const out = [], usedA = new Set(), usedB = new Set()
    for (let i = 0; out.length < 3 && i < 80; i++) {
      const a = N.pre[feats[i % feats.length]] || N.pre.straight, b = N.mid[feats[(i + 1) % feats.length]] || N.mid[t.kind] || N.mid.straight
      const pa = pick(a), pb = pick(b)
      if (i < 60 && (usedA.has(pa) || usedB.has(pb))) continue   // 候補ごとに頭と真ん中を変える
      const nm = lang === 'en' ? `${pa} ${pb} ${pick(N.suf)}` : `${pa}${pb}${pick(N.suf)}`
      if ([...nm].length <= (lang === 'en' ? 30 : 11) && !out.includes(nm)) { out.push(nm); usedA.add(pa); usedB.add(pb) }
    }
    return out
  }

  // ---- 試合の場面（seed で決まる。8回の攻め）
  function makeMatch(seed) {
    const r = rng(seed)
    // 1回目は1対1（練習）。残り7回に、バカな守り方4種（人間タワー・肩車の壁・砂場の山・組体操ピラミッド）を全部と、ふつうの守り3種を混ぜる
    const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
    const classic = shuf(['box', 'wall', 'angle', 'long', 'tall', 'sleep']).slice(0, ATTACKS - 1 - FUNNY.length)
    let rest = shuf([...FUNNY, ...classic])
    // バカな守りが3回続かないように並べ直す（毎回ちがう守りに見えるように）
    for (let g = 0; g < 20; g++) { let bad = -1; for (let i = 2; i < rest.length; i++) if (FUNNY.includes(rest[i]) && FUNNY.includes(rest[i - 1]) && FUNNY.includes(rest[i - 2])) { bad = i; break } if (bad < 0) break; rest = shuf(rest) }
    const seq = ['one', ...rest]
    const scenes = seq.map((ty, i) => makeScene(ty, r, i))
    // 珍しい出来事（試合に1つまで）
    const rare = { ref: r() < 0.45 ? 1 + Math.floor(r() * (ATTACKS - 1)) : -1, dog: r() < 0.3 ? 1 + Math.floor(r() * (ATTACKS - 1)) : -1, bento: r() < 0.35 ? 2 + Math.floor(r() * (ATTACKS - 2)) : -1 }
    if (rare.dog === rare.ref) rare.dog = -1
    if (rare.bento >= 0) scenes[rare.bento].bento = true
    if (rare.dog >= 0) scenes[rare.dog].dog = true
    // 相手は2点は取る（強豪）。いつ取るかは seed
    const o1 = 1 + Math.floor(r() * 3), oppAt = [o1, o1 + 2 + Math.floor(r() * (ATTACKS - o1 - 3))]
    const team = Math.floor(r() * root.HS_DATA.teams.ja.length)
    return { seed, scenes, rare, oppAt, team }
  }
  function makeScene(type, r, idx) {
    const sc = { type, idx, defs: [], ball: null }
    const side = r() < 0.5 ? -1 : 1
    const def = (x, z, kind = 'std') => { const d = { x, z, kind, x0: x, z0: z }; sc.defs.push(d); return d }
    // 2026-11-11 v5 本人「簡単すぎる。ディフェンスをもっと難しく」: 後の攻めほど守りが増え・広がり・横に歩く（歩く範囲は地面に出す）
    const lv = clamp((idx - 1) / 4, 0, 1)
    // 隅の番人: ゴールの隅へ向かう線の上に立つふつうの守り（隅を狙うだけでは入らなくなる）
    const guard0 = sd => { const f = 0.62 + r() * 0.12, p = along(sc.ball, f, sd * f * (2.6 + r() * 0.6)); def(p.x, p.z) }
    const guard = sd => { guard0(sd); if (idx >= 5) guard0(-sd) }   // 6本目からは両方の隅
    const walk = (d, a, per, ph) => { const D = Math.hypot(sc.ball.x, sc.ball.z); d.mv = { a, w: 2 * Math.PI / per, ph, rx: -sc.ball.z / D, rz: sc.ball.x / D }; return d }
    if (type === 'one') { sc.ball = { x: side * (r() * 3), y: 0, z: -(13 + r() * 3) } }
    else if (type === 'box') {
      sc.ball = { x: side * (2 + r() * 5), y: 0, z: -(16 + r() * 4) }
      const n = 2 + (r() < 0.4 ? 1 : 0) + (idx >= 4 ? 1 : 0)
      for (let i = 0; i < n; i++) { const f = 0.3 + r() * 0.45; const p = along(sc.ball, f, (r() * 2 - 1) * 2.8); def(p.x, p.z) }
      if (idx >= 5) guard(r() < 0.5 ? -1 : 1)
    } else if (type === 'wall') {
      sc.ball = { x: side * (r() * 6), y: 0, z: -(20 + r() * 4) }
      if (idx >= 4) guard(r() < 0.5 ? -1 : 1)
      const D = Math.hypot(sc.ball.x, sc.ball.z), f = 9.15 / D, off = (r() * 2 - 1) * 0.6
      const n = idx >= 4 ? 5 : 4
      for (let i = 0; i < n; i++) { const p = along(sc.ball, f, off + (i - (n - 1) / 2) * 0.62); def(p.x, p.z, 'wall') }
    } else if (type === 'angle') {
      sc.ball = { x: side * (10 + r() * 4), y: 0, z: -(7 + r() * 5) }
      const p = along(sc.ball, 0.45, (r() * 2 - 1) * 1.2); def(p.x, p.z)
      if (idx >= 4) { const q = along(sc.ball, 0.75, (r() * 2 - 1) * 1.5); def(q.x, q.z) }
    } else if (type === 'long') {
      sc.ball = { x: side * (r() * 4), y: 0, z: -(25 + r() * 3) }
      for (let i = 0; i < 2; i++) { const p = along(sc.ball, 0.35 + i * 0.25, (r() * 2 - 1) * 3); def(p.x, p.z) }
      if (idx >= 4) guard(r() < 0.5 ? -1 : 1)
    } else if (type === 'tall') {
      sc.ball = { x: side * (r() * 5), y: 0, z: -(17 + r() * 4) }
      const p = along(sc.ball, 0.4 + r() * 0.15, (r() * 2 - 1) * 0.5); def(p.x, p.z, 'tall')
      const sd = r() < 0.5 ? -1 : 1, q = along(sc.ball, 0.65, sd * (2 + r() * 1.5)); def(q.x, q.z)
      if (idx >= 4) guard(-sd)
    } else if (type === 'tower') {        // 人間タワー（3人重ね。細くて高い柱）
      sc.ball = { x: side * (r() * 4), y: 0, z: -(16 + r() * 4) }
      const f = 0.42 + r() * 0.15, sd = r() < 0.5 ? -1 : 1, ph = r() * Math.PI * 2
      const p = along(sc.ball, f, (r() * 2 - 1) * 0.45), tw = def(p.x, p.z, 'tower')
      if (idx >= 4) guard(sd); else { const q = along(sc.ball, 0.7, sd * (2.3 + r() * 1.2)); def(q.x, q.z) }
      if (idx >= 3) walk(tw, 1.2 + 0.9 * lv, 3.0 - 0.6 * lv, ph)          // タワーごと横に歩く
      if (idx >= 5) { const p2 = along(sc.ball, f - 0.08, -sd * 1.9); walk(def(p2.x, p2.z, 'tower'), 1.0 + 0.6 * lv, 3.0 - 0.6 * lv, ph + Math.PI) }   // 2本目（逆の向きに歩く）
    } else if (type === 'kata') {         // 肩車の壁（下の人は上の人に目をふさがれている）
      sc.ball = { x: side * (r() * 5), y: 0, z: -(19 + r() * 4) }
      const D = Math.hypot(sc.ball.x, sc.ball.z), f = 9.15 / D, off = (r() * 2 - 1) * 0.7, n = (r() < 0.35 ? 3 : 2) + (idx >= 4 ? 1 : 0), ph = r() * Math.PI * 2
      for (let i = 0; i < n; i++) { const p = along(sc.ball, f, off + (i - (n - 1) / 2) * 0.92), d = def(p.x, p.z, 'kata'); if (idx >= 3) walk(d, 0.8 + 0.7 * lv, 3.2 - 0.6 * lv, ph) }
      if (idx >= 4) guard(r() < 0.5 ? -1 : 1)   // 上の人の指示で、壁ごと横歩き
    } else if (type === 'sand') {         // 砂場で山を作っている人（低い山。ゴロは埋まる、浮かせれば越える）
      sc.ball = { x: side * (r() * 4), y: 0, z: -(16 + r() * 4) }
      const f = 0.36 + r() * 0.12, lat = (r() * 2 - 1) * 0.35, sd = r() < 0.5 ? -1 : 1
      const p = along(sc.ball, f, lat), mo = def(p.x, p.z, 'mound'); mo.w = 1.0 + 0.6 * lv    // 後の攻めほど山が大きい
      const b = along(sc.ball, f, lat + sd * (mo.w + 0.35)); def(b.x, b.z, 'squat')
      const q = along(sc.ball, 0.7, -sd * (1.8 + r() * 1.2)); def(q.x, q.z)
      if (idx >= 5) { const p2 = along(sc.ball, f + 0.05, lat - sd * (mo.w + 1.0)); def(p2.x, p2.z, 'mound').w = 0.9 }
      if (idx >= 4) guard(sd)   // 2つ目の山
    } else if (type === 'pyr') {          // 組体操のピラミッド（3-2-1。真ん中ほど高い）
      sc.ball = { x: side * (r() * 4), y: 0, z: -(18 + r() * 4) }
      const p = along(sc.ball, 0.45 + r() * 0.1, (r() * 2 - 1) * 0.6), py = def(p.x, p.z, 'pyr')
      if (idx >= 3) walk(py, 0.9 + 0.8 * lv, 3.4 - 0.6 * lv, r() * Math.PI * 2)   // ピラミッドのまま横に這う
      if (idx >= 4) guard(r() < 0.5 ? -1 : 1)
    } else if (type === 'sleep') {
      sc.ball = { x: side * (r() * 4), y: 0, z: -(17 + r() * 3) }
      const p = along(sc.ball, 0.4, (r() * 2 - 1) * 0.8); def(p.x, p.z, 'sleep')
      const q = along(sc.ball, 0.62, (r() * 2 - 1) * 2.5); def(q.x, q.z, 'spin')
      if (idx >= 4) guard(r() < 0.5 ? -1 : 1)
    }
    // 蹴った線に寄せる（作戦ボードを読んでいる）。v=寄る速さ m/秒・L=寄れる幅。眠っている人・砂山・しゃがんだ人は動かない
    // 序盤（1〜3本目）は v4 と同じ（ふつうの守りだけ少し寄る）。4本目からはバカな守りも寄り、後ほど速く広い
    for (const d of sc.defs) {
      const k = DEF_KIND[d.kind]
      if (d.kind === 'sleep' || d.kind === 'mound' || d.kind === 'squat') continue
      const v = k.funny ? (idx >= 3 ? 3.0 + 2.0 * lv : 0) : (k.react || 0.8) * (1 + 1.3 * lv), L = k.funny ? 1.0 + 1.1 * lv : d.kind === 'wall' ? 0.5 + 0.6 * lv : 1.4 + 0.9 * lv
      if (v > 0) d.lg = { v, L }
    }
    return sc
  }
  const LUNGE_DELAY = 0.12
  // 守りの今の位置（τ は攻めが始まってからの秒。歩かない守りはその場）
  // 線の上で、守り d と同じ深さ（蹴る向きの距離）にある点
  function pointAtDepth(path, ball, u, d) {
    const dep = (d.x0 - ball.x) * u.x + (d.z0 - ball.z) * u.z
    let best = path[path.length - 1], bd = Infinity
    for (const p of path) { const e = Math.abs((p.x - ball.x) * u.x + (p.z - ball.z) * u.z - dep); if (e < bd) { bd = e; best = p } }
    return best
  }
  function defAt(d, tau) {
    const x0 = d.x0 ?? d.x, z0 = d.z0 ?? d.z
    if (!d.mv) return { x: x0, z: z0 }
    const o = d.mv.a * Math.sin(d.mv.w * tau + d.mv.ph)
    return { x: x0 + d.mv.rx * o, z: z0 + d.mv.rz * o }
  }
  function along(ball, f, lat) {
    let ux = -ball.x, uz = -ball.z; const D = Math.hypot(ux, uz); ux /= D; uz /= D
    return { x: ball.x + ux * f * D + uz * lat, z: ball.z + uz * f * D - ux * lat }
  }
  const DEF_KIND = { std: { reach: 1.85, jump: 2.45, w: 0.42, react: 2.2 }, wall: { reach: 1.85, jump: 2.4, w: 0.36, react: 0 }, tall: { reach: 3.1, jump: 3.5, w: 0.4, react: 1.2 }, sleep: { reach: 0.45, jump: 0.45, w: 1.0, react: 0 }, spin: { reach: 1.6, jump: 1.6, w: 0.95, react: 1.4 },
    // バカな守り（動かない・跳ばない）。tower=3人重ね 4.7m、kata=肩車 2.55m、mound=砂山（ドーム 0.72m）、squat=しゃがんで山を作る人、pyr=3-2-1 のピラミッド
    tower: { reach: 4.7, jump: 4.7, w: 0.42, react: 0, nj: 1, funny: 1 }, kata: { reach: 2.55, jump: 2.55, w: 0.45, react: 0, nj: 1, funny: 1 },
    mound: { reach: 0.72, jump: 0.72, w: 1.0, react: 0, nj: 1, dome: 1, funny: 1 }, squat: { reach: 1.0, jump: 1.0, w: 0.38, react: 0, nj: 1, funny: 1 },
    pyr: { reach: 3.45, jump: 3.45, w: 1.38, react: 0, nj: 1, pyr: 1, funny: 1 } }
  const FUNNY = ['tower', 'kata', 'sand', 'pyr']
  const PYR = [[-0.85, 0], [0, 0], [0.85, 0], [-0.42, 0.8], [0.42, 0.8], [0, 1.6]]   // ピラミッドの各人の [横, 足の高さ]
  // 球（中心 b・半径 BR）が守りの形に当たるか。u は蹴る向き（単位）。top は跳んだ分を足した高さ
  function hitShape(d, k, b, top, u, extra = 0) {
    const dx = b.x - d.x, dz = b.z - d.z, kw = (d.w || k.w) + extra
    if (k.pyr) {
      const dep = dx * u.x + dz * u.z, lat = Math.abs(dx * u.z - dz * u.x)
      if (Math.abs(dep) > 0.4 + BR) return false
      const h = lat < 0.42 + BR ? 3.45 : lat < 0.85 + BR ? 1.75 : lat < 1.27 + BR ? 0.95 : -1
      return b.y - BR < h
    }
    const hz = Math.hypot(dx, dz)
    if (k.dome) { if (hz > kw + BR * 0.3) return false; const h = k.reach * (1 - Math.min(1, (hz / kw) ** 2)); return b.y - BR < h }
    return hz < kw + BR && b.y < top
  }

  // ---- キーパーの読み（同じ技を使うほど読まれる）
  // mark[id] は 0〜3。0=反応が遅い 1=途中から 2=蹴った瞬間に読む 3=見切った（先に行き先へ動いている）
  function readLevel(marks, id, flip) { const m = marks[id] || [0, 0]; return Math.min(3, Math.floor(m[flip ? 1 : 0] + 1e-6)) }
  function addMark(marks, id, flip, ids) {
    for (const k of ids) { if (k === id) continue; const m = marks[k] || (marks[k] = [0, 0]); m[0] = Math.max(0, m[0] - 0.5); m[1] = Math.max(0, m[1] - 0.5) }
    const m = marks[id] || (marks[id] = [0, 0]); m[flip ? 1 : 0] += 0.75; m[flip ? 0 : 1] += 0.35
  }

  // ---- 1本のシュートを最後まで計算する（決定的。再生はこの結果をなぞる）
  // 返り値: frames（60Hz の ball/keeper/defs）、outcome、tEnd、goalT など
  function simulateShot(sc, tech, flip, level, opt = {}) {
    const dt = 1 / 60
    const ball0 = { x: sc.ball.x, y: BR, z: sc.ball.z }
    const path = toWorld(tech.rel, ball0, flip)
    let ux = -ball0.x, uz = -ball0.z; const D = Math.hypot(ux, uz)
    const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + V.dist(path[i], path[i - 1]))
    const plen = cum[cum.length - 1]
    // 練習場（20m）で描いた速さを、その場の距離に合わせる
    // 2026-11-10 v4: 球が遅いと言われた。描いた速さ（足の負担や技名に使う値）はそのまま、飛ぶ速さだけ 1.6 倍（毎秒 16〜48m）
    const speed = shotSpeed(sc, tech)
    const t0 = opt.t0 || 0   // 球が足を離れる時刻（攻めが始まってからの秒）。歩く守りの位置はこの時刻から数える
    const un = { x: ux / D, z: uz / D }
    let near = null   // バカな守りのすぐ横を抜けた（ひぃっ）
    const muriS = tech.muri >= 0 ? tech.muri * plen : Infinity
    const at = s => { let j = 0; while (j < cum.length - 2 && cum[j + 1] < s) j++; const f = clamp((s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1); return { x: lerp(path[j].x, path[j + 1].x, f), y: lerp(path[j].y, path[j + 1].y, f), z: lerp(path[j].z, path[j + 1].z, f) } }
    // ゴールラインを横切る所（技の線の上で）
    let cross = null; for (let i = 1; i < path.length; i++) if (path[i - 1].z < 0 && path[i].z >= 0) { const f = -path[i - 1].z / (path[i].z - path[i - 1].z); cross = { x: lerp(path[i - 1].x, path[i].x, f), y: lerp(path[i - 1].y, path[i].y, f), s: lerp(cum[i - 1], cum[i], f) }; break }
    const K = { x: clamp(sc.ball.x * 0.12, -1.2, 1.2), y: 0, z: -0.5, vx: 0, dive: 0, diveDir: 0, react: false, target: null }
    if (sc.bento) level = Math.min(level, 0)
    // 見切った: 蹴る前から技の行き先へ寄っている
    if (level >= 3 && cross) { K.x = clamp(cross.x * 0.85, -HALF + 0.3, HALF - 0.3); K.target = { x: cross.x, y: cross.y } }
    // 最初の攻めのキーパーはあくびをしていて、読まれていなければ動かない
    const reactAt = sc.idx === 0 && level === 0 ? Infinity : [0.75, 0.45, 0, 0][level] * Math.max(plen, 1)
    // 前半は相手のキーパーが弱く、後半ほど強い（最初の攻めは決まりやすい）
    // 読んだ（見が2つ以上）キーパーは場面に関係なく本気
    const dif = level >= 2 || sc.idx == null ? 1 : sc.idx === 0 ? 0.2 : 0.6 + 0.4 * Math.min(1, sc.idx / 7)
    const defs = sc.defs.map(d => ({ ...d, y: 0, jump: 0, lo: 0, k: DEF_KIND[d.kind], pl: d.lg ? pointAtDepth(path, ball0, un, d) : null }))
    let hitKind = null
    const frames = []
    let s = 0, t = 0, b = { ...ball0 }, vel = null, outcome = null, hitBy = -1, goalT = -1, onPath = true, muriT = -1, bounces = 0, refT = -1
    const tooLong = 9
    while (t < tooLong) {
      t += dt
      // ボール
      if (onPath) {
        s += speed * dt
        if (s >= muriS) { onPath = false; muriT = t; const p = at(muriS), q = at(Math.max(0, muriS - 0.4)); b = p; vel = V.mul(V.sub(p, q), 0.15 / 0.4 * speed / Math.max(1, speed)); vel.y = 1.5; outcome = outcome || null }
        else if (s >= plen) { onPath = false; const p = at(plen), q = at(plen - 0.3); b = p; vel = V.mul(V.sub(p, q), speed / 0.3) }
        else { const p = at(s), q = at(Math.max(0, s - 0.3)); vel = V.mul(V.sub(p, q), speed / Math.max(0.05, Math.min(0.3, s))); b = p }
      } else {
        vel.y -= 9.8 * dt; b = V.add(b, V.mul(vel, dt))
        if (b.y < BR) { b.y = BR; if (vel.y < -1) { vel.y = -vel.y * 0.45; bounces++; vel.x *= 0.85; vel.z *= 0.85 } else { vel.y = 0; vel.x *= 0.992; vel.z *= 0.992 } }
        if (muriT > 0) { vel.x *= 0.96; vel.z *= 0.96 }
      }
      const progress = onPath ? s : plen + 1
      // キーパー
      if (!outcome) {
        if (!K.react && (progress >= reactAt || level >= 2)) {
          K.react = true
          if (level >= 2 && cross) K.target = { x: cross.x, y: cross.y }
        }
        if (K.react) {
          // 0〜1段: いまの球の向きをまっすぐ伸ばしてゴールラインを予想する（曲がる球にだまされる）
          if ((level === 1 || !K.target) && !(level === 0 && K.locked)) { if (vel && vel.z > 0.5) { K.locked = true; const tt = -b.z / vel.z; K.target = { x: b.x + vel.x * tt, y: b.y + vel.y * tt - 4.9 * tt * tt } } }
          if (K.target) {
            const tx = clamp(K.target.x, -HALF - 0.5, HALF + 0.5), dx = tx - K.x, mv = 2.4 * KS * dif * dt
            K.x += clamp(dx, -mv, mv)
            const eta = vel && vel.z > 0.3 ? -b.z / vel.z : 9
            if (!K.dive && eta < 0.36 && Math.abs(dx) > 0.45) { K.dive = 1e-6; K.diveDir = Math.sign(dx) }
          }
        }
        if (K.dive) { K.dive = Math.min(1, K.dive + dt * 3.2); if (K.dive < 1 && K.target && (K.target.x - K.x) * K.diveDir > 0) K.x += K.diveDir * 3.0 * KS * dif * dt }
        // キーパーに当たったか（ゴールの少し手前で）
        if (b.z > -1.2 && b.z < 0.2 && !opt.noKeeper) {
          const reachX = (K.dive ? 0.85 : 0.55) * (0.6 + 0.4 * dif), reachY = K.dive ? 2.0 : 2.35
          const dx = Math.abs(b.x - K.x), lowDive = 0
          if (dx < reachX + lowDive && b.y < reachY + (K.dive ? 0 : 0.1) && !(K.dive && b.y > 1.6 && dx > 1.2)) { outcome = 'save'; hitBy = -2 }
        }
        // ディフェンダー
        for (let i = 0; i < defs.length && !outcome; i++) {
          const d = defs[i], k = d.k
          if (d.mv && !d.lg) { const p = defAt(d, t0 + t); d.x = p.x; d.z = p.z }
          if (d.lg && !(muriT > 0)) {   // 線が自分の深さを通る横へ寄る（下書きの印はこの寄りまで入れて出す）
            const bp = d.mv ? defAt(d, t0 + t) : { x: d.x0, z: d.z0 }
            const tgt = (d.pl.x - bp.x) * un.z * 1 + (d.pl.z - bp.z) * -un.x
            if (t > LUNGE_DELAY) d.lo = clamp(d.lo + clamp(tgt - d.lo, -d.lg.v * dt, d.lg.v * dt), -d.lg.L, d.lg.L)
            d.x = bp.x + un.z * d.lo; d.z = bp.z - un.x * d.lo
          }
          const hz = Math.hypot(b.x - d.x, b.z - d.z)
          if (hz < 2.2 && b.y > 1.4 && b.y < k.jump + 0.4 && d.kind !== 'sleep' && !k.nj) d.jump = Math.min(1, d.jump + dt * 5)
          else d.jump = Math.max(0, d.jump - dt * 3)
          const top = lerp(k.reach, k.jump, d.jump)
          if (hitShape(d, k, b, top, un)) { outcome = 'block'; hitBy = i; hitKind = d.kind }
          else if (k.funny && !k.dome && !near && hz < (d.w || k.w) + 0.9 && b.y < k.reach + 0.8) near = { i, t }
        }
        // ゴールライン
        if (b.z >= 0 && !outcome) {
          const inX = Math.abs(b.x) < HALF - BR, inY = b.y < GH - BR
          if (inX && inY) { outcome = muriT > 0 ? 'goal' : 'goal'; goalT = t }
          else if (Math.abs(Math.abs(b.x) - HALF) < 0.18 && b.y < GH + 0.1 || Math.abs(b.y - GH) < 0.16 && Math.abs(b.x) < HALF + 0.1) outcome = 'post'
          else outcome = 'miss'
        }
        if (muriT > 0 && !outcome && t - muriT > 1.6) outcome = 'muri'
        if (!onPath && !outcome && Math.hypot(vel.x, vel.z) < 0.6 && b.y <= BR + 0.01) outcome = muriT > 0 ? 'muri' : 'short'
        if (outcome) {
          // 当たった後の跳ね返り
          if (outcome === 'save') { if (opt.catchIt !== false && (!K.dive || Math.abs(b.y - 1) < 0.8)) { vel = { x: 0, y: 0, z: 0 } } else vel = { x: vel.x * -0.2, y: 3, z: -Math.abs(vel.z) * 0.3 } }
          else if (outcome === 'block' && hitKind === 'mound') vel = { x: vel.x * 0.06, y: 0.8, z: vel.z * 0.05 }   // 砂に埋まる
          else if (outcome === 'block' && (hitKind === 'tower' || hitKind === 'pyr')) vel = { x: vel.x * 0.25 + (b.x > defs[hitBy].x ? 2.5 : -2.5), y: 5.5, z: -Math.abs(vel.z) * 0.45 }
          else if (outcome === 'block') vel = { x: vel.x * 0.3 + 1.5, y: 4, z: -Math.abs(vel.z) * 0.35 }
          else if (outcome === 'post') vel = { x: -vel.x * 0.4, y: vel.y * 0.3 + 1, z: -Math.abs(vel.z) * 0.5 }
          onPath = outcome === 'goal' ? onPath : false
          if (outcome === 'goal' && !onPath && vel.z < 4) vel.z = 6
        }
      }
      if (outcome === 'goal' && onPath && s >= plen) onPath = false
      if (outcome === 'goal' && b.z > 1.9) { b.z = 1.9; vel = { x: vel.x * 0.1, y: Math.min(0, vel.y), z: 0 } }   // ネットに刺さる
      if (outcome === 'save' && hitBy === -2 && vel && V.len(vel) < 0.01) b = { x: K.x + 0.3 * (K.diveDir || 0), y: K.dive ? 0.5 : 1.0, z: -0.45 }
      frames.push({ b: { ...b }, k: { x: K.x, dive: K.dive, dir: K.diveDir }, d: defs.map(d => [d.x, d.jump, d.z]) })
      const after = outcome ? (frames.outT == null ? (frames.outT = t) : frames.outT) : null
      if (outcome && t - after > (outcome === 'goal' ? 1.2 : 1.0)) break
      if (!outcome && t > 7) { outcome = 'short'; frames.outT = t }
    }
    if (near && hitBy === near.i) near = null
    return { frames, outcome: outcome || 'short', goalT, muriT, cross, plen, speed, level, outT: frames.outT || t, dur: t, hitBy, hitKind, near, lunge: hitBy >= 0 ? Math.abs(defs[hitBy].lo || 0) : 0 }
  }

  // 技の線がその場のディフェンダーに当たりそうか（画面の下書きと bot の判断に使う。反応や跳びは見ない）
  function pathHitsDef(sc, tech, flip, t0) {
    const path = toWorld(tech.rel, { x: sc.ball.x, y: BR, z: sc.ball.z }, flip)
    return pathHitInfo(sc, tech, flip, path, t0).n
  }
  function shotSpeed(sc, tech) { return Math.min(48, tech.speed * SPEED_BOOST * Math.sqrt(Math.hypot(sc.ball.x, sc.ball.z) / D_EDIT)) }
  // 通り道が最初に守りに当たる点（画面の下書きに「ぶつかる」印を出す）。少し余裕を見て判定する
  // t0 を渡すと、歩く守りは「いま蹴ったら球が来る時の位置」で調べる（画面の下書きの印がその通りに点いたり消えたりする）
  function pathHitInfo(sc, tech, flip, path, t0) {
    path = path || toWorld(tech.rel, { x: sc.ball.x, y: BR, z: sc.ball.z }, flip)
    const D = Math.hypot(sc.ball.x, sc.ball.z), u = { x: -sc.ball.x / D, z: -sc.ball.z / D }
    let n = 0, first = -1, cum = null, sp = 1
    sp = shotSpeed(sc, tech); cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + V.dist(path[i], path[i - 1]))
    for (const d of sc.defs) {
      const k = DEF_KIND[d.kind], ex = k.pyr || k.dome ? 0.1 : 0.24
      for (let i = 0; i < path.length; i++) {
        const p = path[i], ti = cum[i] / sp
        let q = d.mv ? defAt(d, (t0 ?? 0) + ti) : { x: d.x0 ?? d.x, z: d.z0 ?? d.z }
        // 寄せ: 蹴ってから LUNGE_DELAY 秒後に、線の方へ v の速さで L まで寄れる
        if (d.lg) { const s = Math.min(d.lg.L, d.lg.v * Math.max(0, ti - LUNGE_DELAY)), lat = (p.x - q.x) * u.z - (p.z - q.z) * u.x, o = clamp(lat, -s, s); q = { x: q.x + u.z * o, z: q.z - u.x * o } }
        if (hitShape({ ...d, x: q.x, z: q.z }, k, p, k.reach + 0.2, u, ex)) { n++; if (first < 0 || i < first) first = i; break }
      }
    }
    return { n, first, path }
  }

  // ---- 1試合の進行（画面とは別に、bot でも回せる）
  function newGame(seed, techs) {
    const m = makeMatch(seed)
    return { m, techs, i: 0, leg: LEG_MAX, us: 0, them: 0, marks: {}, log: [], used: {}, refUsed: false, half: false }
  }
  // 1回の攻めの結果を決める（choice: {id, flip} か null=時間切れ）
  function playAttack(G, choice) {
    const sc = G.m.scenes[G.i]
    const ids = G.techs.map(t => t.id)
    let res
    if (!choice) { res = { outcome: 'timeout' } }
    else {
      const tech = G.techs.find(t => t.id === choice.id)
      const level = readLevel(G.marks, tech.id, choice.flip)
      if (tech.cost > G.leg) { res = { outcome: 'fall', level, cost: tech.cost }; G.leg = 0 }
      else {
        G.leg -= tech.cost
        res = simulateShot(sc, tech, choice.flip, level, { t0: choice.t0 || 0 })
        res.cost = tech.cost
        // 審判が一番うまい（ブロックされた球を審判が拾い、リフティングして返す。もう一回撃てる）
        if (res.outcome === 'block' && G.m.rare.ref >= 0 && G.i >= G.m.rare.ref && !G.refUsed) { G.refUsed = true; res.outcome = 'ref'; G.leg += Math.round(tech.cost / 2) }
      }
      addMark(G.marks, tech.id, choice.flip, ids)
      G.used[tech.id] = (G.used[tech.id] || 0) + 1
      res.tech = tech.id; res.flip = choice.flip
    }
    res.scene = G.i
    if (res.outcome === 'goal') G.us++
    // 後半（5本目から）は守りに当てると、こぼれ球からカウンターで失点（2026-11-11 v5）
    if (res.outcome === 'block' && G.i >= COUNTER_FROM) { G.them++; res.counter = true }
    if (res.outcome === 'fall' || res.outcome === 'timeout') G.them++   // 転んだ・何もしない＝カウンターで失点
    const again = res.outcome === 'ref'
    G.log.push(res)
    if (!again) {
      if (G.m.oppAt.includes(G.i)) { G.them++; res.oppGoal = true }
      G.i++
      if (G.i === ATTACKS / 2 && !G.half) { G.half = true; G.leg = Math.min(LEG_MAX, G.leg + LEG_HALF); res.half = true }
    }
    res.over = G.i >= ATTACKS
    return res
  }
  // 結果の段位（新聞の見出しの種類）
  function grade(G) {
    const d = G.us - G.them, kinds = Object.keys(G.used).length
    const goals = G.log.filter(r => r.outcome === 'goal')
    const gk = new Set(goals.map(r => r.tech)).size
    let rank
    if (!G.log.some(r => r.outcome !== 'timeout')) rank = 'idle'
    else if (d >= 3 && gk >= 2) rank = 'legend'
    else if (d >= 1) rank = 'win'
    else if (d === 0) rank = 'draw'
    else if (d >= -2) rank = 'lose'
    else rank = 'crush'
    // 点（1本ごとの得点＋技の種類）
    const score = G.us * 100 - G.them * 40 + gk * 30 + kinds * 5
    return { rank, d, kinds, goalKinds: gk, score }
  }

  root.HS = { GW, GH, BR, HALF, D_EDIT, LEG_MAX, LEG_HALF, ATTACKS, CLOCK, rng, clamp, lerp, V, makeCam, fitCam, proj, ray, strokeTo3D, makeTech, toWorld, techNames, makeMatch, simulateShot, pathHitsDef, pathHitInfo, hitShape, FUNNY, PYR, defAt, shotSpeed, COUNTER_FROM, SPEED_BOOST, readLevel, addMark, newGame, playAttack, grade, DEF_KIND, along }
})(typeof window !== 'undefined' ? window : globalThis)
