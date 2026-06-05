(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════
  // SONG DATABASE
  // 曲追加はここだけ編集する
  // ═══════════════════════════════════════════════════════
  var SONGS = [
    { id:'kos_01', series:'kos', seriesLabel:'King of Slipper',
      title:'TENGA黙示録', artist:'クロ・ノーレイ',
      bpm:140, level:7, icon:'👟',
      comment:'深夜テンション限界突破。クロの代表曲。',
      audio:'assets/audio/kos_01_tenga.mp3',
      jacket:'assets/images/kos_01_jacket.png',
      chart:'assets/charts/kos_01_normal.json' },
    { id:'kos_02', series:'kos', seriesLabel:'King of Slipper',
      title:'寿立覇王 Theme', artist:'寿立覇王',
      bpm:168, level:9, icon:'👑', comment:'俺が王だ。以上。' },
    { id:'kos_03', series:'kos', seriesLabel:'King of Slipper',
      title:'松葉迅 Theme', artist:'松葉迅',
      bpm:155, level:8, icon:'⚡', comment:'疾走感重視のバトルチューン。' },
    { id:'kos_04', series:'kos', seriesLabel:'King of Slipper',
      title:'畳野静馬 Character Song', artist:'畳野静馬',
      bpm:128, level:5, icon:'🌙', comment:'穏やかな夜の静寂。' },
    { id:'kos_05', series:'kos', seriesLabel:'King of Slipper',
      title:'百田均一郎 Character Song', artist:'百田均一郎',
      bpm:132, level:6, icon:'🎯', comment:'均一に、確実に。' },
    { id:'vd_01', series:'vendetta', seriesLabel:'Vendetta',
      title:'E.N.A. 独尊 Girl', artist:'E.N.A.',
      bpm:138, level:8, icon:'⚔️', comment:'孤独な女神の独白。ダークポップ。' },
    { id:'vd_02', series:'vendetta', seriesLabel:'Vendetta',
      title:'Chrono Noir', artist:'クロ・ノーレイ',
      bpm:145, level:10, icon:'🌑', comment:'時間軸を超えた黒の詩。上級者向け。' },
    { id:'vd_03', series:'vendetta', seriesLabel:'Vendetta',
      title:'Aldia Percussion', artist:'アルディア',
      bpm:122, level:6, icon:'🗡️', comment:'復讐の鼓動。重厚なリズム譜面。' },
    { id:'or_01', series:'oreue', seriesLabel:'Oreue',
      title:'Garm Crash', artist:'ガルム・クラッシュ',
      bpm:176, level:9, icon:'🔥', comment:'暴走するガルムの咆哮。最速BPM。' },
    { id:'or_02', series:'oreue', seriesLabel:'Oreue',
      title:'Doujou Sumire Idol Song', artist:'堂条純恋',
      bpm:118, level:4, icon:'🌸', comment:'純恋ちゃんの初めてのアイドルソング。' }
  ];

  // ═══════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════
  var SERIES_COLOR = { kos:'#ff1a2e', vendetta:'#aa44ff', oreue:'#00ccff', all:'#ffe033' };
  var SERIES_NAME  = { kos:'King of Slipper', vendetta:'Vendetta', oreue:'Oreue', all:'All Songs' };
  var LANE_COLORS  = ['#ff2244', '#ff6600', '#ffcc00', '#ff44aa'];
  var LANE_KEYS    = [['d','D'], ['f','F'], ['j','J'], ['k','K']];
  var JUDGE_WIN    = { PERFECT:55, GREAT:110, GOOD:160 };
  var JUDGE_SCORE  = { PERFECT:100, GREAT:70, GOOD:40, MISS:0 };
  var NOTE_FALL    = 0.38; // 秒：画面上端→判定線

  // ═══════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════
  var curScreen = 'st';
  var curSeries = 'all';
  var selSong   = null;
  var audioCtx  = null;
  var audioBuffers = {};  // songId → AudioBuffer
  var srcNode   = null;

  var ps = {
    running: false, score: 0, combo: 0, maxCombo: 0,
    notes: [], particles: [], laneActive: [false,false,false,false],
    startTs: 0, time: 0, judgeTO: null, raf: null,
    counts: { PERFECT:0, GREAT:0, GOOD:0, MISS:0 }
  };

  // ═══════════════════════════════════════════════════════
  // AUDIO CONTEXT（ユーザー操作後に初期化）
  // ═══════════════════════════════════════════════════════
  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function loadAudio(songId, url, cb) {
    if (!url) return;
    if (audioBuffers[songId]) { if (cb) cb(audioBuffers[songId]); return; }
    ensureAudioCtx();
    fetch(url)
      .then(function(r) { return r.arrayBuffer(); })
      .then(function(ab) { return audioCtx.decodeAudioData(ab); })
      .then(function(buf) {
        audioBuffers[songId] = buf;
        if (cb) cb(buf);
      })
      .catch(function(e) { console.warn('Audio load failed:', url, e); });
  }

  // ═══════════════════════════════════════════════════════
  // SCREEN TRANSITION
  // ═══════════════════════════════════════════════════════
  function goTo(name) {
    var prev = document.getElementById(curScreen);
    var next = document.getElementById(name);
    if (!next) { console.error('Screen not found:', name); return; }
    if (prev) prev.classList.remove('active');
    next.classList.add('active', 'fin');
    setTimeout(function() { next.classList.remove('fin'); }, 300);
    curScreen = name;
    if (name === 'ss') renderList();
    if (name === 'sp') initPlay();
  }
  window.goTo = goTo;

  // ═══════════════════════════════════════════════════════
  // SERIES SELECT
  // ═══════════════════════════════════════════════════════
  function selSeries(s) {
    ensureAudioCtx();
    curSeries = s;
    selSong = null;
    goTo('ss');
  }
  window.selSeries = selSeries;

  // Series counts
  function updateSeriesCounts() {
    var counts = { kos:0, vendetta:0, oreue:0, all:SONGS.length };
    SONGS.forEach(function(s) { if (counts[s.series] !== undefined) counts[s.series]++; });
    ['kos','vendetta','oreue','all'].forEach(function(k) {
      var el = document.getElementById('cnt-' + k);
      if (el) el.textContent = counts[k] + ' SONGS';
    });
  }

  // ═══════════════════════════════════════════════════════
  // SONG LIST
  // ═══════════════════════════════════════════════════════
  function filtered() {
    return curSeries === 'all' ? SONGS : SONGS.filter(function(s) { return s.series === curSeries; });
  }

  function renderList() {
    var songs = filtered();
    var el = document.getElementById('ssh');
    if (el) el.textContent = SERIES_NAME[curSeries] || 'ALL SONGS';

    if (!selSong && songs.length) { selSong = songs[0]; updateInfo(selSong); }

    var html = '';
    if (curSeries === 'all') {
      var grp = {};
      songs.forEach(function(s) { if (!grp[s.series]) grp[s.series] = []; grp[s.series].push(s); });
      ['kos','vendetta','oreue'].forEach(function(ser) {
        if (!grp[ser]) return;
        html += '<div class="scat">' + SERIES_NAME[ser] + '</div>';
        grp[ser].forEach(function(s) { html += itemHTML(s); });
      });
    } else {
      songs.forEach(function(s) { html += itemHTML(s); });
    }

    var wrap = document.getElementById('slw');
    if (!wrap) return;
    wrap.innerHTML = html;

    wrap.querySelectorAll('.si').forEach(function(el) {
      el.addEventListener('click', function() {
        selSong = SONGS.find(function(s) { return s.id === el.dataset.id; });
        updateInfo(selSong);
        wrap.querySelectorAll('.si').forEach(function(x) { x.classList.remove('sel'); });
        el.classList.add('sel');
      });
      el.addEventListener('dblclick', function() { startPlay(); });
    });

    var first = wrap.querySelector('.si');
    if (first) first.classList.add('sel');
  }

  function itemHTML(s) {
    var hasAudio = !!s.audio;
    return '<div class="si" data-id="' + s.id + '">'
      + '<div class="si-ico">' + s.icon + '</div>'
      + '<div class="si-inf">'
      +   '<div class="si-t">' + s.title + (hasAudio ? ' <span style="color:var(--red2);font-size:9px">♪</span>' : '') + '</div>'
      +   '<div class="si-a">' + s.artist + '</div>'
      + '</div>'
      + '<div class="si-bpm">' + s.bpm + ' BPM</div>'
      + '</div>';
  }

  function updateInfo(s) {
    if (!s) return;
    var c = SERIES_COLOR[s.series] || '#ff1a2e';
    setText('i-ser', s.seriesLabel);
    setStyle('i-ser', 'color', c);
    setText('i-tit', s.title);
    setText('i-art', s.artist);
    setText('i-bpm', 'BPM ' + s.bpm);
    setText('i-dif', 'Lv. ' + s.level);
    setText('i-cmt', s.comment || '');
    setStyle('i-has', 'display', s.audio ? 'inline' : 'none');

    // jacket
    var img = document.getElementById('sj-img');
    var ico = document.getElementById('sj-ico');
    if (s.jacket) {
      img.src = s.jacket;
      img.style.display = 'block';
      if (ico) ico.style.display = 'none';
    } else {
      if (img) img.style.display = 'none';
      if (ico) { ico.style.display = 'block'; ico.textContent = s.icon; }
    }

    // jacket overlay accent
    var ov = document.querySelector('.sj-ov');
    if (ov) ov.style.background = 'linear-gradient(135deg,' + c + '33,transparent)';

    // preload audio
    if (s.audio) loadAudio(s.id, s.audio, null);
  }

  // ═══════════════════════════════════════════════════════
  // PLAY
  // ═══════════════════════════════════════════════════════
  function startPlay() {
    if (!selSong) return;
    ensureAudioCtx();
    goTo('sp');
  }
  window.startPlay = startPlay;

  function exitPlay() {
    ps.running = false;
    stopAudio();
    if (ps.raf) cancelAnimationFrame(ps.raf);
    document.getElementById('res-ov').classList.remove('open');
    goTo('ss');
  }
  window.exitPlay = exitPlay;

  function retryPlay() {
    document.getElementById('res-ov').classList.remove('open');
    stopAudio();
    initPlay();
  }
  window.retryPlay = retryPlay;

  function goRes(to) {
    document.getElementById('res-ov').classList.remove('open');
    ps.running = false;
    stopAudio();
    goTo(to);
  }
  window.goRes = goRes;

  function stopAudio() {
    if (srcNode) { try { srcNode.stop(); } catch(e) {} srcNode = null; }
  }

  function initPlay() {
    if (!selSong) return;
    var s = selSong;

    // reset state
    ps.score = 0; ps.combo = 0; ps.maxCombo = 0; ps.time = 0;
    ps.particles = []; ps.laneActive = [false,false,false,false];
    ps.counts = { PERFECT:0, GREAT:0, GOOD:0, MISS:0 };
    ps.running = false;
    document.getElementById('res-ov').classList.remove('open');

    // HUD
    setText('psn', s.title + ' / ' + s.artist);
    setText('pjbg-t', s.title);
    setText('pjbg-a', s.artist);
    setText('p-sc', '0'); setText('p-cb', '0'); setText('p-mx', '0');
    setText('p-prog-t', '0%');
    setStyle('pj', 'opacity', '0');
    setStyle('pco', 'opacity', '0');

    // jacket banner
    var pjImg = document.getElementById('pjbg-img');
    if (s.jacket) {
      pjImg.src = s.jacket;
      pjImg.style.display = 'block';
    } else {
      pjImg.style.display = 'none';
    }

    // load chart then start
    if (s.chart) {
      fetch(s.chart)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var raw = data.notes || data;
          ps.notes = raw.map(function(n) {
            return { t:n.t, lane:n.lane, type:n.type||'tap', duration:n.duration||0, hit:false, missed:false };
          });
          beginPlay(s);
        })
        .catch(function() {
          ps.notes = genDemo(s.bpm || 140);
          beginPlay(s);
        });
    } else {
      ps.notes = genDemo(s.bpm || 140);
      beginPlay(s);
    }
  }

  function beginPlay(s) {
    resizeCv();
    stopAudio();

    var delay = 0.25;
    ps.startTs = performance.now() + delay * 1000;

    if (s.audio && audioBuffers[s.id] && audioCtx) {
      srcNode = audioCtx.createBufferSource();
      srcNode.buffer = audioBuffers[s.id];
      srcNode.connect(audioCtx.destination);
      srcNode.start(audioCtx.currentTime + delay);
      srcNode.onended = function() { if (ps.running) setTimeout(showResult, 500); };
    } else if (s.audio && audioCtx) {
      // まだロードされていなければロードしてから開始
      loadAudio(s.id, s.audio, function() { beginPlay(s); });
      return;
    }

    ps.running = true;
    if (ps.raf) cancelAnimationFrame(ps.raf);
    ps.raf = requestAnimationFrame(loop);
  }

  // ─── Demo chart (音源なし曲用) ───────────────────────
  function genDemo(bpm) {
    var beat = 60 / bpm, notes = [], t = 2;
    var pats = [[0,2,1,3],[0,1,2,3],[3,2,1,0],[0,3,1,2],[0,2],[1,3]];
    while (t < 30) {
      var p = pats[Math.floor(Math.random() * pats.length)];
      p.forEach(function(lane, i) {
        notes.push({ t:t+i*beat*0.5, lane:lane, type:'tap', duration:0, hit:false, missed:false });
      });
      t += beat * (Math.random() < 0.3 ? 1 : 2);
    }
    notes.sort(function(a, b) { return a.t - b.t; });
    return notes;
  }

  // ═══════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════
  function loop(ts) {
    if (!ps.running) return;
    var ct = (ts - ps.startTs) / 1000;
    ps.time = ct;

    // miss check
    ps.notes.forEach(function(n) {
      if (n.hit || n.missed) return;
      if ((ct - n.t) * 1000 > JUDGE_WIN.GOOD + 60) {
        n.missed = true; ps.combo = 0; ps.counts.MISS++;
        showJudge('MISS'); updHUD();
      }
    });

    draw(ct);
    ps.raf = requestAnimationFrame(loop);
  }

  function resizeCv() {
    var cv = document.getElementById('pc');
    if (!cv) return;
    cv.width  = cv.parentElement.clientWidth  || window.innerWidth;
    cv.height = cv.parentElement.clientHeight || 260;
  }

  // ─── Canvas draw ─────────────────────────────────────
  function draw(ct) {
    var cv = document.getElementById('pc');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#07000b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (var y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);

    var jY = H * 0.82;
    var lW = Math.min(W / 5, 82), lG = 5;
    var tW = 4 * lW + 3 * lG;
    var sX = W / 2 - tW / 2;
    function lx(l) { return sX + l * (lW + lG); }
    function lcx(l) { return lx(l) + lW / 2; }

    // lanes
    for (var l = 0; l < 4; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(lx(l), 0, lW, H);
      if (ps.laneActive[l]) {
        var g = ctx.createLinearGradient(lx(l), 0, lx(l)+lW, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.14)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(lx(l), 0, lW, H);
      }
      var r = ps.laneActive[l] ? 38 : 18;
      var gj = ctx.createRadialGradient(lcx(l), jY, 0, lcx(l), jY, r);
      gj.addColorStop(0, LANE_COLORS[l] + 'cc');
      gj.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gj; ctx.fillRect(lx(l), jY-r, lW, r*2);
    }

    // judge line
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sX, jY); ctx.lineTo(sX+tW, jY); ctx.stroke();

    // notes
    ps.notes.forEach(function(n) {
      if (n.hit || n.missed) return;
      var prog = (ct - n.t + NOTE_FALL) / NOTE_FALL;
      var ny = jY - (1 - prog) * (jY + 60);
      if (ny < -60 || ny > H + 60) return;
      var col = LANE_COLORS[n.lane];
      var nx = lx(n.lane);

      if (n.type === 'hold' && n.duration) {
        var ep = (ct - (n.t + n.duration) + NOTE_FALL) / NOTE_FALL;
        var ey = jY - (1 - ep) * (jY + 60);
        ctx.fillStyle = col + '33';
        ctx.fillRect(nx+6, Math.min(ny,ey), lW-12, Math.abs(ny-ey));
        ctx.fillStyle = col + '88';
        ctx.fillRect(nx+6, Math.min(ny,ey), 4, Math.abs(ny-ey));
        ctx.fillRect(nx+lW-10, Math.min(ny,ey), 4, Math.abs(ny-ey));
      }

      ctx.save();
      ctx.shadowBlur = 16; ctx.shadowColor = col;
      ctx.fillStyle = col; rr(ctx, nx+4, ny-13, lW-8, 26, 5); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, nx+4, ny-13, lW-8, 10, [5,5,0,0]); ctx.fill();
      ctx.restore();
    });

    // particles
    for (var i = ps.particles.length - 1; i >= 0; i--) {
      var p = ps.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= 0.045;
      if (p.life <= 0) { ps.particles.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // progress
    var total = ps.notes.length;
    var done  = ps.notes.filter(function(n) { return n.hit || n.missed; }).length;
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, 0, W, 3);
    ctx.fillStyle = LANE_COLORS[0]; ctx.fillRect(0, 0, W * done / Math.max(total,1), 3);
    setText('p-prog-t', Math.round(done / Math.max(total,1) * 100) + '%');

    var last = ps.notes[ps.notes.length - 1];
    if (last && ct > last.t + 2.5) { ps.running = false; showResult(); }
  }

  function rr(ctx, x, y, w, h, r) {
    if (typeof r === 'number') r = [r,r,r,r];
    ctx.beginPath();
    ctx.moveTo(x+r[0], y); ctx.lineTo(x+w-r[1], y); ctx.quadraticCurveTo(x+w, y, x+w, y+r[1]);
    ctx.lineTo(x+w, y+h-r[2]); ctx.quadraticCurveTo(x+w, y+h, x+w-r[2], y+h);
    ctx.lineTo(x+r[3], y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r[3]);
    ctx.lineTo(x, y+r[0]); ctx.quadraticCurveTo(x, y, x+r[0], y);
    ctx.closePath();
  }

  // ═══════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════
  function hitLane(lane) {
    if (curScreen !== 'sp' || !ps.running) return;
    ps.laneActive[lane] = true;
    var btn = document.getElementById('plb' + lane);
    if (btn) btn.classList.add('act');
    setTimeout(function() {
      ps.laneActive[lane] = false;
      if (btn) btn.classList.remove('act');
    }, 100);

    var ct = ps.time, best = null, bd = 9999;
    ps.notes.forEach(function(n) {
      if (n.hit || n.missed || n.lane !== lane) return;
      var d = Math.abs((ct - n.t) * 1000);
      if (d < bd) { bd = d; best = n; }
    });

    if (best && bd <= JUDGE_WIN.GOOD) {
      var j = bd <= JUDGE_WIN.PERFECT ? 'PERFECT' : bd <= JUDGE_WIN.GREAT ? 'GREAT' : 'GOOD';
      best.hit = true;
      ps.score += Math.round(JUDGE_SCORE[j] * (1 + Math.floor(ps.combo/20) * 0.1));
      ps.combo++; if (ps.combo > ps.maxCombo) ps.maxCombo = ps.combo;
      ps.counts[j]++;
      showJudge(j); spawnP(lane, j); updHUD();
    }
  }

  function updHUD() {
    setText('p-sc', ps.score.toLocaleString());
    setText('p-cb', ps.combo);
    setText('p-mx', ps.maxCombo);
  }

  function showJudge(j) {
    var cl = { PERFECT:'#ffdd44', GREAT:'#44ff88', GOOD:'#44aaff', MISS:'#ff4444' };
    var el = document.getElementById('pj');
    if (!el) return;
    el.textContent = j; el.style.color = cl[j] || '#fff'; el.style.opacity = '1';
    if (ps.judgeTO) clearTimeout(ps.judgeTO);
    ps.judgeTO = setTimeout(function() { el.style.opacity = '0'; }, 380);
    var co = document.getElementById('pco');
    if (ps.combo >= 2) {
      setText('pcn', ps.combo);
      if (co) co.style.opacity = '1';
    } else if (j === 'MISS') {
      if (co) co.style.opacity = '0';
    }
  }

  function spawnP(lane, judge) {
    var cv = document.getElementById('pc'); if (!cv) return;
    var W = cv.width, H = cv.height;
    var lW = Math.min(W/5, 82), lG = 5, tW = 4*lW+3*lG, sX = W/2-tW/2;
    var cx = sX + lane*(lW+lG) + lW/2, jY = H*0.82;
    var col = LANE_COLORS[lane];
    var cnt = judge==='PERFECT' ? 10 : judge==='GREAT' ? 6 : 3;
    for (var i = 0; i < cnt; i++) {
      var a = Math.random()*Math.PI*2, sp = 2+Math.random()*4;
      ps.particles.push({ x:cx, y:jY, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2,
        color:col, r:judge==='PERFECT'?5:3, life:1 });
    }
  }

  // ═══════════════════════════════════════════════════════
  // RESULT
  // ═══════════════════════════════════════════════════════
  function showResult() {
    ps.running = false;
    var c = ps.counts, total = ps.notes.length;
    var pct = Math.round((c.PERFECT + c.GREAT) / Math.max(total,1) * 100);
    var grade, color;
    if (c.MISS === 0 && c.GOOD === 0) { grade = 'S'; color = '#ffdd44'; }
    else if (pct >= 90) { grade = 'A'; color = '#44ff88'; }
    else if (pct >= 75) { grade = 'B'; color = '#44aaff'; }
    else if (pct >= 60) { grade = 'C'; color = '#ff8844'; }
    else                { grade = 'D'; color = '#ff4444'; }
    var titles = { S:'──全知全能──', A:'EXCELLENT', B:'GREAT PLAY', C:'GOOD', D:'TRY AGAIN' };
    setText('r-tit', titles[grade] || 'RESULT');
    var rg = document.getElementById('r-grade');
    if (rg) { rg.textContent = grade; rg.style.color = color; }
    setText('r-sc', ps.score.toLocaleString());
    setText('r-cb', ps.maxCombo);
    setText('r-pf', c.PERFECT); setText('r-gr', c.GREAT);
    setText('r-go', c.GOOD);    setText('r-ms', c.MISS);
    document.getElementById('res-ov').classList.add('open');
  }

  // ═══════════════════════════════════════════════════════
  // MODAL
  // ═══════════════════════════════════════════════════════
  function openM(id) { var el = document.getElementById(id); if (el) el.classList.add('open'); }
  function closeM(id) { var el = document.getElementById(id); if (el) el.classList.remove('open'); }
  window.openM = openM;
  window.closeM = closeM;
  document.querySelectorAll('.mov').forEach(function(el) {
    el.addEventListener('click', function(e) { if (e.target === el) el.classList.remove('open'); });
  });

  // ═══════════════════════════════════════════════════════
  // KEYBOARD / TOUCH
  // ═══════════════════════════════════════════════════════
  document.addEventListener('keydown', function(e) {
    if (e.repeat) return;
    if (e.key === ' ' && curScreen === 'st') { ensureAudioCtx(); goTo('ssr'); return; }
    if (e.key === 'Escape') {
      if (curScreen === 'sp')  exitPlay();
      else if (curScreen === 'ss')  goTo('ssr');
      else if (curScreen === 'ssr') goTo('st');
      return;
    }
    for (var i = 0; i < 4; i++) {
      if (LANE_KEYS[i].indexOf(e.key) >= 0) { hitLane(i); return; }
    }
  });

  for (var l = 0; l < 4; l++) {
    (function(lane) {
      var btn = document.getElementById('plb' + lane);
      if (!btn) return;
      btn.addEventListener('pointerdown', function(e) { e.preventDefault(); hitLane(lane); });
    })(l);
  }

  window.addEventListener('resize', function() { if (curScreen === 'sp') resizeCv(); });

  // ═══════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════
  function setText(id, val) {
    var el = document.getElementById(id); if (el) el.textContent = val;
  }
  function setStyle(id, prop, val) {
    var el = document.getElementById(id); if (el) el.style[prop] = val;
  }

  // ─── INIT ─────────────────────────────────────────────
  updateSeriesCounts();

})();
