import http.client
import json

conn = http.client.HTTPConnection("localhost", 5000)

signup_data = json.dumps({
    'username': 'testuser123',
    'email': 'test@example.com',
    'password': 'password123'
})

headers = {
    'Content-Type': 'application/json',
    'Content-Length': str(len(signup_data))
}

try:
    conn.request("POST", "/api/auth/signup", signup_data, headers)
    response = conn.getresponse()
    print(f"Status: {response.status}")
    print(f"Response: {response.read().decode()}")
    conn.close()
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
