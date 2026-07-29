// ── Custom Confirm ──
function customConfirm(msg, options = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customModalOverlay');
        const msgEl = document.getElementById('customModalMsg');
        const iconEl = document.getElementById('customModalIcon');
        const okBtn = document.getElementById('customModalOk');
        const cancelBtn = document.getElementById('customModalCancel');

        msgEl.textContent = msg;
        iconEl.textContent = options.icon || '⚠️';
        okBtn.textContent = options.okText || '확인';
        okBtn.className = 'custom-modal-ok' + (options.danger ? ' danger' : '');
        cancelBtn.textContent = options.cancelText || '취소';
        overlay.classList.add('active');

        function cleanup() {
            overlay.classList.remove('active');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        }
        okBtn.onclick = () => { cleanup(); resolve(true); };
        cancelBtn.onclick = () => { cleanup(); resolve(false); };
    });
}

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
        if (target === 'members') { loadMembers(); loadGroups(); }
        if (target === 'stats') loadStats();
        if (target === 'history') loadHistory();
        if (target === 'draw') loadToday();
    });
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
window.raceSpeed = 'normal'; // slow, normal, fast

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
                    <button class="setup-mode-btn${window.isGuest ? ' disabled' : ''}" data-mode="real" ${window.isGuest ? 'disabled' : ''}>
                        <span class="setup-mode-icon">🔴</span>
                        <span class="setup-mode-label">실전</span>
                        <span class="setup-mode-desc">${window.isGuest ? '로그인 필요' : '결과가 기록돼요'}</span>
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
                ${gameType === 'race' ? `
                <div class="setup-bet-section">
                    <h4 class="setup-heading-sm">🏇 경주 속도</h4>
                    <div class="setup-bet-chips">
                        <button class="setup-speed-chip" data-speed="slow">🐢 느림</button>
                        <button class="setup-speed-chip active" data-speed="normal">🐎 보통</button>
                        <button class="setup-speed-chip" data-speed="fast">🚀 빠름</button>
                    </div>
                </div>
                ` : ''}
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

    // Speed chips (경마 레이스)
    window.raceSpeed = 'normal';
    overlay.querySelectorAll('.setup-speed-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            overlay.querySelectorAll('.setup-speed-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            window.raceSpeed = chip.dataset.speed;
        });
    });

    // Start game
    document.getElementById('setupStartBtn').addEventListener('click', () => {
        if (setupMembers.length < 2) { toast('최소 2명 이상 필요합니다'); return; }
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
        const groups = await api('/api/groups');
        const container = document.getElementById('setupSavedMembers');

        let html = '';

        // 그룹 불러오기
        if (groups.length > 0) {
            html += `
                <div class="setup-saved-title">📁 그룹 불러오기</div>
                <div class="setup-saved-chips">
                    ${groups.map(g => {
                        const names = g.member_names ? g.member_names.split(',').filter(n => n.trim()) : [];
                        return names.length ? `<button class="setup-saved-chip setup-group-chip" data-group-id="${g.id}">${esc(g.name)} (${names.length}명)</button>` : '';
                    }).join('')}
                </div>
            `;
        }

        // 등록된 멤버
        if (members.length > 0) {
            html += `
                <div class="setup-saved-title">등록된 멤버 (클릭하여 추가)</div>
                <div class="setup-saved-chips">
                    ${members.map(m => `<button class="setup-saved-chip" data-name="${esc(m.name)}">${esc(m.name)}</button>`).join('')}
                    <button class="setup-saved-chip setup-all-chip" data-action="all">전체 추가</button>
                </div>
            `;
        }

        container.innerHTML = html;

        // 그룹 클릭 이벤트
        container.querySelectorAll('.setup-group-chip').forEach(chip => {
            chip.addEventListener('click', async () => {
                const groupId = chip.dataset.groupId;
                try {
                    const groups = await api('/api/groups');
                    const group = groups.find(g => g.id == groupId);
                    if (group && group.member_names) {
                        const names = group.member_names.split(',').map(n => n.trim()).filter(n => n);
                        setupMembers = [...names];
                        renderSetupMembers();
                        toast(`'${group.name}' 그룹 멤버 적용!`);
                    }
                } catch (e) { toast('그룹 불러오기 실패'); }
            });
        });

        // 멤버 클릭 이벤트
        container.querySelectorAll('.setup-saved-chip:not(.setup-group-chip)').forEach(chip => {
            chip.addEventListener('click', () => {
                if (chip.dataset.action === 'all') {
                    members.forEach(m => {
                        if (!setupMembers.includes(m.name)) setupMembers.push(m.name);
                    });
                } else if (chip.dataset.name) {
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
    if (typeof stopRaceBgm === 'function') stopRaceBgm();
});

function isRealMode() {
    return setupMode === 'real';
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
    document.getElementById('resultBlogImg').src = BASE_PATH + '/static/blog-images/wtf.gif';
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
        document.getElementById('resultBetInfo').textContent = `${winner}님 당첨!`;
        document.getElementById('resultAnnounce').textContent = '🔵 연습 모드';
    }

    overlay.classList.add('active');
    startConfetti();
}

// 확인: 결과창만 닫고 게임 화면은 그대로 유지
document.getElementById('resultCloseBtn').addEventListener('click', () => {
    document.getElementById('resultOverlay').classList.remove('active');
    stopConfetti();
});

// 게임 화면 이미지 저장 (모바일 대응)
async function saveGameImage() {
    const btn = document.querySelector('.game-save-btn');
    const origText = btn.textContent;
    btn.textContent = '캡처 중...';
    btn.disabled = true;
    try {
        const gameArea = document.getElementById('gameContainer');
        const footer = document.getElementById('gameFooter');
        footer.style.display = 'none';
        const canvas = await html2canvas(gameArea, {
            backgroundColor: '#1a1a2e',
            scale: 2,
            useCORS: true,
            allowTaint: true,
        });
        footer.style.display = '';

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        const fileName = `daily-bet-game_${dateStr}.png`;

        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));

        // 1순위: Web Share API (모바일 최적)
        if (navigator.share) {
            try {
                const file = new File([blob], fileName, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Daily Bet 결과' });
                    toast('공유 완료!');
                    return;
                }
            } catch(e) {
                if (e.name === 'AbortError') return;
            }
        }

        // 2순위: blob URL로 다운로드
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        toast('이미지 저장 완료!');
    } catch(e) {
        console.error('캡처 오류:', e);
        toast('이미지 저장 실패');
    } finally {
        btn.textContent = origText;
        btn.disabled = false;
    }
}

// 결과 이미지 저장
async function saveResultImage() {
    const btn = document.getElementById('resultSaveBtn');
    const origText = btn.textContent;
    btn.textContent = '캡처 중...';
    btn.disabled = true;
    try {
        const content = document.querySelector('.result-content');
        // 버튼 영역 숨기고 캡처
        const buttons = content.querySelector('.result-buttons');
        buttons.style.display = 'none';
        const canvas = await html2canvas(content, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
            allowTaint: true,
        });
        buttons.style.display = '';
        // 다운로드
        const link = document.createElement('a');
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        link.download = `daily-bet_${dateStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast('이미지 저장 완료!');
    } catch(e) {
        console.error('캡처 오류:', e);
        toast('이미지 저장 실패');
    } finally {
        btn.textContent = origText;
        btn.disabled = false;
    }
}

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
    if (!await customConfirm(`${name}을(를) 삭제하시겠습니까?`, { icon: '🗑️', okText: '삭제', danger: true })) return;
    try {
        await api(`/api/members/${id}`, { method: 'DELETE' });
        toast(`${name} 삭제 완료`);
        loadMembers();
    } catch (err) { toast(err.message); }
}

// ── Groups ──
let groupMembers = [];
let allMembersList = [];
let editingGroupId = null;
let editingGroupName = '';

function openGroupPopup() {
    document.getElementById('groupName').value = '';
    document.getElementById('groupOverlay').style.display = 'flex';
    document.getElementById('groupListView').style.display = 'block';
    document.getElementById('groupEditView').style.display = 'none';
    document.getElementById('groupPopupTitle').textContent = '📁 그룹 관리';
    loadGroups();
}

function closeGroupPopup() {
    document.getElementById('groupOverlay').style.display = 'none';
}

function backToGroupList() {
    document.getElementById('groupListView').style.display = 'block';
    document.getElementById('groupEditView').style.display = 'none';
    document.getElementById('groupPopupTitle').textContent = '📁 그룹 관리';
    loadGroups();
}

async function createGroup() {
    const nameInput = document.getElementById('groupName');
    const name = nameInput.value.trim();
    if (!name) { toast('그룹 이름을 입력하세요'); return; }
    try {
        const res = await api('/api/groups', { method: 'POST', body: JSON.stringify({ name, member_names: '' }) });
        toast(res.message || '그룹 생성 완료');
        nameInput.value = '';
        loadGroups();
        // 바로 편집 화면으로 이동
        openGroupEdit(res.id, name);
    } catch (err) { toast(err.message); }
}

async function openGroupEdit(id, name) {
    editingGroupId = id;
    editingGroupName = name;
    groupMembers = [];

    // 기존 멤버 불러오기
    try {
        const groups = await api('/api/groups');
        const group = groups.find(g => g.id === id);
        if (group && group.member_names) {
            groupMembers = group.member_names.split(',').map(n => n.trim()).filter(n => n);
        }
    } catch (e) {}

    // 검색용 전체 멤버 캐시
    api('/api/members').then(data => { allMembersList = data; });

    document.getElementById('groupListView').style.display = 'none';
    document.getElementById('groupEditView').style.display = 'block';
    document.getElementById('groupPopupTitle').textContent = `✏️ ${name}`;
    renderGroupChips();

    // 검색 이벤트
    const searchInput = document.getElementById('groupMemberSearch');
    searchInput.value = '';
    searchInput.oninput = function() { renderSuggestions(this.value.trim()); };
    searchInput.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); addGroupMember(); }
    };
}

function renderGroupChips() {
    const el = document.getElementById('groupSelectedMembers');
    if (!groupMembers.length) {
        el.innerHTML = '<span style="color:var(--gray-300);font-size:0.8rem;">멤버를 추가하세요</span>';
        return;
    }
    el.innerHTML = groupMembers.map((name, i) =>
        `<span class="group-chip">${esc(name)}<span class="remove" onclick="removeGroupMember(${i})">&times;</span></span>`
    ).join('');
}

function renderSuggestions(query) {
    const box = document.getElementById('groupSuggestBox');
    if (!query) { box.style.display = 'none'; box.innerHTML = ''; return; }

    const filtered = allMembersList
        .filter(m => m.name.includes(query) && !groupMembers.includes(m.name))
        .slice(0, 5);
    if (!filtered.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

    box.style.display = 'block';
    box.innerHTML = filtered.map(m =>
        `<div class="group-suggest-item" onclick="selectSuggestion('${esc(m.name)}')">${esc(m.name)}</div>`
    ).join('');
}

function selectSuggestion(name) {
    if (!groupMembers.includes(name)) {
        groupMembers.push(name);
        renderGroupChips();
    }
    document.getElementById('groupMemberSearch').value = '';
    document.getElementById('groupSuggestBox').style.display = 'none';
}

function addGroupMember() {
    const input = document.getElementById('groupMemberSearch');
    const name = input.value.trim();
    if (!name) return;
    if (groupMembers.includes(name)) { toast('이미 추가된 멤버입니다'); return; }
    groupMembers.push(name);
    renderGroupChips();
    input.value = '';
    document.getElementById('groupSuggestBox').style.display = 'none';
}

function removeGroupMember(index) {
    groupMembers.splice(index, 1);
    renderGroupChips();
}

async function saveGroupMembers() {
    if (!editingGroupId) return;
    const memberNames = groupMembers.join(',');
    try {
        await api('/api/groups', { method: 'POST', body: JSON.stringify({ name: editingGroupName, member_names: memberNames }) });
        toast('멤버 저장 완료');
    } catch (err) { toast(err.message); }
}

async function loadGroups() {
    try {
        const data = await api('/api/groups');
        const el = document.getElementById('groupList');
        if (!data.length) {
            el.innerHTML = '<div style="text-align:center;color:var(--gray-400);padding:16px;font-size:0.85rem;">저장된 그룹이 없습니다</div>';
            return;
        }
        el.innerHTML = data.map(g => {
            const names = g.member_names ? g.member_names.split(',').map(n => n.trim()).filter(n => n) : [];
            return `
                <div class="group-item">
                    <div class="group-item-info" onclick="openGroupEdit(${g.id}, '${esc(g.name)}')" style="cursor:pointer;">
                        <div class="group-item-name">${esc(g.name)} <span style="font-weight:400;color:var(--gray-400);font-size:0.75rem;">(${names.length}명)</span></div>
                        <div class="group-item-members">${names.length ? names.map(n => esc(n)).join(', ') : '멤버 없음 - 클릭하여 추가'}</div>
                    </div>
                    <div class="group-item-actions">
                        <button class="group-load-btn" onclick="loadGroup(${g.id}, '${esc(g.name)}')" ${!names.length ? 'disabled style="opacity:0.4;cursor:not-allowed;padding:6px 14px;border:none;border-radius:8px;background:var(--primary);color:#fff;font-size:0.78rem;font-weight:600;"' : ''}>불러오기</button>
                        <button class="group-del-btn" onclick="deleteGroup(${g.id}, '${esc(g.name)}')">삭제</button>
                    </div>
                </div>`;
        }).join('');
    } catch (err) { console.error('그룹 로드 오류:', err); }
}

async function loadGroup(id, name) {
    if (!await customConfirm(`'${name}' 그룹을 불러오시겠습니까?\n현재 멤버가 교체됩니다.`, { icon: '📁', okText: '불러오기' })) return;
    try {
        const res = await api(`/api/groups/${id}/load`, { method: 'POST' });
        toast(res.message || '그룹 불러오기 완료');
        loadMembers();
        closeGroupPopup();
    } catch (err) { toast(err.message); }
}

async function deleteGroup(id, name) {
    if (!await customConfirm(`'${name}' 그룹을 삭제하시겠습니까?`, { icon: '🗑️', okText: '삭제', danger: true })) return;
    try {
        await api(`/api/groups/${id}`, { method: 'DELETE' });
        toast('그룹 삭제 완료');
        loadGroups();
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
    if (!await customConfirm('이 기록을 삭제하시겠습니까?', { icon: '🗑️', okText: '삭제', danger: true })) return;
    try {
        await api(`/api/history/${id}`, { method: 'DELETE' });
        toast('삭제 완료');
        loadHistory();
    } catch (err) { toast(err.message); }
}

async function resetStats() {
    if (!await customConfirm('모든 추첨 기록과 통계를 삭제합니다.\n정말 초기화하시겠습니까?', { icon: '⚠️', okText: '초기화', danger: true })) return;
    if (!await customConfirm('되돌릴 수 없습니다.\n정말로 삭제하시겠습니까?', { icon: '🚨', okText: '삭제', danger: true })) return;
    try {
        await api('/api/stats/reset', { method: 'DELETE' });
        toast('통계가 초기화되었습니다');
        loadStats();
        loadHistory();
    } catch (err) { toast(err.message); }
}

// ── Sound Helper ──
// 모바일 오디오 활성화 (사용자 터치 시 resume)
let _sharedAudioCtx = null;
function getAudioCtx() {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
        _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_sharedAudioCtx.state === 'suspended') _sharedAudioCtx.resume();
    return _sharedAudioCtx;
}
document.addEventListener('touchstart', () => { getAudioCtx(); }, { once: true });
document.addEventListener('click', () => { getAudioCtx(); }, { once: true });

function playSound(type) {
    try {
        const ctx = getAudioCtx();
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
        } else if (type === 'slash') {
            // 칼 베는 소리 (쉭~)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(2000, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.6, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'bat_hit') {
            // 방망이 타격 소리 (퍽!)
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.7, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        } else if (type === 'explode') {
            // 폭탄 폭발 소리 (쾅!)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.8, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        }
    } catch (e) {}
}

// 경마 BGM (긴장감 있는 드럼+베이스)
let raceBgmCtx = null;
let raceBgmNodes = [];
function startRaceBgm() {
    try {
        stopRaceBgm();
        raceBgmCtx = getAudioCtx();
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
        raceBgmCtx = null;
    } catch (e) {}
}

// ── Init ──
loadToday();
