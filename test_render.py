from flask import Flask, render_template

app = Flask(__name__)

try:
    with app.app_context():
        html = render_template('dashboard.html')
        print(f"Dashboard HTML length: {len(html)}")
        print("First 200 chars:")
        print(html[:200])
except Exception as e:
    print(f"Error rendering dashboard: {e}")
    import traceback
    traceback.print_exc()
