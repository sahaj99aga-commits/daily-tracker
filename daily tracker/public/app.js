/**
 * Daily Tracker - Main Application Logic
 * Handles all UI interactions, API calls, animations, and state management.
 * Features: Water tracking, Core Habits, Learning Log, Custom Tasks, History View.
 */

// ============ API LAYER ============
const API = {
    async getToday() {
        const res = await fetch('/api/today');
        return res.json();
    },
    async getHistory() {
        const res = await fetch('/api/history');
        return res.json();
    },
    async getDay(dateKey) {
        const res = await fetch(`/api/day/${dateKey}`);
        return res.json();
    },
    async updateWater(water) {
        const res = await fetch('/api/water', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ water }),
        });
        return res.json();
    },
    async toggleHabit(id) {
        const res = await fetch('/api/habit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        return res.json();
    },
    async addTask(label) {
        const res = await fetch('/api/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label }),
        });
        return res.json();
    },
    async toggleTask(id) {
        const res = await fetch('/api/task/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        return res.json();
    },
    async deleteTask(id) {
        const res = await fetch('/api/task/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        return res.json();
    },
    async saveLearning(text) {
        const res = await fetch('/api/learning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        return res.json();
    },
};

// ============ STATE ============
let state = {
    water: 0,
    coreHabits: [],
    customTasks: [],
    learning: '',
};

let previousProgress = 0;
let confettiTriggered = false;
let currentHistoryOffset = 1; // 1 = yesterday, 2 = day before, etc.
let currentTab = 'today';

// ============ DOM REFS ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
    // Date
    currentDate: $('#current-date'),
    // Tabs
    tabNav: $('#tab-nav'),
    tabToday: $('#tab-today'),
    tabHistory: $('#tab-history'),
    todayView: $('#today-view'),
    historyView: $('#history-view'),
    // Progress
    progressRingFill: $('#progress-ring-fill'),
    progressPercentage: $('#progress-percentage'),
    tasksDone: $('#tasks-done'),
    tasksTotal: $('#tasks-total'),
    tasksRemaining: $('#tasks-remaining'),
    // Water
    waterCount: $('#water-count'),
    waterFill: $('#water-fill'),
    waterDrops: $$('.water-drop'),
    // Habits
    habitsList: $('#habits-list'),
    habitsCount: $('#habits-count'),
    // Learning
    learningInput: $('#learning-input'),
    learningSaveBtn: $('#learning-save-btn'),
    learningStatus: $('#learning-status'),
    learningCharCount: $('#learning-char-count'),
    // Tasks
    tasksList: $('#tasks-list'),
    customTasksCount: $('#custom-tasks-count'),
    addTaskForm: $('#add-task-form'),
    taskInput: $('#task-input'),
    emptyTasks: $('#empty-tasks'),
    // Completion
    completionOverlay: $('#completion-overlay'),
    completionClose: $('#completion-close'),
    // Confetti
    confettiCanvas: $('#confetti-canvas'),
    // Streak
    streakCount: $('#streak-count'),
    // History
    historyContent: $('#history-content'),
    historyEmpty: $('#history-empty'),
    historyDateLabel: $('#history-date-label'),
    historyDateFull: $('#history-date-full'),
    historyPrev: $('#history-prev'),
    historyNext: $('#history-next'),
};

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    loadData();
    setupEventListeners();
});

function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    els.currentDate.textContent = now.toLocaleDateString('en-US', options);
}

async function loadData() {
    try {
        const data = await API.getToday();
        state = data;
        confettiTriggered = false;
        renderAll();
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

function setupEventListeners() {
    // Tab switching
    els.tabToday.addEventListener('click', () => switchTab('today'));
    els.tabHistory.addEventListener('click', () => switchTab('history'));

    // Water drops
    els.waterDrops.forEach((drop) => {
        drop.addEventListener('click', () => {
            const index = parseInt(drop.dataset.index, 10);
            handleWaterClick(index);
        });
    });

    // Add task form
    els.addTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const label = els.taskInput.value.trim();
        if (!label) return;
        els.taskInput.value = '';
        try {
            const data = await API.addTask(label);
            state = data;
            renderAll();
            const items = els.tasksList.querySelectorAll('.task-item');
            if (items.length > 0) {
                const last = items[items.length - 1];
                last.style.animation = 'fadeInUp 0.4s ease-out';
            }
        } catch (e) {
            console.error('Failed to add task:', e);
        }
    });

    // Learning log
    els.learningInput.addEventListener('input', () => {
        const len = els.learningInput.value.length;
        els.learningCharCount.textContent = `${len} / 500`;
    });

    els.learningSaveBtn.addEventListener('click', saveLearning);

    // Auto-save learning on blur
    els.learningInput.addEventListener('blur', () => {
        if (els.learningInput.value.trim() !== (state.learning || '')) {
            saveLearning();
        }
    });

    // Completion modal close
    els.completionClose.addEventListener('click', () => {
        els.completionOverlay.classList.remove('active');
    });

    els.completionOverlay.addEventListener('click', (e) => {
        if (e.target === els.completionOverlay) {
            els.completionOverlay.classList.remove('active');
        }
    });

    // History navigation
    els.historyPrev.addEventListener('click', () => {
        currentHistoryOffset++;
        loadHistoryDay();
    });

    els.historyNext.addEventListener('click', () => {
        if (currentHistoryOffset > 1) {
            currentHistoryOffset--;
            loadHistoryDay();
        }
    });
}

// ============ TAB SWITCHING ============
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    els.tabToday.classList.toggle('active', tab === 'today');
    els.tabHistory.classList.toggle('active', tab === 'history');

    // Show/hide views
    if (tab === 'today') {
        els.todayView.classList.remove('hidden');
        els.historyView.classList.add('hidden');
    } else {
        els.todayView.classList.add('hidden');
        els.historyView.classList.remove('hidden');
        currentHistoryOffset = 1;
        loadHistoryDay();
    }
}

// ============ LEARNING LOG ============
async function saveLearning() {
    const text = els.learningInput.value.trim();
    try {
        els.learningSaveBtn.classList.add('saving');
        const data = await API.saveLearning(text);
        state = data;
        
        // Show saved status
        els.learningStatus.textContent = '✓ Saved';
        els.learningStatus.classList.add('show');
        setTimeout(() => {
            els.learningStatus.classList.remove('show');
        }, 2000);
        
        els.learningSaveBtn.classList.remove('saving');
        renderAll();
    } catch (e) {
        console.error('Failed to save learning:', e);
        els.learningSaveBtn.classList.remove('saving');
    }
}

// ============ HISTORY ============
function getDateFromOffset(offset) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d;
}

function formatDateKey(date) {
    return date.toISOString().split('T')[0];
}

function getRelativeLabel(offset) {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Yesterday';
    if (offset === 2) return '2 Days Ago';
    if (offset === 3) return '3 Days Ago';
    return `${offset} Days Ago`;
}

async function loadHistoryDay() {
    const date = getDateFromOffset(currentHistoryOffset);
    const dateKey = formatDateKey(date);
    
    // Update navigation labels
    els.historyDateLabel.textContent = getRelativeLabel(currentHistoryOffset);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    els.historyDateFull.textContent = date.toLocaleDateString('en-US', options);

    // Disable next button if at yesterday
    els.historyNext.classList.toggle('disabled', currentHistoryOffset <= 1);

    try {
        const dayData = await API.getDay(dateKey);
        renderHistoryDay(dayData);
    } catch (e) {
        console.error('Failed to load history:', e);
        els.historyContent.innerHTML = '';
        els.historyEmpty.classList.remove('hidden');
    }
}

function renderHistoryDay(data) {
    const habits = data.coreHabits || [];
    const tasks = data.customTasks || [];
    const water = data.water || 0;
    const learning = data.learning || '';

    const hasData = habits.some(h => h.done) || tasks.some(t => t.done) || water > 0 || learning;

    if (!hasData) {
        els.historyContent.innerHTML = '';
        els.historyEmpty.classList.remove('hidden');
        return;
    }

    els.historyEmpty.classList.add('hidden');

    // Calculate progress
    const totalItems = habits.length + tasks.length + 1;
    const doneHabits = habits.filter(h => h.done).length;
    const doneTasks = tasks.filter(t => t.done).length;
    const waterDone = water >= 5 ? 1 : water / 5;
    const totalDone = doneHabits + doneTasks + waterDone;
    const percentage = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

    let html = '';

    // Overview card
    html += `
        <div class="glass-card history-overview-card">
            <div class="history-overview-header">
                <div class="history-progress-circle ${percentage === 100 ? 'complete' : ''}">
                    <span class="history-progress-number">${percentage}%</span>
                </div>
                <div class="history-overview-stats">
                    <div class="history-stat">
                        <span class="history-stat-value">${doneHabits}/${habits.length}</span>
                        <span class="history-stat-label">Habits</span>
                    </div>
                    <div class="history-stat">
                        <span class="history-stat-value">${doneTasks}/${tasks.length}</span>
                        <span class="history-stat-label">Tasks</span>
                    </div>
                    <div class="history-stat">
                        <span class="history-stat-value">${water}/5</span>
                        <span class="history-stat-label">Water</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Habits breakdown
    html += `
        <div class="glass-card history-detail-card">
            <h3 class="history-card-title">
                <span class="section-icon">⚡</span> Core Habits
            </h3>
            <ul class="history-items-list">
                ${habits.map(h => `
                    <li class="history-item ${h.done ? 'done' : 'missed'}">
                        <span class="history-item-icon">${h.done ? '✅' : '❌'}</span>
                        <span class="history-item-label">${h.label}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    // Water
    html += `
        <div class="glass-card history-detail-card">
            <h3 class="history-card-title">
                <span class="section-icon">💧</span> Water Intake
            </h3>
            <div class="history-water-display">
                ${Array.from({length: 5}, (_, i) => `
                    <span class="history-water-drop ${i < water ? 'filled' : ''}">💧</span>
                `).join('')}
                <span class="history-water-text">${water} / 5 L</span>
            </div>
        </div>
    `;

    // Learning log
    if (learning) {
        html += `
            <div class="glass-card history-detail-card history-learning-card">
                <h3 class="history-card-title">
                    <span class="section-icon">🧠</span> What Was Learned
                </h3>
                <div class="history-learning-text">
                    <p>"${escapeHtml(learning)}"</p>
                </div>
            </div>
        `;
    }

    // Custom tasks
    if (tasks.length > 0) {
        html += `
            <div class="glass-card history-detail-card">
                <h3 class="history-card-title">
                    <span class="section-icon">📝</span> Custom Tasks
                </h3>
                <ul class="history-items-list">
                    ${tasks.map(t => `
                        <li class="history-item ${t.done ? 'done' : 'missed'}">
                            <span class="history-item-icon">${t.done ? '✅' : '❌'}</span>
                            <span class="history-item-label">${escapeHtml(t.label)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    els.historyContent.innerHTML = html;
    
    // Animate cards in
    const cards = els.historyContent.querySelectorAll('.glass-card');
    cards.forEach((card, i) => {
        card.style.animation = `fadeInUp 0.4s ease-out ${i * 0.1}s both`;
    });
}

// ============ WATER HANDLING ============
async function handleWaterClick(index) {
    let newWater;
    if (index === state.water) {
        newWater = index - 1;
    } else {
        newWater = index;
    }

    const drop = document.querySelector(`.water-drop[data-index="${index}"]`);
    if (newWater >= index) {
        drop.classList.add('filling');
        setTimeout(() => drop.classList.remove('filling'), 600);
    } else {
        drop.classList.add('draining');
        setTimeout(() => drop.classList.remove('draining'), 400);
    }

    try {
        const data = await API.updateWater(newWater);
        state = data;
        renderAll();
    } catch (e) {
        console.error('Failed to update water:', e);
    }
}

// ============ RENDERING ============
function renderAll() {
    renderWater();
    renderHabits();
    renderTasks();
    renderLearning();
    renderProgress();
}

function renderWater() {
    const water = state.water || 0;
    els.waterCount.textContent = `${water} / 5 L`;
    els.waterFill.style.width = `${(water / 5) * 100}%`;

    els.waterDrops.forEach((drop) => {
        const i = parseInt(drop.dataset.index, 10);
        if (i <= water) {
            drop.classList.add('filled');
        } else {
            drop.classList.remove('filled');
        }
    });
}

function renderHabits() {
    const habits = state.coreHabits || [];
    const doneCount = habits.filter((h) => h.done).length;
    els.habitsCount.textContent = `${doneCount} / ${habits.length}`;

    els.habitsList.innerHTML = habits
        .map(
            (habit) => `
        <li class="habit-item ${habit.done ? 'done' : ''}" data-id="${habit.id}" id="habit-${habit.id}">
            <div class="check-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <span class="habit-label">${habit.label}</span>
            ${habit.id === 'learn' ? '<span class="habit-badge learning-badge">📖</span>' : ''}
        </li>
    `
        )
        .join('');

    // Add click handlers
    els.habitsList.querySelectorAll('.habit-item').forEach((item) => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            const wasDone = item.classList.contains('done');

            item.classList.add('completing');
            setTimeout(() => item.classList.remove('completing'), 600);

            if (!wasDone) {
                createSparkles(item);
            }

            try {
                const data = await API.toggleHabit(id);
                state = data;
                renderAll();
            } catch (e) {
                console.error('Failed to toggle habit:', e);
            }
        });
    });
}

function renderTasks() {
    const tasks = state.customTasks || [];

    if (tasks.length === 0) {
        els.emptyTasks.classList.remove('hidden');
        els.tasksList.innerHTML = '';
    } else {
        els.emptyTasks.classList.add('hidden');
        els.tasksList.innerHTML = tasks
            .map(
                (task) => `
            <li class="task-item ${task.done ? 'done' : ''}" data-id="${task.id}" id="task-${task.id}">
                <div class="check-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <span class="task-label">${escapeHtml(task.label)}</span>
                <button class="task-delete" data-id="${task.id}" aria-label="Delete task">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </li>
        `
            )
            .join('');

        // Toggle handlers
        els.tasksList.querySelectorAll('.task-item').forEach((item) => {
            item.addEventListener('click', async (e) => {
                if (e.target.closest('.task-delete')) return;

                const id = item.dataset.id;
                const wasDone = item.classList.contains('done');

                item.classList.add('completing');
                setTimeout(() => item.classList.remove('completing'), 600);

                if (!wasDone) {
                    createSparkles(item);
                }

                try {
                    const data = await API.toggleTask(id);
                    state = data;
                    renderAll();
                } catch (e2) {
                    console.error('Failed to toggle task:', e2);
                }
            });
        });

        // Delete handlers
        els.tasksList.querySelectorAll('.task-delete').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const item = btn.closest('.task-item');
                item.style.transform = 'translateX(100%)';
                item.style.opacity = '0';
                item.style.transition = 'all 0.3s ease';

                setTimeout(async () => {
                    try {
                        const data = await API.deleteTask(id);
                        state = data;
                        renderAll();
                    } catch (e2) {
                        console.error('Failed to delete task:', e2);
                    }
                }, 300);
            });
        });
    }

    els.customTasksCount.textContent = tasks.length > 0 ? `${tasks.filter((t) => t.done).length} / ${tasks.length}` : '0';
}

function renderLearning() {
    const learning = state.learning || '';
    // Only update if user isn't actively typing
    if (document.activeElement !== els.learningInput) {
        els.learningInput.value = learning;
        els.learningCharCount.textContent = `${learning.length} / 500`;
    }
}

function renderProgress() {
    const habits = state.coreHabits || [];
    const tasks = state.customTasks || [];
    const water = state.water || 0;

    const totalItems = habits.length + tasks.length + 1;
    const doneHabits = habits.filter((h) => h.done).length;
    const doneTasks = tasks.filter((t) => t.done).length;
    const waterDone = water >= 5 ? 1 : water / 5;

    const totalDone = doneHabits + doneTasks + waterDone;
    const percentage = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

    const circumference = 2 * Math.PI * 85;
    const offset = circumference - (percentage / 100) * circumference;
    els.progressRingFill.style.strokeDashoffset = offset;

    animateNumber(els.progressPercentage, previousProgress, percentage, 600);
    previousProgress = percentage;

    const allDone = doneHabits + doneTasks;
    const allTotal = habits.length + tasks.length;
    els.tasksDone.textContent = allDone;
    els.tasksTotal.textContent = allTotal;
    els.tasksRemaining.textContent = allTotal - allDone;

    els.progressPercentage.classList.add('bump');
    setTimeout(() => els.progressPercentage.classList.remove('bump'), 400);

    if (percentage === 100 && !confettiTriggered) {
        confettiTriggered = true;
        setTimeout(() => {
            triggerConfetti();
            els.completionOverlay.classList.add('active');
        }, 800);
    }
}

// ============ ANIMATIONS ============

function animateNumber(element, from, to, duration) {
    const start = performance.now();
    const update = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(from + (to - from) * eased);
        element.textContent = current;
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    };
    requestAnimationFrame(update);
}

function createSparkles(element) {
    const rect = element.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = 'sparkle-burst';
    burst.style.left = rect.left + 20 + 'px';
    burst.style.top = rect.top + rect.height / 2 + 'px';
    document.body.appendChild(burst);

    const colors = ['#6366f1', '#a855f7', '#ec4899', '#22c55e', '#fbbf24', '#60a5fa'];
    for (let i = 0; i < 10; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        const angle = (i / 10) * Math.PI * 2;
        const dist = 20 + Math.random() * 30;
        sparkle.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
        sparkle.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
        sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
        burst.appendChild(sparkle);
    }

    setTimeout(() => burst.remove(), 800);
}

// ============ CONFETTI ============
function triggerConfetti() {
    const canvas = els.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = [
        '#6366f1', '#a855f7', '#ec4899', '#22c55e',
        '#fbbf24', '#60a5fa', '#f472b6', '#818cf8',
        '#34d399', '#fb923c', '#f87171', '#c084fc',
    ];

    for (let i = 0; i < 200; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: -10 - Math.random() * canvas.height,
            w: 6 + Math.random() * 8,
            h: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 4,
            vy: 2 + Math.random() * 4,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
        });
    }

    let startTime = performance.now();
    const duration = 4000;

    function animate(now) {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        pieces.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.rotation += p.rotationSpeed;

            if (elapsed > duration * 0.6) {
                p.opacity = Math.max(0, 1 - (elapsed - duration * 0.6) / (duration * 0.4));
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });

        if (elapsed < duration) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    requestAnimationFrame(animate);
}

// ============ HELPERS ============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('resize', () => {
    els.confettiCanvas.width = window.innerWidth;
    els.confettiCanvas.height = window.innerHeight;
});
