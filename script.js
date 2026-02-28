// Change this port if your terminal shows a different one!
const API_URL = 'https://one5113-project2.onrender.com/api/puzzle';

const CATEGORY_COLORS = ['cat-0', 'cat-1', 'cat-2', 'cat-3'];

let selectedCards = [];
let solvedCategories = 0;
let mistakesLeft = 4;
let allThumbnails = [];
let solvedCategoryNames = [];

const submitBtn = document.getElementById('submit-btn');
const deselectBtn = document.getElementById('deselect-btn');
const hintBtn = document.getElementById('hint-btn');
const guessModal = document.getElementById('guess-modal');
const guessInput = document.getElementById('guess-input');
const guessSubmitBtn = document.getElementById('guess-submit-btn');
const guessCancelBtn = document.getElementById('guess-cancel-btn');
const guessPreview = document.getElementById('guess-preview');

let hintMode = false;

submitBtn.addEventListener('click', checkMatch);
deselectBtn.addEventListener('click', deselectAll);
hintBtn.addEventListener('click', toggleHintMode);
guessSubmitBtn.addEventListener('click', submitCategoryGuess);
guessCancelBtn.addEventListener('click', closeGuessModal);
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCategoryGuess();
});

function toggleHintMode() {
    hintMode = !hintMode;
    document.body.classList.toggle('hint-mode', hintMode);
    hintBtn.classList.toggle('active', hintMode);
    hintBtn.textContent = hintMode ? 'Hints ON' : 'Hints OFF';
}

async function initGame() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const msgBoard = document.getElementById('message-board');

        if (data.thumbnails) {
            setMessage('Select 4 related thumbnails!', 'default');
            allThumbnails = data.thumbnails;
            renderBoard(allThumbnails);
            renderMistakeDots();
        }
    } catch (err) {
        console.error(err);
        setMessage("Backend not found. Is app.py running?", 'error');
    }
}

function setMessage(text, type) {
    const msgBoard = document.getElementById('message-board');
    msgBoard.innerText = text;
    msgBoard.className = '';
    if (type === 'success') msgBoard.classList.add('success');
    else if (type === 'error') msgBoard.classList.add('error');
    else if (type === 'win') msgBoard.classList.add('win');
    else if (type === 'close') msgBoard.classList.add('close');
}

function renderMistakeDots() {
    const row = document.getElementById('mistakes-row');
    row.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const dot = document.createElement('div');
        dot.className = 'mistake-dot';
        if (i >= mistakesLeft) dot.classList.add('used');
        row.appendChild(dot);
    }
}

function renderBoard(thumbnails) {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    // Only render unsolved thumbnails
    const unsolved = thumbnails.filter(
        v => !solvedCategoryNames.includes(v.category)
    );

    unsolved.forEach((video, i) => {
        const card = document.createElement('div');
        card.className = 'card-container entering';
        card.style.setProperty('--entry-delay', `${i * 0.04}s`);
        card.dataset.id = video.id;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img src="${video.url}" alt="thumbnail">
                </div>
                <div class="card-back">
                    <strong>${video.title}</strong>
                </div>
            </div>
        `;

        card.addEventListener('click', () => handleSelection(card, video));
        board.appendChild(card);
    });
}

function handleSelection(el, data) {
    if (el.classList.contains('solved')) return;

    // Deselect
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        selectedCards = selectedCards.filter(c => c.id !== data.id);
        updateButtons();
        return;
    }

    if (selectedCards.length >= 4) return;

    el.classList.add('selected');
    selectedCards.push({ id: data.id, category: data.category, element: el, data });

    updateButtons();
}

function updateButtons() {
    submitBtn.disabled = selectedCards.length !== 4;
    deselectBtn.disabled = selectedCards.length === 0;
}

function deselectAll() {
    selectedCards.forEach(c => c.element.classList.remove('selected'));
    selectedCards = [];
    updateButtons();
}

function checkMatch() {
    if (selectedCards.length !== 4) return;

    const firstCat = selectedCards[0].category;
    const isMatch = selectedCards.every(c => c.category === firstCat);

    if (isMatch) {
        // Cards are correct — now ask the user to name the category
        openGuessModal();
    } else if (isOneAway()) {
        handleCloseGuess();
    } else {
        handleWrongGuess();
    }
}

function openGuessModal() {
    // Show the 4 selected thumbnails in the preview
    guessPreview.innerHTML = selectedCards
        .map(c => `<img src="${c.data.url}" alt="thumbnail">`)
        .join('');

    guessInput.value = '';
    guessModal.classList.remove('hidden');
    setTimeout(() => guessInput.focus(), 100);
}

function closeGuessModal() {
    guessModal.classList.add('hidden');
    guessInput.value = '';
}

function submitCategoryGuess() {
    const guess = guessInput.value.trim();
    if (!guess) return;

    const actualCategory = selectedCards[0].category;
    const isCorrectGuess = fuzzyMatch(guess, actualCategory);

    closeGuessModal();

    if (isCorrectGuess) {
        handleCorrectGuess(actualCategory);
    } else {
        // Cards were right but category name was wrong — no mistake penalty
        setMessage(`Not quite the category name! Try again...`, 'close');
        setTimeout(() => {
            selectedCards.forEach(c => c.element.classList.remove('selected'));
            selectedCards = [];
            updateButtons();
        }, 1200);
    }
}

/**
 * Fuzzy matching: checks if the user's guess is close enough.
 * Matches if:
 * 1. Exact match (case-insensitive)
 * 2. One string contains the other (e.g. "Cooking" matches "Cooking Tutorials")
 * 3. Any word in the guess appears in the category or vice versa (2+ chars)
 * 4. Levenshtein distance is small relative to the category length
 */
function fuzzyMatch(guess, actual) {
    const g = guess.toLowerCase().trim();
    const a = actual.toLowerCase().trim();

    // 1. Exact match
    if (g === a) return true;

    // 2. Containment — either direction
    if (a.includes(g) || g.includes(a)) return true;

    // 3. Word overlap — any significant word in common
    const guessWords = g.split(/\s+/).filter(w => w.length >= 2);
    const actualWords = a.split(/\s+/).filter(w => w.length >= 2);
    const hasCommonWord = guessWords.some(gw =>
        actualWords.some(aw => aw.includes(gw) || gw.includes(aw))
    );
    if (hasCommonWord) return true;

    // 4. Levenshtein distance — allow roughly 35% edits
    const distance = levenshtein(g, a);
    const threshold = Math.floor(a.length * 0.35);
    if (distance <= threshold) return true;

    return false;
}

function levenshtein(s, t) {
    const m = s.length;
    const n = t.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
}

function handleCorrectGuess(category) {
    setMessage(`Correct! Category: ${category}`, 'success');
    solvedCategoryNames.push(category);

    const cardElements = selectedCards.map(c => c.element);
    const thumbnailUrls = selectedCards.map(c => c.data.url);
    const colorIndex = solvedCategories; // capture before incrementing

    solvedCategories++;
    selectedCards = [];
    updateButtons();

    // Animate cards away then create solved row
    animateCardsToSolved(cardElements, category, thumbnailUrls, colorIndex);
}

function animateCardsToSolved(cardElements, category, thumbnailUrls, colorIndex) {
    const solvedArea = document.getElementById('solved-area');
    const board = document.getElementById('game-board');

    // Step 1: Record current positions of all selected cards
    const cardRects = cardElements.map(el => el.getBoundingClientRect());

    // Step 2: Fix cards in place and start animating them up
    cardElements.forEach((el, i) => {
        const rect = cardRects[i];
        el.classList.add('animating-to-solved');
        el.classList.remove('selected');
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
        el.style.width = rect.width + 'px';
        el.style.height = rect.height + 'px';
    });

    // Step 3: After a brief frame, animate them to collapse together
    requestAnimationFrame(() => {
        const targetRect = solvedArea.getBoundingClientRect();
        const targetY = targetRect.bottom;
        const totalWidth = solvedArea.clientWidth || board.clientWidth;
        const thumbWidth = (totalWidth - 3 * 6) / 4; // 4 thumbs, 6px gaps

        cardElements.forEach((el, i) => {
            const startLeft = (totalWidth - (4 * thumbWidth + 3 * 6)) / 2;
            el.style.left = (targetRect.left + startLeft + i * (thumbWidth + 6)) + 'px';
            el.style.top = targetY + 'px';
            el.style.width = thumbWidth + 'px';
            el.style.height = (thumbWidth * 9 / 16) + 'px';
            el.style.opacity = '0';
        });
    });

    // Step 4: After animation completes, clean up and create solved row
    setTimeout(() => {
        cardElements.forEach(el => el.remove());

        // Create the solved row
        const row = document.createElement('div');
        row.className = `solved-row ${CATEGORY_COLORS[colorIndex]}`;
        row.innerHTML = `
            <div class="solved-label">${category}</div>
            <div class="solved-thumbnails">
                ${thumbnailUrls.map(url => `<img src="${url}" alt="thumbnail">`).join('')}
            </div>
        `;
        solvedArea.appendChild(row);

        // Re-render remaining cards
        renderBoard(allThumbnails);

        // Check win condition
        if (solvedCategories === 4) {
            setTimeout(() => {
                setMessage('🎉 You cleared the board!', 'win');
                launchConfetti();
            }, 300);
        }
    }, 650);
}

function isOneAway() {
    // Build up a counts dict for each category in selected cards
    const categoryCounts = {};
    selectedCards.forEach(c => {
        if (categoryCounts[c.category]) {
            categoryCounts[c.category] += 1;
        } else {
            categoryCounts[c.category] = 1;
        }
    });
    return Object.values(categoryCounts).some(count => count === 3);
}

function handleCloseGuess() {
    mistakesLeft--;
    renderMistakeDots();

    if (mistakesLeft <= 0) {
        setMessage('Out of guesses! Better luck next time.', 'error');
        // Disable all interactions
        document.querySelectorAll('.card-container').forEach(el => {
            el.style.pointerEvents = 'none';
        });
        submitBtn.disabled = true;
        deselectBtn.disabled = true;
        selectedCards.forEach(c => c.element.classList.remove('selected'));
        selectedCards = [];
        revealAll();
        return;
    }

    setMessage('One away...', 'close');

    // Shake animation is handled by CSS class on message board
    setTimeout(() => {
        selectedCards.forEach(c => c.element.classList.remove('selected'));
        selectedCards = [];
        updateButtons();
    }, 800);
}

function handleWrongGuess() {
    mistakesLeft--;
    renderMistakeDots();

    if (mistakesLeft <= 0) {
        setMessage('Out of guesses! Better luck next time.', 'error');
        // Disable all interactions
        document.querySelectorAll('.card-container').forEach(el => {
            el.style.pointerEvents = 'none';
        });
        submitBtn.disabled = true;
        deselectBtn.disabled = true;
        selectedCards.forEach(c => c.element.classList.remove('selected'));
        selectedCards = [];
        revealAll();
        return;
    }

    setMessage('Not quite... try again!', 'error');

    // Shake animation is handled by CSS class on message board
    setTimeout(() => {
        selectedCards.forEach(c => c.element.classList.remove('selected'));
        selectedCards = [];
        updateButtons();
    }, 800);
}

function revealAll() {
    const solvedArea = document.getElementById('solved-area');
    const board = document.getElementById('game-board');

    // Group remaining unsolved thumbnails by category
    const remaining = allThumbnails.filter(
        v => !solvedCategoryNames.includes(v.category)
    );

    const groups = {};
    remaining.forEach(v => {
        if (!groups[v.category]) groups[v.category] = [];
        groups[v.category].push(v);
    });

    const categoryList = Object.keys(groups);

    // Reveal each category group sequentially with a stagger
    categoryList.forEach((category, groupIndex) => {
        const delay = groupIndex * 800; // stagger each group by 800ms

        setTimeout(() => {
            const videos = groups[category];
            const colorIndex = solvedCategories;
            solvedCategories++;
            solvedCategoryNames.push(category);

            // Find the card elements on the board that belong to this category
            const cardElements = [];
            const thumbnailUrls = [];
            videos.forEach(video => {
                const card = board.querySelector(`[data-id="${video.id}"]`);
                if (card) {
                    cardElements.push(card);
                    thumbnailUrls.push(video.url);
                }
            });

            if (cardElements.length === 0) return;

            // Record positions, fix them, then animate to collapse
            const cardRects = cardElements.map(el => el.getBoundingClientRect());

            cardElements.forEach((el, i) => {
                const rect = cardRects[i];
                el.classList.add('animating-to-solved');
                el.classList.remove('selected');
                el.style.left = rect.left + 'px';
                el.style.top = rect.top + 'px';
                el.style.width = rect.width + 'px';
                el.style.height = rect.height + 'px';
            });

            requestAnimationFrame(() => {
                const targetRect = solvedArea.getBoundingClientRect();
                const targetY = targetRect.bottom;
                const totalWidth = solvedArea.clientWidth || board.clientWidth;
                const thumbWidth = (totalWidth - 3 * 6) / 4;

                cardElements.forEach((el, i) => {
                    const startLeft = (totalWidth - (4 * thumbWidth + 3 * 6)) / 2;
                    el.style.left = (targetRect.left + startLeft + i * (thumbWidth + 6)) + 'px';
                    el.style.top = targetY + 'px';
                    el.style.width = thumbWidth + 'px';
                    el.style.height = (thumbWidth * 9 / 16) + 'px';
                    el.style.opacity = '0';
                });
            });

            // After animation, create solved row and clean up
            setTimeout(() => {
                cardElements.forEach(el => el.remove());

                const row = document.createElement('div');
                row.className = `solved-row ${CATEGORY_COLORS[colorIndex]}`;
                row.innerHTML = `
                    <div class="solved-label">${category}</div>
                    <div class="solved-thumbnails">
                        ${thumbnailUrls.map(url => `<img src="${url}" alt="thumbnail">`).join('')}
                    </div>
                `;
                solvedArea.appendChild(row);

                // Re-render remaining cards after each group
                renderBoard(allThumbnails);
            }, 650);
        }, delay);
    });
}

/* ===== Confetti ===== */
function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const colors = ['#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f87171', '#fb923c'];

    for (let i = 0; i < 80; i++) {
        setTimeout(() => {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + 'vw';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (Math.random() * 8 + 5) + 'px';
            piece.style.height = (Math.random() * 8 + 5) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            piece.style.setProperty('--fall-duration', (Math.random() * 2 + 2) + 's');
            piece.style.setProperty('--rotation', (Math.random() * 720 - 360) + 'deg');
            canvas.appendChild(piece);

            setTimeout(() => piece.remove(), 4500);
        }, i * 30);
    }
}

initGame();