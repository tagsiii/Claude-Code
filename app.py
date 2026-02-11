"""
Navy QOL Chatbot - Flask Web Application
Serves the chat interface and handles API requests.
"""
import os
import json
from flask import Flask, render_template, request, jsonify
from chatbot import get_response, WELCOME_MSG
from search_engine import rebuild_index
from ingest import ingest_text_file, ingest_json_file

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB upload limit
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    reply = get_response(user_message)
    return jsonify({"reply": reply})


@app.route("/api/welcome", methods=["GET"])
def welcome():
    return jsonify({"reply": WELCOME_MSG})


@app.route("/api/upload", methods=["POST"])
def upload_document():
    """Upload a new publication document to expand the knowledge base."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = file.filename
    filepath = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file.save(filepath)

    category = request.form.get("category", "Uploaded Publication")
    source = request.form.get("source", filename)

    try:
        if filename.endswith(".json"):
            count = ingest_json_file(filepath)
        elif filename.endswith(".txt"):
            count = ingest_text_file(filepath, category=category, source=source)
        else:
            return jsonify({"error": "Unsupported file type. Use .txt or .json"}), 400

        # Rebuild search index to include new content
        rebuild_index()
        return jsonify({"message": f"Ingested {count} entries from {filename}. Index rebuilt."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rebuild-index", methods=["POST"])
def rebuild():
    """Force rebuild the search index from all knowledge base files."""
    rebuild_index()
    return jsonify({"message": "Search index rebuilt successfully."})


if __name__ == "__main__":
    # Build index on startup
    rebuild_index()
    app.run(host="0.0.0.0", port=5000, debug=True)
