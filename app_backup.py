from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///finance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'your-secret-key-change-in-production'

db = SQLAlchemy(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    
    transactions = db.relationship('Transaction', backref='user', lazy=True, cascade='all, delete-orphan')
    budgets = db.relationship('Budget', backref='user', lazy=True, cascade='all, delete-orphan')
    goals = db.relationship('SavingsGoal', backref='user', lazy=True, cascade='all, delete-orphan')

# Transaction Model
class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'income' or 'expense'
    category = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(500))
    date = db.Column(db.DateTime, nullable=False, default=datetime.now)
    is_recurring = db.Column(db.Boolean, default=False)
    recurring_frequency = db.Column(db.String(50))  # 'daily', 'weekly', 'monthly', 'yearly'

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'category': self.category,
            'amount': self.amount,
            'description': self.description,
            'date': self.date.strftime('%Y-%m-%d %H:%M'),
            'is_recurring': self.is_recurring,
            'recurring_frequency': self.recurring_frequency
        }

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    limit = db.Column(db.Float, nullable=False)
    month = db.Column(db.String(7), nullable=False, default=datetime.now().strftime('%Y-%m'))
    alert_threshold = db.Column(db.Float, default=80)  # Alert at 80% of budget

    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'limit': self.limit,
            'month': self.month,
            'alert_threshold': self.alert_threshold
        }

class SavingsGoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    target = db.Column(db.Float, nullable=False)
    current = db.Column(db.Float, default=0)
    deadline = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    priority = db.Column(db.String(50), default='medium')  # 'low', 'medium', 'high'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'target': self.target,
            'current': self.current,
            'deadline': self.deadline.strftime('%Y-%m-%d') if self.deadline else None,
            'progress': round((self.current / self.target) * 100, 1) if self.target > 0 else 0,
            'priority': self.priority,
            'days_left': (self.deadline - datetime.now()).days if self.deadline else None
        }

# Create tables
with app.app_context():
    db.create_all()

# Authentication helper
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Auth Routes
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    user = User(
        username=data['username'],
        email=data['email'],
        password=generate_password_hash(data['password'])
    )
    db.session.add(user)
    db.session.commit()
    
    session['user_id'] = user.id
    return jsonify({'success': True, 'user_id': user.id}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not check_password_hash(user.password, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    session['user_id'] = user.id
    return jsonify({'success': True, 'user_id': user.id}), 200

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True}), 200

@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_user():
    user = User.query.get(session['user_id'])
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email
    }), 200

# Main routes
@app.route('/')
def index():
    if 'user_id' not in session:
        return render_template('auth.html')
    return render_template('dashboard.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template('dashboard.html')

@app.route('/api/dashboard')
@login_required
def get_dashboard():
    """Get comprehensive dashboard data with analytics"""
    current_month = datetime.now().strftime('%Y-%m')
    user_id = session['user_id']
    
    # Get this month's transactions
    transactions = Transaction.query.filter_by(user_id=user_id).filter(
        db.func.strftime('%Y-%m', Transaction.date) == current_month
    ).all()
    
    # Calculate totals
    total_income = sum(t.amount for t in transactions if t.type == 'income')
    total_expenses = sum(t.amount for t in transactions if t.type == 'expense')
    balance = total_income - total_expenses
    
    # Get expense breakdown by category
    expense_data = {}
    for t in transactions:
        if t.type == 'expense':
            expense_data[t.category] = expense_data.get(t.category, 0) + t.amount
    
    # Get all goals with days remaining
    goals = SavingsGoal.query.filter_by(user_id=user_id).all()
    goals_data = [g.to_dict() for g in goals]
    
    # Budget alerts
    budgets = Budget.query.filter_by(user_id=user_id, month=current_month).all()
    budget_alerts = []
    for budget in budgets:
        spent = sum(t.amount for t in transactions if t.type == 'expense' and t.category == budget.category)
        percentage = (spent / budget.limit) * 100 if budget.limit > 0 else 0
        if percentage >= budget.alert_threshold:
            budget_alerts.append({
                'category': budget.category,
                'spent': spent,
                'limit': budget.limit,
                'percentage': percentage,
                'status': 'over' if percentage > 100 else 'warning'
            })
    
    # Calculate savings rate
    if total_income > 0:
        savings_rate = round(((total_income - total_expenses) / total_income) * 100, 1)
    else:
        savings_rate = 0
    
    return jsonify({
        'total_income': total_income,
        'total_expenses': total_expenses,
        'balance': balance,
        'savings_rate': savings_rate,
        'expense_breakdown': expense_data,
        'savings_goals': goals_data,
        'budget_alerts': budget_alerts,
        'month': current_month
    })

@app.route('/api/analytics/monthly', methods=['GET'])
@login_required
def get_monthly_analytics():
    """Get 12-month analytics for trends"""
    user_id = session['user_id']
    months = []
    
    for i in range(12):
        date = datetime.now() - timedelta(days=30*i)
        month_str = date.strftime('%Y-%m')
        
        transactions = Transaction.query.filter_by(user_id=user_id).filter(
            db.func.strftime('%Y-%m', Transaction.date) == month_str
        ).all()
        
        income = sum(t.amount for t in transactions if t.type == 'income')
        expenses = sum(t.amount for t in transactions if t.type == 'expense')
        
        months.append({
            'month': month_str,
            'income': income,
            'expenses': expenses,
            'balance': income - expenses
        })
    
    return jsonify(months[::-1])

@app.route('/api/transactions', methods=['GET', 'POST'])
@login_required
def transactions():
    """Get all transactions or add a new one"""
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.json
        transaction = Transaction(
            user_id=user_id,
            type=data['type'],
            category=data['category'],
            amount=float(data['amount']),
            description=data.get('description', ''),
            date=datetime.strptime(data['date'], '%Y-%m-%d') if 'date' in data else datetime.now(),
            is_recurring=data.get('is_recurring', False),
            recurring_frequency=data.get('recurring_frequency')
        )
        db.session.add(transaction)
        db.session.commit()
        return jsonify(transaction.to_dict()), 201
    
    transactions_list = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date.desc()).all()
    return jsonify([t.to_dict() for t in transactions_list])

@app.route('/api/transactions/<int:id>', methods=['DELETE'])
@login_required
def delete_transaction(id):
    """Delete a transaction"""
    user_id = session['user_id']
    transaction = Transaction.query.filter_by(id=id, user_id=user_id).first()
    if transaction:
        db.session.delete(transaction)
        db.session.commit()
        return jsonify({'success': True}), 200
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/budgets', methods=['GET', 'POST'])
@login_required
def budgets():
    """Get or create budgets"""
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.json
        existing = Budget.query.filter_by(user_id=user_id, category=data['category']).first()
        if existing:
            existing.limit = float(data['limit'])
            existing.alert_threshold = float(data.get('alert_threshold', 80))
        else:
            budget = Budget(
                user_id=user_id,
                category=data['category'],
                limit=float(data['limit']),
                alert_threshold=float(data.get('alert_threshold', 80))
            )
            db.session.add(budget)
        db.session.commit()
        return jsonify({'success': True}), 201
    
    budgets_list = Budget.query.filter_by(user_id=user_id).all()
    return jsonify([b.to_dict() for b in budgets_list])

@app.route('/api/budgets/<int:id>', methods=['DELETE'])
@login_required
def delete_budget(id):
    """Delete a budget"""
    user_id = session['user_id']
    budget = Budget.query.filter_by(id=id, user_id=user_id).first()
    if budget:
        db.session.delete(budget)
        db.session.commit()
        return jsonify({'success': True}), 200
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/goals', methods=['GET', 'POST'])
@login_required
def goals():
    """Get or create savings goals"""
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.json
        goal = SavingsGoal(
            user_id=user_id,
            name=data['name'],
            target=float(data['target']),
            priority=data.get('priority', 'medium'),
            deadline=datetime.strptime(data['deadline'], '%Y-%m-%d') if data.get('deadline') else None
        )
        db.session.add(goal)
        db.session.commit()
        return jsonify(goal.to_dict()), 201
    
    goals_list = SavingsGoal.query.filter_by(user_id=user_id).all()
    return jsonify([g.to_dict() for g in goals_list])

@app.route('/api/goals/<int:id>', methods=['PUT', 'DELETE'])
@login_required
def update_delete_goal(id):
    """Update or delete a savings goal"""
    user_id = session['user_id']
    goal = SavingsGoal.query.filter_by(id=id, user_id=user_id).first()
    if not goal:
        return jsonify({'error': 'Not found'}), 404
    
    if request.method == 'PUT':
        data = request.json
        goal.current = float(data.get('current', goal.current))
        db.session.commit()
        return jsonify(goal.to_dict()), 200
    
    db.session.delete(goal)
    db.session.commit()
    return jsonify({'success': True}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
