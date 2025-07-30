function displayScreen(screenId) {
    // すべての画面を非表示
    const screens = [
        "home-screen",
        "deck-select-screen",
        "study-screen",
        "stats-screen",
        "decks-screen",
        "settings-screen",
        "card-list-screen",
        "card-edit-screen"
    ];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add("hidden");
        }
    });

    // 指定した画面を表示
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove("hidden");
        target.classList.add("slide-in");
    }
}

function initializeEventListeners() {
    document.getElementById("start-learning-btn")?.addEventListener("click", () => {
        displayScreen("deck-select-screen");
    });

    document.getElementById("stats-btn")?.addEventListener("click", () => {
        displayScreen("stats-screen");
        renderCharts(); // stats.jsで定義されている前提
    });

    document.getElementById("decks-btn")?.addEventListener("click", () => {
        displayScreen("decks-screen");
    });

    document.getElementById("settings-btn")?.addEventListener("click", () => {
        displayScreen("settings-screen");
    });
}

// DOMが読み込まれたらイベントリスナーを初期化
document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
    displayScreen("home-screen");
});
