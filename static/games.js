/* ══════════════════════════════════════════════════
   Daily Bet - 10 Mini Games
   ══════════════════════════════════════════════════ */

const Games = {};

// ─────────────────────────────────────
// 1. Ghost Leg (사다리 타기)
// ─────────────────────────────────────
Games.ladder = function(container, players, onWin) {
    const n = players.length;
    const levels = 12;
    const w = Math.min(600, window.innerWidth - 40);
    const h = 450;
    const padX = 50;
    const padTop = 20;
    const padBot = 40;
    const colW = (w - padX * 2) / (n - 1);

    // Pre-decide: one random bottom position is the "fail" slot
    const failSlot = Math.floor(Math.random() * n);

    // Generate rungs
    const rungs = [];
    for (let lv = 0; lv < levels; lv++) {
        const lvRungs = [];
        const used = new Set();
        for (let col = 0; col < n - 1; col++) {
            if (used.has(col - 1)) continue; // no consecutive
            if (Math.random() < 0.45) {
                lvRungs.push({ col, lv });
                used.add(col);
            }
        }
        rungs.push(lvRungs);
    }

    // Compute path: start from a column, follow rungs down, return final column
    function computePath(startCol) {
        const path = [];
        let col = startCol;
        path.push({ col, lv: -1 });
        for (let lv = 0; lv < levels; lv++) {
            const lvRungs = rungs[lv];
            for (const r of lvRungs) {
                if (r.col === col) { col++; break; }
                if (r.col === col - 1) { col--; break; }
            }
            path.push({ col, lv });
        }
        return { path, endCol: col };
    }

    // Build coordinate points from a path for animation
    function pathToPoints(path) {
        const points = [];
        points.push({ x: getX(path[0].col), y: getY(-1) });
        for (let i = 1; i < path.length; i++) {
            const prevCol = path[i - 1].col;
            const currCol = path[i].col;
            const y = getY(path[i].lv);
            if (prevCol !== currCol) {
                points.push({ x: getX(prevCol), y });
                points.push({ x: getX(currCol), y });
            } else {
                points.push({ x: getX(currCol), y });
            }
        }
        const lastCol = path[path.length - 1].col;
        points.push({ x: getX(lastCol), y: h - padBot + 10 });
        return { points, endCol: lastCol };
    }

    function getX(col) { return padX + col * colW; }
    function getY(lv) {
        if (lv < 0) return padTop;
        return padTop + 40 + lv * ((h - padTop - padBot - 40) / (levels - 1));
    }

    const div = document.createElement('div');
    div.className = 'ladder-game';

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'text-align:center;margin-bottom:12px;color:#6B7280;font-weight:600;font-size:0.9rem;';
    infoDiv.textContent = '드래그로 순서를 바꾼 후, 이름을 클릭하면 출발!';
    div.appendChild(infoDiv);

    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
                   '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#06B6D4'];

    // Player labels (top) with fixed colors + drag to reorder
    const playersDiv = document.createElement('div');
    playersDiv.className = 'ladder-players';
    let gameStarted = false;

    function renderPlayerLabels() {
        playersDiv.innerHTML = '';
        players.forEach((name, i) => {
            const c = colors[i % colors.length];
            const btn = document.createElement('button');
            btn.className = 'ladder-player ladder-player-fixed';
            btn.draggable = true;
            btn.dataset.idx = i;
            btn.style.cssText = `background:${c};color:white;border:2px solid ${c};cursor:${gameStarted ? 'pointer' : 'grab'};user-select:none;transition:transform .15s,opacity .15s;`;
            btn.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:white;margin-right:6px;vertical-align:middle;opacity:.7;"></span>${esc(name)}`;
            btn.addEventListener('click', () => startSingleRun(i));

            // Drag events
            btn.addEventListener('dragstart', (e) => {
                if (gameStarted) { e.preventDefault(); return; }
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
                btn.style.opacity = '0.4';
            });
            btn.addEventListener('dragend', () => { btn.style.opacity = '1'; });
            btn.addEventListener('dragover', (e) => {
                if (gameStarted) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                btn.style.transform = 'scale(1.1)';
            });
            btn.addEventListener('dragleave', () => { btn.style.transform = ''; });
            btn.addEventListener('drop', (e) => {
                e.preventDefault();
                btn.style.transform = '';
                if (gameStarted) return;
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = i;
                if (fromIdx === toIdx) return;
                // Swap players
                [players[fromIdx], players[toIdx]] = [players[toIdx], players[fromIdx]];
                renderPlayerLabels();
            });

            // Touch drag support
            let touchStartIdx = null;
            btn.addEventListener('touchstart', (e) => {
                if (gameStarted) return;
                touchStartIdx = i;
                btn.style.opacity = '0.5';
            }, { passive: true });
            btn.addEventListener('touchend', (e) => {
                btn.style.opacity = '1';
                if (gameStarted || touchStartIdx === null) return;
                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetBtn = target && target.closest('.ladder-player');
                if (targetBtn && targetBtn.dataset.idx !== undefined) {
                    const toIdx = parseInt(targetBtn.dataset.idx);
                    if (touchStartIdx !== toIdx) {
                        [players[touchStartIdx], players[toIdx]] = [players[toIdx], players[touchStartIdx]];
                        renderPlayerLabels();
                    }
                }
                touchStartIdx = null;
            });

            playersDiv.appendChild(btn);
        });
    }
    renderPlayerLabels();
    div.appendChild(playersDiv);

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'ladder-canvas';
    canvas.width = w;
    canvas.height = h;
    div.appendChild(canvas);

    // Bottom result area - 꽝/당첨은 처음부터 표시, 이름은 나중에
    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'ladder-results';
    bottomDiv.style.cssText = 'display:flex;justify-content:space-around;margin-top:8px;';
    for (let i = 0; i < n; i++) {
        const lbl = document.createElement('div');
        lbl.style.cssText = 'text-align:center;font-size:0.85rem;font-weight:700;min-width:50px;line-height:1.6;';
        if (i === failSlot) {
            lbl.innerHTML = '<span style="background:#FEE2E2;color:#DC2626;padding:4px 12px;border-radius:8px;">💀 꽝</span>';
        } else {
            lbl.innerHTML = '<span style="background:#D1FAE5;color:#065F46;padding:4px 12px;border-radius:8px;">✅ 세이프</span>';
        }
        bottomDiv.appendChild(lbl);
    }
    div.appendChild(bottomDiv);

    // "모두 출발" button
    const allBtn = document.createElement('button');
    allBtn.className = 'ladder-start-btn';
    allBtn.textContent = '모두 한꺼번에 출발!';
    allBtn.addEventListener('click', startAllRun);
    div.appendChild(allBtn);

    container.appendChild(div);

    const ctx = canvas.getContext('2d');
    const completedPaths = []; // store drawn paths for re-render
    let animating = false;
    let gameFinished = false;

    drawLadder();

    function drawLadder() {
        ctx.clearRect(0, 0, w, h);

        // Vertical lines
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 3;
        for (let i = 0; i < n; i++) {
            ctx.beginPath();
            ctx.moveTo(getX(i), padTop);
            ctx.lineTo(getX(i), h - padBot + 10);
            ctx.stroke();
        }

        // Rungs
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 2;
        for (const lvRungs of rungs) {
            for (const r of lvRungs) {
                const y = getY(r.lv);
                ctx.beginPath();
                ctx.moveTo(getX(r.col), y);
                ctx.lineTo(getX(r.col + 1), y);
                ctx.stroke();
            }
        }

        // Re-draw any completed paths + name labels
        completedPaths.forEach(cp => {
            ctx.strokeStyle = cp.color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(cp.points[0].x, cp.points[0].y);
            for (let i = 1; i < cp.points.length; i++) ctx.lineTo(cp.points[i].x, cp.points[i].y);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Draw name at the end point
            const endPt = cp.points[cp.points.length - 1];
            drawBall(endPt.x, endPt.y, cp.color);
            ctx.fillStyle = cp.color;
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(cp.name, endPt.x, endPt.y + 26);
        });
    }

    function drawBall(x, y, color) {
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Draw a path line + ball for a runner at its current position
    function drawRunnerState(runner) {
        ctx.strokeStyle = runner.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(runner.points[0].x, runner.points[0].y);
        for (let i = 1; i < runner.ptIdx; i++) ctx.lineTo(runner.points[i].x, runner.points[i].y);
        ctx.lineTo(runner.cx, runner.cy);
        ctx.stroke();
        drawBall(runner.cx, runner.cy, runner.color);
    }

    // Create a runner object for a player
    function createRunner(startIdx) {
        const { path, endCol } = computePath(startIdx);
        const { points } = pathToPoints(path);
        const color = colors[startIdx % colors.length];
        return {
            idx: startIdx,
            points,
            endCol,
            color,
            cx: points[0].x,
            cy: points[0].y,
            ptIdx: 1,
            done: false,
            speed: 4
        };
    }

    // Step one runner forward; returns true if newly finished
    function stepRunner(r) {
        if (r.done) return false;
        if (r.ptIdx >= r.points.length) {
            r.done = true;
            completedPaths.push({ points: r.points, color: r.color, name: players[r.idx] });
            return true;
        }
        const target = r.points[r.ptIdx];
        const dx = target.x - r.cx;
        const dy = target.y - r.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r.speed) {
            r.cx = target.x;
            r.cy = target.y;
            r.ptIdx++;
        } else {
            r.cx += (dx / dist) * r.speed;
            r.cy += (dy / dist) * r.speed;
        }
        return false;
    }

    // Animate a single path and return a promise that resolves with endCol
    function animateOnePath(startIdx) {
        return new Promise((resolve) => {
            const runner = createRunner(startIdx);
            playersDiv.children[startIdx].classList.add('selected');

            function frame() {
                const justFinished = stepRunner(runner);
                drawLadder();
                drawRunnerState(runner);

                if (justFinished) {
                    playSound('tick');
                    resolve(runner.endCol);
                    return;
                }
                requestAnimationFrame(frame);
            }
            frame();
        });
    }

    // Animate ALL runners simultaneously, resolve when all done
    function animateAllPaths(runners) {
        return new Promise((resolve) => {
            runners.forEach(r => playersDiv.children[r.idx].classList.add('selected'));

            function frame() {
                let anyActive = false;
                runners.forEach(r => {
                    const justFinished = stepRunner(r);
                    if (justFinished) playSound('tick');
                    if (!r.done) anyActive = true;
                });

                // Redraw everything
                drawLadder();
                runners.forEach(r => drawRunnerState(r));

                if (anyActive) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            }
            frame();
        });
    }

    function revealBottom() {
        // 기존 꽝/세이프 라벨 위에 이름만 추가
        const colToPlayer = {};
        for (const [idx, endCol] of Object.entries(runResults)) {
            colToPlayer[endCol] = players[idx];
        }
        for (let i = 0; i < n; i++) {
            const lbl = bottomDiv.children[i];
            const name = colToPlayer[i] || '?';
            const color = i === failSlot ? '#DC2626' : '#065F46';
            // 이름을 라벨 위에 삽입
            const nameDiv = document.createElement('div');
            nameDiv.style.cssText = `color:${color};font-size:0.9rem;font-weight:800;margin-bottom:2px;animation:resultPop .4s ease-out;`;
            nameDiv.textContent = name;
            lbl.insertBefore(nameDiv, lbl.firstChild);
        }
    }

    const runResults = {};

    function checkAllDone() {
        if (Object.keys(runResults).length < n) return;
        gameFinished = true;
        revealBottom();

        let loser = null;
        for (const [idx, endCol] of Object.entries(runResults)) {
            if (endCol === failSlot) loser = players[idx];
        }

        const resultLabel = document.createElement('div');
        resultLabel.style.cssText = 'text-align:center;margin-top:16px;font-size:1.5rem;font-weight:900;color:#DC2626;animation:resultPop .4s ease-out;';
        resultLabel.textContent = `💀 ${loser} 당첨!`;
        div.appendChild(resultLabel);
        playSound('boom');

        setTimeout(() => onWin(loser), 3000);
    }

    // Single player click
    async function startSingleRun(idx) {
        if (animating || gameFinished || runResults[idx] !== undefined) return;
        if (!gameStarted) {
            gameStarted = true;
            infoDiv.textContent = '이름을 클릭하면 출발!';
            renderPlayerLabels(); // 드래그 커서 -> 포인터로 전환
        }
        animating = true;
        allBtn.style.display = 'none';

        const endCol = await animateOnePath(idx);
        runResults[idx] = endCol;
        animating = false;

        const remaining = n - Object.keys(runResults).length;
        if (remaining > 0) {
            infoDiv.textContent = `나머지 ${remaining}명도 클릭하세요!`;
        }
        checkAllDone();
    }

    // All at once: everyone runs simultaneously
    async function startAllRun() {
        if (animating || gameFinished) return;
        gameStarted = true;
        renderPlayerLabels();
        animating = true;
        allBtn.disabled = true;
        infoDiv.textContent = '사다리 타는 중...';

        const runners = [];
        for (let i = 0; i < n; i++) {
            runners.push(createRunner(i));
        }

        await animateAllPaths(runners);

        // Record results
        for (const r of runners) {
            runResults[r.idx] = r.endCol;
        }

        animating = false;
        checkAllDone();
    }
};


// ─────────────────────────────────────
// 2. Lucky Wheel (돌림판)
// ─────────────────────────────────────
Games.wheel = function(container, players, onWin) {
    // 모드 선택 화면
    container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;max-width:400px;margin:0 auto;">
            <h3 style="font-size:1.3rem;font-weight:700;color:#4F46E5;margin-bottom:24px;">🎡 돌림판 모드 선택</h3>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="wheelNormal" style="
                    flex:1;padding:24px 16px;background:#fff;border:2px solid #E2E8F0;border-radius:16px;
                    cursor:pointer;transition:all 0.2s;text-align:center;
                ">
                    <div style="font-size:2rem;margin-bottom:8px;">🎯</div>
                    <div style="font-size:1rem;font-weight:700;color:#1E293B;">클래식</div>
                    <div style="font-size:0.75rem;color:#94A3B8;margin-top:4px;">참가자 수만큼 동일 칸</div>
                </button>
                <button id="wheelClassic" style="
                    flex:1;padding:24px 16px;background:#fff;border:2px solid #E2E8F0;border-radius:16px;
                    cursor:pointer;transition:all 0.2s;text-align:center;
                ">
                    <div style="font-size:2rem;margin-bottom:8px;">🎰</div>
                    <div style="font-size:1rem;font-weight:700;color:#1E293B;">다이나믹</div>
                    <div style="font-size:0.75rem;color:#94A3B8;margin-top:4px;">20칸 랜덤 비율 배정</div>
                </button>
            </div>
        </div>
    `;

    document.getElementById('wheelNormal').addEventListener('click', () => {
        container.innerHTML = '';
        wheelNormal(container, players, onWin);
    });
    document.getElementById('wheelClassic').addEventListener('click', () => {
        container.innerHTML = '';
        wheelClassic(container, players, onWin);
    });
};

// 다이나믹 모드 - 20칸 랜덤 비율 배정
function wheelClassic(container, players, onWin) {
    const totalSlots = 20;
    const n = players.length;
    const size = Math.min(320, window.innerWidth - 80);

    // 랜덤 비율로 칸 배정
    const slots = [];
    const counts = new Array(n).fill(0);

    // 최소 1칸씩 보장
    for (let i = 0; i < n; i++) {
        counts[i] = 1;
    }
    // 나머지 칸 랜덤 배정
    let remaining = totalSlots - n;
    while (remaining > 0) {
        const randPlayer = Math.floor(Math.random() * n);
        counts[randPlayer]++;
        remaining--;
    }

    // 슬롯 배열 생성 (연속되지 않도록 분산 배치)
    const playerSlots = [];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < counts[i]; j++) {
            playerSlots.push(i);
        }
    }
    // 셔플
    for (let i = playerSlots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerSlots[i], playerSlots[j]] = [playerSlots[j], playerSlots[i]];
    }

    const div = document.createElement('div');
    div.className = 'wheel-game';

    // 비율 표시
    const ratioDiv = document.createElement('div');
    ratioDiv.style.cssText = 'text-align:center;margin-bottom:12px;';
    ratioDiv.innerHTML = players.map((p, i) => {
        const pct = Math.round(counts[i] / totalSlots * 100);
        return `<span style="display:inline-block;margin:3px 6px;padding:4px 10px;border-radius:8px;font-size:0.8rem;font-weight:600;background:${['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#06B6D4'][i % 10]}20;color:${['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#06B6D4'][i % 10]};">${p}: ${counts[i]}칸 (${pct}%)</span>`;
    }).join('');
    div.appendChild(ratioDiv);

    const wrapper = document.createElement('div');
    wrapper.className = 'wheel-wrapper';

    const pointer = document.createElement('div');
    pointer.className = 'wheel-pointer';
    pointer.textContent = '▼';
    wrapper.appendChild(pointer);

    const canvas = document.createElement('canvas');
    canvas.className = 'wheel-canvas';
    canvas.width = size;
    canvas.height = size;
    wrapper.appendChild(canvas);
    div.appendChild(wrapper);

    const spinBtn = document.createElement('button');
    spinBtn.className = 'wheel-spin-btn';
    spinBtn.textContent = '돌리기!';
    div.appendChild(spinBtn);

    container.appendChild(div);

    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2, radius = size / 2 - 4;
    const sliceAngle = (Math.PI * 2) / totalSlots;

    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
                   '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#06B6D4',
                   '#84CC16', '#A855F7'];

    let currentRotation = 0;

    function drawWheel(rotation) {
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        for (let i = 0; i < totalSlots; i++) {
            const start = i * sliceAngle;
            const end = start + sliceAngle;
            const playerIdx = playerSlots[i];

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, start, end);
            ctx.closePath();
            ctx.fillStyle = colors[playerIdx % colors.length];
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 이름 (간격이 좁으니 짧게)
            ctx.save();
            ctx.rotate(start + sliceAngle / 2);
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.min(10, 140 / totalSlots)}px sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,.3)';
            ctx.shadowBlur = 2;
            const name = players[playerIdx].length > 3 ? players[playerIdx].substring(0, 3) : players[playerIdx];
            ctx.fillText(name, radius * 0.7, 3);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    drawWheel(0);

    function getWinnerFromRotation(rot) {
        let pointerAngle = (-Math.PI / 2 - rot) % (Math.PI * 2);
        if (pointerAngle < 0) pointerAngle += Math.PI * 2;
        const idx = Math.floor(pointerAngle / sliceAngle) % totalSlots;
        return playerSlots[idx];
    }

    spinBtn.addEventListener('click', () => {
        spinBtn.disabled = true;
        const extraAngle = Math.random() * Math.PI * 2;
        const spins = 5 + Math.random() * 3;
        const totalRotation = spins * Math.PI * 2 + extraAngle;
        const duration = 5000;
        const startTime = performance.now();
        const startRot = currentRotation;
        let lastTickSlice = -1;

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const rot = startRot + totalRotation * ease;
            drawWheel(rot);

            const currentSlice = getWinnerFromRotation(rot);
            if (currentSlice !== lastTickSlice && progress > 0.1) {
                playSound('tick');
                pointer.style.transform = 'translateX(-50%) scale(1.2)';
                setTimeout(() => { pointer.style.transform = 'translateX(-50%)'; }, 50);
            }
            lastTickSlice = currentSlice;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                currentRotation = rot;
                const winnerIdx = getWinnerFromRotation(rot);
                playSound('win');
                setTimeout(() => onWin(players[winnerIdx]), 800);
            }
        }
        requestAnimationFrame(animate);
    });
}

// 클래식 모드 - 동일 칸
function wheelNormal(container, players, onWin) {
    const n = players.length;
    const size = Math.min(320, window.innerWidth - 80);

    const div = document.createElement('div');
    div.className = 'wheel-game';

    const wrapper = document.createElement('div');
    wrapper.className = 'wheel-wrapper';

    const pointer = document.createElement('div');
    pointer.className = 'wheel-pointer';
    pointer.textContent = '▼';
    wrapper.appendChild(pointer);

    const canvas = document.createElement('canvas');
    canvas.className = 'wheel-canvas';
    canvas.width = size;
    canvas.height = size;
    wrapper.appendChild(canvas);
    div.appendChild(wrapper);

    const spinBtn = document.createElement('button');
    spinBtn.className = 'wheel-spin-btn';
    spinBtn.textContent = '돌리기!';
    div.appendChild(spinBtn);

    container.appendChild(div);

    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2, radius = size / 2 - 4;
    const sliceAngle = (Math.PI * 2) / n;

    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
                   '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#06B6D4',
                   '#84CC16', '#A855F7'];

    let currentRotation = 0;

    function drawWheel(rotation) {
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        for (let i = 0; i < n; i++) {
            const start = i * sliceAngle;
            const end = start + sliceAngle;

            // Slice
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, start, end);
            ctx.closePath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Text
            ctx.save();
            ctx.rotate(start + sliceAngle / 2);
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.min(16, 200 / n)}px sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,.3)';
            ctx.shadowBlur = 3;
            ctx.fillText(players[i], radius * 0.6, 5);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Center circle
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    drawWheel(0);

    // Pointer is at the top (12 o'clock = -90deg = -PI/2)
    // Canvas arc starts at 3 o'clock (0 rad), goes clockwise
    // Slice i spans from i*sliceAngle to (i+1)*sliceAngle
    // After rotation `rot`, the angle at pointer position is: -rot - PI/2
    // We need to find which slice that falls into.

    function getWinnerFromRotation(rot) {
        // The pointer is fixed at top (-PI/2).
        // The wheel is rotated by `rot`.
        // The unrotated angle that now sits under the pointer is: (-PI/2 - rot)
        let pointerAngle = (-Math.PI / 2 - rot) % (Math.PI * 2);
        if (pointerAngle < 0) pointerAngle += Math.PI * 2;
        const idx = Math.floor(pointerAngle / sliceAngle) % n;
        return idx;
    }

    spinBtn.addEventListener('click', () => {
        spinBtn.disabled = true;

        // Random final rotation: at least 5 full spins + random offset
        const extraAngle = Math.random() * Math.PI * 2;
        const spins = 5 + Math.random() * 3;
        const totalRotation = spins * Math.PI * 2 + extraAngle;

        const duration = 5000;
        const startTime = performance.now();
        const startRot = currentRotation;

        let lastTickSlice = -1;

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const rot = startRot + totalRotation * ease;

            drawWheel(rot);

            // Tick sound when crossing slice boundaries
            const currentSlice = getWinnerFromRotation(rot);
            if (currentSlice !== lastTickSlice && progress > 0.1) {
                playSound('tick');
                pointer.style.transform = 'translateX(-50%) scale(1.2)';
                setTimeout(() => { pointer.style.transform = 'translateX(-50%)'; }, 50);
            }
            lastTickSlice = currentSlice;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                currentRotation = rot;
                const winnerIdx = getWinnerFromRotation(rot);
                playSound('win');
                setTimeout(() => onWin(players[winnerIdx]), 800);
            }
        }
        requestAnimationFrame(animate);
    });
};


// ─────────────────────────────────────
// 3. Bomb Pass (폭탄 돌리기)
// ─────────────────────────────────────
Games.bomb = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'bomb-game';

    const totalTime = 10 + Math.random() * 20; // 10-30 sec
    let elapsed = 0;
    let currentIdx = 0;
    let running = false;
    let timer = null;

    div.innerHTML = `
        <div class="bomb-current-player" id="bombPlayer">${esc(players[0])}</div>
        <div class="bomb-turn-label">의 차례입니다</div>
        <div class="bomb-display" id="bombDisplay">💣</div>
        <div class="bomb-fuse">
            <div class="bomb-fuse-inner" id="bombFuse" style="width:100%"></div>
        </div>
        <button class="bomb-start-btn" id="bombStartBtn">시작!</button>
        <button class="bomb-pass-btn" id="bombPassBtn" style="display:none">패스! →</button>
    `;
    container.appendChild(div);

    const display = document.getElementById('bombDisplay');
    const fuse = document.getElementById('bombFuse');
    const playerEl = document.getElementById('bombPlayer');
    const startBtn = document.getElementById('bombStartBtn');
    const passBtn = document.getElementById('bombPassBtn');

    startBtn.addEventListener('click', () => {
        startBtn.style.display = 'none';
        passBtn.style.display = 'inline-block';
        running = true;
        tick();
    });

    function tick() {
        if (!running) return;
        timer = setInterval(() => {
            elapsed += 0.1;
            const pct = Math.max(0, (1 - elapsed / totalTime) * 100);
            fuse.style.width = pct + '%';

            // Shake intensity increases
            if (elapsed / totalTime > 0.5) {
                display.classList.add('shake');
            }

            // Speed up near end
            if (elapsed / totalTime > 0.8) {
                fuse.style.background = 'linear-gradient(90deg, #DC2626, #EF4444)';
            }

            if (elapsed >= totalTime) {
                // BOOM!
                clearInterval(timer);
                running = false;
                passBtn.style.display = 'none';
                display.classList.remove('shake');
                display.innerHTML = '<div class="bomb-explosion">💥</div>';
                playSound('boom');
                setTimeout(() => onWin(players[currentIdx]), 1500);
            }
        }, 100);
    }

    passBtn.addEventListener('click', () => {
        if (!running) return;
        playSound('click');

        // Add time pressure per pass (0.5-2 sec)
        elapsed += 0.5 + Math.random() * 1.5;

        currentIdx = (currentIdx + 1) % players.length;
        playerEl.textContent = players[currentIdx];

        // Flash effect
        display.style.transform = 'scale(1.2)';
        setTimeout(() => { display.style.transform = 'scale(1)'; }, 150);
    });
};


// ─────────────────────────────────────
// 4. Card Flip (카드 뒤집기)
// ─────────────────────────────────────
Games.card = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'card-game';

    const totalCards = 10;
    const failIdx = Math.floor(Math.random() * totalCards);
    const cards = Array.from({ length: totalCards }, (_, i) => i === failIdx ? 'fail' : 'safe');
    let currentPlayer = 0;
    let flippedCount = 0;
    let gameOver = false;

    div.innerHTML = `
        <div class="card-current-player" id="cardPlayer">${esc(players[0])}의 차례</div>
        <div class="card-game-info">카드를 선택하세요 (1장은 💀)</div>
        <div class="card-grid" id="cardGrid"></div>
    `;
    container.appendChild(div);

    const grid = document.getElementById('cardGrid');
    const playerEl = document.getElementById('cardPlayer');

    // Create cards
    cards.forEach((type, i) => {
        const card = document.createElement('div');
        card.className = 'flip-card';
        card.innerHTML = `
            <div class="flip-card-face flip-card-back">?</div>
            <div class="flip-card-face flip-card-front ${type}">
                ${type === 'safe' ? '✅' : '💀'}
            </div>
        `;
        card.addEventListener('click', () => flipCard(card, type, i));
        grid.appendChild(card);
    });

    // Shuffle animation
    const allCards = grid.querySelectorAll('.flip-card');
    allCards.forEach((c, i) => {
        setTimeout(() => {
            c.classList.add('shuffling');
            setTimeout(() => c.classList.remove('shuffling'), 600);
        }, i * 80);
    });

    function flipCard(card, type) {
        if (gameOver || card.classList.contains('flipped')) return;

        playSound('click');
        card.classList.add('flipped');
        flippedCount++;

        if (type === 'fail') {
            gameOver = true;
            playSound('boom');
            // Reveal all cards
            setTimeout(() => {
                allCards.forEach(c => c.classList.add('flipped'));
                setTimeout(() => onWin(players[currentPlayer]), 1000);
            }, 600);
        } else {
            // Safe - next player
            currentPlayer = (currentPlayer + 1) % players.length;
            playerEl.textContent = players[currentPlayer] + '의 차례';
        }
    }
};


// ─────────────────────────────────────
// 5. Mystery Box (기프트 박스)
// ─────────────────────────────────────
Games.box = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'box-game';

    const totalBoxes = Math.max(9, players.length);
    const failIdx = Math.floor(Math.random() * totalBoxes);
    let currentPlayer = 0;
    let gameOver = false;

    div.innerHTML = `
        <div class="box-current-player" id="boxPlayer">${esc(players[0])}의 차례</div>
        <div class="box-game-info">상자를 하나 선택하세요!</div>
        <div class="box-grid" id="boxGrid"></div>
    `;
    container.appendChild(div);

    const grid = document.getElementById('boxGrid');
    const playerEl = document.getElementById('boxPlayer');

    for (let i = 0; i < totalBoxes; i++) {
        const box = document.createElement('button');
        box.className = 'mystery-box';
        box.textContent = '🎁';
        box.style.animationDelay = (Math.random() * 2) + 's';
        box.addEventListener('click', () => openBox(box, i));
        grid.appendChild(box);
    }

    function openBox(box, idx) {
        if (gameOver || box.classList.contains('opened')) return;

        playSound('pop');
        box.classList.add('opened');

        if (idx === failIdx) {
            gameOver = true;
            box.textContent = '💀';
            box.style.background = 'linear-gradient(135deg, #FCA5A5, #EF4444)';

            // Sparkle effect
            createSparkles(box);

            setTimeout(() => {
                // Reveal all
                const boxes = grid.querySelectorAll('.mystery-box');
                boxes.forEach((b, i) => {
                    if (!b.classList.contains('opened')) {
                        b.classList.add('opened');
                        b.textContent = '✨';
                        b.style.background = 'linear-gradient(135deg, #86EFAC, #22C55E)';
                    }
                });
                setTimeout(() => onWin(players[currentPlayer]), 800);
            }, 600);
        } else {
            box.textContent = '✨';
            box.style.background = 'linear-gradient(135deg, #86EFAC, #22C55E)';
            currentPlayer = (currentPlayer + 1) % players.length;
            playerEl.textContent = players[currentPlayer] + '의 차례';
        }
    }

    function createSparkles(box) {
        for (let i = 0; i < 12; i++) {
            const spark = document.createElement('div');
            spark.style.cssText = `
                position: absolute; width: 6px; height: 6px; border-radius: 50%;
                background: ${['#FDE68A', '#FCA5A5', '#C4B5FD', '#6EE7B7'][i % 4]};
                top: 50%; left: 50%;
                animation: sparkle${i} .6s ease-out forwards;
            `;
            const angle = (i / 12) * Math.PI * 2;
            const dist = 40 + Math.random() * 30;
            const style = document.createElement('style');
            style.textContent = `
                @keyframes sparkle${i} {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
            box.appendChild(spark);
        }
    }
};


// ─────────────────────────────────────
// 6. Pop-up Pirate (해적 통아저씨)
// ─────────────────────────────────────
Games.pirate = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'pirate-game';

    const totalHoles = 16;
    const failIdx = Math.floor(Math.random() * totalHoles);
    let currentPlayer = 0;
    let gameOver = false;

    div.innerHTML = `
        <div class="pirate-current" id="piratePlayer">${esc(players[0])}의 차례</div>
        <div class="pirate-info">구멍에 칼을 꽂으세요! 🗡️</div>
        <div style="position:relative;display:inline-block;">
            <div class="pirate-character" id="pirateChar">🏴‍☠️</div>
            <div class="pirate-barrel" id="pirateBarrel"></div>
        </div>
    `;
    container.appendChild(div);

    const barrel = document.getElementById('pirateBarrel');
    const pirateChar = document.getElementById('pirateChar');
    const playerEl = document.getElementById('piratePlayer');

    for (let i = 0; i < totalHoles; i++) {
        const hole = document.createElement('button');
        hole.className = 'pirate-hole';
        hole.addEventListener('click', () => stab(hole, i));
        barrel.appendChild(hole);
    }

    function stab(hole, idx) {
        if (gameOver || hole.classList.contains('stabbed')) return;

        playSound('click');
        hole.classList.add('stabbed');

        if (idx === failIdx) {
            gameOver = true;
            hole.classList.add('danger');

            // 당첨 칼 화려한 연출
            hole.style.cssText += `
                animation: dangerStab .6s ease-out;
                transform: scale(1.8);
                z-index: 10;
                box-shadow: 0 0 20px #EF4444, 0 0 40px rgba(239,68,68,.5);
                border-color: #EF4444;
            `;
            hole.innerHTML = '<span style="font-size:1.8rem;filter:drop-shadow(0 0 8px #EF4444);">🗡️</span>';

            // 통 전체 흔들림
            barrel.style.animation = 'barrelShake .5s ease-out';

            // 화면 플래시
            const flash = document.createElement('div');
            flash.style.cssText = `
                position:fixed;inset:0;background:rgba(239,68,68,.3);
                z-index:50;pointer-events:none;
                animation: screenFlash .4s ease-out forwards;
            `;
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 500);

            // 해적 팝업
            setTimeout(() => {
                pirateChar.classList.add('popped');
                playSound('boom');
            }, 300);

            setTimeout(() => onWin(players[currentPlayer]), 1800);
        } else {
            // 안전한 칼 - 살짝 흔들림
            hole.style.animation = 'safeStab .3s ease-out';
            currentPlayer = (currentPlayer + 1) % players.length;
            playerEl.textContent = players[currentPlayer] + '의 차례';
        }
    }
};


// ─────────────────────────────────────
// 7. Racing Game (경마 레이스)
// ─────────────────────────────────────
Games.race = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'race-game';

    // 12간지 SVG 동물
    const zodiacSVG = {
        rat: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:8px 30px"><path d="M8 30Q2 25,5 20" stroke="#E8A0A0" stroke-width="2" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:25px 45px"><line x1="23" y1="48" x2="19" y2="65" stroke="#B0B0B0" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="48" x2="27" y2="65" stroke="#C0C0C0" stroke-width="4" stroke-linecap="round"/><ellipse cx="18" cy="67" rx="3" ry="2.5" fill="#888"/><ellipse cx="26" cy="67" rx="3" ry="2.5" fill="#888"/></g><g class="zbd"><ellipse cx="38" cy="40" rx="22" ry="14" fill="#C0C0C0"/></g><g class="zfl" style="transform-origin:52px 45px"><line x1="48" y1="48" x2="45" y2="65" stroke="#B0B0B0" stroke-width="4" stroke-linecap="round"/><line x1="55" y1="48" x2="53" y2="65" stroke="#C0C0C0" stroke-width="4" stroke-linecap="round"/><ellipse cx="44" cy="67" rx="3" ry="2.5" fill="#888"/><ellipse cx="52" cy="67" rx="3" ry="2.5" fill="#888"/></g><g class="zbd"><circle cx="65" cy="30" r="12" fill="#C0C0C0"/><circle cx="57" cy="20" r="7" fill="#D0D0D0"/><circle cx="57" cy="20" r="4" fill="#F0A0A0"/><circle cx="73" cy="20" r="7" fill="#D0D0D0"/><circle cx="73" cy="20" r="4" fill="#F0A0A0"/><circle cx="69" cy="27" r="2.5" fill="white"/><circle cx="69" cy="27" r="1.5" fill="#1a1a1a"/><ellipse cx="73" cy="32" rx="4" ry="3" fill="#E8C0C0"/><path d="M75 32L82 30M75 33L81 33M75 34L82 36" stroke="#D0D0D0" stroke-width="0.8"/></g></svg>`,
        ox: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:8px 32px"><path d="M8 32Q3 28,6 22" stroke="#5D4037" stroke-width="2.5" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:25px 48px"><line x1="22" y1="50" x2="18" y2="65" stroke="#6D5040" stroke-width="5" stroke-linecap="round"/><line x1="30" y1="50" x2="27" y2="65" stroke="#7D6050" stroke-width="5" stroke-linecap="round"/><ellipse cx="17" cy="67" rx="4" ry="3" fill="#3E2723"/><ellipse cx="26" cy="67" rx="4" ry="3" fill="#3E2723"/></g><g class="zbd"><ellipse cx="40" cy="42" rx="26" ry="16" fill="#7D6050"/></g><g class="zfl" style="transform-origin:55px 48px"><line x1="52" y1="50" x2="49" y2="65" stroke="#6D5040" stroke-width="5" stroke-linecap="round"/><line x1="59" y1="50" x2="57" y2="65" stroke="#7D6050" stroke-width="5" stroke-linecap="round"/><ellipse cx="48" cy="67" rx="4" ry="3" fill="#3E2723"/><ellipse cx="56" cy="67" rx="4" ry="3" fill="#3E2723"/></g><g class="zbd"><circle cx="68" cy="32" r="13" fill="#7D6050"/><path d="M57 18L54 10" stroke="#F5F5DC" stroke-width="3" stroke-linecap="round"/><path d="M79 18L82 10" stroke="#F5F5DC" stroke-width="3" stroke-linecap="round"/><ellipse cx="72" cy="38" rx="7" ry="5" fill="#E8C0A0"/><circle cx="70" cy="37" r="1" fill="#5D4037"/><circle cx="75" cy="37" r="1" fill="#5D4037"/><circle cx="72" cy="28" r="3" fill="white"/><circle cx="72" cy="28" r="1.8" fill="#1a1a1a"/></g></svg>`,
        tiger: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:8px 35px"><path d="M8 35Q2 30,5 24Q8 18,6 14" stroke="#E8A020" stroke-width="3" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:25px 47px"><line x1="22" y1="50" x2="18" y2="65" stroke="#D49020" stroke-width="5" stroke-linecap="round"/><line x1="30" y1="50" x2="27" y2="65" stroke="#E8A030" stroke-width="5" stroke-linecap="round"/><ellipse cx="17" cy="67" rx="3.5" ry="3" fill="#8B6914"/><ellipse cx="26" cy="67" rx="3.5" ry="3" fill="#8B6914"/></g><g class="zbd"><ellipse cx="40" cy="42" rx="24" ry="15" fill="#E8A030"/><line x1="30" y1="35" x2="30" y2="50" stroke="#2d1b00" stroke-width="2"/><line x1="38" y1="33" x2="38" y2="52" stroke="#2d1b00" stroke-width="2"/><line x1="46" y1="33" x2="46" y2="52" stroke="#2d1b00" stroke-width="2"/></g><g class="zfl" style="transform-origin:55px 47px"><line x1="52" y1="50" x2="49" y2="65" stroke="#D49020" stroke-width="5" stroke-linecap="round"/><line x1="59" y1="50" x2="57" y2="65" stroke="#E8A030" stroke-width="5" stroke-linecap="round"/><ellipse cx="48" cy="67" rx="3.5" ry="3" fill="#8B6914"/><ellipse cx="56" cy="67" rx="3.5" ry="3" fill="#8B6914"/></g><g class="zbd"><circle cx="68" cy="30" r="14" fill="#E8A030"/><polygon points="58,18 56,8 63,16" fill="#E8A030"/><polygon points="78,18 80,8 73,16" fill="#E8A030"/><circle cx="72" cy="27" r="3" fill="white"/><circle cx="72" cy="27" r="1.8" fill="#2d1b00"/><circle cx="63" cy="27" r="3" fill="white"/><circle cx="63" cy="27" r="1.8" fill="#2d1b00"/><path d="M68 20L68 16" stroke="#2d1b00" stroke-width="2" stroke-linecap="round"/></g></svg>`,
        rabbit: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:14px 42px"><circle cx="14" cy="42" r="4" fill="white"/></g><g class="zbl" style="transform-origin:28px 48px"><line x1="25" y1="50" x2="20" y2="65" stroke="#E0D0D0" stroke-width="5" stroke-linecap="round"/><line x1="33" y1="50" x2="30" y2="65" stroke="white" stroke-width="5" stroke-linecap="round"/><ellipse cx="19" cy="67" rx="4" ry="3" fill="#F0C0C0"/><ellipse cx="29" cy="67" rx="4" ry="3" fill="#F0C0C0"/></g><g class="zbd"><ellipse cx="42" cy="42" rx="22" ry="14" fill="white"/></g><g class="zfl" style="transform-origin:55px 48px"><line x1="52" y1="50" x2="49" y2="65" stroke="#E0D0D0" stroke-width="4" stroke-linecap="round"/><line x1="58" y1="50" x2="56" y2="65" stroke="white" stroke-width="4" stroke-linecap="round"/><ellipse cx="48" cy="67" rx="3" ry="2.5" fill="#F0C0C0"/><ellipse cx="55" cy="67" rx="3" ry="2.5" fill="#F0C0C0"/></g><g class="zbd"><circle cx="68" cy="32" r="12" fill="white"/><ellipse cx="63" cy="10" rx="4" ry="14" fill="white"/><ellipse cx="63" cy="10" rx="2.5" ry="10" fill="#F0A0A0"/><ellipse cx="75" cy="10" rx="4" ry="14" fill="white"/><ellipse cx="75" cy="10" rx="2.5" ry="10" fill="#F0A0A0"/><circle cx="72" cy="30" r="2.5" fill="#EF4444"/><circle cx="72" cy="30" r="1.5" fill="#1a1a1a"/><circle cx="64" cy="30" r="2.5" fill="#EF4444"/><circle cx="64" cy="30" r="1.5" fill="#1a1a1a"/><ellipse cx="68" cy="35" rx="2" ry="1.5" fill="#F0A0A0"/></g></svg>`,
        dragon: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:8px 35px"><path d="M8 35Q0 30,5 22Q3 16,8 12" stroke="#2E7D32" stroke-width="3" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:25px 48px"><line x1="22" y1="50" x2="18" y2="65" stroke="#388E3C" stroke-width="5" stroke-linecap="round"/><line x1="30" y1="50" x2="27" y2="65" stroke="#43A047" stroke-width="5" stroke-linecap="round"/><ellipse cx="17" cy="67" rx="4" ry="3" fill="#1B5E20"/><ellipse cx="26" cy="67" rx="4" ry="3" fill="#1B5E20"/></g><g class="zbd"><ellipse cx="40" cy="42" rx="24" ry="15" fill="#43A047"/></g><g class="zfl" style="transform-origin:55px 48px"><line x1="52" y1="50" x2="49" y2="65" stroke="#388E3C" stroke-width="5" stroke-linecap="round"/><line x1="59" y1="50" x2="57" y2="65" stroke="#43A047" stroke-width="5" stroke-linecap="round"/><ellipse cx="48" cy="67" rx="4" ry="3" fill="#1B5E20"/><ellipse cx="56" cy="67" rx="4" ry="3" fill="#1B5E20"/></g><g class="zbd"><circle cx="68" cy="28" r="14" fill="#43A047"/><path d="M58 16L54 6" stroke="#FDD835" stroke-width="2.5" stroke-linecap="round"/><path d="M62 14L60 4" stroke="#FDD835" stroke-width="2.5" stroke-linecap="round"/><path d="M78 16L82 6" stroke="#FDD835" stroke-width="2.5" stroke-linecap="round"/><circle cx="72" cy="24" r="3.5" fill="#FDD835"/><circle cx="72" cy="24" r="2" fill="#E65100"/><circle cx="63" cy="24" r="3.5" fill="#FDD835"/><circle cx="63" cy="24" r="2" fill="#E65100"/></g></svg>`,
        snake: `<svg viewBox="0 0 90 75"><g class="zsn"><path d="M10 55Q20 45,30 55Q40 65,50 55Q60 45,70 55" stroke="#4CAF50" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M10 55Q20 45,30 55Q40 65,50 55Q60 45,70 55" stroke="#66BB6A" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="78" cy="48" r="8" fill="#4CAF50"/><circle cx="81" cy="45" r="2.5" fill="#FDD835"/><circle cx="81" cy="45" r="1.3" fill="#1a1a1a"/><circle cx="75" cy="45" r="2.5" fill="#FDD835"/><circle cx="75" cy="45" r="1.3" fill="#1a1a1a"/><path d="M82 52L88 50M82 53L88 54" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/></g></svg>`,
        horse: `<svg viewBox="0 0 100 85"><g class="ztl" style="transform-origin:12px 38px"><path d="M12 38Q2 42,5 52Q8 58,6 65" stroke="#8B6914" stroke-width="3" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:30px 50px"><line x1="28" y1="55" x2="22" y2="76" stroke="#C4943D" stroke-width="5" stroke-linecap="round"/><line x1="36" y1="55" x2="32" y2="76" stroke="#D4A44D" stroke-width="5" stroke-linecap="round"/><ellipse cx="21" cy="78" rx="4" ry="3" fill="#3d2b0a"/><ellipse cx="31" cy="78" rx="4" ry="3" fill="#3d2b0a"/></g><g class="zbd"><ellipse cx="45" cy="45" rx="28" ry="18" fill="#D4A44D"/></g><g class="zfl" style="transform-origin:62px 50px"><line x1="58" y1="55" x2="55" y2="76" stroke="#C4943D" stroke-width="5" stroke-linecap="round"/><line x1="65" y1="55" x2="63" y2="76" stroke="#D4A44D" stroke-width="5" stroke-linecap="round"/><ellipse cx="54" cy="78" rx="4" ry="3" fill="#3d2b0a"/><ellipse cx="62" cy="78" rx="4" ry="3" fill="#3d2b0a"/></g><g class="zbd"><ellipse cx="78" cy="30" rx="12" ry="15" fill="#D4A44D" transform="rotate(-15 78 30)"/><polygon points="72,16 75,6 79,17" fill="#C4943D"/><polygon points="80,14 83,5 86,15" fill="#C4943D"/><circle cx="82" cy="26" r="3" fill="white"/><circle cx="82" cy="26" r="1.8" fill="#2d1b00"/><ellipse cx="87" cy="34" rx="5" ry="4" fill="#C4943D"/><circle cx="86" cy="33" r="1" fill="#5a3d0a"/><circle cx="89" cy="33" r="1" fill="#5a3d0a"/><path d="M70 18Q65 25,68 32" stroke="#8B6914" stroke-width="2.5" fill="none" stroke-linecap="round"/></g></svg>`,
        sheep: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:12px 40px"><ellipse cx="12" cy="42" rx="3" ry="4" fill="white"/></g><g class="zbl" style="transform-origin:25px 48px"><line x1="23" y1="50" x2="19" y2="65" stroke="#555" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="50" x2="27" y2="65" stroke="#555" stroke-width="4" stroke-linecap="round"/><ellipse cx="18" cy="67" rx="3" ry="2.5" fill="#333"/><ellipse cx="26" cy="67" rx="3" ry="2.5" fill="#333"/></g><g class="zbd"><ellipse cx="40" cy="40" rx="24" ry="16" fill="white"/><circle cx="25" cy="36" r="6" fill="#F5F5F5"/><circle cx="35" cy="33" r="7" fill="#F5F5F5"/><circle cx="45" cy="33" r="7" fill="#F5F5F5"/><circle cx="55" cy="36" r="6" fill="#F5F5F5"/></g><g class="zfl" style="transform-origin:52px 48px"><line x1="50" y1="50" x2="47" y2="65" stroke="#555" stroke-width="4" stroke-linecap="round"/><line x1="56" y1="50" x2="54" y2="65" stroke="#555" stroke-width="4" stroke-linecap="round"/><ellipse cx="46" cy="67" rx="3" ry="2.5" fill="#333"/><ellipse cx="53" cy="67" rx="3" ry="2.5" fill="#333"/></g><g class="zbd"><circle cx="65" cy="30" r="11" fill="#555"/><circle cx="57" cy="22" r="4" fill="#555"/><circle cx="73" cy="22" r="4" fill="#555"/><circle cx="69" cy="28" r="2.5" fill="white"/><circle cx="69" cy="28" r="1.5" fill="#1a1a1a"/><ellipse cx="68" cy="34" rx="3" ry="2" fill="#E0C0A0"/></g></svg>`,
        monkey: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:10px 38px"><path d="M10 38Q2 32,5 25Q8 18,5 12" stroke="#8B6B3D" stroke-width="2.5" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:28px 50px"><line x1="25" y1="52" x2="20" y2="65" stroke="#A07040" stroke-width="4.5" stroke-linecap="round"/><line x1="32" y1="52" x2="28" y2="65" stroke="#B08050" stroke-width="4.5" stroke-linecap="round"/><ellipse cx="19" cy="67" rx="3.5" ry="3" fill="#6b4420"/><ellipse cx="27" cy="67" rx="3.5" ry="3" fill="#6b4420"/></g><g class="zbd"><ellipse cx="40" cy="44" rx="22" ry="14" fill="#B08050"/><ellipse cx="42" cy="44" rx="14" ry="9" fill="#D4B888"/></g><g class="zfl" style="transform-origin:52px 50px"><line x1="50" y1="52" x2="47" y2="65" stroke="#A07040" stroke-width="4.5" stroke-linecap="round"/><line x1="56" y1="52" x2="54" y2="65" stroke="#B08050" stroke-width="4.5" stroke-linecap="round"/><ellipse cx="46" cy="67" rx="3.5" ry="3" fill="#6b4420"/><ellipse cx="53" cy="67" rx="3.5" ry="3" fill="#6b4420"/></g><g class="zbd"><circle cx="65" cy="30" r="13" fill="#B08050"/><circle cx="67" cy="33" r="9" fill="#E8C99A"/><circle cx="54" cy="25" r="5" fill="#B08050"/><circle cx="54" cy="25" r="3" fill="#E8C99A"/><circle cx="76" cy="25" r="5" fill="#B08050"/><circle cx="76" cy="25" r="3" fill="#E8C99A"/><circle cx="63" cy="28" r="2.5" fill="white"/><circle cx="63" cy="28" r="1.5" fill="#1a1a1a"/><circle cx="71" cy="28" r="2.5" fill="white"/><circle cx="71" cy="28" r="1.5" fill="#1a1a1a"/><ellipse cx="67" cy="34" rx="2" ry="1.5" fill="#8B5E3C"/></g></svg>`,
        chicken: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:12px 32px"><path d="M12 32Q4 26,7 18" stroke="#2E7D32" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M13 34Q6 30,9 22" stroke="#1B5E20" stroke-width="2.5" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:35px 52px"><line x1="35" y1="55" x2="32" y2="68" stroke="#E8A020" stroke-width="3" stroke-linecap="round"/><path d="M28 70L32 68L30 72" stroke="#E8A020" stroke-width="1.5" fill="none" stroke-linecap="round"/></g><g class="zfl" style="transform-origin:48px 52px"><line x1="48" y1="55" x2="46" y2="68" stroke="#E8A020" stroke-width="3" stroke-linecap="round"/><path d="M42 70L46 68L44 72" stroke="#E8A020" stroke-width="1.5" fill="none" stroke-linecap="round"/></g><g class="zbd"><ellipse cx="42" cy="42" rx="18" ry="14" fill="white"/></g><g class="zbd"><circle cx="62" cy="30" r="10" fill="white"/><path d="M58 20Q62 12,66 20" fill="#EF4444"/><polygon points="71,28 80,31 71,34" fill="#F59E0B"/><circle cx="65" cy="27" r="2.5" fill="white"/><circle cx="65" cy="27" r="1.5" fill="#1a1a1a"/><ellipse cx="66" cy="38" rx="3.5" ry="4" fill="#EF4444"/></g></svg>`,
        dog: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:10px 30px"><path d="M10 30Q4 24,8 18Q12 12,10 8" stroke="#8B5E3C" stroke-width="3" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:25px 48px"><line x1="22" y1="50" x2="18" y2="65" stroke="#A0724A" stroke-width="5" stroke-linecap="round"/><line x1="30" y1="50" x2="27" y2="65" stroke="#B8845A" stroke-width="5" stroke-linecap="round"/><ellipse cx="17" cy="67" rx="3.5" ry="3" fill="#5a3d1a"/><ellipse cx="26" cy="67" rx="3.5" ry="3" fill="#5a3d1a"/></g><g class="zbd"><ellipse cx="40" cy="42" rx="24" ry="15" fill="#B8845A"/></g><g class="zfl" style="transform-origin:55px 48px"><line x1="52" y1="50" x2="49" y2="65" stroke="#A0724A" stroke-width="5" stroke-linecap="round"/><line x1="59" y1="50" x2="57" y2="65" stroke="#B8845A" stroke-width="5" stroke-linecap="round"/><ellipse cx="48" cy="67" rx="3.5" ry="3" fill="#5a3d1a"/><ellipse cx="56" cy="67" rx="3.5" ry="3" fill="#5a3d1a"/></g><g class="zbd"><circle cx="68" cy="30" r="13" fill="#B8845A"/><ellipse cx="58" cy="20" rx="5" ry="9" fill="#A0724A" transform="rotate(-20 58 20)"/><ellipse cx="78" cy="20" rx="5" ry="9" fill="#A0724A" transform="rotate(20 78 20)"/><ellipse cx="76" cy="35" rx="7" ry="5" fill="#D4B88A"/><ellipse cx="78" cy="33" rx="3" ry="2" fill="#3d2b0a"/><circle cx="72" cy="26" r="3" fill="white"/><circle cx="72" cy="26" r="1.8" fill="#2d1b00"/><path d="M77 39Q79 44,76 46" stroke="#E85D75" stroke-width="2" fill="none" stroke-linecap="round"/></g></svg>`,
        pig: `<svg viewBox="0 0 90 75"><g class="ztl" style="transform-origin:10px 38px"><path d="M10 38Q5 35,8 30Q6 28,10 26" stroke="#F48FB1" stroke-width="2" fill="none" stroke-linecap="round"/></g><g class="zbl" style="transform-origin:25px 48px"><line x1="22" y1="50" x2="18" y2="65" stroke="#E88098" stroke-width="5" stroke-linecap="round"/><line x1="30" y1="50" x2="27" y2="65" stroke="#F48FB1" stroke-width="5" stroke-linecap="round"/><ellipse cx="17" cy="67" rx="3.5" ry="3" fill="#AD1457"/><ellipse cx="26" cy="67" rx="3.5" ry="3" fill="#AD1457"/></g><g class="zbd"><ellipse cx="42" cy="42" rx="26" ry="16" fill="#F48FB1"/></g><g class="zfl" style="transform-origin:55px 48px"><line x1="52" y1="50" x2="49" y2="65" stroke="#E88098" stroke-width="5" stroke-linecap="round"/><line x1="59" y1="50" x2="57" y2="65" stroke="#F48FB1" stroke-width="5" stroke-linecap="round"/><ellipse cx="48" cy="67" rx="3.5" ry="3" fill="#AD1457"/><ellipse cx="56" cy="67" rx="3.5" ry="3" fill="#AD1457"/></g><g class="zbd"><circle cx="68" cy="32" r="14" fill="#F48FB1"/><polygon points="58,22 56,12 63,20" fill="#F48FB1"/><polygon points="78,22 80,12 73,20" fill="#F48FB1"/><circle cx="72" cy="28" r="3" fill="white"/><circle cx="72" cy="28" r="1.8" fill="#1a1a1a"/><circle cx="62" cy="28" r="3" fill="white"/><circle cx="62" cy="28" r="1.8" fill="#1a1a1a"/><ellipse cx="68" cy="36" rx="7" ry="5" fill="#EC407A"/><circle cx="65" cy="35" r="1.5" fill="#AD1457"/><circle cx="71" cy="35" r="1.5" fill="#AD1457"/></g></svg>`,
    };
    const zodiacKeys = Object.keys(zodiacSVG);
    const zodiacEmoji = { rat:'🐭', ox:'🐂', tiger:'🐯', rabbit:'🐰', dragon:'🐲', snake:'🐍', horse:'🐎', sheep:'🐑', monkey:'🐵', chicken:'🐔', dog:'🐕', pig:'🐷' };

    // 플레이어 순서 셔플 + 동물 랜덤 배정
    const shuffled = [...players].map((name, i) => ({ name, origIdx: i }));
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const keyPool = [...zodiacKeys].sort(() => Math.random() - 0.5);
    const assignedKeys = shuffled.map((_, i) => keyPool[i % keyPool.length]);
    const icons = assignedKeys.map(k => zodiacEmoji[k]);
    const racePlayers = shuffled.map(s => s.name);
    const boostZone = 0.5 + Math.random() * 0.2;

    let trackHTML = '<div class="race-track">';
    racePlayers.forEach((name, i) => {
        const key = assignedKeys[i];
        trackHTML += `
            <div class="race-lane">
                <span class="race-name">${zodiacEmoji[key]} ${esc(name)}</span>
                <div class="race-track-bg">
                    <div class="race-boost" style="left:${boostZone * 100}%;width:10%"></div>
                    <div class="race-finish"></div>
                    <div class="race-runner race-svg-runner" id="runner${i}">${zodiacSVG[key]}</div>
                </div>
            </div>
        `;
    });
    trackHTML += '</div>';

    div.innerHTML = trackHTML + `
        <button class="race-start-btn" id="raceStartBtn">출발! 🚀</button>
        <div class="race-ranking" id="raceRanking" style="display:none;"></div>
    `;
    container.appendChild(div);

    const startBtn = document.getElementById('raceStartBtn');
    const positions = new Array(players.length).fill(0);
    const stunned = new Array(players.length).fill(0); // 스턴 남은 틱 수
    const maxPos = 85; // percent

    // 장애물 위치 랜덤 생성 (트랙당 1~2개)
    const obstacles = [];
    racePlayers.forEach((_, i) => {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let j = 0; j < count; j++) {
            const pos = 15 + Math.random() * 55; // 15~70% 구간
            obstacles.push({ lane: i, pos });
            const trackBg = div.querySelectorAll('.race-track-bg')[i];
            const obs = document.createElement('div');
            obs.className = 'race-obstacle';
            obs.textContent = '🪨';
            obs.style.cssText = `position:absolute;left:${pos}%;top:50%;transform:translateY(-50%);font-size:0.9rem;z-index:1;opacity:0.6;`;
            trackBg.appendChild(obs);
        }
    });

    const knifeHits = new Array(racePlayers.length).fill(0); // 칼 맞은 횟수
    const speedPenalty = new Array(racePlayers.length).fill(1); // 속도 감소 배율
    let tickCount = 0;

    startBtn.addEventListener('click', () => {
        startBtn.disabled = true;
        startBtn.textContent = '경주 중...';
        if (typeof startRaceBgm === 'function') startRaceBgm();

        const finishedPlayers = [];
        const tripped = new Set();
        const flyingObjects = []; // 날아가는 칼/방망이 실시간 추적

        const interval = setInterval(() => {
            tickCount++;

            // 랜덤 폭탄 이벤트 (평균 2초마다, 랜덤 주자)
            if (Math.random() < 0.04) {
                const active = racePlayers.map((_, i) => i).filter(i => positions[i] < maxPos && stunned[i] <= 0);
                if (active.length > 0) {
                    const target = active[Math.floor(Math.random() * active.length)];
                    stunned[target] = 15; // 약 1.2초 멈춤 (15틱 * 80ms)
                    const runner = document.getElementById(`runner${target}`);
                    // 폭탄 이펙트
                    const bomb = document.createElement('div');
                    bomb.textContent = '💣';
                    bomb.style.cssText = `position:absolute;left:${positions[target]}%;top:-20px;font-size:1.3rem;z-index:10;animation:bombFall 0.4s ease-in forwards;`;
                    runner.parentElement.appendChild(bomb);
                    setTimeout(() => {
                        bomb.textContent = '💥'; playSound('explode');
                        bomb.style.top = '50%';
                        bomb.style.transform = 'translateY(-50%)';
                        bomb.style.animation = 'none';
                        runner.style.transform = 'translateY(-50%) rotate(20deg)';
                        setTimeout(() => { bomb.remove(); runner.style.transform = 'translateY(-50%)'; }, 800);
                    }, 400);
                }
            }

            // 칼 발사 (오른쪽→왼쪽, 랜덤 레인)
            if (Math.random() < 0.03 && flyingObjects.filter(f => f.type === 'knife').length < 2) {
                const laneIdx = Math.floor(Math.random() * racePlayers.length);
                const trackBg = div.querySelectorAll('.race-track-bg')[laneIdx];
                if (trackBg) {
                    const el = document.createElement('div');
                    el.textContent = '🗡️';
                    el.style.cssText = `position:absolute;right:-5%;top:50%;transform:translateY(-50%) rotate(-90deg);font-size:2.5rem;z-index:10;`;
                    trackBg.appendChild(el);
                    flyingObjects.push({ type: 'knife', el, lane: laneIdx, pos: 105, speed: 1.5 + Math.random() });
                }
            }

            // 방망이 발사 (오른쪽→왼쪽, 랜덤 레인)
            if (Math.random() < 0.025 && flyingObjects.filter(f => f.type === 'bat').length < 1) {
                const laneIdx = Math.floor(Math.random() * racePlayers.length);
                const trackBg = div.querySelectorAll('.race-track-bg')[laneIdx];
                if (trackBg) {
                    const el = document.createElement('div');
                    el.textContent = '🏏';
                    el.style.cssText = `position:absolute;right:-5%;top:50%;transform:translateY(-50%) rotate(-45deg);font-size:2.5rem;z-index:10;`;
                    trackBg.appendChild(el);
                    flyingObjects.push({ type: 'bat', el, lane: laneIdx, pos: 105, speed: 1.2 + Math.random() });
                }
            }

            // 날아가는 물체 이동 + 충돌 감지
            for (let f = flyingObjects.length - 1; f >= 0; f--) {
                const obj = flyingObjects[f];
                obj.pos -= obj.speed; // 오른쪽→왼쪽 이동
                obj.el.style.right = (100 - obj.pos) + '%';

                // 화면 밖으로 나가면 제거
                if (obj.pos < -10) {
                    obj.el.remove();
                    flyingObjects.splice(f, 1);
                    continue;
                }

                // 해당 레인의 주자와 충돌 감지 (위치 차이 5% 이내)
                const runnerPos = positions[obj.lane];
                if (Math.abs(obj.pos - runnerPos) < 5 && positions[obj.lane] < maxPos && stunned[obj.lane] <= 0) {
                    const target = obj.lane;
                    const runner = document.getElementById(`runner${target}`);

                    if (obj.type === 'knife' && knifeHits[target] < 4) {
                        // 칼 충돌 → 부위 잘림
                        knifeHits[target]++;
                        speedPenalty[target] = Math.max(0.3, 1 - knifeHits[target] * 0.2);
                        stunned[target] = 12;
                        const hitCount = knifeHits[target];
                        obj.el.textContent = '🔪'; playSound('slash');
                        runner.style.transform = 'translateY(-50%) scaleX(-1)';

                        const svgEl = runner.querySelector('svg');
                        const partSelectors = ['.zbd:last-of-type', '.zfl', '.zbl', '.ztl'];
                        const partViews = ['50 5 45 50', '40 45 30 35', '10 45 30 35', '0 10 20 40'];
                        const partIdx = hitCount - 1;
                        if (partIdx < partSelectors.length && svgEl) {
                            const part = svgEl.querySelector(partSelectors[partIdx]);
                            if (part) {
                                const partSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                                partSvg.setAttribute('viewBox', partViews[partIdx]);
                                partSvg.appendChild(part.cloneNode(true));
                                const partWrap = document.createElement('div');
                                partWrap.appendChild(partSvg);
                                partWrap.style.cssText = `position:absolute;left:${positions[target]}%;bottom:-5px;width:40px;height:40px;z-index:20;pointer-events:none;animation:headDrop 0.6s ease-in forwards;`;
                                runner.parentElement.appendChild(partWrap);
                                part.style.display = 'none';
                            }
                        }
                        for (let b = 0; b < 3; b++) {
                            const blood = document.createElement('div');
                            blood.style.cssText = `position:absolute;left:${positions[target] + (b * 1.5)}%;bottom:2px;font-size:0.7rem;color:#DC2626;z-index:5;opacity:0.8;pointer-events:none;`;
                            blood.textContent = '🩸';
                            runner.parentElement.appendChild(blood);
                            setTimeout(() => { blood.style.opacity = '0.3'; }, 1500);
                        }
                        setTimeout(() => { obj.el.remove(); runner.style.transform = 'translateY(-50%)'; }, 800);
                    } else if (obj.type === 'bat') {
                        // 방망이 충돌 → 넉백
                        stunned[target] = 10;
                        obj.el.textContent = '💫'; playSound('bat_hit');
                        const knockback = 8 + Math.random() * 7;
                        positions[target] = Math.max(0, positions[target] - knockback);
                        runner.style.left = positions[target] + '%';
                        runner.style.transform = 'translateY(-50%) rotate(-30deg) scale(0.8)';
                        runner.style.transition = 'left 0.4s ease-out';
                        setTimeout(() => {
                            obj.el.remove();
                            runner.style.transform = 'translateY(-50%)';
                            runner.style.transition = 'left .15s ease-out';
                        }, 600);
                    }
                    flyingObjects.splice(f, 1);
                }
            }

            for (let i = 0; i < racePlayers.length; i++) {
                if (positions[i] >= maxPos) continue;

                // 스턴 상태면 멈춤
                if (stunned[i] > 0) {
                    stunned[i]--;
                    continue;
                }

                let speed = Math.random() * 3 * speedPenalty[i]; // 칼 맞으면 느려짐

                // Boost zone
                const posPct = positions[i] / maxPos;
                if (posPct >= boostZone && posPct <= boostZone + 0.1) {
                    speed *= 1.5 + Math.random();
                }

                // Rubber-banding: trailing runners get slight boost
                const maxP = Math.max(...positions);
                if (positions[i] < maxP - 10) {
                    speed *= 1.3;
                }

                positions[i] = Math.min(maxPos, positions[i] + speed);

                const runner = document.getElementById(`runner${i}`);
                runner.style.left = positions[i] + '%';

                // 장애물 충돌 체크
                for (const obs of obstacles) {
                    const obsKey = `${obs.lane}-${obs.pos}`;
                    if (obs.lane === i && !tripped.has(obsKey) && Math.abs(positions[i] - obs.pos) < 2) {
                        tripped.add(obsKey);
                        stunned[i] = 8; // 약 0.6초 멈춤
                        runner.style.transform = 'translateY(-50%) rotate(-15deg)';
                        setTimeout(() => { runner.style.transform = 'translateY(-50%)'; }, 500);
                        break;
                    }
                }

                if (positions[i] >= maxPos && !finishedPlayers.includes(i)) {
                    finishedPlayers.push(i);

                    // 꼴찌가 당첨! (마지막 한 명 남으면 종료)
                    if (finishedPlayers.length === racePlayers.length - 1) {
                        clearInterval(interval);
                        if (typeof stopRaceBgm === 'function') stopRaceBgm();
                        const lastIdx = racePlayers.findIndex((_, idx) => !finishedPlayers.includes(idx));
                        finishedPlayers.push(lastIdx);
                        const lastRunner = document.getElementById(`runner${lastIdx}`);
                        lastRunner.style.fontSize = '2.2rem';
                        playSound('win');

                        // 순위 표시
                        const rankingEl = document.getElementById('raceRanking');
                        let rankHTML = '<div style="font-weight:700;font-size:1.1rem;margin-bottom:10px;color:#333;">🏁 최종 순위</div>';
                        finishedPlayers.forEach((idx, rank) => {
                            const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank+1}위`;
                            const isLast = rank === finishedPlayers.length - 1;
                            rankHTML += `<div style="padding:6px 12px;margin:4px 0;border-radius:8px;font-size:0.95rem;display:flex;align-items:center;gap:8px;${isLast?'background:#FEE2E2;color:#DC2626;font-weight:700;':'background:#F3F4F6;color:#374151;'}">
                                <span style="min-width:32px;">${isLast?'💀':medal}</span>
                                <span>${icons[idx % icons.length]} ${esc(racePlayers[idx])}</span>
                                ${isLast?'<span style="margin-left:auto;font-size:0.8rem;">← 당첨!</span>':''}
                            </div>`;
                        });
                        rankingEl.innerHTML = rankHTML;
                        rankingEl.style.display = 'block';

                        // 경주 중 버튼 → 다시하기 버튼으로 변경
                        const retryBtn = document.createElement('button');
                        retryBtn.className = 'race-start-btn';
                        retryBtn.textContent = '🔄 다시하기';
                        retryBtn.addEventListener('click', () => {
                            container.innerHTML = '';
                            Games.race(container, players, onWin);
                        });
                        startBtn.replaceWith(retryBtn);

                        setTimeout(() => onWin(racePlayers[lastIdx]), 2500);
                    }
                }
            }
        }, 80);
    });
};


// ─────────────────────────────────────
// 8. Slot Machine (슬롯머신)
// ─────────────────────────────────────
Games.slot = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'slot-game';

    const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣', '🎰'];
    // Build long reel strips
    const reelSize = 30;

    function buildReel() {
        const items = [];
        for (let i = 0; i < reelSize; i++) {
            items.push(symbols[Math.floor(Math.random() * symbols.length)]);
        }
        return items;
    }

    const reels = [buildReel(), buildReel(), buildReel()];
    const itemH = Math.min(90, (window.innerWidth - 120) / 3);

    div.innerHTML = `
        <div class="slot-machine">
            <div class="slot-reels" id="slotReels">
                ${reels.map((reel, ri) => `
                    <div class="slot-reel" style="width:${itemH}px;height:${itemH}px">
                        <div class="slot-reel-inner" id="reel${ri}" style="top:0">
                            ${reel.map(s => `<div class="slot-item" style="width:${itemH}px;height:${itemH}px">${s}</div>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="slot-pull-btn" id="slotPullBtn">당기기!</button>
            <div class="slot-message" id="slotMsg"></div>
        </div>
    `;
    container.appendChild(div);

    const pullBtn = document.getElementById('slotPullBtn');
    const msgEl = document.getElementById('slotMsg');
    let spinning = false;

    pullBtn.addEventListener('click', () => {
        if (spinning) return;
        spinning = true;
        pullBtn.disabled = true;
        msgEl.textContent = '돌아가는 중...';

        // Determine final positions
        const stops = reels.map(reel => {
            return Math.floor(Math.random() * (reelSize - 1));
        });

        // Check if all three match
        const matched = reels[0][stops[0]] === reels[1][stops[1]] &&
                       reels[1][stops[1]] === reels[2][stops[2]];

        // Animate each reel
        reels.forEach((reel, ri) => {
            const el = document.getElementById(`reel${ri}`);
            const targetTop = -(stops[ri] * itemH);
            el.style.transition = `top ${2.5 + ri * 0.8}s cubic-bezier(.1, 0, 0, 1)`;
            el.style.top = targetTop + 'px';
        });

        // After animation
        const totalDuration = 2500 + 2 * 800 + 500;
        setTimeout(() => {
            spinning = false;
            pullBtn.disabled = false;

            if (matched) {
                msgEl.textContent = `🎊 ${reels[0][stops[0]]} 잭팟! 🎊`;
                playSound('win');
            } else {
                msgEl.textContent = '다시 도전!';
                // Pick loser
                const loser = players[Math.floor(Math.random() * players.length)];
                setTimeout(() => onWin(loser), 800);
            }
        }, totalDuration);
    });
};


// ─────────────────────────────────────
// 9. Crocodile Dentist (악어 이빨)
// ─────────────────────────────────────
Games.croc = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'croc-game';

    const totalTeeth = 12;
    const failIdx = Math.floor(Math.random() * totalTeeth);
    let currentPlayer = 0;
    let gameOver = false;

    div.innerHTML = `
        <div class="croc-current" id="crocPlayer">${esc(players[0])}의 차례</div>
        <div class="croc-info">이빨을 조심히 눌러보세요!</div>
        <div class="croc-mouth" id="crocMouth">
            <!-- 윗턱 -->
            <div class="croc-jaw-upper" id="crocUpper">
                <svg viewBox="0 0 320 100" class="croc-svg-upper">
                    <ellipse cx="160" cy="25" rx="140" ry="28" fill="#16A34A"/>
                    <path d="M20,45 Q160,10 300,45 L300,80 Q160,60 20,80 Z" fill="#15803D"/>
                    <ellipse cx="125" cy="20" rx="5" ry="3" fill="#0F5132"/>
                    <ellipse cx="195" cy="20" rx="5" ry="3" fill="#0F5132"/>
                    <circle cx="75" cy="18" r="15" fill="#BBF7D0"/>
                    <circle cx="75" cy="18" r="9" fill="white"/>
                    <circle cx="78" cy="16" r="5" fill="#111827"/>
                    <circle cx="80" cy="14" r="1.5" fill="white"/>
                    <circle cx="245" cy="18" r="15" fill="#BBF7D0"/>
                    <circle cx="245" cy="18" r="9" fill="white"/>
                    <circle cx="248" cy="16" r="5" fill="#111827"/>
                    <circle cx="250" cy="14" r="1.5" fill="white"/>
                </svg>
                <div class="croc-angry-eyes" id="crocAngry">😡</div>
            </div>
            <!-- 입 안: 이빨이 여기 들어감 -->
            <div class="croc-mouth-inside">
                <div class="croc-teeth" id="crocTeeth"></div>
            </div>
            <!-- 아랫턱 -->
            <div class="croc-jaw-lower">
                <svg viewBox="0 0 320 50" class="croc-svg-lower">
                    <path d="M20,0 Q160,15 300,0 L290,35 Q160,50 30,35 Z" fill="#16A34A"/>
                </svg>
            </div>
        </div>
    `;
    container.appendChild(div);

    const teethEl = document.getElementById('crocTeeth');
    const upperEl = document.getElementById('crocUpper');
    const mouthEl = document.getElementById('crocMouth');
    const angryEl = document.getElementById('crocAngry');
    const playerEl = document.getElementById('crocPlayer');

    for (let i = 0; i < totalTeeth; i++) {
        const tooth = document.createElement('button');
        tooth.className = 'croc-tooth';
        tooth.addEventListener('click', () => pressTooth(tooth, i));
        teethEl.appendChild(tooth);
    }

    function pressTooth(tooth, idx) {
        if (gameOver || tooth.classList.contains('pressed')) return;

        playSound('click');
        tooth.classList.add('pressed');

        if (idx === failIdx) {
            gameOver = true;
            tooth.classList.add('danger');
            mouthEl.classList.add('chomped');
            angryEl.style.display = 'block';
            playSound('boom');
            setTimeout(() => onWin(players[currentPlayer]), 1500);
        } else {
            currentPlayer = (currentPlayer + 1) % players.length;
            playerEl.textContent = players[currentPlayer] + '의 차례';
        }
    }
};


// ─────────────────────────────────────
// 10. Balloon Pop (풍선 터뜨리기)
// ─────────────────────────────────────
Games.balloon = function(container, players, onWin) {
    const div = document.createElement('div');
    div.className = 'balloon-game';

    const maxPumps = 8 + Math.floor(Math.random() * 15); // 8-22
    let pumps = 0;
    let currentPlayer = 0;
    let gameOver = false;
    const baseScale = 0.5;
    const scaleStep = (1.8 - baseScale) / maxPumps;

    const balloonColors = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];
    const bColor = balloonColors[Math.floor(Math.random() * balloonColors.length)];

    div.innerHTML = `
        <div class="balloon-current" id="balloonPlayer">${esc(players[0])}의 차례</div>
        <div class="balloon-info">풍선이 터지기 전에 다음 사람에게!</div>
        <div class="balloon-wrap">
            <svg id="balloonSvg" class="balloon-svg" width="200" height="260" viewBox="0 0 200 260"
                 style="transform: scale(${baseScale})">
                <defs>
                    <radialGradient id="balloonGrad" cx="40%" cy="35%">
                        <stop offset="0%" style="stop-color:white;stop-opacity:0.4"/>
                        <stop offset="100%" style="stop-color:${bColor};stop-opacity:1"/>
                    </radialGradient>
                </defs>
                <ellipse cx="100" cy="110" rx="85" ry="100" fill="url(#balloonGrad)" stroke="${bColor}" stroke-width="2"/>
                <polygon points="85,205 100,260 115,205" fill="${bColor}" opacity="0.8"/>
                <ellipse cx="100" cy="208" rx="18" ry="8" fill="${bColor}"/>
                <ellipse cx="72" cy="75" rx="15" ry="20" fill="white" opacity="0.2" transform="rotate(-20,72,75)"/>
            </svg>
        </div>
        <div class="balloon-counter" id="balloonCounter">${pumps}회 펌프</div>
        <button class="balloon-pump-btn" id="balloonPumpBtn">🌬️ 불기!</button>
    `;
    container.appendChild(div);

    const svg = document.getElementById('balloonSvg');
    const counterEl = document.getElementById('balloonCounter');
    const pumpBtn = document.getElementById('balloonPumpBtn');
    const playerEl = document.getElementById('balloonPlayer');

    pumpBtn.addEventListener('click', () => {
        if (gameOver) return;

        pumps++;
        playSound('pop');

        const scale = baseScale + scaleStep * pumps;
        svg.style.transform = `scale(${scale})`;

        // Wobble
        svg.style.transition = 'transform .15s ease-out';

        counterEl.textContent = `${pumps}회 펌프`;

        if (pumps >= maxPumps) {
            // POP!
            gameOver = true;
            pumpBtn.disabled = true;

            svg.style.transition = 'none';
            svg.style.display = 'none';

            const wrap = div.querySelector('.balloon-wrap');
            wrap.innerHTML = '<div class="balloon-pop-text">빵!</div>';

            playSound('boom');

            // Create confetti particles in wrap
            for (let i = 0; i < 30; i++) {
                const p = document.createElement('div');
                const size = 4 + Math.random() * 8;
                const angle = (i / 30) * Math.PI * 2;
                const dist = 50 + Math.random() * 80;
                const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
                p.style.cssText = `
                    position: absolute; width: ${size}px; height: ${size}px;
                    border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    animation: bPop${i} .8s ease-out forwards;
                `;
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes bPop${i} {
                        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                        100% { transform: translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
                wrap.appendChild(p);
            }

            setTimeout(() => onWin(players[currentPlayer]), 1500);
        } else {
            // Next player's turn
            currentPlayer = (currentPlayer + 1) % players.length;
            playerEl.textContent = players[currentPlayer] + '의 차례';
        }
    });
};

// ─────────────────────────────────────
// 11. Dice (주사위)
// ─────────────────────────────────────
Games.dice = function(container, players, onWin) {
    let currentIdx = 0;
    const results = [];
    const diceEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

    // 주사위 면 그리기 (Canvas로 dot 패턴)
    function drawDiceFace(value, size) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 배경
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, size * 0.13);
        ctx.fill();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 3;
        ctx.stroke();

        // dot 위치 (3x3 그리드 기반)
        const p = size * 0.25; // padding
        const positions = {
            tl: [p, p], tc: [size/2, p], tr: [size-p, p],
            ml: [p, size/2], mc: [size/2, size/2], mr: [size-p, size/2],
            bl: [p, size-p], bc: [size/2, size-p], br: [size-p, size-p],
        };
        const layouts = {
            1: ['mc'],
            2: ['tr', 'bl'],
            3: ['tr', 'mc', 'bl'],
            4: ['tl', 'tr', 'bl', 'br'],
            5: ['tl', 'tr', 'mc', 'bl', 'br'],
            6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
        };
        const r = size * 0.08;
        ctx.fillStyle = value === 1 ? '#DC2626' : '#1E293B';
        (layouts[value] || []).forEach(key => {
            const [x, y] = positions[key];
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        });
        return canvas.toDataURL();
    }

    const diceSize = 140;
    const initialImg = drawDiceFace(1, diceSize);

    container.innerHTML = `
        <style>
            .dice-img {
                width: ${diceSize}px; height: ${diceSize}px;
                margin: 20px auto;
                border-radius: 18px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                transition: transform 0.1s;
            }
            .dice-img.rolling {
                animation: diceShake 0.08s infinite alternate;
            }
            @keyframes diceShake {
                0% { transform: rotate(-15deg) scale(1.1); }
                100% { transform: rotate(15deg) scale(1.1); }
            }
        </style>
        <div style="text-align:center;padding:20px;max-width:500px;margin:0 auto;">
            <div id="dicePlayerName" style="font-size:1.3rem;font-weight:700;color:#4F46E5;margin-bottom:16px;">
                ${players[0]}의 차례
            </div>
            <img id="diceImg" class="dice-img" src="${initialImg}" alt="dice">
            <div id="diceValue" style="font-size:2.5rem;font-weight:900;color:#4F46E5;margin:8px 0;min-height:50px;"></div>
            <button id="diceRollBtn" style="
                padding:14px 40px;background:#4F46E5;color:#fff;border:none;border-radius:12px;
                font-size:1.1rem;font-weight:700;cursor:pointer;margin-bottom:24px;
            ">🎲 주사위 굴리기!</button>
            <div id="diceResults" style="margin-top:16px;"></div>
        </div>
    `;

    const diceImg = document.getElementById('diceImg');
    const valueEl = document.getElementById('diceValue');
    const nameEl = document.getElementById('dicePlayerName');
    const rollBtn = document.getElementById('diceRollBtn');
    const resultsEl = document.getElementById('diceResults');

    function renderResults() {
        resultsEl.innerHTML = results.map((r, i) => `
            <div style="
                display:flex;align-items:center;justify-content:space-between;
                padding:10px 16px;margin:6px 0;border-radius:10px;
                background:${i === results.length - 1 ? '#EEF2FF' : '#F8FAFC'};
                border:1px solid ${i === results.length - 1 ? '#C7D2FE' : '#E2E8F0'};
            ">
                <span style="font-weight:600;color:#1E293B;">${r.name}</span>
                <span style="font-size:1.5rem;">${diceEmojis[r.value - 1]}</span>
                <span style="font-weight:700;font-size:1.2rem;color:#4F46E5;">${r.value}</span>
            </div>
        `).join('');
    }

    rollBtn.addEventListener('click', () => {
        rollBtn.disabled = true;
        rollBtn.style.opacity = '0.5';

        // 주사위 굴리기 애니메이션
        const finalValue = Math.floor(Math.random() * 6) + 1;
        diceImg.classList.add('rolling');
        valueEl.textContent = '';
        if (typeof playSound === 'function') playSound('tick');

        // 빠르게 면 바꾸기 애니메이션
        let rollCount = 0;
        const rollInterval = setInterval(() => {
            const randVal = Math.floor(Math.random() * 6) + 1;
            diceImg.src = drawDiceFace(randVal, diceSize);
            rollCount++;
            if (rollCount >= 12) {
                clearInterval(rollInterval);
                diceImg.classList.remove('rolling');
                diceImg.style.transform = '';
                diceImg.src = drawDiceFace(finalValue, diceSize);
                valueEl.textContent = finalValue;
                if (typeof playSound === 'function') playSound('pop');

                results.push({ name: players[currentIdx], value: finalValue });
                renderResults();

                currentIdx++;

                if (currentIdx >= players.length) {
                    rollBtn.style.display = 'none';
                    let maxVal = 0;
                    let winners = [];
                    results.forEach(r => {
                        if (r.value > maxVal) {
                            maxVal = r.value;
                            winners = [r.name];
                        } else if (r.value === maxVal) {
                            winners.push(r.name);
                        }
                    });

                    if (winners.length > 1) {
                        nameEl.textContent = '동점! 재대결!';
                        nameEl.style.color = '#EF4444';
                        setTimeout(() => {
                            results.length = 0;
                            currentIdx = 0;
                            const tiedPlayers = [...winners];
                            players.length = 0;
                            players.push(...tiedPlayers);
                            nameEl.textContent = players[0] + '의 차례';
                            nameEl.style.color = '#4F46E5';
                            valueEl.textContent = '';
                            diceImg.src = drawDiceFace(1, diceSize);
                            rollBtn.style.display = '';
                            rollBtn.disabled = false;
                            rollBtn.style.opacity = '1';
                            renderResults();
                        }, 1500);
                    } else {
                        nameEl.innerHTML = `🏆 <span style="color:#F59E0B;">${winners[0]}</span> 당첨!`;
                        resultsEl.querySelectorAll('div').forEach(div => {
                            const nameSpan = div.querySelector('span');
                            if (nameSpan && nameSpan.textContent === winners[0]) {
                                div.style.background = '#FEF3C7';
                                div.style.borderColor = '#F59E0B';
                            }
                        });
                        if (typeof playSound === 'function') playSound('win');
                        setTimeout(() => onWin(winners[0]), 1500);
                    }
                } else {
                    setTimeout(() => {
                        nameEl.textContent = players[currentIdx] + '의 차례';
                        valueEl.textContent = '';
                        diceImg.src = drawDiceFace(1, diceSize);
                        rollBtn.disabled = false;
                        rollBtn.style.opacity = '1';
                    }, 800);
                }
            }
        }, 70);
    });
};
