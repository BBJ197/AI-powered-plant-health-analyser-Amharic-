from flask import Flask, request, jsonify, render_template, send_from_directory
import base64, requests, time, json, datetime, os

# 🔐 Gemini API Key
GEMINI_API_KEY = "Add your Gemini api key here"  # Replace with your actual key from Google AI Studio
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent"
HEADERS = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}

# ESP32-CAM IP (update with IP from Serial Monitor, e.g., 192.168.137.202)
ESP_IP = "192.168.137.121"  # Replace with your ESP32-CAM's actual IP

# 🧠 Flask setup
app = Flask(__name__, static_folder='static', template_folder='templates')

# 🗃️ In-memory + file log
LOG_FILE = "ai_analysis_log.jsonl"
IMAGE_DIR = "images"  # Folder for saving images
analyses = []  # Keeps recent data for fast summaries

# Create images directory if it doesn't exist
if not os.path.exists(os.path.join(app.static_folder, IMAGE_DIR)):
    os.makedirs(os.path.join(app.static_folder, IMAGE_DIR))

PROMPT ="""
መልሱን በሙሉ በአማርኛ ስጥ
የእፅዋት ጤና ሁኔታን ከ0 እስከ 100 ባለው ነጥብ አሳይ
የመሬት እርጥበት ደረጃን በመቶኛ አሳይ
የተክል አይነትን በግልፅ ጥቀስ (ለምሳሌ ቲማቲም በቆሎ ቡና ጤፍ ስንዴ ወዘተ)
የበሽታ አይነት ወይም የደረቅነት ምልክቶችን በአማርኛ ጥቀስ እና የበሽታውን ስም በእንግሊዝኛ በቅንፍ () ውስጥ ጨምር
አንድ ቀላል እና ተግባራዊ የማሻሻያ ምክር ስጥ እና በግልፅ አብራራ
እንደ * ያሉ የነጥብ ምልክቶችን አትጠቀም
ከ “የእፅዋት ጤና ሁኔታ” በፊት ምንም አይነት ሐረግ አትጀምር
"""

# 📦 Utility: load old logs on startup
def load_logs():
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                analyses.append(json.loads(line))
        print(f"✅ Loaded {len(analyses)} past records.")
    except FileNotFoundError:
        print("ℹ️ No previous log file found.")

def save_log(entry, image_b64=None):
    analyses.append(entry)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    # Save image if provided
    if image_b64:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        image_path = os.path.join(app.static_folder, IMAGE_DIR, f"image_{timestamp}.jpg")
        with open(image_path, "wb") as f:
            f.write(base64.b64decode(image_b64))
        entry["image_path"] = f"{IMAGE_DIR}/image_{timestamp}.jpg"

# Serve static files (CSS, JS, images)
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route("/")
def home():
    return render_template('index.html')

@app.route("/summary_page")
def summary_page():
    return render_template('summary.html')

# Route to capture from ESP and analyze with retries
@app.route("/capture_and_analyze", methods=["GET"])
def capture_and_analyze():
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Fetch image from ESP32-CAM
            esp_url = f"http://{ESP_IP}/capture"
            print(f"Fetching from ESP at {esp_url}")
            esp_response = requests.get(esp_url, timeout=10)
            esp_response.raise_for_status()
            data = esp_response.json()
            image_b64 = data["image"]
            mime_type = data.get("mime_type", "image/jpeg")

            # Process with Gemini
            body = {
                "contents": [
                    {
                        "parts": [
                            {"text": PROMPT},
                            {"inline_data": {"mime_type": mime_type, "data": image_b64}}
                        ]
                    }
                ]
            }
            print("Sending request to Gemini API")
            response = requests.post(GEMINI_URL, headers=HEADERS, json=body, timeout=100)
            response.raise_for_status()
            result = response.json()
            ai_text = result["candidates"][0]["content"]["parts"][0]["text"]

            # Save with timestamp and image
            entry = {
                "timestamp": time.time(),
                "analysis": ai_text
            }
            save_log(entry, image_b64)

            print(f"✅ Saved analysis and image at {datetime.datetime.now()}")
            return jsonify({"status": "ok", "analysis": ai_text, "image_b64": image_b64})

        except (requests.exceptions.HTTPError, requests.exceptions.ReadTimeout) as e:
            if (isinstance(e, requests.exceptions.HTTPError) and e.response.status_code == 503) or isinstance(e, requests.exceptions.ReadTimeout):
                if attempt < max_retries - 1:
                    print(f"❌ {type(e).__name__} on attempt {attempt + 1}. Retrying in {5 * (attempt + 1)} seconds...")
                    time.sleep(5 * (attempt + 1))
                    continue
            print(f"❌ {type(e).__name__} Error:", str(e))
            return jsonify({"error": str(e)}), 500
        except Exception as e:
            print("❌ General Error:", str(e), type(e).__name__)
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "Max retries exceeded due to connection errors"}), 500

# Manual upload route
@app.route("/upload", methods=["POST"])
def upload():
    try:
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"error": "Missing image data"}), 400

        image_b64 = data["image"]
        mime_type = data.get("mime_type", "image/jpeg")

        body = {
            "contents": [
                {
                    "parts": [
                        {"text": PROMPT},
                        {"inline_data": {"mime_type": mime_type, "data": image_b64}}
                    ]
                }
            ]
        }

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.post(GEMINI_URL, headers=HEADERS, json=body, timeout=60)
                response.raise_for_status()
                result = response.json()
                ai_text = result["candidates"][0]["content"]["parts"][0]["text"]

                entry = {
                    "timestamp": time.time(),
                    "analysis": ai_text
                }
                save_log(entry, image_b64)

                print(f"✅ Saved analysis and image at {datetime.datetime.now()}")
                return jsonify({"status": "ok", "analysis": ai_text})

            except (requests.exceptions.HTTPError, requests.exceptions.ReadTimeout) as e:
                if (isinstance(e, requests.exceptions.HTTPError) and e.response.status_code == 503) or isinstance(e, requests.exceptions.ReadTimeout):
                    if attempt < max_retries - 1:
                        print(f"❌ {type(e).__name__} on attempt {attempt + 1}. Retrying in {5 * (attempt + 1)} seconds...")
                        time.sleep(5 * (attempt + 1))
                        continue
                print(f"❌ {type(e).__name__} Error:", str(e))
                return jsonify({"error": str(e)}), 500
    except Exception as e:
                print("❌ General Error:", str(e))
                return jsonify({"error": str(e)}), 500
    return jsonify({"error": "Max retries exceeded due to connection errors"}), 500

# Summaries by time window
# ────── inside app.py ──────
@app.route("/summary", methods=["GET"])
def summary():
    try:
        now = time.time()
        periods = {
            "hour": 3600,
            "day": 86400,
            "week": 604800,
            "month": 2592000,
            "year": 31536000
        }
        summary_data = {}
        for name, seconds in periods.items():
            start = now - seconds
            items = [a for a in analyses if a["timestamp"] >= start]
            summary_data[name] = {
                "count": len(items),
                # ────── CHANGE: return *all* items, not just last 3 ──────
                "sample": [
                    {"analysis": a["analysis"], "image_path": a.get("image_path", "")}
                    for a in items
                ][::-1]   # newest first
            }
        return jsonify(summary_data)
    except Exception as e:
        print("Summary Error:", str(e))
        return jsonify({"error": str(e)}), 500

# Clear logs route
@app.route("/clear_logs", methods=["POST"])
def clear_logs():
    try:
        analyses.clear()
        open(LOG_FILE, "w").close()
        # Optionally, delete saved images
        for file in os.listdir(os.path.join(app.static_folder, IMAGE_DIR)):
            os.remove(os.path.join(app.static_folder, IMAGE_DIR, file))
        print("✅ Cleared logs and images")
        return jsonify({"status": "cleared"})
    except Exception as e:
        print("❌ Clear Logs Error:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    load_logs()
    app.run(host="0.0.0.0", port=5000)