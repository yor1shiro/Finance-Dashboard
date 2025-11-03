// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadUserData();
    setupEventListeners();
    updateDate();
    setInterval(updateDate, 60000);
});

// Authentication check
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            console.log('Auth check failed:', response.status);
            setTimeout(() => { window.location.href = '/'; }, 500);
            return;
        }
        const user = await response.json();
        document.getElementById('userGreeting').textContent = `Welcome back, ${user.username}!`;
    } catch (err) {
        console.error('Auth error:', err);
        setTimeout(() => { window.location.href = '/'; }, 500);
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

// Load all data
async function loadUserData() {
    await Promise.all([
        loadDashboard(),
        loadTransactions(),
        loadBudgets(),
        loadGoals(),
        loadAnalytics()
    ]);
}

// Tab switching
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
}

// Dashboard
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        document.getElementById('totalIncome').textContent = formatCurrency(data.total_income);
        document.getElementById('totalExpenses').textContent = formatCurrency(data.total_expenses);
        document.getElementById('balance').textContent = formatCurrency(data.balance);
        document.getElementById('savingsRate').textContent = (data.savings_rate || 0) + '%';

        const balanceCard = document.querySelector('.summary-card.balance');
        if (data.balance < 0) {
            balanceCard.style.background = 'linear-gradient(135deg, #f5a5a5 0%, #e88e8e 100%)';
        }

        updateExpenseChart(data.expense_breakdown);
        updateGoalsPreview(data.savings_goals);
        showBudgetAlerts(data.budget_alerts);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function showBudgetAlerts(alerts) {
    const container = document.getElementById('budgetAlerts');
    const alertsContainer = document.getElementById('budgetAlertsContainer');
    
    if (alerts.length === 0) {
        alertsContainer.style.display = 'none';
        return;
    }
    
    alertsContainer.style.display = 'block';
    container.innerHTML = alerts.map(alert => `
        <div class="alert ${alert.status}">
            <strong>${alert.category}</strong>: ${formatCurrency(alert.spent)} / ${formatCurrency(alert.limit)} (${alert.percentage.toFixed(1)}%)
        </div>
    `).join('');
}

function updateExpenseChart(expenseData) {
    const ctx = document.getElementById('expenseChart');
    if (window.expenseChartInstance) window.expenseChartInstance.destroy();

    const labels = Object.keys(expenseData);
    const data = Object.values(expenseData);
    const colors = ['#a8d8ea', '#98ccdb', '#88bfd0', '#78b4c5', '#68a9ba'];

    window.expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function updateGoalsPreview(goals) {
    const container = document.getElementById('goalsPreview');
    if (goals.length === 0) {
        container.innerHTML = '<p class="empty-state">No goals yet.</p>';
        return;
    }

    container.innerHTML = goals.map(goal => `
        <div class="goal-item">
            <div class="transaction-info">
                <div class="transaction-category">${goal.name}</div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${goal.progress}%"></div>
                    </div>
                    <div class="progress-text">${goal.progress}% - ${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Transactions
async function loadTransactions() {
    try {
        const response = await fetch('/api/transactions');
        const transactions = await response.json();
        displayTransactions(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions yet.</p>';
        return;
    }

    container.innerHTML = transactions.map(t => `
        <div class="transaction-item ${t.type}">
            <div class="transaction-info">
                <div class="transaction-category">${t.category}</div>
                <div class="transaction-date">${t.date}</div>
                ${t.description ? `<div style="font-size: 0.9em; color: var(--text-secondary);">${t.description}</div>` : ''}
            </div>
            <div class="transaction-amount">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</div>
            <button class="btn-danger" onclick="deleteTransaction(${t.id})" style="padding: 8px 12px;">Delete</button>
        </div>
    `).join('');
}

async function addTransaction(e) {
    e.preventDefault();

    const transaction = {
        type: document.getElementById('transactionType').value,
        category: document.getElementById('category').value,
        amount: document.getElementById('amount').value,
        description: document.getElementById('description').value,
        date: document.getElementById('date').value,
        is_recurring: document.getElementById('isRecurring').checked,
        recurring_frequency: document.getElementById('recurringFrequency').value || null
    };

    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });

        if (response.ok) {
            document.getElementById('transactionForm').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            loadUserData();
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
    }
}

async function deleteTransaction(id) {
    if (confirm('Delete this transaction?')) {
        try {
            const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadUserData();
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    }
}

// Budgets
async function loadBudgets() {
    try {
        const response = await fetch('/api/budgets');
        const budgets = await response.json();
        displayBudgets(budgets);
    } catch (error) {
        console.error('Error loading budgets:', error);
    }
}

function displayBudgets(budgets) {
    const container = document.getElementById('budgetsList');
    if (budgets.length === 0) {
        container.innerHTML = '<p class="empty-state">No budgets yet.</p>';
        return;
    }

    container.innerHTML = budgets.map(budget => `
        <div class="budget-item">
            <div class="transaction-info">
                <div class="transaction-category">${budget.category}</div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 50%"></div>
                    </div>
                    <div class="progress-text">Budget: ${formatCurrency(budget.limit)}</div>
                </div>
            </div>
            <button class="btn-danger" onclick="deleteBudget(${budget.id})" style="padding: 8px 12px;">Delete</button>
        </div>
    `).join('');
}

async function addBudget(e) {
    e.preventDefault();

    const budget = {
        category: document.getElementById('budgetCategory').value,
        limit: document.getElementById('budgetLimit').value,
        alert_threshold: document.getElementById('alertThreshold').value || 80
    };

    try {
        const response = await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(budget)
        });

        if (response.ok) {
            document.getElementById('budgetForm').reset();
            loadUserData();
        }
    } catch (error) {
        console.error('Error adding budget:', error);
    }
}

async function deleteBudget(id) {
    if (confirm('Delete this budget?')) {
        try {
            const response = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadUserData();
            }
        } catch (error) {
            console.error('Error deleting budget:', error);
        }
    }
}

// Goals
async function loadGoals() {
    try {
        const response = await fetch('/api/goals');
        const goals = await response.json();
        displayGoals(goals);
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

function displayGoals(goals) {
    const container = document.getElementById('goalsList');
    if (goals.length === 0) {
        container.innerHTML = '<p class="empty-state">No goals yet.</p>';
        return;
    }

    let html = '';
    for (const goal of goals) {
        html += `
        <div class="goal-item">
            <div class="transaction-info">
                <div class="transaction-category">${goal.name}</div>
                <div style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 5px;">
                    Priority: <strong>${goal.priority}</strong> ${goal.deadline ? `| Deadline: ${goal.deadline}` : ''}
                </div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${goal.progress}%"></div>
                    </div>
                    <div class="progress-text">${goal.progress}% - ${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</div>
                </div>
            </div>
            <div class="item-actions" style="flex-shrink: 0;">
                <input type="number" id="goalAmount-${goal.id}" placeholder="Amount" step="0.01" style="width: 110px; padding: 8px 10px; font-size: 0.9em; border: 2px solid var(--border-color); border-radius: 8px; background: white; cursor: text;">
                <button type="button" class="btn-secondary" onclick="addGoalAmount(${goal.id})" style="white-space: nowrap; padding: 8px 12px;">Add</button>
                <button type="button" class="btn-danger" onclick="deleteGoal(${goal.id})" style="white-space: nowrap; padding: 8px 12px;">Delete</button>
            </div>
        </div>
        `;
    }
    container.innerHTML = html;
}

async function addGoal(e) {
    e.preventDefault();

    const goal = {
        name: document.getElementById('goalName').value,
        target: document.getElementById('goalTarget').value,
        priority: document.getElementById('goalPriority').value,
        deadline: document.getElementById('goalDeadline').value || null
    };

    try {
        const response = await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(goal)
        });

        if (response.ok) {
            document.getElementById('goalForm').reset();
            loadUserData();
        }
    } catch (error) {
        console.error('Error adding goal:', error);
    }
}

async function addGoalAmount(id) {
    const input = document.getElementById('goalAmount-' + id);
    const amount = parseFloat(input.value);
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    try {
        const response = await fetch(`/api/goals/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_addition: amount })
        });

        if (response.ok) {
            input.value = '';
            loadUserData();
        }
    } catch (error) {
        console.error('Error updating goal:', error);
    }
}

async function deleteGoal(id) {
    if (confirm('Delete this goal?')) {
        try {
            const response = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadUserData();
            }
        } catch (error) {
            console.error('Error deleting goal:', error);
        }
    }
}

// Analytics
async function loadAnalytics() {
    try {
        const [transResponse, budgetResponse, goalsResponse, analyticsResponse] = await Promise.all([
            fetch('/api/transactions'),
            fetch('/api/budgets'),
            fetch('/api/goals'),
            fetch('/api/analytics/monthly')
        ]);

        const transactions = await transResponse.json();
        const budgets = await budgetResponse.json();
        const goals = await goalsResponse.json();
        const monthlyData = await analyticsResponse.json();

        updateTrendChart(monthlyData);
        updateIncomeExpenseChart(monthlyData);
        updateSavingsGrowthChart(monthlyData);
        updateCategoryBarChart(transactions);
        updateBudgetRadarChart(budgets, transactions);
        updateGoalsChart(goals);
        updateIncomeSourcesChart(transactions);
        updateCategoryTrendChart(transactions);
        updateAnalyticsStats(monthlyData, transactions, budgets, goals);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function updateTrendChart(data) {
    const ctx = document.getElementById('trendChart');
    if (window.trendChartInstance) window.trendChartInstance.destroy();

    const labels = data.map(d => d.month);
    const income = data.map(d => d.income);
    const expenses = data.map(d => d.expenses);

    window.trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: income,
                    borderColor: '#a8d8ea',
                    backgroundColor: 'rgba(168, 216, 234, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Expenses',
                    data: expenses,
                    borderColor: '#f5a5a5',
                    backgroundColor: 'rgba(245, 165, 165, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateIncomeExpenseChart(data) {
    const ctx = document.getElementById('incomeExpenseChart');
    if (window.incomeExpenseChartInstance) window.incomeExpenseChartInstance.destroy();

    const totalIncome = data.reduce((sum, d) => sum + (d.income || 0), 0);
    const totalExpenses = data.reduce((sum, d) => sum + (d.expenses || 0), 0);

    window.incomeExpenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
                data: [totalIncome, totalExpenses],
                backgroundColor: ['#a8d8ea', '#f5a5a5'],
                borderColor: '#ffffff',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.parsed) } }
            }
        }
    });
}

function updateSavingsGrowthChart(data) {
    const ctx = document.getElementById('savingsGrowthChart');
    if (window.savingsGrowthChartInstance) window.savingsGrowthChartInstance.destroy();

    const labels = data.map(d => d.month);
    const savings = data.map(d => (d.income || 0) - (d.expenses || 0));
    const cumulativeSavings = [];
    let total = 0;
    for (const s of savings) {
        total += s;
        cumulativeSavings.push(total);
    }

    window.savingsGrowthChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Savings',
                data: savings,
                backgroundColor: savings.map(s => s >= 0 ? '#a8d8ea' : '#f5a5a5'),
                borderRadius: 6
            }, {
                label: 'Cumulative Savings',
                data: cumulativeSavings,
                type: 'line',
                borderColor: '#81d4fa',
                backgroundColor: 'rgba(129, 212, 250, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateCategoryBarChart(transactions) {
    const ctx = document.getElementById('categoryBarChart');
    if (window.categoryBarChartInstance) window.categoryBarChartInstance.destroy();

    const expensesByCategory = {};
    transactions.forEach(t => {
        if (t.type === 'expense') {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        }
    });

    const sorted = Object.entries(expensesByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    window.categoryBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(e => e[0]),
            datasets: [{
                label: 'Spending',
                data: sorted.map(e => e[1]),
                backgroundColor: ['#a8d8ea', '#98ccdb', '#88bfd0', '#78b4c5', '#68a9ba', '#6a9fb0', '#5c8fa6', '#4e7f9c'],
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function updateBudgetRadarChart(budgets, transactions) {
    const ctx = document.getElementById('budgetRadarChart');
    if (window.budgetRadarChartInstance) window.budgetRadarChartInstance.destroy();

    const expensesByCategory = {};
    transactions.forEach(t => {
        if (t.type === 'expense') {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        }
    });

    const labels = budgets.map(b => b.category);
    const limits = budgets.map(b => b.limit);
    const spending = budgets.map(b => expensesByCategory[b.category] || 0);

    window.budgetRadarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Budget Limit',
                data: limits,
                borderColor: '#a8d8ea',
                backgroundColor: 'rgba(168, 216, 234, 0.2)',
                borderWidth: 2
            }, {
                label: 'Current Spending',
                data: spending,
                borderColor: '#f5a5a5',
                backgroundColor: 'rgba(245, 165, 165, 0.2)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function updateGoalsChart(goals) {
    const ctx = document.getElementById('goalsChart');
    if (window.goalsChartInstance) window.goalsChartInstance.destroy();

    if (goals.length === 0) {
        return;
    }

    window.goalsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: goals.map(g => g.name),
            datasets: [{
                label: 'Progress',
                data: goals.map(g => g.progress),
                backgroundColor: goals.map(g => {
                    if (g.progress >= 100) return '#81c784';
                    if (g.progress >= 75) return '#a8d8ea';
                    if (g.progress >= 50) return '#ffd54f';
                    return '#ef5350';
                }),
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { max: 100, beginAtZero: true } }
        }
    });
}

function updateIncomeSourcesChart(transactions) {
    const ctx = document.getElementById('incomeSourcesChart');
    if (window.incomeSourcesChartInstance) window.incomeSourcesChartInstance.destroy();

    const incomeBySource = {};
    transactions.forEach(t => {
        if (t.type === 'income') {
            incomeBySource[t.category] = (incomeBySource[t.category] || 0) + t.amount;
        }
    });

    const data = Object.values(incomeBySource);
    const labels = Object.keys(incomeBySource);

    if (data.length === 0) {
        return;
    }

    const colors = ['#b3e5fc', '#81d4fa', '#a8d8ea', '#98ccdb', '#88bfd0'];

    window.incomeSourcesChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function updateCategoryTrendChart(transactions) {
    const ctx = document.getElementById('categoryTrendChart');
    if (window.categoryTrendChartInstance) window.categoryTrendChartInstance.destroy();

    const categoryByMonth = {};
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const month = t.date.substring(0, 7);
            if (!categoryByMonth[t.category]) categoryByMonth[t.category] = {};
            categoryByMonth[t.category][month] = (categoryByMonth[t.category][month] || 0) + t.amount;
        }
    });

    const months = [...new Set(transactions.map(t => t.date.substring(0, 7)))].sort();
    const categories = Object.keys(categoryByMonth).slice(0, 5);
    const colors = ['#a8d8ea', '#98ccdb', '#88bfd0', '#78b4c5', '#68a9ba'];

    const datasets = categories.map((cat, idx) => ({
        label: cat,
        data: months.map(month => categoryByMonth[cat][month] || 0),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '30',
        tension: 0.3,
        fill: true
    }));

    window.categoryTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateAnalyticsStats(monthlyData, transactions, budgets, goals) {
    const container = document.getElementById('analyticsStats');
    
    const totalIncome = monthlyData.reduce((sum, d) => sum + (d.income || 0), 0);
    const totalExpenses = monthlyData.reduce((sum, d) => sum + (d.expenses || 0), 0);
    const totalSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome * 100).toFixed(1) : 0;
    
    const avgIncome = totalIncome / 12;
    const avgExpenses = totalExpenses / 12;
    
    const goalProgress = goals.length > 0 ? (goals.reduce((sum, g) => sum + g.progress, 0) / goals.length).toFixed(1) : 0;
    const completedGoals = goals.filter(g => g.progress >= 100).length;
    
    const budgetCategories = budgets.length;
    const expenseCategories = [...new Set(transactions.filter(t => t.type === 'expense').map(t => t.category))].length;
    const incomeCategories = [...new Set(transactions.filter(t => t.type === 'income').map(t => t.category))].length;
    
    container.innerHTML = `
        <div class="stat-box">
            <div class="stat-label">Total Income</div>
            <div class="stat-value">${formatCurrency(totalIncome)}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Total Expenses</div>
            <div class="stat-value">${formatCurrency(totalExpenses)}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Total Savings</div>
            <div class="stat-value" style="color: ${totalSavings >= 0 ? '#81c784' : '#ef5350'};">${formatCurrency(totalSavings)}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Savings Rate</div>
            <div class="stat-value">${savingsRate}%</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Average Monthly Income</div>
            <div class="stat-value">${formatCurrency(avgIncome)}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Average Monthly Expenses</div>
            <div class="stat-value">${formatCurrency(avgExpenses)}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Goal Completion</div>
            <div class="stat-value">${goalProgress}% (${completedGoals}/${goals.length})</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Budget Categories</div>
            <div class="stat-value">${budgetCategories}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Expense Categories</div>
            <div class="stat-value">${expenseCategories}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Income Categories</div>
            <div class="stat-value">${incomeCategories}</div>
        </div>
    `;
}

// Event listeners
function setupEventListeners() {
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    document.getElementById('budgetForm').addEventListener('submit', addBudget);
    document.getElementById('goalForm').addEventListener('submit', addGoal);

    const dateInput = document.getElementById('date');
    dateInput.value = new Date().toISOString().split('T')[0];

    document.getElementById('isRecurring').addEventListener('change', function() {
        document.getElementById('recurringFrequency').style.display = this.checked ? 'block' : 'none';
    });
}

// Utilities
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', options);
}
