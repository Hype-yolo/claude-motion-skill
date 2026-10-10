// 剪辑表：150 BPM，1 拍 = 0.4s，1 小节 = 4 拍 = 1.6s。所有镜头都落在拍点上。
// 浏览器里是 window.EDL；node 里 require/import 后导出 timeline.json 给配乐。
(function (root) {
  const BPM = 150, BEAT = 60 / BPM, BAR = BEAT * 4;
  // kind: intro/chapter/card/finale；beats = 时长（拍）
  // n = 大项编号（/43）；sub = 分项
  const S = [];
  const add = (o) => S.push(o);

  add({ kind: 'intro', id: 'intro', beats: 48 });

  const chapter = (id, no, en, zh, jp, pal) => add({ kind: 'chapter', id, no, en, zh, jp, pal, beats: 8 });
  const card = (n, en, zh, jp, pose, o = {}) => add({ kind: 'card', n, en, zh, jp, pose, beats: 4, ...o });

  // ── CH1 田径（红）── 横向长镜头：一条跑道从左推到右
  chapter('ath', '01', 'ATHLETICS', '田径', '陸上競技', 'red');
  const A = (sub, zh, pose, jp) => card(1, 'ATHLETICS', zh, jp, pose, { sub, track: true, fam: true });
  A('SPRINT', '短跑', 'sprint', '短距離');
  A('HURDLES', '跨栏', 'hurdles', 'ハードル');
  A('RELAY', '接力', 'relay', 'リレー');
  A('MIDDLE & LONG', '中长跑', 'distance', '中長距離');
  A('STEEPLECHASE', '障碍跑', 'steeple', '障害');
  A('MARATHON', '马拉松', 'marathon', 'マラソン');
  A('RACE WALK', '竞走', 'walk', '競歩');
  A('HIGH JUMP', '跳高', 'highjump', '走高跳');
  A('POLE VAULT', '撑竿跳高', 'polevault', '棒高跳');
  A('LONG & TRIPLE JUMP', '跳远 · 三级跳远', 'longjump', '走幅跳・三段跳');
  A('SHOT PUT', '铅球', 'shot', '砲丸投');
  A('DISCUS', '铁饼', 'discus', '円盤投');
  A('HAMMER', '链球', 'hammer', 'ハンマー投');
  A('JAVELIN', '标枪', 'javelin', 'やり投');
  // 全能：用最后一格收住田径
  // （14 格 = 14 小节）

  // ── CH2 水上（紫：燕子花长在水边）──
  chapter('aqua', '02', 'AQUATICS', '水上项目', '水泳', 'purple');
  const Sw = (sub, zh, pose, jpBig) => card(2, 'SWIMMING', zh, '競泳', pose, { sub, beats: 2, water: true, fam: true, jpBig });
  Sw('FREESTYLE', '自由泳', 'free', '自由形');
  Sw('BREASTSTROKE', '蛙泳', 'breast', '平泳ぎ');
  Sw('BACKSTROKE', '仰泳', 'back', '背泳ぎ');
  Sw('BUTTERFLY', '蝶泳', 'fly', 'バタフライ');
  card(2, 'DIVING', '跳水', '飛込', 'diving', { water: true });
  card(2, 'ARTISTIC SWIMMING', '花样游泳', 'アーティスティックスイミング', 'artistic', { water: true });
  card(2, 'WATER POLO', '水球', '水球', 'waterpolo', { water: true });

  // ── CH3 球类（金）──
  chapter('ball', '03', 'BALL GAMES', '球类项目', '球技', 'gold');
  card(3, 'FOOTBALL', '足球', 'サッカー', 'football');
  card(4, 'BASKETBALL', '篮球', 'バスケットボール', 'basketball', { sub: '5×5 · 3×3' });
  card(5, 'VOLLEYBALL', '排球', 'バレーボール', 'volleyball', { sub: 'INDOOR · BEACH' });
  card(6, 'HANDBALL', '手球', 'ハンドボール', 'handball');
  card(7, 'HOCKEY', '曲棍球', 'ホッケー', 'hockey');
  card(8, 'RUGBY SEVENS', '七人制橄榄球', '7人制ラグビー', 'rugby');
  card(9, 'BASEBALL · SOFTBALL', '棒球 · 垒球', '野球・ソフトボール', 'baseball');
  card(10, 'CRICKET', '板球', 'クリケット', 'cricket', { sub: 'T20' });
  card(11, 'GOLF', '高尔夫球', 'ゴルフ', 'golf');
  // 持拍类：每格 2 拍，球在格与格之间飞
  const R = (n, en, zh, jp, pose, sub) => card(n, en, zh, jp, pose, { beats: 2, racket: true, sub });
  R(12, 'BADMINTON', '羽毛球', 'バドミントン', 'badminton');
  R(13, 'TABLE TENNIS', '乒乓球', '卓球', 'tabletennis');
  R(14, 'TENNIS', '网球', 'テニス', 'tennis');
  R(14, 'SOFT TENNIS', '软式网球', 'ソフトテニス', 'softtennis', 'TENNIS');
  R(15, 'SQUASH', '壁球', 'スカッシュ', 'squash');
  R(16, 'PADEL', '板式网球', 'パデル', 'padel', 'NEW');
  card(17, 'TEQBALL', '泰克球', 'テックボール', 'teqball', { sub: 'NEW' });

  // ── CH4 格斗（赭：传统）──
  chapter('combat', '04', 'COMBAT', '格斗项目', '格闘技', 'ochre');
  card(18, 'JUDO', '柔道', '柔道', 'judo');
  card(19, 'KARATE', '空手道', '空手', 'karate');
  card(20, 'TAEKWONDO', '跆拳道', 'テコンドー', 'taekwondo');
  card(21, 'BOXING', '拳击', 'ボクシング', 'boxing');
  card(22, 'WRESTLING', '摔跤', 'レスリング', 'wrestling');
  card(23, 'FENCING', '击剑', 'フェンシング', 'fencing');
  card(24, 'JU-JITSU', '柔术', '柔術', 'jujitsu', { family: 'COMBAT SPORTS' });
  card(24, 'KURASH', '克拉什', 'クラッシュ', 'kurash', { family: 'COMBAT SPORTS' });
  card(24, 'MMA', '综合格斗', '総合格闘技', 'mma', { family: 'COMBAT SPORTS' });

  // ── CH5 力与准（墨 + 金）──
  chapter('power', '05', 'POWER & PRECISION', '力量与精准', '力と精度', 'ink');
  card(25, 'WEIGHTLIFTING', '举重', 'ウエイトリフティング', 'weightlifting');
  card(26, 'SHOOTING', '射击', '射撃', 'shooting');
  card(27, 'ARCHERY', '射箭', 'アーチェリー', 'archery');
  card(28, 'GYMNASTICS', '竞技体操', '体操競技', 'gym_art', { sub: 'ARTISTIC', fam: true });
  card(28, 'GYMNASTICS', '艺术体操', '新体操', 'gym_rhythm', { sub: 'RHYTHMIC', fam: true });
  card(28, 'GYMNASTICS', '蹦床', 'トランポリン', 'gym_tramp', { sub: 'TRAMPOLINE', fam: true });
  card(29, 'MODERN PENTATHLON', '现代五项', '近代五種', 'pentathlon');

  // ── CH6 山与海（绿）──
  chapter('nature', '06', 'LAND & SEA', '山海之间', '山と海', 'green');
  card(30, 'ROWING', '赛艇', 'ボート', 'rowing');
  card(31, 'CANOE', '皮划艇', 'カヌー', 'canoe', { sub: 'SPRINT · SLALOM' });
  card(32, 'SAILING', '帆船', 'セーリング', 'sailing');
  card(33, 'SURFING', '冲浪', 'サーフィン', 'surfing', { sub: 'NEW' });
  card(34, 'TRIATHLON', '铁人三项', 'トライアスロン', 'triathlon');
  const C = (sub, zh, pose, jpBig) => card(35, 'CYCLING', zh, '自転車', pose, { sub, beats: 2, fam: true, jpBig });
  C('ROAD', '公路自行车', 'cyc_road', 'ロード');
  C('TRACK', '场地自行车', 'cyc_track', 'トラック');
  C('BMX', '小轮车', 'cyc_bmx', 'BMX');
  C('MOUNTAIN BIKE', '山地自行车', 'cyc_mtb', 'マウンテンバイク');
  card(36, 'EQUESTRIAN', '马术', '馬術', 'equestrian');

  // ── CH7 亚洲 · 新浪潮（五色）──
  chapter('asia', '07', 'ASIA & NEW WAVE', '亚洲特色 · 新浪潮', 'アジアと新時代', 'multi');
  card(37, 'KABADDI', '卡巴迪', 'カバディ', 'kabaddi');
  card(38, 'SEPAK TAKRAW', '藤球', 'セパタクロー', 'takraw');
  card(39, 'WUSHU', '武术', '武術', 'wushu');
  card(40, 'SKATEBOARDING', '滑板', 'スケートボード', 'skate');
  card(41, 'SPORT CLIMBING', '攀岩', 'スポーツクライミング', 'climbing');
  card(42, 'BREAKING', '霹雳舞', 'ブレイキン', 'breaking');
  card(43, 'ESPORTS', '电子竞技', 'eスポーツ', 'esports');

  add({ kind: 'finale', id: 'finale', beats: 48 });

  // 时间轴
  let b = 0, chap = null, ci = 0;
  for (const s of S) {
    s.b0 = b; s.t0 = b * BEAT; s.dur = s.beats * BEAT; b += s.beats;
    if (s.kind === 'chapter') { chap = s; ci = 0; }
    if (s.kind === 'card') {
      s.chap = chap.id; s.pal = chap.pal; s.ci = ci++;
      // 显示用：title 大字 / family 家族小字 / tag 角标
      if (s.fam) { s.title = s.sub; s.family = s.en; }
      else { s.title = s.en; s.tag = s.sub; }
    }
  }
  const EDL = { BPM, BEAT, BAR, shots: S, beats: b, DUR: b * BEAT };
  if (typeof module !== 'undefined') module.exports = EDL; else root.EDL = EDL;
})(this);
