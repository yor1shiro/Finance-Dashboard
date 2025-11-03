from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from functools import wraps
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///finance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'change-me-in-production-' + os.urandom(16).hex()
app.permanent_session_lifetime = 24 * 60 * 60  # 24 hours

db = SQLAlchemy(app)

# ==================== Models ====================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    
    transactions = db.relationship('Transaction', backref='user', lazy=True, cascade='all, delete-orphan')
    budgets = db.relationship('Budget', backref='user', lazy=True, cascade='all, delete-orphan')
    goals = db.relationship('SavingsGoal', backref='user', lazy=True, cascade='all, delete-orphan')

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'income' or 'expense'
    category = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(500))
    date = db.Column(db.DateTime, nullable=False, default=datetime.now)
    
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'category': self.category,
            'amount': self.amount,
            'description': self.description,
            'date': self.date.strftime('%Y-%m-%d %H:%M')
        }

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    limit = db.Column(db.Float, nullable=False)
    month = db.Column(db.String(7), nullable=False, default=datetime.now().strftime('%Y-%m'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'limit': self.limit,
            'month': self.month
        }

class SavingsGoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    target = db.Column(db.Float, nullable=False)
    current = db.Column(db.Float, default=0)
    deadline = db.Column(db.DateTime)
    priority = db.Column(db.String(50), default='medium')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'target': self.target,
            'current': self.current,
            'deadline': self.deadline.strftime('%Y-%m-%d') if self.deadline else None,
            'priority': self.priority,
            'progress': round((self.current / self.target) * 100, 1) if self.target > 0 else 0
        }

# Create tables
with app.app_context():
    db.drop_all()
    db.create_all()
    print("[OK] Database initialized")

# ==================== Authentication ====================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# ==================== Routes ====================
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard_page'))
    return render_template('auth.html')

@app.route('/dashboard')
def dashboard_page():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template('dashboard.html')

# ==================== Auth API ====================
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Check if user exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already taken'}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create user
        user = User(
            username=data['username'],
            email=data['email'],
            password=generate_password_hash(data['password'])
        )
        db.session.add(user)
        db.session.commit()
        
        # Set session
        session['user_id'] = user.id
        session.permanent = True
        
        return jsonify({'success': True, 'user_id': user.id}), 201
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] Signup error: {e}")
        return jsonify({'error': f'Signup failed'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Missing credentials'}), 400
        
        user = User.query.filter_by(username=data['username']).first()
        
        if not user or not check_password_hash(user.password, data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        session['user_id'] = user.id
        session.permanent = True
        
        return jsonify({'success': True, 'user_id': user.id}), 200
    except Exception as e:
        print(f"[ERROR] Login error: {e}")
        return jsonify({'error': f'Login failed'}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'success': True}), 200

@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_current_user():
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email
    }), 200

# ==================== Dashboard API ====================
@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    transactions = Transaction.query.filter_by(user_id=session['user_id']).all()
    return jsonify([t.to_dict() for t in transactions]), 200

@app.route('/api/transactions', methods=['POST'])
@login_required
def add_transaction():
    try:
        data = request.get_json()
        transaction = Transaction(
            user_id=session['user_id'],
            type=data['type'],
            category=data['category'],
            amount=float(data['amount']),
            description=data.get('description', '')
        )
        db.session.add(transaction)
        db.session.commit()
        return jsonify(transaction.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/budgets', methods=['GET'])
@login_required
def get_budgets():
    budgets = Budget.query.filter_by(user_id=session['user_id']).all()
    return jsonify([b.to_dict() for b in budgets]), 200

@app.route('/api/budgets', methods=['POST'])
@login_required
def add_budget():
    try:
        data = request.get_json()
        budget = Budget(
            user_id=session['user_id'],
            category=data['category'],
            limit=float(data['limit']),
            month=data.get('month', datetime.now().strftime('%Y-%m'))
        )
        db.session.add(budget)
        db.session.commit()
        return jsonify(budget.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/goals', methods=['GET'])
@login_required
def get_goals():
    goals = SavingsGoal.query.filter_by(user_id=session['user_id']).all()
    return jsonify([g.to_dict() for g in goals]), 200

@app.route('/api/goals', methods=['POST'])
@login_required
def add_goal():
    try:
        data = request.get_json()
        goal = SavingsGoal(
            user_id=session['user_id'],
            name=data['name'],
            target=float(data['target']),
            priority=data.get('priority', 'medium')
        )
        db.session.add(goal)
        db.session.commit()
        return jsonify(goal.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/transactions/<int:tid>', methods=['DELETE'])
@login_required
def delete_transaction(tid):
    transaction = Transaction.query.filter_by(id=tid, user_id=session['user_id']).first()
    if not transaction:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(transaction)
    db.session.commit()
    return jsonify({'success': True}), 200

@app.route('/api/budgets/<int:bid>', methods=['DELETE'])
@login_required
def delete_budget(bid):
    budget = Budget.query.filter_by(id=bid, user_id=session['user_id']).first()
    if not budget:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(budget)
    db.session.commit()
    return jsonify({'success': True}), 200

@app.route('/api/goals/<int:gid>', methods=['DELETE'])
@login_required
def delete_goal(gid):
    goal = SavingsGoal.query.filter_by(id=gid, user_id=session['user_id']).first()
    if not goal:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(goal)
    db.session.commit()
    return jsonify({'success': True}), 200

# ==================== Dashboard Data ====================
@app.route('/api/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    """Get dashboard summary data"""
    user_id = session['user_id']
    
    # Get all transactions for this user
    transactions = Transaction.query.filter_by(user_id=user_id).all()
    
    total_income = sum(t.amount for t in transactions if t.type == 'income')
    total_expenses = sum(t.amount for t in transactions if t.type == 'expense')
    balance = total_income - total_expenses
    
    # Get this month's transactions
    current_month = datetime.now().strftime('%Y-%m')
    month_transactions = [t for t in transactions if t.date.strftime('%Y-%m') == current_month]
    month_income = sum(t.amount for t in month_transactions if t.type == 'income')
    month_expenses = sum(t.amount for t in month_transactions if t.type == 'expense')
    
    return jsonify({
        'totalIncome': total_income,
        'totalExpenses': total_expenses,
        'balance': balance,
        'monthIncome': month_income,
        'monthExpenses': month_expenses,
        'savingsRate': round((month_income - month_expenses) / month_income * 100, 1) if month_income > 0 else 0
    }), 200

@app.route('/api/analytics/monthly', methods=['GET'])
@login_required
def get_monthly_analytics():
    """Get 12-month analytics"""
    user_id = session['user_id']
    transactions = Transaction.query.filter_by(user_id=user_id).all()
    
    # Build 12-month data
    data = []
    
    for i in range(11, -1, -1):
        month_date = datetime.now() - timedelta(days=30*i)
        month_str = month_date.strftime('%Y-%m')
        month_label = month_date.strftime('%b')
        
        month_income = sum(t.amount for t in transactions 
                          if t.type == 'income' and t.date.strftime('%Y-%m') == month_str)
        month_expenses = sum(t.amount for t in transactions 
                            if t.type == 'expense' and t.date.strftime('%Y-%m') == month_str)
        
        data.append({
            'month': month_label,
            'income': month_income,
            'expenses': month_expenses
        })
    
    return jsonify(data), 200

if __name__ == '__main__':
    app.run(debug=False, port=5000)
