class Storage {
    static BACKUP_INTERVAL = 30 * 60 * 1000; // 30分
    static MAX_BACKUPS = 10;
    static MAX_STORAGE_SIZE = 4.5 * 1024 * 1024; // 4.5MB

    constructor() {
        this.initializeStorage();
        this.startBackupInterval();
    }

    initializeStorage() {
        if (!localStorage.getItem('decks')) {
            localStorage.setItem('decks', JSON.stringify({}));
        }
        if (!localStorage.getItem('backups')) {
            localStorage.setItem('backups', JSON.stringify([]));
        }
    }

    startBackupInterval() {
        setInterval(() => this.createBackup(), Storage.BACKUP_INTERVAL);
    }

    createBackup() {
        const currentData = localStorage.getItem('decks');
        const checksum = this.calculateChecksum(currentData);
        const backup = {
            timestamp: dayjs().tz('Asia/Tokyo').format(),
            data: currentData,
            checksum: checksum
        };

        let backups = JSON.parse(localStorage.getItem('backups') || '[]');
        backups.unshift(backup);
        backups = backups.slice(0, Storage.MAX_BACKUPS);
        
        localStorage.setItem('backups', JSON.stringify(backups));
        this.checkStorageSize();
    }

    calculateChecksum(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    checkStorageSize() {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            totalSize += localStorage.getItem(key).length * 2; // UTF-16
        }

        if (totalSize > Storage.MAX_STORAGE_SIZE) {
            this.handleStorageOverflow();
        }
    }

    handleStorageOverflow() {
        const backups = JSON.parse(localStorage.getItem('backups') || '[]');
        if (backups.length > 1) {
            backups.pop(); // 最も古いバックアップを削除
            localStorage.setItem('backups', JSON.stringify(backups));
        }
    }

    getDeck(deckId) {
        const decks = JSON.parse(localStorage.getItem('decks'));
        return decks[deckId];
    }

    getAllDecks() {
        return JSON.parse(localStorage.getItem('decks') || '{}');
    }

    saveDeck(deck) {
        const decks = this.getAllDecks();
        decks[deck.id] = deck;
        localStorage.setItem('decks', JSON.stringify(decks));
        this.createBackup();
    }

    deleteDeck(deckId) {
        const decks = this.getAllDecks();
        delete decks[deckId];
        localStorage.setItem('decks', JSON.stringify(decks));
        this.createBackup();
    }

    restoreFromBackup(timestamp) {
        const backups = JSON.parse(localStorage.getItem('backups') || '[]');
        const backup = backups.find(b => b.timestamp === timestamp);
        
        if (backup) {
            const currentChecksum = this.calculateChecksum(backup.data);
            if (currentChecksum === backup.checksum) {
                localStorage.setItem('decks', backup.data);
                return true;
            }
        }
        return false;
    }

    importFromCsv(csvData) {
        return new Promise((resolve, reject) => {
            if (!csvData) {
                reject(new Error('CSVデータが空です'));
                return;
            }

            Papa.parse(csvData, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        if (results.errors.length > 0) {
                            reject(new Error('CSVの解析エラー: ' + results.errors[0].message));
                            return;
                        }

                        if (results.data.length === 0) {
                            reject(new Error('CSVにデータが含まれていません'));
                            return;
                        }

                        if (results.data.length > 10000) {
                            reject(new Error('CSVファイルが大きすぎます（最大10,000行）'));
                            return;
                        }

                        // 必須フィールドの検証
                        const requiredFields = ['question', 'answer'];
                        const missingFields = requiredFields.filter(field =>
                            !results.meta.fields.includes(field)
                        );

                        if (missingFields.length > 0) {
                            reject(new Error(`必須フィールドがありません: ${missingFields.join(', ')}`));
                            return;
                        }

                        // デッキ名の取得
                        let deckName = '新規デッキ';
                        if (results.meta.fields.includes('deck_name') && results.data[0].deck_name) {
                            deckName = results.data[0].deck_name;
                        }

                        // 現在の日付を取得（日本時間）
                        const now = dayjs().tz('Asia/Tokyo').startOf('day');

                        // 新しいデッキを作成
                        const newDeck = {
                            id: 'deck_' + Date.now(),
                            name: deckName,
                            cards: results.data.map(row => {
                                // 学習履歴の処理
                                let studyHistory = [];
                                if (row.study_history) {
                                    try {
                                        studyHistory = JSON.parse(row.study_history);
                                    } catch (e) {
                                        console.warn('学習履歴の解析に失敗:', e);
                                    }
                                }

                                // 日付の処理
                                const level = parseInt(row.level) || 0;
                                const nextReview = level === 0 ? null : 
                                    (row.next_review ? 
                                        dayjs(row.next_review).tz('Asia/Tokyo').toISOString() : 
                                        now.toISOString());
                                const lastStudied = row.last_studied ? 
                                    dayjs(row.last_studied).tz('Asia/Tokyo').toISOString() : 
                                    null;

                                return {
                                    id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                                    question: row.question,
                                    answer: row.answer,
                                    level: level,
                                    nextReview: nextReview,
                                    lastStudied: lastStudied,
                                    ef: parseFloat(row.ef) || StudyManager.INITIAL_EF,
                                    repetitions: parseInt(row.repetitions) || 0,
                                    studyHistory: studyHistory,
                                    stats: {
                                        correctCount: parseInt(row.correct_count) || 0,
                                        incorrectCount: parseInt(row.incorrect_count) || 0
                                    }
                                };
                            }),
                            created: now.toISOString(),
                            lastStudied: null
                        };

                        // デッキを保存
                        const decks = this.getAllDecks();
                        decks[newDeck.id] = newDeck;
                        localStorage.setItem('decks', JSON.stringify(decks));
                        this.createBackup();

                        resolve(newDeck);
                    } catch (error) {
                        reject(new Error('インポート処理エラー: ' + error.message));
                    }
                },
                error: (error) => {
                    reject(new Error('CSVパースエラー: ' + error.message));
                }
            });
        });
    }

    exportToCsv(deckId) {
        const deck = this.getDeck(deckId);
        if (!deck) return null;

        const csvData = deck.cards.map(card => ({
            deck_name: deck.name,
            question: card.question,
            answer: card.answer,
            level: card.level || 0,
            next_review: card.nextReview ? dayjs(card.nextReview).tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss') : '',
            last_studied: card.lastStudied ? dayjs(card.lastStudied).tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss') : '',
            correct_count: card.stats?.correctCount || 0,
            incorrect_count: card.stats?.incorrectCount || 0,
            ef: card.ef || StudyManager.INITIAL_EF,
            repetitions: card.repetitions || 0,
            study_history: JSON.stringify(card.studyHistory || [])
        }));

        const csvString = Papa.unparse(csvData, {
            quotes: true,
            delimiter: ",",
            header: true,
            encoding: "utf-8"
        });

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8' });
        return blob;
    }

    convertToJst(utcDate) {
        if (!utcDate) {
            return dayjs().tz('Asia/Tokyo').startOf('day').toISOString();
        }
        return dayjs(utcDate)
            .tz('Asia/Tokyo')
            .startOf('day')
            .toISOString();
    }
}

// グローバルインスタンスを作成（window.storageとして公開）
window.storage = new Storage();