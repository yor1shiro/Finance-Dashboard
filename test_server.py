import urllib.request
import time

time.sleep(1)  # Wait for server to be ready

try:
    with urllib.request.urlopen('http://localhost:5000/', timeout=5) as response:
        content = response.read().decode()
        print("===== HTML CONTENT =====")
        print(content[:2000])
        print("\n... (truncated) ...\n")
except Exception as e:
    print(f"Error: {e}")
