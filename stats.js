class StatsManager {
    constructor() {
        this.weeklyChart = null;
        this.levelChart = null;
        this.totalReviewsChart = null;
        this.upcomingReviewsChart = null;
    }

    initializeCharts() {
        this.createTotalReviewsChart();
        this.createWeeklyChart();
        this.createLevelDistributionChart();
        this.createUpcomingReviewsChart();
        this.updateStats();
    }

    createTotalReviewsChart() {
        const ctx = document.getElementById('total-reviews-chart').getContext('2d');
        this.totalReviewsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '総学習回数',
                    data: [],
                    fill: true,
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 4,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        grid: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: '総学習回数の推移',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        position: 'top',
                        align: 'center'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `総学習回数: ${context.parsed.y}回`;
                            }
                        }
                    }
                }
            }
        });
    }

    createWeeklyChart() {
        const ctx = document.getElementById('weekly-chart').getContext('2d');
        this.weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.getLastSevenDays(),
                datasets: [{
                    label: '学習カード数',
                    data: new Array(7).fill(0),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        grid: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: '週間学習カード数',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y}枚のカードを学習`;
                            }
                        }
                    }
                }
            }
        });
    }

    createLevelDistributionChart() {
        const ctx = document.getElementById('level-chart').getContext('2d');
        this.levelChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['新規', '学習中', '習得済み', '完全習得'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(153, 102, 255, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'マスタリーレベル分布',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value}枚 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    createUpcomingReviewsChart() {
        const ctx = document.getElementById('upcoming-reviews-chart').getContext('2d');
        
        this.upcomingReviewsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '予定カード数',
                    data: [],
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 4,
                plugins: {
                    title: {
                        display: true,
                        text: '今後の学習予定',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y}枚のカード`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        grid: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    updateStats() {
        const decks = window.storage.getAllDecks();
        const weeklyData = new Array(7).fill(0);
        const levelData = [0, 0, 0, 0]; // [新規, 学習中, 習得済み, 完全習得]
        let totalCards = 0;
        let totalCorrect = 0;
        let totalIncorrect = 0;
        let longestStreak = 0;
        let currentStreak = 0;
        const dailyStudyCounts = new Map();
        const allStudyDates = new Set();

        Object.values(decks).forEach(deck => {
            deck.cards.forEach(card => {
                totalCards++;
                totalCorrect += card.stats.correctCount;
                totalIncorrect += card.stats.incorrectCount;

                // studyHistoryを使用して学習回数を集計
                if (card.studyHistory && card.studyHistory.length > 0) {
                    card.studyHistory.forEach(entry => {
                        const studyDate = entry.date;
                        const studyCount = entry.reviewCount;

                        // 日毎の学習回数を集計
                        const dailyCount = dailyStudyCounts.get(studyDate) || 0;
                        dailyStudyCounts.set(studyDate, dailyCount + studyCount);

                        // 週間データの更新
                        const dayIndex = this.getDayIndex(dayjs(studyDate));
                        if (dayIndex >= 0) {
                            weeklyData[dayIndex] += studyCount;
                        }

                        // 学習日を記録（連続学習日数の計算用）
                        allStudyDates.add(studyDate);
                    });
                }

                // レベル別のカード数を集計
                if (card.level === 0) {
                    levelData[0]++;
                } else if (card.level < 3) {
                    levelData[1]++;
                } else if (card.level < 5) {
                    levelData[2]++;
                } else {
                    levelData[3]++;
                }
            });
        });

        // 連続学習日数の計算
        const sortedDates = Array.from(allStudyDates).sort();
        if (sortedDates.length > 0) {
            let streak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const currentDate = dayjs(sortedDates[i]);
                const prevDate = dayjs(sortedDates[i - 1]);
                if (currentDate.diff(prevDate, 'day') === 1) {
                    streak++;
                    longestStreak = Math.max(longestStreak, streak);
                } else {
                    streak = 1;
                }
            }

            // 現在の連続学習日数を計算
            const lastDate = dayjs(sortedDates[sortedDates.length - 1]);
            const today = dayjs().tz('Asia/Tokyo').startOf('day');
            if (today.diff(lastDate, 'day') === 0) {
                currentStreak = streak;
            } else if (today.diff(lastDate, 'day') === 1) {
                currentStreak = streak - 1;
            } else {
                currentStreak = 0;
            }
        }

        // グラフの更新
        this.updateWeeklyChart(weeklyData);
        this.updateLevelChart(levelData);
        this.updateTotalReviewsChart(dailyStudyCounts, allStudyDates);
        this.updateUpcomingReviews();
        this.updateSummary({
            totalCards,
            totalCorrect,
            totalIncorrect,
            totalReviews: totalCorrect + totalIncorrect,
            longestStreak,
            currentStreak,
            weeklyData,
            levelData
        });
    }

    calculateCumulativeData(dailyStudyCounts) {
        const sortedDates = Array.from(dailyStudyCounts.keys()).sort();
        const data = [];
        let accumulator = 0;

        sortedDates.forEach(date => {
            accumulator += dailyStudyCounts.get(date);
            data.push(accumulator);
        });

        return {
            dates: sortedDates,
            counts: data
        };
    }

    updateWeeklyChart(data) {
        if (this.weeklyChart) {
            this.weeklyChart.data.datasets[0].data = data;
            this.weeklyChart.update();
        }
    }

    updateLevelChart(data) {
        if (this.levelChart) {
            this.levelChart.data.datasets[0].data = data;
            this.levelChart.update();
        }
    }

    updateTotalReviewsChart(dailyStudyCounts, allStudyDates) {
        if (this.totalReviewsChart) {
            const today = dayjs().tz('Asia/Tokyo').startOf('day');
            
            // 全期間の累積データを計算
            const cumulativeData = this.calculateCumulativeData(dailyStudyCounts);
            
            // 2週間分のデータをフィルタリング
            const twoWeeksAgo = today.subtract(14, 'day');
            const filteredIndexes = cumulativeData.dates
                .map((date, index) => ({ date, index }))
                .filter(item => dayjs(item.date).isAfter(twoWeeksAgo))
                .map(item => item.index);

            const labels = filteredIndexes.map(i => 
                dayjs(cumulativeData.dates[i]).format('M/D'));
            const data = filteredIndexes.map(i => 
                cumulativeData.counts[i]);

            this.totalReviewsChart.data.labels = labels;
            this.totalReviewsChart.data.datasets[0].data = data;

            // Y軸のスケールを調整
            const maxValue = Math.max(...data);
            const max = Math.ceil(maxValue * 1.1);
            const stepSize = Math.ceil(max / 10);

            this.totalReviewsChart.options.scales.y.max = max;
            this.totalReviewsChart.options.scales.y.ticks.stepSize = stepSize;

            this.totalReviewsChart.update();
        }
    }

    updateUpcomingReviews() {
        const decks = window.storage.getAllDecks();
        const today = dayjs().tz('Asia/Tokyo').startOf('day');
        const reviewDates = new Map(); // 日付ごとのカード数を保持

        // 今後14日分の予定を表示
        const daysToShow = 14;
        
        // 全デッキから次回復習日のデータを収集
        Object.values(decks).forEach(deck => {
            deck.cards.forEach(card => {
                if (card.nextReview) {
                    const reviewDate = dayjs(card.nextReview).tz('Asia/Tokyo').startOf('day');
                    // 今日以降のカードのみ対象
                    if (reviewDate.isSameOrAfter(today)) {
                        const dateKey = reviewDate.format('YYYY-MM-DD');
                        reviewDates.set(dateKey, (reviewDates.get(dateKey) || 0) + 1);
                    }
                }
            });
        });

        // 日付とカード数の配列を作成
        const labels = [];
        const data = [];
        
        for (let i = 0; i < daysToShow; i++) {
            const date = today.add(i, 'day');
            const dateKey = date.format('YYYY-MM-DD');
            const formattedDate = date.format('M/D');
            
            labels.push(formattedDate);
            data.push(reviewDates.get(dateKey) || 0);
        }

        // グラフを更新
        this.upcomingReviewsChart.data.labels = labels;
        this.upcomingReviewsChart.data.datasets[0].data = data;
        this.upcomingReviewsChart.update();
    }

    updateSummary(stats) {
        const accuracy = stats.totalReviews > 0
            ? Math.round((stats.totalCorrect / stats.totalReviews) * 100) 
            : 0;
        const averagePerDay = Math.round(stats.weeklyData.reduce((a, b) => a + b, 0) / 7);
        const masteryRate = stats.totalCards > 0 
            ? Math.round(((stats.levelData[2] + stats.levelData[3]) / stats.totalCards) * 100)
            : 0;

        document.getElementById('stats-summary').innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-white p-4 rounded-lg shadow transform hover:scale-105 transition-transform">
                    <h3 class="text-lg font-semibold text-gray-700">総カード数</h3>
                    <p class="text-2xl font-bold text-indigo-600">${stats.totalCards}枚</p>
                    <p class="text-sm text-gray-500">全デッキの合計</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow transform hover:scale-105 transition-transform">
                    <h3 class="text-lg font-semibold text-gray-700">1日平均</h3>
                    <p class="text-2xl font-bold text-blue-600">${averagePerDay}枚</p>
                    <p class="text-sm text-gray-500">過去7日間</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow transform hover:scale-105 transition-transform">
                    <h3 class="text-lg font-semibold text-gray-700">習得率</h3>
                    <p class="text-2xl font-bold text-purple-600">${masteryRate}%</p>
                    <p class="text-sm text-gray-500">習得済み以上の割合</p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white p-4 rounded-lg shadow transform hover:scale-105 transition-transform">
                    <h3 class="text-lg font-semibold text-gray-700">総学習回数</h3>
                    <p class="text-2xl font-bold text-indigo-600">${stats.totalReviews}回</p>
                    <p class="text-sm text-gray-500">正解: ${stats.totalCorrect}回 / 不正解: ${stats.totalIncorrect}回</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow transform hover:scale-105 transition-transform">
                    <h3 class="text-lg font-semibold text-gray-700">最長連続学習</h3>
                    <p class="text-2xl font-bold text-green-600">${stats.longestStreak}日</p>
                    <p class="text-sm text-gray-500">過去最高記録</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow transform hover:scale-105 transition-transform">
                    <h3 class="text-lg font-semibold text-gray-700">現在の連続学習</h3>
                    <p class="text-2xl font-bold text-blue-600">${stats.currentStreak}日</p>
                    <p class="text-sm text-gray-500">継続中のストリーク</p>
                </div>
            </div>
        `;
    }

    getLastSevenDays() {
        const days = [];
        const now = dayjs().tz('Asia/Tokyo');
        const weekdaysShort = ['日', '月', '火', '水', '木', '金', '土'];
        
        for (let i = 6; i >= 0; i--) {
            try {
                const date = now.subtract(i, 'day');
                const weekdayIndex = date.day();
                days.push(weekdaysShort[weekdayIndex] || '');
            } catch (error) {
                console.error('Error formatting date:', error);
                days.push('');
            }
        }
        return days;
    }

    getDayIndex(date) {
        const today = dayjs().tz('Asia/Tokyo').startOf('day');
        const targetDate = dayjs(date).tz('Asia/Tokyo').startOf('day');
        const diffDays = today.diff(targetDate, 'day');
        return diffDays <= 6 ? 6 - diffDays : -1;
    }
}

// グローバルインスタンスを作成（window.statsManagerとして公開）
window.statsManager = new StatsManager();
window.statsManager.initializeCharts();