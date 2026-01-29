from __future__ import annotations

import hashlib
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

# --- Paths / Storage ---
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"

UPLOAD_DIR.mkdir(exist_ok=True)

ENCOURAGEMENT_MESSAGES = [
    "{goal}는 반드시 해낼 줄 알았어!",
    "잘했어! {goal} 달성 완료!",
    "오늘도 꾸준함 승리! {goal} 성공!",
    "멋지다! {goal} 실천했네.",
    "최고야! {goal} 완료했어.",
    "한 걸음 더! {goal} 완료!",
    "{goal} 해냈다! 내일도 화이팅!",
    "성실함이 빛난다! {goal} 완료!",
]


@app.route("/")
def index() -> str:
    return render_template("index.html", state={"total_xp": 0, "level": 1})


@app.route("/uploads/<path:filename>")
def uploaded_file(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


def _allowed_file(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in {".png", ".jpg", ".jpeg", ".webp", ".pdf"}


def _make_unique_filename(original_name: str) -> str:
    safe = secure_filename(original_name) or "upload"
    stem, ext = os.path.splitext(safe)
    return f"{stem}_{hashlib.sha1(os.urandom(16)).hexdigest()[:10]}{ext}"


def _pick_feedback(goal_text: str | None) -> str:
    goal = goal_text.strip() if goal_text else "오늘의 목표"
    return random.choice(ENCOURAGEMENT_MESSAGES).format(goal=goal)


@app.route("/upload", methods=["POST"])
def upload() -> Any:
    if "photo" not in request.files:
        return jsonify({"error": "사진 파일이 필요합니다."}), 400

    file_storage = request.files["photo"]
    if file_storage.filename == "":
        return jsonify({"error": "파일 이름이 비어 있습니다."}), 400

    if not _allowed_file(file_storage.filename):
        return jsonify({"error": "이미지 또는 PDF 파일만 업로드할 수 있습니다."}), 400

    payload = file_storage.read()
    if not payload:
        return jsonify({"error": "빈 파일입니다."}), 400

    unique_name = _make_unique_filename(file_storage.filename)
    save_path = UPLOAD_DIR / unique_name
    with save_path.open("wb") as f:
        f.write(payload)

    _, ext = os.path.splitext(unique_name.lower())
    file_type = "pdf" if ext == ".pdf" else "image"
    feedback = _pick_feedback(request.form.get("goal_text"))

    return jsonify(
        {
            "feedback": feedback,
            "file_url": f"/uploads/{unique_name}",
            "file_type": file_type,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
