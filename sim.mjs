// 遊び方ごとの点の分布（ブラウザを開かない）。node sim.mjs [試合数]
import './data.js'
import './logic.js'
import { BOT_TECHS, botChoose } from './bots.js'
const HS = globalThis.HS
const N = +(process.argv[2] || 300)
const KINDS = ['mix', 'same', 'straight3', 'reckless', 'idle', 'random']
const rows = []
for (const kind of KINDS) {
  const acc = { us: 0, them: 0, win: 0, lose: 0, draw: 0, score: 0, out: {}, ranks: {} }
  for (let s = 1; s <= N; s++) {
    const techs = BOT_TECHS[kind]()
    const G = HS.newGame(s * 7919, techs)
    let guard = 0
    while (G.i < HS.ATTACKS && guard++ < 40) { const r = HS.playAttack(G, botChoose(kind, G, s)); acc.out[r.outcome] = (acc.out[r.outcome] || 0) + 1 }
    const g = HS.grade(G)
    acc.us += G.us; acc.them += G.them; acc.score += g.score; acc.ranks[g.rank] = (acc.ranks[g.rank] || 0) + 1
    if (G.us > G.them) acc.win++; else if (G.us < G.them) acc.lose++; else acc.draw++
  }
  const n = N
  rows.push({ kind, goals: +(acc.us / n).toFixed(2), against: +(acc.them / n).toFixed(2), win: Math.round(acc.win / n * 100) + '%', score: Math.round(acc.score / n), ranks: acc.ranks, out: acc.out })
}
for (const r of rows) console.log(JSON.stringify(r))
