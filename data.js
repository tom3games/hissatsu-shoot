// 文言（日英）と、技の名前の部品・相手チーム
;(function (root) {
  root.HS_DATA = {
    names: {
      ja: {
        pre: {
          zigzag: ['雷鳴', '稲妻', '迷走', '千鳥足'], loop: ['竜巻', '大車輪', '輪廻', 'ぐるぐる'], lob: ['流星', '天空', '月面', '成層圏'],
          ground: ['地獄', 'もぐら', '這い寄る', '芝刈り'], curve: ['三日月', '弧月', '大回り', '遠回り'], fast: ['疾風', '音速', '光速', '弾丸'],
          slow: ['のんびり', '昼下がり', '亀', '日曜日'], straight: ['一直線', '正直者', '愚直', 'まっすぐ'], muri: ['物理無視', '不可能', '反則', '幻'],
        },
        mid: {
          zigzag: ['ジグザグ', '稲妻', 'カクカク'], loop: ['スパイラル', '回転', '大旋回'], lob: ['ドロップ', '急降下', '流れ星'],
          ground: ['ローリング', '地走り', 'ゴロ'], curve: ['バナナ', 'カーブ', '曲がり'], fast: ['ライジング', '弾', '直撃'],
          slow: ['ふわふわ', 'のそのそ', 'そよ風'], straight: ['ストレート', '一閃', '突き'], muri: ['ワープ', '折り返し', '逆走'],
        },
        suf: ['蹴り', 'シュート', '弾', '砲', 'キック', '撃'],
      },
      en: {
        pre: {
          zigzag: ['Thunder', 'Lightning', 'Drunken'], loop: ['Tornado', 'Cyclone', 'Dizzy'], lob: ['Meteor', 'Skyfall', 'Moon'],
          ground: ['Hell', 'Mole', 'Lawnmower'], curve: ['Crescent', 'Banana', 'Detour'], fast: ['Sonic', 'Bullet', 'Lightspeed'],
          slow: ['Sunday', 'Turtle', 'Lazy'], straight: ['Honest', 'Straight', 'Plain'], muri: ['Illegal', 'Impossible', 'Phantom'],
        },
        mid: {
          zigzag: ['Zigzag', 'Bolt'], loop: ['Spiral', 'Spin'], lob: ['Drop', 'Dive'], ground: ['Roller', 'Crawler'], curve: ['Bender', 'Curl'],
          fast: ['Rising', 'Rocket'], slow: ['Breeze', 'Float'], straight: ['Arrow', 'Lance'], muri: ['Warp', 'U-turn'],
        },
        suf: ['Kick', 'Shot', 'Strike', 'Cannon'],
      },
    },
    teams: { ja: ['まがりかど商店街FC', '第三町内会オールスターズ', '駅前ロータリーズ', '夜勤明けユナイテッド'], en: ['Corner Street FC', 'Block 3 All-Stars', 'Station Rotary', 'Night Shift United'] },
    t: {
      ja: {
        title1: '必殺シュートを', title2: '描け！', sub: 'なぞった線が、そのまま必殺技', start: '技を描く', how: '遊び方',
        drawHint: 'ボールから指でなぞって描く', drawHintPc: 'ボールからドラッグして描く', redo: '描き直す', save: 'この名前で登録', play: '試合開始',
        nameLabel: '技の名前', leg: '足', slotEmpty: '空き', full: '技は4つまで。消すなら札を長押し',
        pick: '技を選ぶ', kick: '蹴る', flip: '左右反転', clock: '残り', you: 'あなた',
        half: 'ハーフタイム', halfSub: '足はまだ動く。描き直すなら今', redraw: '技を描き直す', second: '後半へ',
        r_goal: 'ゴール', r_save: ['止められた', 'あぶな', 'ほい'], r_saveRead: '見切った', r_block: ['顔で止めた', 'すね！', 'いたい'], r_post: 'ポスト', r_miss: ['宇宙へ', 'ふかした', '場外'], r_muri: '無理', r_fall: '足が…', r_short: 'とどかない', r_timeout: '奪われた', r_ref: '審判が一番うまい',
        counter: 'カウンターで失点', oppGoal: '相手のゴール', bento: 'キーパー、弁当中', dog: '犬が乱入', tallNote: 'のっぽ', sleepNote: '寝てる',
        newsName: '棒人間スポーツ', again: 'もう一回', saveImg: '画像を保存', post: 'Xでポスト', board: '技を描き直す',
        ranks: { legend: '伝説', win: '勝利', draw: '引き分け', lose: '惜敗', crush: '大敗', idle: '棄権' },
        heads: {
          legend: ['{t}炸裂、伝説の夜', '{t}でネットが裂けた'], win: ['{t}が試合を決めた', '{t}、スタジアムが揺れた'], draw: ['{t}も届かず痛み分け', '引き分け、足だけ限界'],
          lose: ['{t}、あと一歩', '技名だけは勝っていた'], crush: ['技名だけが大きかった', '足がつって大敗'], idle: ['一度も蹴らずに試合終了', '描いた技、未公開のまま'],
        },
        noTech: '必殺技', statLine: '披露した技 {k}種　決まった技 {g}種', miniUs: '得点', miniThem: '失点',
        howTitle: '遊び方', howBody: [
          '<b>1. 技を描く</b> ボールから指でなぞる。描いた線がそのまま球の通り道。地面に沿えばゴロ、上にふくらませれば浮く、横に曲げればカーブ。速く描くほど速い球',
          '<b>2. 試合で撃つ</b> 8回の攻め。技の札を選ぶと通り道が見える。ディフェンダーをよけて、もう一度押して蹴る',
          '<b>3. 足とキーパー</b> 長い・曲がる・速い線ほど足が減る。足が足りないと転んで失点。同じ技はキーパーに読まれて「見」がたまる。技を使い分けよう',
        ],
        credits: '音: Work With Sounds / Torsten Nilsson（CC BY 4.0）、Andreas Richter（CC BY 3.0）、Gravity Sound（CC BY 4.0）ほか CC0',
        close: '閉じる', loading: '芝を刈っています', hashtag: '必殺シュートを描け',
        tut1: 'ボールから上へなぞって', tut2: '札を押すと通り道が見える', tut3: 'もう一度押すか「蹴る」',
        muriWarn: 'この線は物理的に無理', costHeavy: '足に重い',
        live: { one: ['最初は好きにどうぞ', 'キーパー、あくびしてる'], wall: ['壁、ちょっと前に出てる', '壁の人、目を閉じてる'], box: ['相手が戻ってきた', 'ゴール前、渋滞中'], angle: ['角度、ほぼゼロ', 'ほぼ真横から'], long: ['ここから撃つの？', '遠い。とても遠い'], tall: ['でかいのがいる', '3mの人がいる'], sleep: ['芝の上で昼寝中', '一人、寝てる'] },
      },
      en: {
        title1: 'Draw Your', title2: 'Super Shot!', sub: 'The line you draw becomes the move', start: 'Draw a move', how: 'How to play',
        drawHint: 'Trace from the ball', drawHintPc: 'Drag from the ball', redo: 'Redraw', save: 'Save this move', play: 'Kick off',
        nameLabel: 'Move name', leg: 'LEGS', slotEmpty: 'empty', full: 'Max 4 moves. Long-press a card to delete',
        pick: 'Pick a move', kick: 'Kick', flip: 'Mirror', clock: 'Time', you: 'YOU',
        half: 'Half time', halfSub: 'Legs still work. Redraw now if you want', redraw: 'Redraw a move', second: 'Second half',
        r_goal: 'GOAL', r_save: ['Saved', 'Close one', 'Nope'], r_saveRead: 'Read it', r_block: ['Face block', 'Shin!', 'Ouch'], r_post: 'Post', r_miss: ['To space', 'Way over', 'Out'], r_muri: 'Nope', r_fall: 'Cramp...', r_short: 'Too short', r_timeout: 'Lost it', r_ref: 'The ref is best',
        counter: 'Conceded on the counter', oppGoal: 'They scored', bento: 'Keeper is eating lunch', dog: 'A dog ran in', tallNote: 'tall', sleepNote: 'asleep',
        newsName: 'STICK SPORTS', again: 'Play again', saveImg: 'Save image', post: 'Post on X', board: 'Redraw moves',
        ranks: { legend: 'LEGEND', win: 'WIN', draw: 'DRAW', lose: 'CLOSE LOSS', crush: 'ROUT', idle: 'FORFEIT' },
        heads: {
          legend: ['{t} tears the net', 'A legendary night of {t}'], win: ['{t} wins it', '{t} shakes the stadium'], draw: ['{t} not enough', 'A draw, legs are done'],
          lose: ['{t} falls short', 'Only the names won'], crush: ['Big names, big loss', 'Cramps and a rout'], idle: ['Not a single kick', 'Moves never revealed'],
        },
        noTech: 'super shot', statLine: 'Moves shown: {k}   Moves that scored: {g}', miniUs: 'For', miniThem: 'Against',
        howTitle: 'How to play', howBody: [
          '<b>1. Draw a move</b> Trace from the ball. Your line is the path. Hug the grass for a roller, bulge up to lift it, bend sideways to curl. Draw fast for a fast shot',
          '<b>2. Use it</b> 8 attacks. Pick a card to see the path. Dodge defenders, tap again to kick',
          '<b>3. Legs and keeper</b> Long, bendy, fast lines cost more legs. Not enough and you fall and concede. The keeper learns repeated moves. Mix them up',
        ],
        credits: 'Sound: Work With Sounds / Torsten Nilsson (CC BY 4.0), Andreas Richter (CC BY 3.0), Gravity Sound (CC BY 4.0), others CC0',
        close: 'Close', loading: 'Mowing the pitch', hashtag: 'DrawYourSuperShot',
        tut1: 'Trace up from the ball', tut2: 'Tap a card to see the path', tut3: 'Tap again or Kick',
        muriWarn: 'This line breaks physics', costHeavy: 'Hard on the legs',
        live: { one: ['Do whatever you like', 'The keeper is yawning'], wall: ['The wall crept forward', 'The wall has eyes shut'], box: ['They are back', 'Traffic jam in the box'], angle: ['Zero angle', 'Almost from the side'], long: ['From here?', 'Far. Very far'], tall: ['Someone huge', 'A 3m tall guy'], sleep: ['Napping on the grass', 'One of them is asleep'] },
      },
    },
  }
})(typeof window !== 'undefined' ? window : globalThis)
