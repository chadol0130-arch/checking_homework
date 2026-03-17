from __future__ import annotations

import hashlib
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

from parser import parse_exam_pdf

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


# ---------------------------------------------------------------------------
# 직독직해 — 시험지 업로드 & 지문 선택
# ---------------------------------------------------------------------------

@app.route("/exam")
def exam_list() -> str:
    """등록된 시험지 목록 페이지"""
    return render_template("exam_list.html")


@app.route("/exam/upload", methods=["POST"])
def exam_upload() -> Any:
    """
    수능 영어 PDF를 업로드하여 지문 블록을 파싱합니다.
    파싱 결과를 JSON으로 반환하면 클라이언트가 선택 UI를 렌더링합니다.
    """
    if "exam_pdf" not in request.files:
        return jsonify({"error": "PDF 파일이 필요합니다."}), 400

    file_storage = request.files["exam_pdf"]
    if file_storage.filename == "":
        return jsonify({"error": "파일 이름이 비어 있습니다."}), 400

    _, ext = os.path.splitext(file_storage.filename.lower())
    if ext != ".pdf":
        return jsonify({"error": "PDF 파일만 업로드할 수 있습니다."}), 400

    payload = file_storage.read()
    if not payload:
        return jsonify({"error": "빈 파일입니다."}), 400

    # 임시 저장 후 파싱
    unique_name = _make_unique_filename(file_storage.filename)
    save_path = UPLOAD_DIR / unique_name
    with save_path.open("wb") as f:
        f.write(payload)

    try:
        blocks = parse_exam_pdf(str(save_path))
    except Exception as e:
        return jsonify({"error": f"PDF 파싱 오류: {e}"}), 500

    return jsonify({
        "pdf_filename": unique_name,
        "blocks": blocks,
        "total": len(blocks),
    })


@app.route("/exam/save", methods=["POST"])
def exam_save() -> Any:
    """
    선택된 지문 블록을 시험지로 저장합니다.
    클라이언트는 선택된 블록 목록과 각 문장의 힌트를 전송합니다.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON 데이터가 필요합니다."}), 400

    required = ("title", "passages")
    for field in required:
        if field not in data:
            return jsonify({"error": f"'{field}' 필드가 필요합니다."}), 400

    exam_id = hashlib.sha1(os.urandom(16)).hexdigest()[:12]
    exam_data = {
        "exam_id": exam_id,
        "title": data["title"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "passages": data["passages"],  # [{passage_id, text, sentences, questions}]
    }

    # 시험지 데이터를 JSON 파일로 저장 (Firebase 연동 전 로컬 스토리지)
    exams_dir = BASE_DIR / "data" / "exams"
    exams_dir.mkdir(parents=True, exist_ok=True)
    exam_path = exams_dir / f"{exam_id}.json"

    import json
    with exam_path.open("w", encoding="utf-8") as f:
        json.dump(exam_data, f, ensure_ascii=False, indent=2)

    return jsonify({"exam_id": exam_id, "message": "시험지가 저장되었습니다."})


@app.route("/exam/<exam_id>")
def exam_detail(exam_id: str) -> str:
    """시험지 상세 페이지 (직독직해 시작)"""
    import json
    import re
    # exam_id 값 검증: 영숫자만 허용
    if not re.fullmatch(r'[a-f0-9]{12}', exam_id):
        return render_template("exam_list.html"), 404
    exam_path = BASE_DIR / "data" / "exams" / f"{exam_id}.json"
    if not exam_path.exists():
        return render_template("exam_list.html"), 404
    with exam_path.open(encoding="utf-8") as f:
        exam = json.load(f)
    return render_template("reading.html", exam=exam)


@app.route("/exam/list-json")
def exam_list_json() -> Any:
    """저장된 시험지 목록을 JSON으로 반환"""
    import json
    exams_dir = BASE_DIR / "data" / "exams"
    exams_dir.mkdir(parents=True, exist_ok=True)
    exams = []
    for path in sorted(exams_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        exams.append({
            "exam_id": data["exam_id"],
            "title": data["title"],
            "created_at": data["created_at"],
            "passage_count": len(data.get("passages", [])),
        })
    return jsonify(exams)


@app.route("/evaluate-translation", methods=["POST"])
def evaluate_translation() -> Any:
    """
    학생의 번역을 평가합니다.
    """
    from evaluator import evaluate

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON 데이터가 필요합니다."}), 400

    english = data.get("english", "")
    korean = data.get("korean", "")
    model_answer = data.get("model_answer", "")

    if not english:
        return jsonify({"error": "'english' 필드가 필요합니다."}), 400

    result = evaluate(english, korean, model_answer)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
