// ── State ──
let currentBet = '커피';
let statsYear, statsMonth;

const now = new Date();
statsYear = now.getFullYear();
statsMonth = now.getMonth() + 1;

// ── Helpers ──
const API_PREFIX = (typeof BASE_PATH !== 'undefined') ? BASE_PATH : '';

async function api(url, opts = {}) {
    if (opts.body) opts.headers = { 'Content-Type': 'application/json' };
    const res = await fetch(API_PREFIX + url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '오류가 발생했습니다');
    return data;
}

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Tabs ──
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        const target = tab.dataset.tab;
        if (target === 'members') loadMembers();
        if (target === 'stats') loadStats();
        if (target === 'history') loadHistory();
        if (target === 'draw') loadToday();
    });
});

// ── Bet selection ──
document.querySelectorAll('.bet-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.bet-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentBet = chip.dataset.bet;
        document.getElementById('betCustom').value = '';
    });
});

document.getElementById('betCustom').addEventListener('input', (e) => {
    if (e.target.value.trim()) {
        document.querySelectorAll('.bet-chip').forEach(c => c.classList.remove('active'));
        currentBet = e.target.value.trim();
    }
});

// ── Game Selection ──
document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', async () => {
        const gameType = card.dataset.game;
        try {
            const members = await api('/api/members');
            if (members.length < 2) {
                toast('최소 2명 이상의 멤버가 필요합니다');
                return;
            }
            const betName = document.getElementById('betCustom').value.trim() || currentBet;
            startGame(gameType, members.map(m => m.name), betName);
        } catch (err) {
            toast(err.message);
        }
    });
});

const gameTitles = {
    ladder: '🪜 사다리 타기',
    wheel: '🎡 돌림판',
    bomb: '💣 폭탄 돌리기',
    card: '🃏 카드 뒤집기',
    box: '🎁 기프트 박스',
    pirate: '🏴‍☠️ 해적 통아저씨',
    race: '🏇 경마 레이스',
    slot: '🎰 슬롯머신',
    croc: '🐊 악어 이빨',
    balloon: '🎈 풍선 터뜨리기'
};

// Remember current game context for retry
let currentGameType = null;
let currentGamePlayers = null;
let currentGameBet = null;

function startGame(type, players, betName) {
    currentGameType = type;
    currentGamePlayers = players;
    currentGameBet = betName;

    const overlay = document.getElementById('gameOverlay');
    const container = document.getElementById('gameContainer');
    const title = document.getElementById('gameTitle');

    const modeTag = isRealMode()
        ? '<span style="background:#FEE2E2;color:#DC2626;padding:2px 8px;border-radius:6px;font-size:0.75rem;margin-left:8px;">실전</span>'
        : '<span style="background:#DBEAFE;color:#1D4ED8;padding:2px 8px;border-radius:6px;font-size:0.75rem;margin-left:8px;">연습</span>';
    title.innerHTML = (gameTitles[type] || '') + modeTag;
    container.innerHTML = '';
    overlay.classList.add('active');

    if (typeof Games !== 'undefined' && Games[type]) {
        Games[type](container, players, (winner) => {
            onGameComplete(winner, betName);
        });
    }
}

document.getElementById('gameBack').addEventListener('click', () => {
    document.getElementById('gameOverlay').classList.remove('active');
    document.getElementById('gameContainer').innerHTML = '';
});

function isRealMode() {
    const radio = document.querySelector('input[name="gameMode"]:checked');
    return radio && radio.value === 'real';
}

async function onGameComplete(winner, betName) {
    // 실전 모드일 때만 DB에 기록
    if (isRealMode()) {
        try {
            await api('/api/draw', {
                method: 'POST',
                body: JSON.stringify({ bet_name: betName, winner })
            });
        } catch (e) {}
        loadToday();
    }

    // Show result overlay ON TOP of game screen (don't close game)
    showResult(winner, betName, isRealMode());
}

// ── Result Overlay with Confetti ──
function showResult(winner, betName, real) {
    const overlay = document.getElementById('resultOverlay');
    const emojis = ['🎉', '🏆', '👑', '🎊', '💥', '🤡', '💸', '😱'];
    document.getElementById('resultEmoji').textContent = emojis[Math.floor(Math.random() * emojis.length)];
    document.getElementById('resultWinner').textContent = winner;

    if (real) {
        const roasts = [
            `${betName} 쏘기 당첨! 축하드립니다~ (진심 아님)`,
            `오늘의 ${betName}은 ${winner}님이 쏩니다! 감사합니다~`,
            `${winner}님 지갑 여세요~ ${betName} 시간입니다`,
            `운명이 ${winner}님을 선택했습니다. ${betName} 가즈아!`,
            `${winner}님 오늘도 당첨ㅋㅋ ${betName} 쏘세요~`,
            `하늘의 뜻입니다. ${winner}님 ${betName} 결제 부탁드려요`,
            `${winner}님 카드 준비~ ${betName} 타임!`,
            `이건 실력입니다. ${winner}님 ${betName} 쏘기 확정!`,
        ];
        document.getElementById('resultBetInfo').textContent = roasts[Math.floor(Math.random() * roasts.length)];
        document.getElementById('resultAnnounce').textContent = '🔴 실전 — 당첨자 발표!';
    } else {
        document.getElementById('resultBetInfo').textContent = `연습이니까 봐준다~ 다음엔 진짜다 ${winner}!`;
        document.getElementById('resultAnnounce').textContent = '🔵 연습 — 기록되지 않습니다';
    }

    overlay.classList.add('active');
    startConfetti();
}

// 확인: 결과창만 닫고 게임 화면은 그대로 유지
document.getElementById('resultCloseBtn').addEventListener('click', () => {
    document.getElementById('resultOverlay').classList.remove('active');
    stopConfetti();
});

// 다시하기: 결과 닫고 같은 게임 새로 시작
document.getElementById('resultRetryBtn').addEventListener('click', () => {
    document.getElementById('resultOverlay').classList.remove('active');
    stopConfetti();
    if (currentGameType && currentGamePlayers) {
        const container = document.getElementById('gameContainer');
        container.innerHTML = '';
        if (typeof Games !== 'undefined' && Games[currentGameType]) {
            Games[currentGameType](container, currentGamePlayers, (winner) => {
                onGameComplete(winner, currentGameBet);
            });
        }
    }
});

// ── Confetti ──
let confettiAnimId = null;
function startConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FDE68A'];

    for (let i = 0; i < 120; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 4,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 3 + 2,
            rot: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();

            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.rotSpeed;
            p.vy += 0.05;

            if (p.y > canvas.height + 20) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
                p.vy = Math.random() * 3 + 2;
            }
        });
        confettiAnimId = requestAnimationFrame(draw);
    }
    draw();
}

function stopConfetti() {
    if (confettiAnimId) {
        cancelAnimationFrame(confettiAnimId);
        confettiAnimId = null;
    }
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ── Today ──
async function loadToday() {
    try {
        const data = await api('/api/today');
        const card = document.getElementById('todayCard');
        const list = document.getElementById('todayList');
        if (data.length === 0) { card.style.display = 'none'; return; }
        card.style.display = 'block';
        list.innerHTML = data.map(d => `
            <div class="today-item">
                <span class="name">${esc(d.name)}</span>
                <span class="bet-tag">${esc(d.bet_name)}</span>
            </div>
        `).join('');
    } catch (e) {}
}

// ── Members ──
async function loadMembers() {
    const data = await api('/api/members');
    document.getElementById('memberCount').textContent = `${data.length}명 참가 중`;
    document.getElementById('memberList').innerHTML = data.map(m => `
        <li class="member-item">
            <span class="name">${esc(m.name)}</span>
            <button class="btn-remove" onclick="removeMember(${m.id}, '${esc(m.name)}')">삭제</button>
        </li>
    `).join('') || '<li class="no-data">멤버가 없습니다</li>';
}

document.getElementById('memberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('memberName');
    const name = input.value.trim();
    if (!name) return;
    try {
        await api('/api/members', { method: 'POST', body: JSON.stringify({ name }) });
        input.value = '';
        toast(`${name} 추가 완료`);
        loadMembers();
    } catch (err) { toast(err.message); }
});

async function removeMember(id, name) {
    if (!confirm(`${name}을(를) 삭제하시겠습니까?`)) return;
    try {
        await api(`/api/members/${id}`, { method: 'DELETE' });
        toast(`${name} 삭제 완료`);
        loadMembers();
    } catch (err) { toast(err.message); }
}

// ── Stats ──
function updateStatsPeriod() {
    document.getElementById('statsPeriod').textContent = `${statsYear}년 ${statsMonth}월`;
}

document.getElementById('prevMonth').addEventListener('click', () => {
    statsMonth--;
    if (statsMonth < 1) { statsMonth = 12; statsYear--; }
    loadStats();
});
document.getElementById('nextMonth').addEventListener('click', () => {
    statsMonth++;
    if (statsMonth > 12) { statsMonth = 1; statsYear++; }
    loadStats();
});

// ── Roast Messages ──
function getRoastTitle(rank, count, total, name) {
    const pct = (count / total * 100);
    if (rank === 0) {
        // 1등 (제일 많이 당첨)
        const msgs = [
            `👑 이 달의 호구왕`,
            `🏆 축하합니다 ATM ${name}님`,
            `💸 지갑이 텅 비었을 ${name}님`,
            `🎯 당첨 자석 ${name}`,
            `🤡 운이 지독하게 없는 ${name}님`,
            `💳 카드값 걱정되는 ${name}님`,
            `🫡 이 달의 봉사왕`,
        ];
        return msgs[Math.floor(Math.random() * msgs.length)];
    }
    if (rank === 1) {
        const msgs = [
            `😅 아슬아슬 2등... 다음 달은 모르지`,
            `🥈 1등 바짝 뒤쫓는 예비 호구`,
            `📈 상승세 주의보`,
        ];
        return msgs[Math.floor(Math.random() * msgs.length)];
    }
    return null;
}

function getRoastComment(rank, count, total, entries) {
    const pct = (count / total * 100);
    if (rank === 0 && pct >= 50) return `혼자서 전체의 ${pct.toFixed(0)}% 부담 중... 괜찮으세요?`;
    if (rank === 0 && count >= 10) return `${count}번이나 당첨... 전생에 나라를 팔았나`;
    if (rank === 0) return `압도적 1위. 반박 불가.`;
    if (rank === entries.length - 1 && count <= 1) return `운빨 장인. 부럽다 진짜.`;
    if (rank === entries.length - 1) return `이 사람만 피해가는 신기한 운`;
    return null;
}

function getOverallRoast(entries, total) {
    if (entries.length <= 1) return '';
    const top = entries[0];
    const bot = entries[entries.length - 1];
    const gap = top.count - bot.count;

    const msgs = [];
    if (gap >= 5) {
        msgs.push(`${top.name} vs ${bot.name}, ${gap}회 차이. 이건 실력이 아니라 팔자`);
    }
    if (top.count >= total * 0.5) {
        msgs.push(`${top.name}님이 거의 매일 쏘는 중. 월급이 남아나나?`);
    }
    if (total >= 20) {
        msgs.push(`이번 달 벌써 ${total}판... 너무 노는 거 아닙니까`);
    }
    if (gap <= 1 && entries.length >= 3) {
        msgs.push(`다들 골고루 당첨. 이건 진정한 평등사회`);
    }
    if (msgs.length === 0) return '';
    return msgs[Math.floor(Math.random() * msgs.length)];
}

async function loadStats() {
    updateStatsPeriod();
    const data = await api(`/api/stats/monthly?year=${statsYear}&month=${statsMonth}`);
    const container = document.getElementById('statsContent');
    if (data.data.length === 0) {
        container.innerHTML = '<div class="no-data">조용한 달이네요... 아무도 안 뽑혔습니다 🦗</div>';
        return;
    }
    const groups = {};
    data.data.forEach(d => {
        if (!groups[d.bet_name]) groups[d.bet_name] = [];
        groups[d.bet_name].push(d);
    });
    let html = '';
    for (const [betName, entries] of Object.entries(groups)) {
        const total = entries.reduce((s, e) => s + e.count, 0);
        const maxCount = entries[0].count;

        html += `<div class="stat-group"><h3>${esc(betName)} (총 ${total}회)</h3>`;

        // Overall roast
        const overall = getOverallRoast(entries, total);
        if (overall) {
            html += `<div class="stat-roast-overall">${esc(overall)}</div>`;
        }

        entries.forEach((e, i) => {
            const pct = (e.count / maxCount * 100).toFixed(0);
            const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
            const ratio = (e.count / total * 100).toFixed(1);
            const roastTitle = getRoastTitle(i, e.count, total, e.name);
            const roastComment = getRoastComment(i, e.count, total, entries);

            html += `<div class="stat-row-wrap">`;
            if (roastTitle) {
                html += `<div class="stat-roast-title">${roastTitle}</div>`;
            }
            html += `
                <div class="stat-row">
                    <span class="rank ${rankClass}">${i + 1}</span>
                    <span class="name">${esc(e.name)}</span>
                    <div class="stat-bar-wrap">
                        <div class="stat-bar" style="width:${pct}%"></div>
                    </div>
                    <span class="stat-count">${e.count}회 (${ratio}%)</span>
                </div>`;
            if (roastComment) {
                html += `<div class="stat-roast-comment">${esc(roastComment)}</div>`;
            }
            html += `</div>`;
        });
        html += '</div>';
    }
    container.innerHTML = html;
}

// ── History ──
async function loadHistory() {
    const data = await api('/api/history?limit=50');
    const container = document.getElementById('historyList');
    if (data.length === 0) {
        container.innerHTML = '<div class="no-data">기록이 없습니다</div>';
        return;
    }
    container.innerHTML = data.map(d => `
        <div class="history-item">
            <div class="history-left">
                <span class="history-date">${d.drawn_at}</span>
                <span class="history-name">${esc(d.name)}</span>
                <span class="history-bet">${esc(d.bet_name)}</span>
            </div>
            <button class="btn-del-history" onclick="deleteHistory(${d.id})" title="삭제">&times;</button>
        </div>
    `).join('');
}

async function deleteHistory(id) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
        await api(`/api/history/${id}`, { method: 'DELETE' });
        toast('삭제 완료');
        loadHistory();
    } catch (err) { toast(err.message); }
}

// ── Sound Helper ──
function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'tick') {
            osc.frequency.value = 800;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } else if (type === 'win') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(523, ctx.currentTime);
            osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
            gain.gain.value = 0.08;
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === 'boom') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'pop') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'click') {
            osc.frequency.value = 600;
            gain.gain.value = 0.05;
            osc.start();
            osc.stop(ctx.currentTime + 0.03);
        }
    } catch (e) {}
}

// ── Init ──
loadToday();
