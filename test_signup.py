import urllib.request
import json
import time

time.sleep(1)

data = json.dumps({
    'username': 'testuser',
    'email': 'test@example.com',
    'password': 'password123'
}).encode('utf-8')

req = urllib.request.Request(
    'http://localhost:5000/api/auth/signup',
    data=data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=5) as response:
        result = response.read().decode()
        print(f"Status: {response.status}")
        print(f"Response: {result}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
