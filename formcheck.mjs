// バカな守り（人間タワー・肩車の壁・砂場の山・組体操ピラミッド）の検査。ブラウザを開かない。node formcheck.mjs
// 1) 守りの真ん中を狙った線は、その守りに当たって止まる（block・hitKind がその守り）
// 2) 同じ場面で、よける線（曲げる・浮かせる・反対の隅）のどれかは決まる（どの場面にも抜け道がある）
// 3) 砂山は「ゴロは埋まる・浮かせれば越える」、ピラミッドは「端は低い」
// 4) 試合ごとに4種が全部出て、3回続けて出ない
import './data.js'
import './logic.js'
import { TECHS } from './bots.js'
const HS = globalThis.HS
const BR = 0.11
const curve = (fn, n = 72) => { const a = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); const p = fn(t); a.push({ f: p[0], l: p[1] / 20, y: Math.max(BR, p[2]) }) } return a }
// 守り d をまっすぐ狙う線（高さ h で d を通り、ゴールの中へ）
function aimAt(sc, d, h) {
  const D = Math.hypot(sc.ball.x, sc.ball.z), u = { x: -sc.ball.x / D, z: -sc.ball.z / D }, R = { x: u.z, z: -u.x }
  const dx = d.x - sc.ball.x, dz = d.z - sc.ball.z, f = (dx * u.x + dz * u.z) / D, lat = dx * R.x + dz * R.z
  return HS.makeTech(curve(t => [t * 1.02, lat * (t / f), BR + Math.sin(Math.PI * Math.min(1, t / f / 2)) * (h - BR) * (t < f * 2 ? 1 : 0)]), 600, 'aim')
}
// よける線の候補（左右・高さ・曲がりを振る）
function dodgers() {
  const out = []
  for (const ex of [-3, -2.2, -1.2, 1.2, 2.2, 3]) for (const bend of [-3.5, -2, 0, 2, 3.5]) for (const lift of [0, 1.2, 3.2, 4.2]) for (const ey of [0.2, 1.4])
    out.push(HS.makeTech(curve(t => [t * 1.02, t * ex + Math.sin(Math.PI * t) * bend, BR + Math.sin(Math.PI * t) * lift + t * ey]), 600, `d${ex},${bend},${lift},${ey}`))
  return out
}
const DODGE = dodgers()
const fails = [], stats = { tower: [0, 0, 0], kata: [0, 0, 0], sand: [0, 0, 0], pyr: [0, 0, 0] }
let matches = 0, allFour = 0, threeInRow = 0
for (let seed = 1; seed <= 400; seed++) {
  const m = HS.makeMatch(seed * 131)
  matches++
  const types = m.scenes.map(s => s.type)
  if (HS.FUNNY.every(t => types.includes(t))) allFour++
  for (let i = 2; i < types.length; i++) if ([types[i], types[i - 1], types[i - 2]].every(t => HS.FUNNY.includes(t))) threeInRow++
  if (seed > 60) continue
  for (const sc of m.scenes) {
    if (!HS.FUNNY.includes(sc.type)) continue
    const st = stats[sc.type]; st[0]++
    const main = sc.defs.find(d => HS.DEF_KIND[d.kind].funny && d.kind !== 'squat')
    const h = { tower: 1.5, kata: 1.3, sand: BR, pyr: 1.0 }[sc.type]
    const r = HS.simulateShot({ ...sc, idx: 3 }, aimAt(sc, main, h), false, 0)
    if (r.outcome === 'block' && r.hitKind === main.kind) st[1]++
    else fails.push(`${sc.type} seed${seed}: 真ん中を狙っても ${r.outcome}/${r.hitKind}`)
    // 抜け道: 読まれていない（level 0）キーパー・後半の強さで1本でも決まるか
    const ok = DODGE.some(t => HS.simulateShot({ ...sc, idx: 3 }, t, false, 0).outcome === 'goal' || HS.simulateShot({ ...sc, idx: 3 }, t, true, 0).outcome === 'goal')
    if (ok) st[2]++; else fails.push(`${sc.type} seed${seed}: よける線が1本も決まらない`)
  }
}
// 砂山: ゴロは埋まり、同じ向きで浮かせると越える
let moundLow = 0, moundHigh = 0, moundN = 0, pyrEdge = 0, pyrN = 0
for (let seed = 1; seed <= 200 && moundN < 30; seed++) {
  const m = HS.makeMatch(seed * 977)
  for (const sc of m.scenes) {
    if (sc.type === 'sand') {
      const mo = sc.defs.find(d => d.kind === 'mound'); moundN++
      const low = HS.simulateShot({ ...sc, idx: 3 }, aimAt(sc, mo, BR), false, 0, { noKeeper: true })
      if (low.outcome === 'block' && low.hitKind === 'mound') moundLow++
      const hi = HS.simulateShot({ ...sc, idx: 3 }, aimAt(sc, mo, 1.6), false, 0, { noKeeper: true })
      if (hi.hitKind !== 'mound') moundHigh++
    }
    if (sc.type === 'pyr') {
      // ピラミッドの端（横 1.1m）を 1.2m の高さで通すと当たらない／真ん中を 2.5m で通すと当たる
      const p = sc.defs[0], D = Math.hypot(sc.ball.x, sc.ball.z), u = { x: -sc.ball.x / D, z: -sc.ball.z / D }, R = { x: u.z, z: -u.x }
      const u2 = { x: u.x, z: u.z }
      pyrN++
      const edge = HS.hitShape(p, HS.DEF_KIND.pyr, { x: p.x + R.x * 1.1, y: 1.2, z: p.z + R.z * 1.1 }, 3.45, u2)
      const mid = HS.hitShape(p, HS.DEF_KIND.pyr, { x: p.x, y: 2.5, z: p.z }, 3.45, u2)
      if (!edge && mid) pyrEdge++
    }
  }
}
const out = { matches, allFour, threeInRow, stats, mound: { n: moundN, lowBuried: moundLow, highClears: moundHigh }, pyr: { n: pyrN, edgeLowMidHigh: pyrEdge }, fails: fails.slice(0, 8), nfail: fails.length }
console.log(JSON.stringify(out))
const good = allFour === matches && threeInRow === 0 && fails.length === 0 && moundLow === moundN && moundHigh >= moundN * 0.9 && pyrEdge === pyrN
process.exit(good ? 0 : 1)
