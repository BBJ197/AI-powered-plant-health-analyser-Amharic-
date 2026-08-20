import os
import re
import time
import json
import base64
import datetime
import threading
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, Response, render_template
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")

# ---------------------------------------------------------------------------
# Gemini & Database Configuration
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Corrected endpoint with the -preview tag
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"

# Pass the API key securely via headers
HEADERS = {
    "Content-Type": "application/json",
    "x-goog-api-key": GEMINI_API_KEY
}

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "dbname": os.getenv("DB_NAME", "plant_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

# ---------------------------------------------------------------------------
# Database Utilities
# ---------------------------------------------------------------------------
def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def init_db():
    """Ensures the required table exists on startup."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # image_data is BYTEA to store raw image binaries directly in PostgreSQL
        cur.execute("""
            CREATE TABLE IF NOT EXISTS plant_health_log (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                health_score INT NOT NULL,
                moisture_level INT NOT NULL,
                plant_type VARCHAR(100) NOT NULL,
                short_summary VARCHAR(255) NOT NULL,
                disease_or_symptoms VARCHAR(255),
                actionable_advice TEXT,
                full_analysis TEXT,
                image_data BYTEA NOT NULL
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Database initialized successfully.")
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")

# ---------------------------------------------------------------------------
# Live Feed State (Thread-Safe)
# ---------------------------------------------------------------------------
feed_lock = threading.Lock()
latest_frame_bytes = None

# ---------------------------------------------------------------------------
# Gemini AI Prompt (Strict JSON Output)
# ---------------------------------------------------------------------------
AMHARIC_PROMPT = """
ምስሉን በጥንቃቄ ተመልክተህ ትንተናህን በ JSON ቅርጸት (JSON format) ብቻ አቅርብ።
መልስህ ምንም አይነት ተጨማሪ የMarkdown መክፈቻ ወይም መዝጊያ (እንደ ```json) ማካተት የለበትም፤ ንፁህ JSON ብቻ ይሁን።

የሚከተሉትን ቁልፎች (keys) ተጠቀም:
{
  "health_score": (የእፅዋት አጠቃላይ ጤና ከ 0 እስከ 100 ባለው ኢንቲጀር ቁጥር),
  "moisture_level": (የአፈር ወይም የተክል እርጥበት ግምት ከመቶ 0 እስከ 100 ባለው ኢንቲጀር ቁጥር),
  "plant_type": "(የተክሉ አይነት ስም በአማርኛ፤ ለምሳሌ፡ ቲማቲም፣ በቆሎ፣ ቡና፣ ጤፍ፣ ስንዴ)",
  "disease_or_symptoms": "(የበሽታው አይነት ወይም የደረቅነት ምልክቶች በአማርኛ እና የእንግሊዝኛ ስሙ በቅንፍ ውስጥ፤ ምንም ከሌለ 'ጤናማ' በል)",
  "short_summary": "(ለዋናው ካርድ ማሳያ የሚሆን በጣም አጭር የአንድ ዓረፍተ ነገር ማጠቃለያ በአማርኛ)",
  "actionable_advice": "(ቀላል እና ተግባራዊ የሆነ የማሻሻያ ወይም የእንክብካቤ ምክር በአማርኛ)",
  "full_analysis": "(የተሟላ እና ዝርዝር ያለ የምርመራ ትንተና በአማርኛ)"
}
"""

def analyze_image_with_gemini(image_bytes, mime_type="image/jpeg"):
    """Sends image bytes to Google Gemini and parses the structured JSON output."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    body = {
        "contents": [
            {
                "parts": [
                    {"text": AMHARIC_PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": image_b64}}
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    }

    response = requests.post(
        GEMINI_URL,
        headers=HEADERS,
        json=body,
        timeout=60
    )
    response.raise_for_status()

    result = response.json()
    raw_ai_text = result["candidates"][0]["content"]["parts"][0]["text"].strip()

    clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_ai_text, flags=re.MULTILINE).strip()
    parsed_data = json.loads(clean_json_str)

    return parsed_data

# ---------------------------------------------------------------------------
# Database Insert Helper
# ---------------------------------------------------------------------------
def save_plant_record(analysis_data, image_bytes):
    """Logs the parsed fields and binary image directly to PostgreSQL."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO plant_health_log (
            health_score, moisture_level, plant_type, 
            short_summary, disease_or_symptoms, actionable_advice, 
            full_analysis, image_data
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        int(analysis_data.get("health_score", 0)),
        int(analysis_data.get("moisture_level", 0)),
        str(analysis_data.get("plant_type", "ያልታወቀ")),
        str(analysis_data.get("short_summary", "")),
        str(analysis_data.get("disease_or_symptoms", "ምንም")),
        str(analysis_data.get("actionable_advice", "")),
        str(analysis_data.get("full_analysis", "")),
        psycopg2.Binary(image_bytes)  # Converts raw bytes to PostgreSQL BYTEA
    ))
    record_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return record_id

# ---------------------------------------------------------------------------
# Routes: Web UI & Static Streaming
# ---------------------------------------------------------------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/upload_stream", methods=["POST"])
def upload_stream():
    """Continuous stream frames pushed from the ESP32-CAM."""
    global latest_frame_bytes
    if not request.data:
        return "No image data", 400

    with feed_lock:
        latest_frame_bytes = request.data
    return "OK", 200

def generate_stream():
    while True:
        with feed_lock:
            frame = latest_frame_bytes

        if frame is None:
            time.sleep(0.05)
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        )
        time.sleep(0.03)

@app.route("/video_feed")
def video_feed():
    return Response(generate_stream(), mimetype="multipart/x-mixed-replace; boundary=frame")

# ---------------------------------------------------------------------------
# Routes: Analysis Trigger (Button POST or Web Form)
# ---------------------------------------------------------------------------
@app.route("/analyze_frame", methods=["POST"])
def analyze_frame():
    """Triggered directly by ESP32 push button or manual capture."""
    try:
        if request.is_json:
            data = request.get_json()
            image_bytes = base64.b64decode(data.get("image", ""))
        else:
            image_bytes = request.data

        if not image_bytes:
            return jsonify({"error": "No image payload received"}), 400

        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 📸 Frame received. Running Gemini analysis...")
        
        analysis_data = analyze_image_with_gemini(image_bytes)
        
        # Save record and get ID (no local image path needed)
        record_id = save_plant_record(analysis_data, image_bytes)

        print(f"✅ Saved Record #{record_id}: {analysis_data.get('plant_type')} (Health: {analysis_data.get('health_score')}%)")

        return jsonify({
            "status": "success",
            "record_id": record_id,
            "image_url": f"/api/image/{record_id}", # Point UI to the new image route
            "data": analysis_data
        }), 200

    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# Routes: Data API & Image Serving
# ---------------------------------------------------------------------------
@app.route("/api/image/<int:record_id>")
def serve_image(record_id):
    """Fetches the BYTEA image from PostgreSQL and serves it as a JPEG."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT image_data FROM plant_health_log WHERE id = %s;", (record_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row or row[0] is None:
            return "No photo found", 404

        return Response(bytes(row[0]), mimetype="image/jpeg")
    except Exception as e:
        return str(e), 500

@app.route("/api/records", methods=["GET"])
def get_records():
    """Returns past health records for the UI cards (excludes heavy image data)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Select specific columns to avoid crashing the JSON response with BYTEA data
        cur.execute("""
            SELECT id, timestamp, health_score, moisture_level, plant_type, 
                   short_summary, disease_or_symptoms 
            FROM plant_health_log 
            ORDER BY timestamp DESC LIMIT 50;
        """)
        records = cur.fetchall()
        cur.close()
        conn.close()

        for r in records:
            if isinstance(r["timestamp"], (datetime.datetime, datetime.date)):
                r["timestamp"] = r["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
            # Inject the image URL so the frontend knows where to load the photo
            r["image_url"] = f"/api/image/{r['id']}"

        return jsonify(records), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/record/<int:record_id>", methods=["GET"])
def get_single_record(record_id):
    """Returns detailed information for the modal popup (excludes heavy image data)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, timestamp, health_score, moisture_level, plant_type, 
                   short_summary, disease_or_symptoms, actionable_advice, full_analysis 
            FROM plant_health_log WHERE id = %s;
        """, (record_id,))
        record = cur.fetchone()
        cur.close()
        conn.close()

        if not record:
            return jsonify({"error": "Record not found"}), 404

        if isinstance(record["timestamp"], (datetime.datetime, datetime.date)):
            record["timestamp"] = record["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
            
        record["image_url"] = f"/api/image/{record['id']}"

        return jsonify(record), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, threaded=True)