class App {
  constructor() {
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document.getElementById('start-learning-btn')?.addEventListener('click', () => {
      this.navigateTo('study-screen');
    });

    document.getElementById('stats-btn')?.addEventListener('click', () => {
      this.navigateTo('stats-screen');
    });

    document.getElementById('decks-btn')?.addEventListener('click', () => {
      this.navigateTo('decks-screen');
    });

    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.navigateTo('settings-screen');
    });
  }

  navigateTo(screenId) {
    const screens = document.querySelectorAll('#app > div');
    screens.forEach(screen => {
      if (screen.id === screenId) {
        screen.classList.remove('hidden');
      } else {
        screen.classList.add('hidden');
      }
    });
  }
}

// ページ読み込み後に初期化
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
