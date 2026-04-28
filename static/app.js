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
    card.addEventListener('click', () => {
        const gameType = card.dataset.game;
        showGameSetup(gameType);
    });
});

// ── Game Setup Flow ──
let setupGameType = null;
let setupMode = null;
let setupMembers = [];

function showGameSetup(gameType) {
    setupGameType = gameType;
    setupMode = null;
    setupMembers = [];
    const title = gameTitles[gameType] || gameType;

    const overlay = document.getElementById('gameSetupOverlay');
    overlay.innerHTML = `
        <div class="setup-container">
            <button class="setup-close" id="setupClose">&times;</button>
            <div class="setup-step active" id="setupStep1">
                <div class="setup-game-title">${title}</div>
                <h3 class="setup-heading">모드 선택</h3>
                <div class="setup-mode-grid">
                    <button class="setup-mode-btn" data-mode="practice">
                        <span class="setup-mode-icon">🔵</span>
                        <span class="setup-mode-label">연습</span>
                        <span class="setup-mode-desc">기록되지 않아요</span>
                    </button>
                    <button class="setup-mode-btn" data-mode="real">
                        <span class="setup-mode-icon">🔴</span>
                        <span class="setup-mode-label">실전</span>
                        <span class="setup-mode-desc">결과가 기록돼요</span>
                    </button>
                </div>
            </div>
            <div class="setup-step" id="setupStep2">
                <div class="setup-game-title">${title}</div>
                <h3 class="setup-heading">참가 멤버</h3>
                <div class="setup-member-input">
                    <input type="text" id="setupMemberInput" placeholder="이름 입력 후 Enter" autocomplete="off">
                    <button class="setup-add-btn" id="setupAddBtn">추가</button>
                </div>
                <div class="setup-member-list" id="setupMemberList"></div>
                <div class="setup-saved-members" id="setupSavedMembers"></div>
                <div class="setup-bet-section">
                    <h4 class="setup-heading-sm">내기 종류</h4>
                    <div class="setup-bet-chips">
                        <button class="setup-bet-chip active" data-bet="커피">☕ 커피</button>
                        <button class="setup-bet-chip" data-bet="점심">🍚 점심</button>
                        <button class="setup-bet-chip" data-bet="간식">🍰 간식</button>
                    </div>
                </div>
                <button class="setup-start-btn" id="setupStartBtn" disabled>게임 시작</button>
            </div>
        </div>
    `;
    overlay.classList.add('active');

    // Close
    document.getElementById('setupClose').addEventListener('click', () => {
        overlay.classList.remove('active');
    });

    // Mode selection
    overlay.querySelectorAll('.setup-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setupMode = btn.dataset.mode;
            document.getElementById('setupStep1').classList.remove('active');
            document.getElementById('setupStep2').classList.add('active');
            loadSavedMembers();
            setTimeout(() => document.getElementById('setupMemberInput').focus(), 200);
        });
    });

    // Add member
    const addMember = () => {
        const input = document.getElementById('setupMemberInput');
        const name = input.value.trim();
        if (!name) return;
        if (setupMembers.includes(name)) { toast('이미 추가된 멤버입니다'); return; }
        setupMembers.push(name);
        input.value = '';
        input.focus();
        renderSetupMembers();
    };

    document.getElementById('setupAddBtn').addEventListener('click', addMember);
    document.getElementById('setupMemberInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addMember(); }
    });

    // Bet chips
    overlay.querySelectorAll('.setup-bet-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            overlay.querySelectorAll('.setup-bet-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentBet = chip.dataset.bet;
        });
    });

    // Start game
    document.getElementById('setupStartBtn').addEventListener('click', () => {
        if (setupMembers.length < 2) { toast('최소 2명 이상 필요합니다'); return; }
        // Set mode radio for compatibility
        const realRadio = document.querySelector('input[name="gameMode"][value="real"]');
        const practiceRadio = document.querySelector('input[name="gameMode"][value="practice"]');
        if (setupMode === 'real' && realRadio) realRadio.checked = true;
        if (setupMode === 'practice' && practiceRadio) practiceRadio.checked = true;

        overlay.classList.remove('active');
        const betName = currentBet;
        // 멤버 순서 랜덤 셔플
        const shuffledMembers = shuffle([...setupMembers]);
        // 랜덤 게임이면 게임도 랜덤 선택
        let gameToPlay = setupGameType;
        if (gameToPlay === 'random') {
            const gameKeys = Object.keys(gameTitles);
            gameToPlay = gameKeys[Math.floor(Math.random() * gameKeys.length)];
            toast(`🎲 ${gameTitles[gameToPlay]} 선택!`);
        }
        startGame(gameToPlay, shuffledMembers, betName);
    });
}

async function loadSavedMembers() {
    try {
        const members = await api('/api/members');
        const container = document.getElementById('setupSavedMembers');
        if (members.length === 0) { container.innerHTML = ''; return; }
        container.innerHTML = `
            <div class="setup-saved-title">등록된 멤버 (클릭하여 추가)</div>
            <div class="setup-saved-chips">
                ${members.map(m => `<button class="setup-saved-chip" data-name="${esc(m.name)}">${esc(m.name)}</button>`).join('')}
                <button class="setup-saved-chip setup-all-chip" data-action="all">전체 추가</button>
            </div>
        `;
        container.querySelectorAll('.setup-saved-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                if (chip.dataset.action === 'all') {
                    members.forEach(m => {
                        if (!setupMembers.includes(m.name)) setupMembers.push(m.name);
                    });
                } else {
                    const name = chip.dataset.name;
                    if (!setupMembers.includes(name)) setupMembers.push(name);
                    else { toast('이미 추가된 멤버입니다'); return; }
                }
                renderSetupMembers();
            });
        });
    } catch (e) {}
}

function renderSetupMembers() {
    const list = document.getElementById('setupMemberList');
    list.innerHTML = setupMembers.map((name, i) => `
        <div class="setup-member-tag">
            <span>${esc(name)}</span>
            <button class="setup-member-remove" data-idx="${i}">&times;</button>
        </div>
    `).join('');
    list.querySelectorAll('.setup-member-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            setupMembers.splice(parseInt(btn.dataset.idx), 1);
            renderSetupMembers();
        });
    });
    const startBtn = document.getElementById('setupStartBtn');
    if (startBtn) startBtn.disabled = setupMembers.length < 2;
}

const gameTitles = {
    ladder: '🪜 사다리 타기',
    wheel: '🎡 돌림판',
    card: '🃏 카드 뒤집기',
    box: '🎁 기프트 박스',
    pirate: '🏴‍☠️ 해적 통아저씨',
    race: '🏇 경마 레이스',
    croc: '🐊 악어 이빨',
    dice: '🎲 주사위',
    random: '❓ 랜덤 게임',
};

// Remember current game context for retry
let currentGameType = null;
let currentGamePlayers = null;
let currentGameBet = null;

function startGame(type, players, betName) {
    currentGameType = type;
    currentGamePlayers = players;
    currentGameBet = betName;

    // 다시하기 버튼 숨기기
    const footer = document.getElementById('gameFooter');
    if (footer) footer.style.display = 'none';

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
    const footer = document.getElementById('gameFooter');
    if (footer) footer.style.display = 'none';
});

document.getElementById('gameRetryBtn').addEventListener('click', () => {
    if (currentGameType && currentGamePlayers) {
        startGame(currentGameType, shuffle([...currentGamePlayers]), currentGameBet);
    }
});

function isRealMode() {
    const radio = document.querySelector('input[name="gameMode"]:checked');
    return radio && radio.value === 'real';
}

async function onGameComplete(winner, betName) {
    // 게임 완료 후 다시하기 버튼 표시
    const footer = document.getElementById('gameFooter');
    if (footer) footer.style.display = 'flex';

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
const BLOG_IMAGES = [
    'angry.gif','baby-tired.gif','battlefield.gif','bibimbap.gif','biden-confused.gif',
    'burned-out.jpeg','clapping.gif','coffee-time.gif','coffee.gif','damn-delicious.gif',
    'dont-wanna-go.gif','drunk.png','eating-deliciously.gif','flexing.gif','headache.gif',
    'hungry.gif','infinite-futures.gif','just-woke-up.gif','knock.gif','la-la-la.gif',
    'laughing-but-sad.gif','mistake.gif','morning-person.png','no-way-really.gif','no-way.png',
    'really-sorry.gif','rice-rice.gif','shameless.jpg','smug.jpg','so-good.gif',
    'something-amazing-happened.gif','startled.gif','take-my-money.gif','titanic-doge-musk.png',
    'unbelievable.gif','what-is-this-taste.gif','why.gif','wow-amazing.gif','wtf.gif','you-fool.gif'
];
function showResult(winner, betName, real) {
    const overlay = document.getElementById('resultOverlay');
    const emojis = ['🎉', '🏆', '👑', '🎊', '💥', '🤡', '💸', '😱'];
    document.getElementById('resultEmoji').textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const randomImg = BLOG_IMAGES[Math.floor(Math.random() * BLOG_IMAGES.length)];
    document.getElementById('resultBlogImg').src = BASE_PATH + '/static/blog-images/' + randomImg;
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

async function resetStats() {
    if (!confirm('모든 추첨 기록과 통계를 삭제합니다. 정말 초기화하시겠습니까?')) return;
    if (!confirm('되돌릴 수 없습니다. 정말로 삭제하시겠습니까?')) return;
    try {
        await api('/api/stats/reset', { method: 'DELETE' });
        toast('통계가 초기화되었습니다');
        loadStats();
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

// 경마 BGM (긴장감 있는 드럼+베이스)
let raceBgmCtx = null;
let raceBgmNodes = [];
function startRaceBgm() {
    try {
        stopRaceBgm();
        raceBgmCtx = new (window.AudioContext || window.webkitAudioContext)();
        const tempo = 140;
        const beat = 60 / tempo;

        // 드럼 패턴 (루프)
        function playDrum(time) {
            // 킥
            const kick = raceBgmCtx.createOscillator();
            const kickGain = raceBgmCtx.createGain();
            kick.connect(kickGain);
            kickGain.connect(raceBgmCtx.destination);
            kick.frequency.setValueAtTime(150, time);
            kick.frequency.exponentialRampToValueAtTime(30, time + 0.1);
            kickGain.gain.setValueAtTime(0.3, time);
            kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            kick.start(time);
            kick.stop(time + 0.15);
            raceBgmNodes.push(kick);

            // 하이햇
            const hh = raceBgmCtx.createOscillator();
            const hhGain = raceBgmCtx.createGain();
            const hhFilter = raceBgmCtx.createBiquadFilter();
            hh.type = 'square';
            hh.frequency.value = 5000;
            hhFilter.type = 'highpass';
            hhFilter.frequency.value = 7000;
            hh.connect(hhFilter);
            hhFilter.connect(hhGain);
            hhGain.connect(raceBgmCtx.destination);
            hhGain.gain.setValueAtTime(0.04, time + beat * 0.5);
            hhGain.gain.exponentialRampToValueAtTime(0.001, time + beat * 0.5 + 0.05);
            hh.start(time + beat * 0.5);
            hh.stop(time + beat * 0.5 + 0.05);
            raceBgmNodes.push(hh);
        }

        // 베이스라인 (긴장감)
        function playBass(time, note) {
            const bass = raceBgmCtx.createOscillator();
            const bassGain = raceBgmCtx.createGain();
            bass.type = 'sawtooth';
            bass.frequency.value = note;
            bass.connect(bassGain);
            bassGain.connect(raceBgmCtx.destination);
            bassGain.gain.setValueAtTime(0.08, time);
            bassGain.gain.setValueAtTime(0.08, time + beat * 0.8);
            bassGain.gain.exponentialRampToValueAtTime(0.001, time + beat);
            bass.start(time);
            bass.stop(time + beat);
            raceBgmNodes.push(bass);
        }

        const bassNotes = [82, 82, 98, 82, 110, 82, 98, 73]; // E2 패턴
        let loopCount = 0;
        function scheduleLoop() {
            if (!raceBgmCtx) return;
            const now = raceBgmCtx.currentTime;
            for (let i = 0; i < 8; i++) {
                const t = now + i * beat;
                playDrum(t);
                playBass(t, bassNotes[i % bassNotes.length]);
            }
            loopCount++;
            if (loopCount < 30) { // 최대 30루프 (~100초)
                setTimeout(scheduleLoop, beat * 8 * 1000 - 50);
            }
        }
        scheduleLoop();
    } catch (e) {}
}

function stopRaceBgm() {
    try {
        raceBgmNodes.forEach(n => { try { n.stop(); } catch(e){} });
        raceBgmNodes = [];
        if (raceBgmCtx) { raceBgmCtx.close(); raceBgmCtx = null; }
    } catch (e) {}
}

// ── Init ──
loadToday();
