"""
Daily Tracker Backend Server
A lightweight Python HTTP server with JSON file-based storage.
"""

import http.server
import json
import os
import datetime
import socketserver
from urllib.parse import urlparse, parse_qs

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DATA_FILE = os.path.join(DATA_DIR, 'tracker_data.json')
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
PORT = 8080


def ensure_data_dir():
    """Create data directory if it doesn't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f)


def load_data():
    """Load all tracker data from JSON file."""
    ensure_data_dir()
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {}


def save_data(data):
    """Save tracker data to JSON file."""
    ensure_data_dir()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_today_key():
    """Get today's date as a string key."""
    return datetime.date.today().isoformat()


def get_default_day_data(date_key=None):
    """Return default structure for a new day."""
    return {
        "date": date_key or get_today_key(),
        "water": 0,
        "coreHabits": [
            {"id": "gym", "label": "Go to the Gym", "done": False},
            {"id": "hanging", "label": "Hanging (2 mins) - Height", "done": False},
            {"id": "cobra", "label": "Cobra Stretch - Height", "done": False},
            {"id": "posture", "label": "Maintain Good Posture", "done": False},
            {"id": "sleep", "label": "Sleep 8 Hours", "done": False},
            {"id": "learn", "label": "Learn Something New", "done": False},
        ],
        "customTasks": [],
        "learning": "",
    }


class TrackerHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler for the Daily Tracker."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/today':
            self.handle_get_today()
        elif parsed.path == '/api/history':
            self.handle_get_history()
        elif parsed.path.startswith('/api/day/'):
            date_key = parsed.path.split('/api/day/')[-1]
            self.handle_get_day(date_key)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            payload = {}

        if parsed.path == '/api/water':
            self.handle_update_water(payload)
        elif parsed.path == '/api/habit':
            self.handle_toggle_habit(payload)
        elif parsed.path == '/api/task':
            self.handle_add_task(payload)
        elif parsed.path == '/api/task/toggle':
            self.handle_toggle_task(payload)
        elif parsed.path == '/api/task/delete':
            self.handle_delete_task(payload)
        elif parsed.path == '/api/learning':
            self.handle_update_learning(payload)
        else:
            self.send_json_response(404, {"error": "Not found"})

    def send_json_response(self, status, data):
        """Send a JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def handle_get_today(self):
        """Get today's tracker data."""
        data = load_data()
        today = get_today_key()
        if today not in data:
            data[today] = get_default_day_data()
            save_data(data)
        else:
            # Migrate: add missing fields for older data
            changed = False
            day = data[today]
            # Ensure learning field
            if 'learning' not in day:
                day['learning'] = ''
                changed = True
            # Ensure learn habit exists
            habit_ids = [h['id'] for h in day.get('coreHabits', [])]
            if 'learn' not in habit_ids:
                day['coreHabits'].append(
                    {"id": "learn", "label": "Learn Something New", "done": False}
                )
                changed = True
            if changed:
                save_data(data)
        self.send_json_response(200, data[today])

    def handle_get_history(self):
        """Get all historical data sorted by date descending."""
        data = load_data()
        # Return sorted list of day entries
        sorted_days = sorted(data.values(), key=lambda d: d.get('date', ''), reverse=True)
        self.send_json_response(200, sorted_days)

    def handle_get_day(self, date_key):
        """Get data for a specific date."""
        data = load_data()
        if date_key in data:
            self.send_json_response(200, data[date_key])
        else:
            self.send_json_response(200, get_default_day_data(date_key))

    def handle_update_learning(self, payload):
        """Update learning note for today."""
        data = load_data()
        today = get_today_key()
        if today not in data:
            data[today] = get_default_day_data()
        data[today]['learning'] = payload.get('text', '').strip()
        save_data(data)
        self.send_json_response(200, data[today])

    def handle_update_water(self, payload):
        """Update water intake count."""
        data = load_data()
        today = get_today_key()
        if today not in data:
            data[today] = get_default_day_data()
        water = payload.get('water', 0)
        data[today]['water'] = max(0, min(5, water))
        save_data(data)
        self.send_json_response(200, data[today])

    def handle_toggle_habit(self, payload):
        """Toggle a core habit's completion status."""
        data = load_data()
        today = get_today_key()
        if today not in data:
            data[today] = get_default_day_data()
        habit_id = payload.get('id')
        for habit in data[today]['coreHabits']:
            if habit['id'] == habit_id:
                habit['done'] = not habit['done']
                break
        save_data(data)
        self.send_json_response(200, data[today])

    def handle_add_task(self, payload):
        """Add a custom task."""
        data = load_data()
        today = get_today_key()
        if today not in data:
            data[today] = get_default_day_data()
        label = payload.get('label', '').strip()
        if label:
            task_id = f"custom_{datetime.datetime.now().strftime('%H%M%S%f')}"
            data[today]['customTasks'].append({
                "id": task_id,
                "label": label,
                "done": False,
            })
            save_data(data)
        self.send_json_response(200, data[today])

    def handle_toggle_task(self, payload):
        """Toggle a custom task's completion status."""
        data = load_data()
        today = get_today_key()
        if today not in data:
            data[today] = get_default_day_data()
        task_id = payload.get('id')
        for task in data[today]['customTasks']:
            if task['id'] == task_id:
                task['done'] = not task['done']
                break
        save_data(data)
        self.send_json_response(200, data[today])

    def handle_delete_task(self, payload):
        """Delete a custom task."""
        data = load_data()
        today = get_today_key()
        if today not in data:
            data[today] = get_default_day_data()
        task_id = payload.get('id')
        data[today]['customTasks'] = [
            t for t in data[today]['customTasks'] if t['id'] != task_id
        ]
        save_data(data)
        self.send_json_response(200, data[today])


def run_server():
    """Start the HTTP server."""
    ensure_data_dir()
    os.makedirs(STATIC_DIR, exist_ok=True)

    socketserver.TCPServer.allow_reuse_address = True

    class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        daemon_threads = True

    with ThreadedServer(("", PORT), TrackerHandler) as httpd:
        print(f"\n{'='*55}")
        print(f"  >> Daily Tracker Server Running!")
        print(f"  -> Open in browser: http://localhost:{PORT}")
        print(f"  -> Data stored in: {DATA_FILE}")
        print(f"  -> Press Ctrl+C to stop")
        print(f"{'='*55}\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n[OK] Server stopped gracefully.")
            httpd.server_close()


if __name__ == '__main__':
    run_server()
