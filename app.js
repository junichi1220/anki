class App {
    constructor() {
        // 初期化が必要ならここに記述
    }

    initializeEventListeners() {
        document.getElementById("start-learning-btn").addEventListener("click", () => {
            this.navigateTo("deck-select");
        });
        document.getElementById("stats-btn").addEventListener("click", () => {
            this.navigateTo("stats");
        });
        document.getElementById("decks-btn").addEventListener("click", () => {
            this.navigateTo("decks");
        });
        document.getElementById("settings-btn").addEventListener("click", () => {
            this.navigateTo("settings");
        });
    }

    navigateTo(screenId) {
        this.displayScreen(screenId);
    }

    displayScreen(screenId) {
        // 全ての画面を非表示
        document.querySelectorAll('[id$="-screen"]').forEach(el => el.classList.add('hidden'));

        // 指定画面だけを表示
        const screen = document.getElementById(`${screenId}-screen`);
        if (screen) {
            screen.classList.remove('hidden');
        }
    }
}

// アプリの起動処理
document.addEventListener("DOMContentLoaded", () => {
    const app = new App();
    app.initializeEventListeners();
});
