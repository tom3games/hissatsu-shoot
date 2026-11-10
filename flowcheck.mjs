// 進行不能の検査（verify.mjs と、直す前のコードで落ちるかの確認に使う）
// 人の操作で タイトル→描く→名前→登録→試合（8回、本物のクリック）→ハーフタイム→結果→もう一回 まで通す。
// 途中で わざと変な操作（二重タップ・切り替え中のタップ・画面外へ指を出す・キーボードで画面が縮む・試し撃ちを長く見る）を混ぜる。
// どの段でも 15 秒以内に次へ進めなければ「詰まった」として止める
export async function flow(p, { log = () => {} } = {}) {
  const until = async (what, fn, ms = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await p.evaluate(fn).catch(() => false)) return; await p.waitForTimeout(100) }
    const st = await p.evaluate(() => ({ mode: window.hs && hs.M.mode, st: window.hs && hs.dbg.st(), err: window.__drawErr || null })).catch(e => String(e))
    throw new Error(`詰まった: ${what} ${JSON.stringify(st)}`)
  }
  const box = sel => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel)
  const tap = async sel => { const b = await box(sel); await p.mouse.click(b.x, b.y) }
  await until('読み込み画面が消える', () => document.getElementById('loading').hidden)
  // タイトル: 二重タップ
  await tap('#bStart'); await tap('#bStart').catch(() => {})
  await until('作戦ボードが開く', () => hs.M.mode === 'edit')
  const pts = await p.evaluate(() => { const c = hs.dbg.cam('edit'), b = hs.HS.proj(c, { x: 0, y: 0.11, z: -20 }), g = hs.HS.proj(c, { x: 2.2, y: 1.2, z: 0 }); return { b, g } })
  // 画面の外まで指を出してから離す
  await p.mouse.move(pts.b.x, pts.b.y); await p.mouse.down()
  for (let i = 1; i <= 16; i++) { const k = i / 16; await p.mouse.move(pts.b.x + (pts.g.x - pts.b.x) * k + Math.sin(k * Math.PI) * 60, pts.b.y + (pts.g.y - pts.b.y) * k); await p.waitForTimeout(16) }
  await p.mouse.move(-30, 20); await p.mouse.up()
  await until('名前の紙が出る', () => !document.getElementById('sheet').hidden)
  // 試し撃ちを2周以上見る（2026-11-10 実機ではここで描画が止まり、以後なにも進まなかった）
  await p.waitForTimeout(4500)
  // 名前の入力でキーボードが出て画面が縮む（iOS）
  await p.click('#nameIn'); const vp = p.viewportSize(); await p.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) }); await p.keyboard.type('テスト'); await p.keyboard.press('Enter')
  await p.waitForTimeout(200); await p.setViewportSize(vp)
  await tap('#bSave'); await until('札に入って「試合開始」が出る', () => !document.getElementById('bPlay').hidden)
  await tap('#bPlay'); await tap('#bPlay').catch(() => {})
  await until('試合が始まる', () => hs.M.mode === 'match')
  for (let a = 0; a < 40; a++) {
    const s = await p.evaluate(() => ({ mode: hs.M.mode, half: !document.getElementById('half').hidden }))
    if (s.mode === 'end') break
    if (s.half) { await tap('#bSecond'); await until('後半に入る', () => document.getElementById('half').hidden); continue }
    // 切り替えの最中にも押してみる
    await p.evaluate(() => { const c = document.querySelector('.card'); if (c) c.click(); document.getElementById('bKick').click() })
    await until('札が押せる（aim）', () => hs.dbg.st() === 'aim' || hs.M.mode === 'end' || !document.getElementById('half').hidden || hs.dbg.st() === 'tame' || hs.dbg.st() === 'fly')
    if (await p.evaluate(() => hs.dbg.st() === 'aim')) {
      await tap('.card'); await p.waitForTimeout(80); await tap('.card')
    }
    await until('蹴って結果が出て次へ進む', () => hs.M.mode === 'end' || !document.getElementById('half').hidden || (hs.dbg.st() === 'aim' && hs.M.match.sel < 0) || hs.dbg.st() === 'intro', 20000)
    log(await p.evaluate(() => hs.M.match.G.log.map(r => r.outcome).join(' ')))
  }
  await until('結果（新聞）が出る', () => hs.M.mode === 'end', 20000)
  await tap('#bAgain'); await until('もう一回で試合が始まる', () => hs.M.mode === 'match' && hs.M.match.G.i === 0)
  // 戻るで作戦ボード → 戻るでタイトル
  await tap('#bBack'); await until('試合から戻ると作戦ボード', () => hs.M.mode === 'edit')
  await tap('#bBack'); await until('作戦ボードから戻るとタイトル', () => hs.M.mode === 'title')
  return true
}
