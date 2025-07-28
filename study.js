class StudyManager {
    static MIN_EF = 1.3;
    static MAX_EF = 2.5;
    static INITIAL_EF = 2.5;
    static MAX_INTERVAL = 90;  // 最大復習間隔を90日に設定

    // 日本時間の日付を取得
    getJstDate(date) {
        try {
            const targetDate = date ? new Date(date) : new Date();
            if (isNaN(targetDate.getTime())) {
                console.warn('Invalid date provided:', date);
                return dayjs().tz('Asia/Tokyo').startOf('day').toISOString();
            }
            return dayjs(targetDate).tz('Asia/Tokyo').startOf('day').toISOString();
        } catch (error) {
            console.error('Error in getJstDate:', error);
            return dayjs().tz('Asia/Tokyo').startOf('day').toISOString();
        }
    }

    // 指定した日数後の日本時間の日付を取得
    getJstDateAfterDays(days, baseDate) {
        try {
            // baseDateが未定義またはnullの場合は現在の日付を使用
            const targetDate = baseDate || new Date();
            return dayjs(targetDate)
                .tz('Asia/Tokyo')
                .startOf('day')
                .add(days, 'day')
                .toISOString();
        } catch (error) {
            console.error('Invalid date value:', baseDate, error);
            // エラーが発生した場合は現在の日付から計算
            return dayjs()
                .tz('Asia/Tokyo')
                .startOf('day')
                .add(days, 'day')
                .toISOString();
        }
    }
    constructor() {
        this.currentDeck = null;
        this.currentCard = null;
        this.newCardsToday = 0;
        this.reviewCardsToday = 0;
        
        // 設定を読み込む
        const savedSettings = JSON.parse(localStorage.getItem('ankiSettings') || '{}');
        this.MAX_NEW_CARDS = savedSettings.maxNewCards || 20;
        this.MAX_REVIEW_CARDS = savedSettings.maxReviewCards || 100;

        // 学習セッション管理用の配列
        this.againCards = [];         // Againが選択されたカード
        this.firstPassCards = [];     // 1回目の正解カード（新規カードのみ）
        this.todayCards = new Set();  // その日に学習したカードのID
    }

    initializeDeck(deckId) {
        this.currentDeck = window.storage.getDeck(deckId);
        this.resetDailyCounters();
        
        // セッション管理用の配列をリセット
        this.againCards = [];
        this.firstPassCards = [];
        this.todayCards = new Set();

        // 学習可能なカード数をチェック
        const counts = this.getStudyCountsForDeck(deckId);
        if (counts.newCards === 0 && counts.reviewCards === 0) {
            throw new Error('学習可能なカードがありません');
        }
    }

    resetDailyCounters() {
        if (!this.currentDeck.lastStudied) {
            this.newCardsToday = 0;
            this.reviewCardsToday = 0;
            return;
        }

        const lastStudiedJST = dayjs(this.currentDeck.lastStudied).tz('Asia/Tokyo').startOf('day');
        const todayJST = dayjs().tz('Asia/Tokyo').startOf('day');

        if (!lastStudiedJST.isSame(todayJST, 'day')) {
            this.newCardsToday = 0;
            this.reviewCardsToday = 0;
        }
    }

    getNextCard() {
        if (!this.currentDeck) return null;

        const now = this.getJstDate();

        // 1. 復習カードのAgainを優先
        const reviewAgainCards = this.againCards.filter(card => card.level > 0);
        if (reviewAgainCards.length > 0) {
            this.currentCard = reviewAgainCards[0];
            this.againCards = this.againCards.filter(card => card !== this.currentCard);
            this.reviewCardsToday++;
            this.todayCards.add(this.currentCard.id);
            this.currentCard.formattedQuestion = this.formatQuestion(this.currentCard.question);
            return this.currentCard;
        }

        // 2. 復習カードを次に優先
        if (this.reviewCardsToday < this.MAX_REVIEW_CARDS) {
            const dueReviewCards = this.currentDeck.cards.filter(card => {
                const nextReview = this.getJstDate(new Date(card.nextReview));
                return card.level > 0 && nextReview <= now && !this.todayCards.has(card.id);
            });

            if (dueReviewCards.length > 0) {
                this.currentCard = dueReviewCards[0];
                this.reviewCardsToday++;
                this.todayCards.add(this.currentCard.id);
                this.currentCard.formattedQuestion = this.formatQuestion(this.currentCard.question);
                return this.currentCard;
            }
        }

        // 3. 新規カードを次に
        if (this.newCardsToday < this.MAX_NEW_CARDS) {
            const newCards = this.currentDeck.cards.filter(card =>
                card.level === 0 && !this.todayCards.has(card.id) && !this.againCards.includes(card)
            );

            if (newCards.length > 0) {
                this.currentCard = newCards[0];
                this.newCardsToday++;
                this.currentCard.formattedQuestion = this.formatQuestion(this.currentCard.question);
                return this.currentCard;
            }
        }

        // 4. 新規カードのAgainを次に
        const newAgainCards = this.againCards.filter(card => card.level === 0);
        if (newAgainCards.length > 0) {
            this.currentCard = newAgainCards[0];
            this.againCards = this.againCards.filter(card => card !== this.currentCard);
            this.currentCard.formattedQuestion = this.formatQuestion(this.currentCard.question);
            return this.currentCard;
        }

        // 5. 1回目正解の新規カードを最後に
        if (this.firstPassCards.length > 0) {
            this.currentCard = this.firstPassCards[0];
            this.firstPassCards = this.firstPassCards.filter(card => card !== this.currentCard);
            this.currentCard.formattedQuestion = this.formatQuestion(this.currentCard.question);
            return this.currentCard;
        }

        return null;
    }

    formatQuestion(question) {
        // 穴埋めマーカーをハイライト表示に変換
        return question.replace(/___/g, '<span class="bg-yellow-200 px-1">___</span>');
    }

    processAnswer(quality) {
        if (!this.currentCard) return;

        const card = this.currentCard;
        const now = dayjs().tz('Asia/Tokyo').startOf('day');
        const studyDate = now.format('YYYY-MM-DD');
        let reviewCount = 1;

        if (quality === 1) { // Again
            card.stats.incorrectCount++;
            
            if (card.level > 0) {
                card.level = 0;
                card.repetitions = 0;
            }
            card.nextReview = now.toISOString();
            
            if (!this.againCards.includes(card)) {
                this.againCards.push(card);
            }
        } else {
            card.stats.correctCount++;

            if (card.level === 0) {
                if (!this.todayCards.has(card.id) && !this.firstPassCards.includes(card)) {
                    // 新規カード1回目
                    this.firstPassCards.push(card);
                    this.todayCards.add(card.id);
                    this.againCards = this.againCards.filter(c => c !== card);
                } else if (this.todayCards.has(card.id) && !this.againCards.includes(card)) {
                    // 新規カード2回目
                    card.level = 1;
                    card.repetitions = 0;
                    card.nextReview = this.getJstDateAfterDays(1, now);
                    this.firstPassCards = this.firstPassCards.filter(c => c !== card);
                    this.againCards = this.againCards.filter(c => c !== card);
                }
            } else {
                switch (quality) {
                    case 2: // Hard
                        card.ef = Math.max(StudyManager.MIN_EF, card.ef - 0.15);
                        const hardInterval = this.calculateInterval(card, quality);  // 先に計算
                        card.repetitions++;  // 後でインクリメント
                        card.nextReview = this.getJstDateAfterDays(hardInterval, now);
                        break;

                    case 3: // Good
                        const interval = this.calculateInterval(card, quality);  // 先に計算
                        card.repetitions++;  // 後でインクリメント
                        card.nextReview = this.getJstDateAfterDays(interval, now);
                        break;

                    case 4: // Easy
                        card.ef = Math.min(card.ef + 0.15, StudyManager.MAX_EF);
                        const easyInterval = this.calculateInterval(card, quality);  // 先に計算
                        card.repetitions++;  // 後でインクリメント
                        card.nextReview = this.getJstDateAfterDays(easyInterval, now);
                        break;
                }
                
                this.againCards = this.againCards.filter(c => c !== card);
            }
        }

        // 最終学習日時の更新
        card.lastStudied = this.getJstDate();

        // 学習履歴の更新
        if (!card.studyHistory) {
            card.studyHistory = [];
        }

        let historyEntry = card.studyHistory.find(entry => entry.date === studyDate);
        if (historyEntry) {
            // 同じ日の学習の場合、reviewCountを加算
            historyEntry.reviewCount += reviewCount;
        } else {
            // 新しい日の学習の場合、新しいエントリを追加
            card.studyHistory.push({
                date: studyDate,
                reviewCount: reviewCount
            });
        }

        // 学習履歴を日付順にソート
        card.studyHistory.sort((a, b) => a.date.localeCompare(b.date));

        this.updateDeckStats();
        window.storage.saveDeck(this.currentDeck);

        // 統計の更新
        if (window.statsManager) {
            window.statsManager.updateStats();
        }
    }

    calculateInterval(card, quality) {
        if (card.level === 0) return 1;

        const repetitions = card.repetitions || 0;
        const ef = card.ef || StudyManager.INITIAL_EF;

        switch (quality) {
            case 2: // Hard
                if (repetitions === 0) return 1;
                if (repetitions === 1) return 3;

                const hardInterval = this.getPreviousInterval(card);
                return Math.min(Math.floor(hardInterval * (ef - 0.1)), StudyManager.MAX_INTERVAL);  // 切り捨て
                
            case 3: // Good
                if (repetitions === 0) return 2;
                if (repetitions === 1) return 4;

                const goodInterval = this.getPreviousInterval(card);
                return Math.min(Math.ceil(goodInterval * ef), StudyManager.MAX_INTERVAL);  // 切り上げ
                
            case 4: // Easy
                if (repetitions === 0) return 3;
                if (repetitions === 1) return 6;

                const easyInterval = this.getPreviousInterval(card);
                return Math.min(Math.ceil(easyInterval * ef * 1.3), StudyManager.MAX_INTERVAL);  // 切り上げ
        }
        return 1; // デフォルト値
    }

    // 表示用の間隔計算メソッド
    calculateDisplayInterval(card, quality) {
        if (card.level === 0) return 1;

        const repetitions = card.repetitions || 0;
        const ef = card.ef || StudyManager.INITIAL_EF;
        
        switch (quality) {
            case 2: // Hard
                if (repetitions === 0) return 1;
                if (repetitions === 1) return 3;

                const hardInterval = this.getPreviousInterval(card);
                return Math.min(Math.floor(hardInterval * (ef - 0.1)), StudyManager.MAX_INTERVAL);  // 切り捨て
                
            case 3: // Good
                if (repetitions === 0) return 2;
                if (repetitions === 1) return 4;

                const goodInterval = this.getPreviousInterval(card);
                return Math.min(Math.ceil(goodInterval * ef), StudyManager.MAX_INTERVAL);  // 切り上げ
                
            case 4: // Easy
                if (repetitions === 0) return 3;
                if (repetitions === 1) return 6;

                const easyInterval = this.getPreviousInterval(card);
                return Math.min(Math.ceil(easyInterval * ef * 1.3), StudyManager.MAX_INTERVAL);  // 切り上げ
        }
        return 1;
    }

    // 前回の実際の学習間隔を取得
    getPreviousInterval(card) {
        if (!card.studyHistory || card.studyHistory.length < 2) {
            return 1; // デフォルト値
        }
        
        const history = card.studyHistory;
        const lastStudy = dayjs(history[history.length - 1].date);
        const prevStudy = dayjs(history[history.length - 2].date);
        return Math.max(1, lastStudy.diff(prevStudy, 'day'));
    }

    updateDeckStats() {
        this.currentDeck.lastStudied = this.getJstDate();
    }

    getCurrentProgress() {
        return {
            newCardsToday: this.newCardsToday,
            reviewCardsToday: this.reviewCardsToday,
            maxNewCards: this.MAX_NEW_CARDS,
            maxReviewCards: this.MAX_REVIEW_CARDS
        };
    }

    getStudyCountsForDeck(deckId) {
        const deck = window.storage.getDeck(deckId);
        if (!deck) return { newCards: 0, reviewCards: 0 };

        // 日付の初期化（日本時間）
        const now = this.getJstDate();
        
        // デッキの最終学習日をチェック
        if (deck.lastStudied) {
            const lastStudiedJST = dayjs(deck.lastStudied).tz('Asia/Tokyo').startOf('day');
            const todayJST = dayjs().tz('Asia/Tokyo').startOf('day');
            
            // 日付が変わっていれば、カウンターをリセット
            if (!lastStudiedJST.isSame(todayJST, 'day')) {
                this.newCardsToday = 0;
                this.reviewCardsToday = 0;
            }
        }

        // 新規カード数を計算
        const newCards = deck.cards.filter(card =>
            card.level === 0 && !this.todayCards.has(card.id)
        ).length;
        const remainingNewCards = Math.max(0, Math.min(
            newCards,
            this.MAX_NEW_CARDS - this.newCardsToday
        ));

        // 復習カード数を計算
        const reviewCards = deck.cards.filter(card => {
            const nextReview = this.getJstDate(new Date(card.nextReview));
            return card.level > 0 &&
                   nextReview <= now &&
                   !this.todayCards.has(card.id);
        }).length;
        const remainingReviewCards = Math.max(0, Math.min(
            reviewCards,
            this.MAX_REVIEW_CARDS - this.reviewCardsToday
        ));

        return {
            newCards: remainingNewCards,
            reviewCards: remainingReviewCards
        };
    }
}

// グローバルインスタンスを作成（window.studyManagerとして公開）
window.studyManager = new StudyManager();