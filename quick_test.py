#!/usr/bin/env python
import sys
sys.path.insert(0, '/mnt/c/Users/mmdmc/Documents/womenji')

# Just test the app directly without running server
from app import app, db, User
from werkzeug.security import generate_password_hash

with app.app_context():
    # Create a test user
    if not User.query.filter_by(username='test').first():
        user = User(
            username='test',
            email='test@test.com',
            password=generate_password_hash('test123')
        )
        db.session.add(user)
        db.session.commit()
        print("✓ User created")
    else:
        print("✓ User already exists")
    
    # Test login
    user = User.query.filter_by(username='test').first()
    if user:
        print(f"✓ User found: {user.username}")
    else:
        print("✗ User not found")
