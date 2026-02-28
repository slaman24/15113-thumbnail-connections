// Change this port if your terminal shows a different one!
const API_URL = 'http://127.0.0.1:5002/api/puzzle';

let selectedCards = [];
let solvedCategories = 0;

async function initGame() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const msgBoard = document.getElementById('message-board');
        
        if (data.thumbnails) {
            msgBoard.innerText = "Select 4 related thumbnails!";
            msgBoard.style.color = "#aaa";
            renderBoard(data.thumbnails);
        }
    } catch (err) {
        console.error(err);
        document.getElementById('message-board').innerText = "Backend not found. Is app.py running?";
    }
}

function renderBoard(thumbnails) {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    thumbnails.forEach(video => {
        const card = document.createElement('div');
        card.className = 'card-container';
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img src="${video.url}" alt="thumbnail">
                </div>
                <div class="card-back">
                    <strong>${video.title}</strong>
                    <p>${video.category}</p>
                </div>
            </div>
        `;

        card.addEventListener('click', () => handleSelection(card, video));
        board.appendChild(card);
    });
}

function handleSelection(el, data) {
    if (el.classList.contains('solved') || el.classList.contains('selected')) {
        // Deselect if already selected
        if (el.classList.contains('selected')) {
            el.classList.remove('selected');
            selectedCards = selectedCards.filter(c => c.id !== data.id);
        }
        return;
    }

    if (selectedCards.length < 4) {
        el.classList.add('selected');
        selectedCards.push({ id: data.id, category: data.category, element: el });
    }

    if (selectedCards.length === 4) {
        checkMatch();
    }
}

function checkMatch() {
    const firstCat = selectedCards[0].category;
    const isMatch = selectedCards.every(c => c.category === firstCat);
    const msgBoard = document.getElementById('message-board');

    if (isMatch) {
        msgBoard.innerText = `Correct! Category: ${firstCat}`;
        msgBoard.style.color = "#2ecc71";
        
        selectedCards.forEach(c => {
            c.element.classList.remove('selected');
            c.element.classList.add('solved');
        });
        
        solvedCategories++;
        selectedCards = [];

        if (solvedCategories === 4) {
            msgBoard.innerText = "🎉 You cleared the board!";
        }
    } else {
        msgBoard.innerText = "Not quite... try again!";
        msgBoard.style.color = "#e74c3c";
        
        setTimeout(() => {
            selectedCards.forEach(c => c.element.classList.remove('selected'));
            selectedCards = [];
        }, 1000);
    }
}

initGame();