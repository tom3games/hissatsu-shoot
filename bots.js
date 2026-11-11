// 試合の bot（sim.mjs と、画面の自動プレイ・宣伝動画で使う）
// 技は3Dの曲線から作る（画面の線から作るのと同じ makeTech を通す）
const HS = (typeof window !== 'undefined' ? window : globalThis).HS
const BR = 0.11
function curve(fn, n = 72) { const a = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); const p = fn(t); a.push({ f: p[0], l: p[1] / 20, y: Math.max(BR, p[2]) }) } return a }
const T = {
  // [前(0..1.02), 横(m, 20m基準), 高さ(m)]
  lowCorner: () => HS.makeTech(curve(t => [t * 1.02, t * 3.1, BR + Math.sin(Math.PI * t) * 0.3]), 520, 'low'),
  lowCornerL: () => HS.makeTech(curve(t => [t * 1.02, -t * 3.0, BR]), 560, 'lowL'),
  highCorner: () => HS.makeTech(curve(t => [t * 1.02, t * 2.9, BR + t * 1.9 + Math.sin(Math.PI * t) * 0.6]), 480, 'high'),
  banana: () => HS.makeTech(curve(t => [t * 1.02, Math.sin(Math.PI * t) * 2.8 - t * t * t * 2.7, BR + Math.sin(Math.PI * t) * 1.4 + t * 0.6]), 640, 'banana'),
  bananaR: () => HS.makeTech(curve(t => [t * 1.02, -Math.sin(Math.PI * t) * 2.8 + t * t * t * 2.8, BR + Math.sin(Math.PI * t) * 0.6]), 600, 'bananaR'),
  dip: () => HS.makeTech(curve(t => [t * 1.02, t * 2.6 + Math.sin(Math.PI * t) * 1.2, BR + Math.sin(Math.PI * Math.min(1, t * 1.1)) * 3.4 + t * 1.6]), 760, 'dip'),
  zigzag: () => HS.makeTech(curve(t => [t * 1.02, Math.sin(t * Math.PI * 5) * 1.6 + t * 2.6, BR + Math.sin(Math.PI * t) * 0.6]), 900, 'zig'),
  loop: () => HS.makeTech(curve(t => { const a = t * Math.PI * 2; return [t * 1.02 - Math.sin(a) * 0.12, (1 - Math.cos(a)) * 2.4 + t * -2.8, BR + Math.sin(Math.PI * t) * 1.2] }, 96), 1200, 'loop'),
  muri: () => HS.makeTech(curve(t => t < 0.5 ? [t * 1.2, t * 8, BR + t * 2] : [0.6 + (t - 0.5) * 0.85, 4 - (t - 0.5) * 14, BR + 1]), 500, 'muri'),
  lob: () => HS.makeTech(curve(t => [t * 1.02, t * 1.5, BR + Math.sin(Math.PI * t) * 7 + t * 1.5]), 1100, 'lob'),
}
let uid = 0
const withId = a => a.map(t => { t.id = 'b' + (++uid); return t })
export const BOT_TECHS = {
  mix: () => withId([T.lowCorner(), T.banana(), T.dip(), T.bananaR()]),
  same: () => withId([T.lowCorner()]),
  straight3: () => withId([T.lowCorner(), T.lowCornerL(), T.highCorner()]),
  reckless: () => withId([T.loop(), T.zigzag(), T.muri(), T.lob()]),
  idle: () => withId([T.lowCorner()]),
  random: () => withId([T.lowCorner(), T.banana(), T.dip(), T.zigzag()]),
  human: seed => withId(humanTechs(seed)),
}
// 人が指で描いたような技（狙いがずれる・曲がりも高さもばらばら）
function humanTechs(seed = 1) {
  const r = HS.rng(seed * 977 + 13), out = []
  // 練習場の試し撃ちで枠に入らない線は、人も描き直す（10回まで）
  for (let k = 0, tries = 0; out.length < 4 && tries < 60; tries++) {
    const ex = (r() * 2 - 1) * 3.4, ey = 0.1 + r() * 2.3, bend = (r() * 2 - 1) * 3.5, lift = r() < 0.4 ? r() * 4 : r() * 1, wig = r() < 0.25 ? 1 + r() : 0
    const tech = HS.makeTech(curve(t => [t * 1.02, t * ex + Math.sin(Math.PI * t) * bend + Math.sin(t * Math.PI * 5) * wig, BR + Math.sin(Math.PI * t) * lift + t * ey]), 350 + r() * 700, 'h' + out.length)
    const tryIt = HS.simulateShot({ ball: { x: 0, y: 0, z: -20 }, defs: [] }, tech, false, 0, { noKeeper: true })
    if (tryIt.outcome === 'goal' || tries % 10 === 9) out.push(tech)
  }
  return out
}
export const TECHS = T
// 人がやりそうな選び方
export function botChoose(kind, G, seed, t0) {
  const c = botChoose0(kind, G, seed, t0)
  if (c && t0 != null) c.t0 = t0
  return c
}
function botChoose0(kind, G, seed, t0) {
  if (kind === 'idle') return null
  const sc = G.m.scenes[G.i]
  if (kind === 'same') return { id: G.techs[0].id, flip: false }
  if (kind === 'human') {   // 半分は通り道を見て選び、半分は気分で押す。反転はあまり使わない
    const r = HS.rng(seed * 31 + G.i * 7 + G.log.length * 3)
    if (r() < 0.5) { const t = G.techs[Math.floor(r() * G.techs.length)]; return { id: t.id, flip: r() < 0.15 } }
    let best = null
    for (const t of G.techs) { const hit = HS.pathHitsDef(sc, t, false, t0), lv = HS.readLevel(G.marks, t.id, false), e = hit * 10 + lv * 3 + r() * 4; if (!best || e < best.e) best = { e, id: t.id } }
    return { id: best.id, flip: false }
  }
  if (kind === 'random' || kind === 'reckless') { const r = HS.rng(seed * 31 + G.i * 7 + G.log.length); const t = G.techs[Math.floor(r() * G.techs.length)]; return { id: t.id, flip: r() < 0.5 } }
  // mix / straight3: 通り道にディフェンダーがいない・読まれていない・足が足りる、の順で選ぶ
  let best = null
  for (const t of G.techs) for (const flip of [false, true]) {
    const hit = HS.pathHitsDef(sc, t, flip, t0), lv = HS.readLevel(G.marks, t.id, flip)
    const afford = t.cost <= G.leg - (HS.ATTACKS - G.i - 1) * 8 ? 0 : 1
    const e = hit * 10 + lv * 3 + afford * 6 + t.cost * 0.02
    if (!best || e < best.e) best = { e, id: t.id, flip }
  }
  return { id: best.id, flip: best.flip }
}
if (typeof window !== 'undefined') window.HSBots = { BOT_TECHS, botChoose, TECHS }
