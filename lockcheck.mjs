// 「札を押して狙いの線が出てから球が飛び出すまで、カメラとキッカーが動かない」「球の出発点が足先」の検査
// 試合を何本も回し、攻めごとに 技・左右反転・札を押す時刻（場面が始まった直後／演出の途中に押してから／3秒待ってから）を変える
export async function lockcheck(p, { matches = 21, rate = 8 } = {}) {
  const rows = [], byType = {}
  for (let s = 1; s <= matches; s++) {
    await p.evaluate(([s, rate]) => { hs.dbg.start(1000 + s); hs.dbg.rate(rate) }, [s, rate])
    for (let i = 0; i < 12; i++) {
      const st0 = await p.evaluate(() => ({ mode: hs.M.mode, i: hs.M.match.G.i }))
      if (st0.mode !== 'match' || st0.i >= 8) break
      const tech = (st0.i + s) % 4, flip = ((st0.i >> 2) + s) % 2 === 1, timing = (st0.i + s * 2) % 3
      // 演出の途中（intro）にも押してみる
      if (timing === 1) await p.evaluate(t => { const c = document.querySelectorAll('.card')[t]; if (c) c.click() }, tech)
      await p.waitForFunction(() => hs.dbg.st() === 'aim' || !document.getElementById('half').hidden, null, { timeout: 20000 })
      if (await p.evaluate(() => !document.getElementById('half').hidden)) { await p.evaluate(() => document.getElementById('bSecond').click()); await p.waitForFunction(() => hs.dbg.st() === 'aim', null, { timeout: 20000 }) }
      if (timing === 2) await p.waitForTimeout(3000 / rate)
      await p.evaluate(([t, f]) => { hs.dbg.choose(t); if (f) document.getElementById('bFlip').click() }, [tech, flip])
      await p.waitForTimeout(60)
      if (flip) await p.evaluate(() => { document.getElementById('bFlip').click(); document.getElementById('bFlip').click() })   // 反転を往復しても最後の向きで固まる
      await p.waitForTimeout(60)
      await p.evaluate(() => hs.dbg.kick())
      await p.waitForFunction(() => { const st = hs.dbg.st(); return st === 'after' || st === 'concede' || st === 'ref' || (st === 'fall' && hs.M.match.t > 0.3) || hs.M.mode === 'end' }, null, { timeout: 20000 })
      const r = await p.evaluate(() => { const pr = hs.dbg.probe() || {}, m = hs.M.match; return { diff: pr.diff ?? -1, foot: pr.foot ?? null, out: m.res.outcome, type: m.G.m.scenes[Math.min(7, m.res.scene)].type, bad: pr.bad || null, fd: pr.fd } })
      rows.push({ s, i: st0.i, tech, flip, timing, ...r })
      byType[r.type] = (byType[r.type] || 0) + 1
      await p.waitForFunction(i0 => hs.M.mode !== 'match' || hs.M.match.G.i !== i0 || hs.dbg.st() === 'aim' || hs.dbg.st() === 'intro', st0.i, { timeout: 20000 })
    }
    await p.waitForFunction(() => hs.M.mode === 'end' || hs.M.match.G.i >= 8 || true, null, { timeout: 2000 })
  }
  await p.evaluate(() => hs.dbg.rate(1))
  const moved = rows.filter(r => r.diff !== 0), far = rows.filter(r => r.foot != null && r.foot > 8), withFoot = rows.filter(r => r.foot != null)
  return { n: rows.length, moved: moved.length, far: far.length, withFoot: withFoot.length, maxFoot: Math.max(0, ...withFoot.map(r => r.foot)), byType, flips: rows.filter(r => r.flip).length, timings: [0, 1, 2].map(k => rows.filter(r => r.timing === k).length), sample: (moved[0] || far[0] || null) }
}
