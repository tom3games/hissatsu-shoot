// 守りの難しさを数える（ブラウザを開かない）。node simdef.mjs [試合数] [logic のあるフォルダ]
// 「人の速さの bot」: 指で描いた線（0.45〜1.1秒で描く・狙いがずれる）を4本持ち、場面を1〜2秒見てから
// 下書きの「ぶつかる」印が消えた札を選び、印が消えたのを見てから0.25〜0.6秒遅れて蹴る。印が消えないまま時間が来たら一番ましな札で蹴る
// 2つ目の引数に古い版のフォルダを渡すと、同じ bot で前の版と比べられる
const N = +(process.argv[2] || 300)
const DIR = process.argv[3] ? new URL('file://' + process.argv[3].replace(/\/?$/, '/')) : new URL('./', import.meta.url)
await import(new URL('data.js', DIR))
await import(new URL('logic.js', DIR))
const HS = globalThis.HS
const BR = 0.11, TAME = 1.15
const curve = (fn, n = 72) => { const a = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); const p = fn(t); a.push({ f: p[0], l: p[1] / 20, y: Math.max(BR, p[2]) }) } return a }
const SKILL = process.env.SKILL !== '0'   // うまい人（隅を狙う。本人のようにキーパーが弱いと感じる人）。SKILL=0 でふつうの人（狙いがばらばら）
function humanTechs(seed) {
  const r = HS.rng(seed * 977 + 13), out = []
  for (let tries = 0; out.length < 4 && tries < 60; tries++) {
    const ex = SKILL ? (r() < 0.5 ? -1 : 1) * (2.3 + r() * 1.1) : (r() * 2 - 1) * 3.4, ey = SKILL ? 0.2 + r() * 1.6 : 0.1 + r() * 2.3, bend = (r() * 2 - 1) * 3.5, lift = r() < 0.4 ? r() * 4 : r() * 1, wig = r() < 0.25 ? 1 + r() : 0
    const tech = HS.makeTech(curve(t => [t * 1.02, t * ex + Math.sin(Math.PI * t) * bend + Math.sin(t * Math.PI * 5) * wig, BR + Math.sin(Math.PI * t) * lift + t * ey]), 450 + r() * 650, 'h' + out.length)
    tech.id = 'h' + seed + '_' + out.length
    const tryIt = HS.simulateShot({ ball: { x: 0, y: 0, z: -20 }, defs: [] }, tech, false, 0, { noKeeper: true })
    if (tryIt.outcome === 'goal' || tries % 10 === 9) out.push(tech)
  }
  return out
}
function hito(G, seed) {
  const sc = G.m.scenes[G.i], r = HS.rng(seed * 131 + G.i * 17 + G.log.length * 5)
  const intro = HS.FUNNY.includes(sc.type) ? 1.9 : 0.7
  const opts = []
  for (const t of G.techs) for (const flip of [false, true]) { if (flip && r() < 0.6) continue; if (t.cost > G.leg && G.techs.some(q => q.cost <= G.leg)) continue; opts.push({ t, flip, lv: HS.readLevel(G.marks, t.id, flip) }) }
  const clear = (o, tau) => HS.pathHitsDef(sc, o.t, o.flip, tau + TAME) === 0
  const end = intro + HS.CLOCK - 1
  for (let tau = intro + 1.0 + r() * 1.0; tau < end; tau += 0.2) {
    const ok = opts.filter(o => clear(o, tau) && clear(o, tau + 0.3)).sort((a, b) => a.lv - b.lv + (r() - 0.5) * 0.8)
    if (ok.length) { const o = ok[0]; return { id: o.t.id, flip: o.flip, t0: tau + 0.3 + 0.25 + r() * 0.35 + TAME } }
  }
  const o = opts.sort((a, b) => HS.pathHitsDef(sc, a.t, a.flip, end + TAME) - HS.pathHitsDef(sc, b.t, b.flip, end + TAME))[0] || { t: G.techs[0], flip: false }
  return { id: o.t.id, flip: o.flip, t0: end + 0.4 + TAME }
}
const byType = {}
const byIdx = Array.from({ length: HS.ATTACKS }, () => ({ n: 0, goal: 0, block: 0, save: 0, other: 0 }))
let us = 0, them = 0, win = 0
for (let s = 1; s <= N; s++) {
  const G = HS.newGame(s * 7919, humanTechs(s))
  let guard = 0
  while (G.i < HS.ATTACKS && guard++ < 40) {
    const i = G.i, res = HS.playAttack(G, hito(G, s)), o = res.outcome, b = byIdx[i]
    { const ty = G.m.scenes[i].type + (i >= 4 ? '後' : '前'), q = byType[ty] || (byType[ty] = { n: 0, g: 0 }); q.n++; if (o === 'goal') q.g++ }
    b.n++; if (o === 'goal') b.goal++; else if (o === 'block' || o === 'ref') b.block++; else if (o === 'save') b.save++; else b.other++
  }
  us += G.us; them += G.them; if (G.us > G.them) win++
}
const pct = (a, n) => Math.round(a / n * 100)
const rows = byIdx.map((b, i) => `${i + 1}本目 ゴール${pct(b.goal, b.n)}% 守り${pct(b.block, b.n)}% キーパー${pct(b.save, b.n)}% 他${pct(b.other, b.n)}%`)
const sum = (a, b) => { const x = byIdx.slice(a, b).reduce((p, q) => ({ n: p.n + q.n, goal: p.goal + q.goal, block: p.block + q.block }), { n: 0, goal: 0, block: 0 }); return `ゴール${pct(x.goal, x.n)}% 守りに止められた${pct(x.block, x.n)}%` }
console.log(rows.join('\n'))
console.log(`序盤(1〜3本目) ${sum(0, 3)} / 後半(5〜8本目) ${sum(4, 8)} / 全体 ${sum(0, 8)}`)
console.log(`1試合の平均 ${(us / N).toFixed(2)}-${(them / N).toFixed(2)} 勝率${pct(win, N)}%`)
if (process.env.TYPES) console.log(Object.entries(byType).sort().map(([k, v]) => `${k}:${Math.round(v.g / v.n * 100)}%(${v.n})`).join(' '))
