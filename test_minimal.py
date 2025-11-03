from flask import Flask, render_template, session, jsonify

app = Flask(__name__)
app.secret_key = 'test-key'

@app.route('/')
def index():
    if 'user_id' not in session:
        return "Login page"
    return "Dashboard page"

@app.route('/dashboard')
def dashboard():
    return "Dashboard"

@app.route('/api/auth/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    return jsonify({'id': 1, 'username': 'test'})

if __name__ == '__main__':
    app.run(debug=False, port=5000)
