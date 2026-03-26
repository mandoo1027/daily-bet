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

    const totalBoxes = Math.max(6, players.length);
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

    const icons = ['🏇', '🐎', '🦄', '🐴', '🏃', '🐕', '🐈', '🐢', '🐇', '🦊'];
    const boostZone = 0.5 + Math.random() * 0.2; // 50-70% area

    let trackHTML = '<div class="race-track">';
    players.forEach((name, i) => {
        trackHTML += `
            <div class="race-lane">
                <span class="race-name">${esc(name)}</span>
                <div class="race-track-bg">
                    <div class="race-boost" style="left:${boostZone * 100}%;width:10%"></div>
                    <div class="race-finish"></div>
                    <div class="race-runner" id="runner${i}">${icons[i % icons.length]}</div>
                </div>
            </div>
        `;
    });
    trackHTML += '</div>';

    div.innerHTML = trackHTML + `
        <button class="race-start-btn" id="raceStartBtn">출발! 🚀</button>
    `;
    container.appendChild(div);

    const startBtn = document.getElementById('raceStartBtn');
    const positions = new Array(players.length).fill(0);
    const maxPos = 85; // percent

    startBtn.addEventListener('click', () => {
        startBtn.disabled = true;
        startBtn.textContent = '경주 중...';

        const interval = setInterval(() => {
            let finished = false;

            for (let i = 0; i < players.length; i++) {
                if (positions[i] >= maxPos) continue;

                let speed = Math.random() * 3;

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

                if (positions[i] >= maxPos) {
                    finished = true;
                    clearInterval(interval);
                    playSound('win');

                    runner.style.fontSize = '2.2rem';
                    setTimeout(() => onWin(players[i]), 1000);
                    break;
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
