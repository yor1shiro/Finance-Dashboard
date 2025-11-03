// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadDashboard();
    loadTransactions();
    loadBudgets();
    loadGoals();
    setupEventListeners();
});

// Tab Navigation
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            // Remove active class from all
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    document.getElementById('budgetForm').addEventListener('submit', addBudget);
    document.getElementById('goalForm').addEventListener('submit', addGoal);

    // Set today's date as default
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

// Dashboard
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        document.getElementById('totalIncome').textContent = formatCurrency(data.total_income);
        document.getElementById('totalExpenses').textContent = formatCurrency(data.total_expenses);
        document.getElementById('balance').textContent = formatCurrency(data.balance);

        // Update balance color
        const balanceCard = document.querySelector('.summary-card.balance');
        if (data.balance < 0) {
            balanceCard.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }

        // Update expense chart
        updateExpenseChart(data.expense_breakdown);

        // Update goals preview
        updateGoalsPreview(data.savings_goals);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateExpenseChart(expenseData) {
    const ctx = document.getElementById('expenseChart');
    
    // Destroy existing chart if it exists
    if (window.expenseChartInstance) {
        window.expenseChartInstance.destroy();
    }

    const labels = Object.keys(expenseData);
    const data = Object.values(expenseData);
    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
        '#f97316', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9'
    ];

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
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

function updateGoalsPreview(goals) {
    const container = document.getElementById('goalsPreview');
    
    if (goals.length === 0) {
        container.innerHTML = '<p class="empty-state">No goals yet. Create one in the Goals tab!</p>';
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
        container.innerHTML = '<p class="empty-state">No transactions yet. Add one to get started!</p>';
        return;
    }

    container.innerHTML = transactions.map(t => `
        <div class="transaction-item ${t.type}">
            <div class="transaction-info">
                <div class="transaction-category">${t.category}</div>
                <div class="transaction-date">${t.date}</div>
                ${t.description ? `<div style="font-size: 0.9em; color: var(--text-secondary); margin-top: 4px;">${t.description}</div>` : ''}
            </div>
            <div class="transaction-amount">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</div>
            <div class="item-actions">
                <button class="btn-danger" onclick="deleteTransaction(${t.id})">Delete</button>
            </div>
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
        date: document.getElementById('date').value
    };

    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });

        if (response.ok) {
            document.getElementById('transactionForm').reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('date').value = today;
            loadTransactions();
            loadDashboard();
            loadBudgets();
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
    }
}

async function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        try {
            const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadTransactions();
                loadDashboard();
            } else {
                alert('Error deleting transaction: ' + response.statusText);
                console.error('Delete failed:', response.status, response.statusText);
            }
        } catch (error) {
            alert('Error deleting transaction: ' + error.message);
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
        container.innerHTML = '<p class="empty-state">No budgets yet. Create one to track your spending!</p>';
        return;
    }

    // Get current month's transactions
    fetch('/api/transactions')
        .then(response => response.json())
        .then(transactions => {
            const currentMonth = new Date().toISOString().split('T')[0].substring(0, 7);
            const categorySpent = {};

            transactions.forEach(t => {
                if (t.type === 'expense' && t.date.substring(0, 7) === currentMonth) {
                    categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
                }
            });

            container.innerHTML = budgets.map(budget => {
                const spent = categorySpent[budget.category] || 0;
                const percentage = (spent / budget.limit) * 100;
                const status = percentage > 100 ? 'Over budget!' : `${Math.round(percentage)}% used`;

                return `
                    <div class="budget-item">
                        <div class="transaction-info">
                            <div class="transaction-category">${budget.category}</div>
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background: ${percentage > 100 ? '#ef4444' : 'linear-gradient(90deg, var(--primary-color), var(--secondary-color))'}"></div>
                                </div>
                                <div class="progress-text">${formatCurrency(spent)} / ${formatCurrency(budget.limit)} - ${status}</div>
                            </div>
                        </div>
                        <button class="btn-danger" onclick="deleteBudget(${budget.id})">Delete</button>
                    </div>
                `;
            }).join('');
        });
}

async function addBudget(e) {
    e.preventDefault();

    const budget = {
        category: document.getElementById('budgetCategory').value,
        limit: document.getElementById('budgetLimit').value
    };

    try {
        const response = await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(budget)
        });

        if (response.ok) {
            document.getElementById('budgetForm').reset();
            loadBudgets();
        }
    } catch (error) {
        console.error('Error adding budget:', error);
    }
}

async function deleteBudget(id) {
    if (confirm('Are you sure you want to delete this budget?')) {
        try {
            const response = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadBudgets();
            } else {
                alert('Error deleting budget: ' + response.statusText);
                console.error('Delete failed:', response.status, response.statusText);
            }
        } catch (error) {
            alert('Error deleting budget: ' + error.message);
            console.error('Error deleting budget:', error);
        }
    }
}

// Savings Goals
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
        container.innerHTML = '<p class="empty-state">No savings goals yet. Create one to start saving!</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < goals.length; i++) {
        const goal = goals[i];
        html += `
        <div class="goal-item">
            <div class="transaction-info">
                <div class="transaction-category">${goal.name}</div>
                <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 8px;">
                    ${goal.deadline ? `Target: ${goal.deadline}` : 'No deadline set'}
                </div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${goal.progress}%"></div>
                    </div>
                    <div class="progress-text">${goal.progress}% - ${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</div>
                </div>
            </div>
            <div class="item-actions" style="flex-shrink: 0;">
                <input type="number" id="goalAmount-${goal.id}" placeholder="Add" step="0.01" style="width: 80px; padding: 8px; font-size: 0.9em; border: 1px solid var(--border-color); border-radius: 6px;">
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
            loadGoals();
            loadDashboard();
        }
    } catch (error) {
        console.error('Error adding goal:', error);
    }
}

async function updateGoal(id, amount) {
    try {
        // First get the current goal
        const response = await fetch('/api/goals');
        const goals = await response.json();
        const goal = goals.find(g => g.id === id);

        if (!goal) {
            alert('Goal not found');
            return;
        }

        // Update with new amount
        const updateResponse = await fetch(`/api/goals/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current: goal.current + amount })
        });

        if (updateResponse.ok) {
            loadGoals();
            loadDashboard();
        } else {
            alert('Error updating goal: ' + updateResponse.statusText);
        }
    } catch (error) {
        alert('Error updating goal: ' + error.message);
        console.error('Error updating goal:', error);
    }
}

async function addGoalAmount(id) {
    const input = document.getElementById('goalAmount-' + id);
    const amount = parseFloat(input.value);
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    await updateGoal(id, amount);
    input.value = '';
}

async function deleteGoal(id) {
    console.log('deleteGoal called with id:', id);
    if (confirm('Are you sure you want to delete this goal?')) {
        try {
            console.log('Sending DELETE request to /api/goals/' + id);
            const response = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
            console.log('Response status:', response.status);
            if (response.ok) {
                console.log('Delete successful, reloading');
                loadGoals();
                loadDashboard();
            } else {
                const errorData = await response.text();
                alert('Error deleting goal: ' + response.statusText + ' - ' + errorData);
                console.error('Delete failed:', response.status, response.statusText, errorData);
            }
        } catch (error) {
            alert('Error deleting goal: ' + error.message);
            console.error('Error deleting goal:', error);
        }
    }
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
