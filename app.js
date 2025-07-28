// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', () => {
    // 既存のファイル入力要素を削除
    const existingInput = document.getElementById('csv-file-input');
    if (existingInput) {
        existingInput.remove();
    }

    // 新しいファイル入力要素を作成
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'csv-file-input';
    input.accept = '.csv';
    input.style.display = 'none';
    document.body.appendChild(input);

    // アプリケーションを初期化
    const app = new App();
});

class App {
    constructor() {
        this.currentScreen = 'home';
        this.currentDeck = null;
        this.currentCard = null;
        
        // 保存された設定を読み込む
        const savedSettings = JSON.parse(localStorage.getItem('ankiSettings') || '{}');
        window.studyManager.MAX_NEW_CARDS = savedSettings.maxNewCards || 20;
        window.studyManager.MAX_REVIEW_CARDS = savedSettings.maxReviewCards || 100;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // グローバルに関数を公開
        window.app = this;
        window.navigateTo = (screen) => this.navigateTo(screen);
        window.handleAnswer = (quality) => this.handleAnswer(quality);
        window.startStudy = (deckId) => this.startStudy(deckId);
        window.createNewDeck = () => this.createNewDeck();
        window.deleteDeck = (deckId) => this.deleteDeck(deckId);
        window.exportDeck = (deckId) => this.exportDeck(deckId);
        window.viewCards = (deckId) => this.viewCards(deckId);
        window.createNewCard = () => this.createNewCard();
        window.editCard = (cardId) => this.editCard(cardId);
        window.deleteCard = (cardId) => this.deleteCard(cardId);
        window.saveCard = () => this.saveCard();
        window.saveSettings = () => this.saveSettings();
        window.restoreBackup = () => this.restoreBackup();

        // 画面の初期化
        this.setupScreens();
        // 初期画面の表示
        this.navigateTo('home');
    }

    setupScreens() {
        // 保存された設定を読み込む
        const savedSettings = JSON.parse(localStorage.getItem('ankiSettings') || '{}');
        window.studyManager.MAX_NEW_CARDS = savedSettings.maxNewCards || 20;
        window.studyManager.MAX_REVIEW_CARDS = savedSettings.maxReviewCards || 100;

        this.setupStudyScreen();
        this.setupStatsScreen();
        this.setupDecksScreen();
        this.setupDeckSelectScreen();  // 新しい画面のセットアップを追加
        this.setupSettingsScreen();
        this.setupCardListScreen();
        this.setupCardEditScreen();
    }

    setupDeckSelectScreen() {
        const deckSelectScreen = document.getElementById('deck-select-screen');
        deckSelectScreen.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <div class="mb-4">
                    <button onclick="navigateTo('home')" class="text-indigo-600 hover:text-indigo-800">
                        ← 戻る
                    </button>
                </div>
                <div id="deck-select-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                </div>
            </div>
        `;
    }

    updateDeckSelectList() {
        const deckList = document.getElementById('deck-select-list');
        const decks = window.storage.getAllDecks();
        
        if (Object.keys(decks).length === 0) {
            deckList.innerHTML = `
                <div class="col-span-full text-center py-8 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 mb-4">デッキがありません</p>
                    <p class="text-gray-400">デッキ管理から新しいデッキを作成してください</p>
                </div>
            `;
            return;
        }

        deckList.innerHTML = Object.values(decks).map(deck => {
            // デッキごとの学習可能カード数を取得
            const counts = window.studyManager.getStudyCountsForDeck(deck.id);
            const isStudyAvailable = counts.newCards > 0 || counts.reviewCards > 0;

            return `
                <div class="bg-white rounded-lg shadow p-4 transform transition-transform hover:scale-105">
                    <h3 class="text-xl font-bold mb-2">${deck.name}</h3>
                    <p class="text-gray-600 mb-2">${deck.cards.length}枚のカード</p>
                    <div class="mb-4 space-y-1">
                        <p class="text-sm">
                            <span class="text-emerald-600">新規: ${counts.newCards}</span> /
                            <span class="text-blue-600">復習: ${counts.reviewCards}</span>
                        </p>
                    </div>
                    <div class="flex justify-center">
                        <button onclick="startStudy('${deck.id}')"
                                class="${isStudyAvailable
                                    ? 'bg-indigo-600 hover:bg-indigo-700'
                                    : 'bg-gray-400 cursor-not-allowed'}
                                    text-white px-6 py-2 rounded-lg transition-colors duration-200"
                                ${!isStudyAvailable ? 'disabled' : ''}>
                            ${isStudyAvailable ? '学習開始' : '今日の学習は完了'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    setupStudyScreen() {
        const studyScreen = document.getElementById('study-screen');
        studyScreen.innerHTML = `
            <div class="max-w-2xl mx-auto">
                <div class="mb-4 flex justify-between items-center">
                    <button onclick="navigateTo('home')" class="text-indigo-600 hover:text-indigo-800">
                        ← 戻る
                    </button>
                    <div id="study-progress" class="flex items-center space-x-4">
                        <div class="flex items-center">
                            <span class="text-emerald-600 font-medium">新規:</span>
                            <span class="ml-1 text-gray-700">0/0</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-blue-600 font-medium">復習:</span>
                            <span class="ml-1 text-gray-700">0/0</span>
                        </div>
                    </div>
                </div>
                <div class="card-flip relative h-96 w-full" id="flashcard">
                    <div class="card-front bg-white rounded-xl shadow-lg pt-28 px-8 pb-8 flex flex-col items-center">
                        <p class="text-2xl text-center w-full" id="question"></p>
                    </div>
                    <div class="card-back bg-white rounded-xl shadow-lg pt-28 px-8 pb-8 flex flex-col items-center space-y-12">
                        <p class="text-2xl text-center w-full" id="answer-question"></p>
                        <p class="text-2xl text-center w-full" id="answer"></p>
                    </div>
                </div>
                <div class="mt-8 grid grid-cols-4 gap-4" id="answer-buttons" style="display: none;">
                    <button onclick="handleAnswer(1)" class="bg-rose-500 hover:bg-rose-600 text-white py-6 rounded-lg transition-colors duration-200 flex flex-col items-center">
                        <span class="text-lg font-medium">Again</span>
                        <span class="text-sm mt-1" id="interval-again">もう一度</span>
                    </button>
                    <button onclick="handleAnswer(2)" class="bg-amber-500 hover:bg-amber-600 text-white py-6 rounded-lg transition-colors duration-200 flex flex-col items-center">
                        <span class="text-lg font-medium">Hard</span>
                        <span class="text-sm mt-1" id="interval-hard"></span>
                    </button>
                    <button onclick="handleAnswer(3)" class="bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-lg transition-colors duration-200 flex flex-col items-center">
                        <span class="text-lg font-medium">Good</span>
                        <span class="text-sm mt-1" id="interval-good"></span>
                    </button>
                    <button onclick="handleAnswer(4)" class="bg-indigo-500 hover:bg-indigo-600 text-white py-6 rounded-lg transition-colors duration-200 flex flex-col items-center">
                        <span class="text-lg font-medium">Easy</span>
                        <span class="text-sm mt-1" id="interval-easy"></span>
                    </button>
                </div>
            </div>
        `;

        const flashcard = document.getElementById('flashcard');
        flashcard.addEventListener('click', () => {
            if (!flashcard.classList.contains('flipped')) {
                // フリップ開始時にボタンを無効化
                const buttons = document.querySelectorAll('#answer-buttons button');
                buttons.forEach(button => button.disabled = true);
                
                flashcard.classList.add('flipped');
                document.getElementById('answer-buttons').style.display = 'grid';
                
                // トランジション完了時にボタンを有効化
                flashcard.addEventListener('transitionend', function enableButtons() {
                    buttons.forEach(button => button.disabled = false);
                    flashcard.removeEventListener('transitionend', enableButtons);
                });
            }
        });
    }

    setupStatsScreen() {
        const statsScreen = document.getElementById('stats-screen');
        statsScreen.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <div class="mb-4">
                    <button onclick="navigateTo('home')" class="text-indigo-600 hover:text-indigo-800">
                        ← 戻る
                    </button>
                </div>
                <div id="stats-summary" class="mb-8"></div>
                <div class="space-y-8">
                    <div class="bg-white p-4 rounded-lg shadow">
                        <canvas id="upcoming-reviews-chart"></canvas>
                    </div>
                    <div class="bg-white p-4 rounded-lg shadow">
                        <canvas id="total-reviews-chart"></canvas>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="bg-white p-4 rounded-lg shadow">
                            <canvas id="weekly-chart"></canvas>
                        </div>
                        <div class="bg-white p-4 rounded-lg shadow">
                            <canvas id="level-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupDecksScreen() {
        const decksScreen = document.getElementById('decks-screen');
        decksScreen.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <div class="mb-4 flex justify-between items-center">
                    <button onclick="navigateTo('home')" class="text-indigo-600 hover:text-indigo-800">
                        ← 戻る
                    </button>
                    <div class="flex items-center">
                        <button onclick="app.importCSV()" class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg mr-2 transition-colors duration-200">
                            インポート
                        </button>
                        <button onclick="createNewDeck()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                            新規デッキ
                        </button>
                    </div>
                </div>
                <div id="decks-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                </div>
            </div>
        `;

        this.updateDecksList();
    }

    setupCardListScreen() {
        const cardListScreen = document.getElementById('card-list-screen');
        if (!cardListScreen) {
            const screen = document.createElement('div');
            screen.id = 'card-list-screen';
            screen.className = 'hidden';
            document.getElementById('app').appendChild(screen);
        }
        
        const screen = document.getElementById('card-list-screen');
        screen.innerHTML = `
            <div class="max-w-2xl mx-auto">
                <div class="mb-4 flex justify-between items-center">
                    <button onclick="navigateTo('decks')" class="text-indigo-600 hover:text-indigo-800">
                        ← 戻る
                    </button>
                    <div class="flex items-center">
                        <button onclick="createNewCard()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                            新規カード
                        </button>
                    </div>
                </div>
                <div id="cards-list" class="space-y-4">
                </div>
            </div>
        `;
    }

    setupCardEditScreen() {
        const cardEditScreen = document.getElementById('card-edit-screen');
        if (!cardEditScreen) {
            const screen = document.createElement('div');
            screen.id = 'card-edit-screen';
            screen.className = 'hidden';
            document.getElementById('app').appendChild(screen);
        }

        const screen = document.getElementById('card-edit-screen');
        screen.innerHTML = `
            <div class="max-w-2xl mx-auto">
                <div class="mb-4 flex justify-between items-center">
                    <button onclick="navigateTo('card-list')" class="text-indigo-600 hover:text-indigo-800">
                        ← 戻る
                    </button>
                    <button onclick="saveCard()" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">
                        保存
                    </button>
                </div>
                <div class="space-y-4">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-gray-700 mb-2">問題</label>
                                <textarea id="card-question" rows="3" class="w-full border rounded-lg px-3 py-2"></textarea>
                            </div>
                            <div class="flex justify-center">
                                <button id="make-blank-button" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded inline-block">
                                    選択部分を穴埋めにする
                                </button>
                            </div>
                            <div>
                                <label class="block text-gray-700 mb-2">解答</label>
                                <textarea id="card-answer" rows="3" class="w-full border rounded-lg px-3 py-2"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <h3 class="text-lg font-semibold mb-4">プレビュー</h3>
                        <div class="space-y-4">
                            <div>
                                <h4 class="font-bold text-gray-700">問題</h4>
                                <p class="mt-2" id="preview-question"></p>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-700">解答</h4>
                                <p class="mt-2" id="preview-answer"></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 穴埋めボタンのイベントリスナーを設定
        const makeBlankButton = document.getElementById('make-blank-button');
        const questionTextarea = document.getElementById('card-question');
        const answerTextarea = document.getElementById('card-answer');

        // プレビューを更新する関数
        const updatePreview = () => {
            const previewQuestion = document.getElementById('preview-question');
            const previewAnswer = document.getElementById('preview-answer');
            
            // 問題のプレビューを更新（改行と___をハイライト表示）
            previewQuestion.innerHTML = this.formatQuestion(questionTextarea.value);
            
            // 解答のプレビューを更新（改行を反映）
            previewAnswer.innerHTML = answerTextarea.value.replace(/\n/g, '<br>');
        };

        // 問題と解答の入力時にプレビューを更新
        questionTextarea.addEventListener('input', updatePreview);
        answerTextarea.addEventListener('input', updatePreview);

        // 穴埋めボタンのクリックイベント
        makeBlankButton.addEventListener('click', () => {
            const selectedText = questionTextarea.value.substring(
                questionTextarea.selectionStart,
                questionTextarea.selectionEnd
            ).trim();

            if (selectedText) {
                // 選択されたテキストを___に置き換え
                const beforeCursor = questionTextarea.value.substring(0, questionTextarea.selectionStart);
                const afterCursor = questionTextarea.value.substring(questionTextarea.selectionEnd);
                questionTextarea.value = beforeCursor + '___' + afterCursor;

                // 答えに選択されたテキストを追加
                const currentAnswer = answerTextarea.value.trim();
                answerTextarea.value = currentAnswer
                    ? currentAnswer + '\n' + selectedText
                    : selectedText;

                // プレビューを更新
                updatePreview();
            }
        });

        // 初期プレビューを表示
        updatePreview();
    }

    setupSettingsScreen() {
        const settingsScreen = document.getElementById('settings-screen');
        const savedSettings = JSON.parse(localStorage.getItem('ankiSettings') || '{}');
        settingsScreen.innerHTML = `
            <div class="max-w-2xl mx-auto">
                <div class="mb-4">
                    <button onclick="navigateTo('home')" class="text-indigo-600 hover:text-indigo-800">
                        ← 戻る
                    </button>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4">設定</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-gray-700 mb-2">1日の新規カード上限</label>
                            <input type="number" id="max-new-cards" value="${savedSettings.maxNewCards || window.studyManager.MAX_NEW_CARDS || 20}" min="1" max="100"
                                class="w-full border rounded-lg px-3 py-2">
                        </div>
                        <div>
                            <label class="block text-gray-700 mb-2">1日の復習カード上限</label>
                            <input type="number" id="max-review-cards" value="${savedSettings.maxReviewCards || window.studyManager.MAX_REVIEW_CARDS || 100}" min="1" max="500"
                                class="w-full border rounded-lg px-3 py-2">
                        </div>
                        <div>
                            <button onclick="saveSettings()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                                保存
                            </button>
                        </div>
                        <div class="mt-8">
                            <h3 class="text-xl font-bold mb-4">バックアップ</h3>
                            <button onclick="restoreBackup()" class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                                バックアップから復元
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async navigateTo(screen) {
        // 現在の画面を非表示
        const currentScreenElement = document.getElementById(`${this.currentScreen}-screen`);
        if (currentScreenElement) {
            currentScreenElement.classList.remove('slide-in');
            currentScreenElement.classList.add('hidden');
        }
        
        // 新しい画面を表示
        this.currentScreen = screen;
        const newScreenElement = document.getElementById(`${screen}-screen`);
        if (newScreenElement) {
            newScreenElement.classList.remove('hidden');
            newScreenElement.classList.add('slide-in');

            // 画面に応じた初期化処理
            if (screen === 'stats') {
                // 既存のグラフを破棄
                if (window.statsManager) {
                    if (window.statsManager.weeklyChart) window.statsManager.weeklyChart.destroy();
                    if (window.statsManager.levelChart) window.statsManager.levelChart.destroy();
                    if (window.statsManager.totalReviewsChart) window.statsManager.totalReviewsChart.destroy();
                    if (window.statsManager.upcomingReviewsChart) window.statsManager.upcomingReviewsChart.destroy();
                }
                window.statsManager.initializeCharts();
            } else if (screen === 'decks') {
                this.updateDecksList();
            } else if (screen === 'deck-select') {
                this.updateDeckSelectList();
            }
        }
    }

    updateDecksList() {
        const decksList = document.getElementById('decks-list');
        const decks = window.storage.getAllDecks();
        
        if (Object.keys(decks).length === 0) {
            decksList.innerHTML = `
                <div class="col-span-full text-center py-8 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 mb-4">デッキがありません</p>
                    <p class="text-gray-400">新規デッキを作成するか、CSVファイルをインポートしてください</p>
                </div>
            `;
            return;
        }

        decksList.innerHTML = Object.values(decks).map(deck => `
            <div class="bg-white rounded-lg shadow p-4 transform transition-transform hover:scale-105">
                <h3 class="text-xl font-bold mb-2">${deck.name}</h3>
                <p class="text-gray-600 mb-4">${deck.cards.length}枚のカード</p>
                <div class="flex justify-between">
                    <button onclick="startStudy('${deck.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded transition-colors duration-200">
                        学習
                    </button>
                    <button onclick="viewCards('${deck.id}')" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded transition-colors duration-200">
                        編集
                    </button>
                    <button onclick="exportDeck('${deck.id}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded transition-colors duration-200">
                        エクスポート
                    </button>
                    <button onclick="deleteDeck('${deck.id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded transition-colors duration-200">
                        削除
                    </button>
                </div>
            </div>
        `).join('');
    }

    formatNextReview(dateString) {
        if (!dateString) return '未設定';
        try {
            const now = dayjs().tz('Asia/Tokyo').startOf('day');
            const date = dayjs(dateString).tz('Asia/Tokyo').startOf('day');
            
            if (!date.isValid()) {
                console.warn('Invalid date:', dateString);
                return '無効な日付';
            }

            if (date.isBefore(now)) {
                return '期限切れ';
            }

            if (date.isSame(now)) {
                return '今日';
            }

            if (date.diff(now, 'day') === 1) {
                return '明日';
            }

            // 日数で表示
            const days = date.diff(now, 'day');
            return `${days}日後`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return '無効な日付';
        }
    }

    updateCardsList() {
        if (!this.currentDeck) return;

        const cardsList = document.getElementById('cards-list');
        const deck = window.storage.getDeck(this.currentDeck);
        
        if (deck.cards.length === 0) {
            cardsList.innerHTML = `
                <div class="text-center py-8 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 mb-4">カードがありません</p>
                    <p class="text-gray-400">新規カードを作成してください</p>
                </div>
            `;
            return;
        }

        cardsList.innerHTML = deck.cards.map(card => `
            <div class="bg-white rounded-lg shadow p-4">
                <div class="mb-4">
                    <h4 class="font-bold text-gray-700">問題</h4>
                    <p class="mt-2">${this.formatQuestion(card.question)}</p>
                </div>
                <div class="mb-4">
                    <h4 class="font-bold text-gray-700">解答</h4>
                    <p class="mt-2">${card.answer.replace(/\n/g, '<br>')}</p>
                </div>
                <div class="mb-4">
                    <h4 class="font-bold text-gray-700">次の復習</h4>
                    <p class="mt-2 text-sm text-indigo-600">
                        ${this.formatNextReview(card.nextReview)}
                    </p>
                </div>
                <div class="flex justify-end">
                    <div class="flex gap-3">
                        <button onclick="editCard('${card.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded transition-colors duration-200 min-w-[80px]">
                            編集
                        </button>
                        <button onclick="deleteCard('${card.id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded transition-colors duration-200 min-w-[80px]">
                            削除
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    formatQuestion(question, answer = '', isAnswer = false) {
        // まず改行を <br> に変換
        question = question.replace(/\n/g, '<br>');
        
        if (isAnswer && answer) {
            // 回答カード用：回答をインディゴ色と下線で表示
            return question.replace(/___/g,
                `<span class="text-indigo-800 border-b-2 border-indigo-800">${answer}</span>`);
        } else {
            // 問題カード・プレビュー用：黄色いハイライトで___を表示
            return question.replace(/___/g, '<span class="bg-yellow-200 px-1">___</span>');
        }
    }

    async viewCards(deckId) {
        console.log('viewCards called with deckId:', deckId);
        this.currentDeck = deckId;
        await this.navigateTo('card-list');
        // 画面遷移が完了してからカードリストを更新
        setTimeout(() => {
            console.log('Calling updateCardsList after navigation');
            this.updateCardsList();
        }, 100);
    }

    createNewCard() {
        this.currentCard = null;
        document.getElementById('card-question').value = '';
        document.getElementById('card-answer').value = '';
        this.navigateTo('card-edit');
    }

    editCard(cardId) {
        const deck = window.storage.getDeck(this.currentDeck);
        this.currentCard = deck.cards.find(card => card.id === cardId);
        if (this.currentCard) {
            document.getElementById('card-question').value = this.currentCard.question;
            document.getElementById('card-answer').value = this.currentCard.answer;
            this.navigateTo('card-edit');
        }
    }

    async saveCard() {
        try {
            const question = document.getElementById('card-question').value.trim();
            const answer = document.getElementById('card-answer').value.trim();

            if (!question || !answer) {
                alert('問題と解答を入力してください');
                return;
            }

            if (question.length > 2000 || answer.length > 2000) {
                alert('問題または解答が長すぎます（最大2,000文字）');
                return;
            }

            const deck = window.storage.getDeck(this.currentDeck);
            if (this.currentCard) {
                // 既存カードの編集
                const cardIndex = deck.cards.findIndex(card => card.id === this.currentCard.id);
                if (cardIndex !== -1) {
                    deck.cards[cardIndex] = {
                        ...deck.cards[cardIndex],
                        question: question,
                        answer: answer
                    };
                }
            } else {
                // 新規カード作成
                deck.cards.push({
                    id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    question: question,
                    answer: answer,
                    level: 0,
                    nextReview: new Date(),
                    lastStudied: new Date(),
                    stats: {
                        correctCount: 0,
                        incorrectCount: 0
                    }
                });
            }

            // デッキを保存
            window.storage.saveDeck(deck);

            // カードリスト画面に戻る前に現在のデッキIDを保存
            const currentDeckId = this.currentDeck;

            // 画面遷移
            await this.navigateTo('card-list');

            // 少し待ってからカードリストを更新
            setTimeout(() => {
                this.currentDeck = currentDeckId;
                this.updateCardsList();
            }, 100);

        } catch (error) {
            console.error('Error saving card:', error);
            alert('カードの保存中にエラーが発生しました');
        }
    }

    deleteCard(cardId) {
        if (confirm('このカードを削除してもよろしいですか？')) {
            const deck = window.storage.getDeck(this.currentDeck);
            deck.cards = deck.cards.filter(card => card.id !== cardId);
            window.storage.saveDeck(deck);
            this.updateCardsList();
        }
    }

    importCSV() {
        console.log('importCSV called');
        const input = document.getElementById('csv-file-input');
        if (!input) {
            console.error('File input element not found');
            return;
        }

        const handleFileSelect = async (event) => {
            console.log('File select event triggered');
            const file = event.target.files[0];
            if (file) {
                console.log('Selected file:', file.name);
                try {
                    const text = await file.text();
                    console.log('File content loaded');
                    const deck = await window.storage.importFromCsv(text);
                    console.log('CSV imported successfully');
                    this.updateDecksList();
                    alert(`デッキ「${deck.name}」をインポートしました`);
                    
                    // 統計ページを手動遷移時に更新するために、ここで統計情報を更新
                    if (window.statsManager) {
                        window.statsManager.updateStats();
                    }
                } catch (error) {
                    console.error('Import error:', error);
                    alert('インポートエラー: ' + error.message);
                }
            }
            input.value = '';
            input.removeEventListener('change', handleFileSelect);
        };
        input.addEventListener('change', handleFileSelect);
        input.click();
    }

    async startStudy(deckId) {
        try {
            window.studyManager.initializeDeck(deckId);
            await this.navigateTo('study');
            // 画面遷移が完了してからカードを表示
            setTimeout(() => {
                this.showNextCard();
            }, 100);
        } catch (error) {
            alert(error.message);
            await this.navigateTo('deck-select');
        }
    }

    showNextCard() {
        const card = window.studyManager.getNextCard();
        if (!card) {
            alert('今日の学習は完了です！');
            this.navigateTo('home');
            return;
        }

        // カードの表示をリセット
        const flashcard = document.getElementById('flashcard');
        flashcard.classList.remove('flipped');
        document.getElementById('answer-buttons').style.display = 'none';

        // 問題と解答を設定
        document.getElementById('question').innerHTML = card.formattedQuestion;
        document.getElementById('answer-question').innerHTML = this.formatQuestion(card.question, `<span class="text-indigo-600">${card.answer}</span>`, true);
        document.getElementById('answer').innerHTML = card.answer.replace(/\n/g, '<br>');

        // 穴埋め問題の場合は回答エリアを非表示にする
        const answerElement = document.getElementById('answer');
        if (card.question.includes('___')) {
            answerElement.style.display = 'none';
        } else {
            answerElement.style.display = 'block';
        }

        // 進捗を更新
        const progress = window.studyManager.getCurrentProgress();
        const studyProgress = document.getElementById('study-progress');
        studyProgress.innerHTML = `
            <div class="flex items-center">
                <span class="text-emerald-600 font-medium">新規:</span>
                <span class="ml-1 text-gray-700">${progress.newCardsToday}/${progress.maxNewCards}</span>
            </div>
            <div class="flex items-center">
                <span class="text-blue-600 font-medium">復習:</span>
                <span class="ml-1 text-gray-700">${progress.reviewCardsToday}/${progress.maxReviewCards}</span>
            </div>
        `;

        // 各ボタンの次回復習タイミングを更新
        const now = dayjs().tz('Asia/Tokyo').startOf('day');

        // Again: もう一度（固定）
        document.getElementById('interval-again').textContent = 'もう一度';

        // Hard
        const hardInterval = window.studyManager.calculateDisplayInterval(card, 2);
        document.getElementById('interval-hard').textContent =
            this.formatNextReview(now.add(hardInterval, 'day').toISOString());

        // Good
        const goodInterval = window.studyManager.calculateDisplayInterval(card, 3);
        document.getElementById('interval-good').textContent =
            this.formatNextReview(now.add(goodInterval, 'day').toISOString());

        // Easy
        const easyInterval = window.studyManager.calculateDisplayInterval(card, 4);
        document.getElementById('interval-easy').textContent =
            this.formatNextReview(now.add(easyInterval, 'day').toISOString());
    }

    handleAnswer(quality) {
        window.studyManager.processAnswer(quality);
        // フリップはすぐに解除
        const flashcard = document.getElementById('flashcard');
        flashcard.classList.remove('flipped');
        // 次のカードの表示は0.25秒遅延
        setTimeout(() => {
            this.showNextCard();
        }, 250);
    }

    exportDeck(deckId) {
        const blob = window.storage.exportToCsv(deckId);
        if (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const deck = window.storage.getDeck(deckId);
            a.href = url;
            a.download = `${deck.name}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    }

    deleteDeck(deckId) {
        if (confirm('このデッキを削除してもよろしいですか？')) {
            window.storage.deleteDeck(deckId);
            this.updateDecksList();
            // 統計を更新
            if (window.statsManager) {
                window.statsManager.updateStats();
            }
        }
    }

    createNewDeck() {
        const name = prompt('デッキ名を入力してください：');
        if (name) {
            const deck = {
                id: 'deck_' + Date.now(),
                name: name,
                cards: [],
                created: new Date(),
                lastStudied: new Date()
            };
            window.storage.saveDeck(deck);
            this.updateDecksList();
        }
    }

    async saveSettings() {
        const maxNewCards = parseInt(document.getElementById('max-new-cards').value);
        const maxReviewCards = parseInt(document.getElementById('max-review-cards').value);
        
        if (maxNewCards >= 1 && maxNewCards <= 100 &&
            maxReviewCards >= 1 && maxReviewCards <= 500) {
            
            // 設定をlocalStorageに保存
            const settings = {
                maxNewCards: maxNewCards,
                maxReviewCards: maxReviewCards
            };
            localStorage.setItem('ankiSettings', JSON.stringify(settings));
            
            // studyManagerを再初期化
            window.studyManager = new StudyManager();
            
            // 設定画面を再描画して値を反映
            this.setupSettingsScreen();
            
            alert('設定を保存しました');
            
            // ホーム画面に戻る
            await this.navigateTo('home');
        } else {
            alert('入力値が範囲外です');
        }
    }

    restoreBackup() {
        const backups = JSON.parse(localStorage.getItem('backups') || '[]');
        if (backups.length === 0) {
            alert('利用可能なバックアップがありません');
            return;
        }

        if (confirm('最新のバックアップから復元しますか？')) {
            const backup = backups[0]; // 最新のバックアップを使用
            if (window.storage.restoreFromBackup(backup.timestamp)) {
                alert('バックアップから復元しました');
                this.updateDecksList();
            } else {
                alert('バックアップの復元に失敗しました');
            }
        }
    }
}
