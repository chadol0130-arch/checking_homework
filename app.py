from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Tuple

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

# --- Paths / Storage ---
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
STATE_DIR = BASE_DIR / "data"
STATE_FILE = STATE_DIR / "state.json"

UPLOAD_DIR.mkdir(exist_ok=True)
STATE_DIR.mkdir(exist_ok=True)


@dataclass(frozen=True)
class EvaluationResult:
    score: int
    feedback: str
    gained_xp: int


@app.route("/")
def index() -> str:
    # 현재 누적 상태도 같이 보여주기 위해 전달
    state = _load_state()
    return render_template("index.html", state=state)


@app.route("/uploads/<path:filename>")
def uploaded_file(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


def _score_from_bytes(payload: bytes) -> int:
    if not payload:
        return 0
    digest = hashlib.sha256(payload).hexdigest()
    return int(digest[:2], 16) % 101


def _feedback_for_score(score: int) -> str:
    if score >= 90:
        return "완벽해요! 풀이 과정도 아주 명확합니다."
    if score >= 70:
        return "좋아요! 몇 군데만 조금 더 확인하면 더 좋아질 거예요."
    if score >= 50:
        return "기본은 잘했어요. 핵심 공식을 다시 한번 확인해 봅시다."
    return "조금만 더 집중해서 풀어 볼까요? 힌트는 차근차근 확인해요."


def _gained_xp_from_score(score: int) -> int:
    # 제출 1회 기본 보상 + 성과 보상
    return 10 + score


def _level_from_total_xp(total_xp: int) -> int:
    # 누적 경험치 기준 레벨업 (원하는 대로 수정 가능)
    thresholds = [0, 50, 120, 200, 300, 420, 560, 720, 900]
    # thresholds: 레벨 1 시작, total_xp가 커질수록 레벨 상승
    level = 1
    for cutoff in thresholds:
        if total_xp >= cutoff:
            level += 1
    return max(1, level - 1)


def _allowed_file(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in {".png", ".jpg", ".jpeg", ".webp"}


def _load_state() -> Dict[str, int]:
    if not STATE_FILE.exists():
        return {"total_xp": 0, "level": 1}
    try:
        with STATE_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        total_xp = int(data.get("total_xp", 0))
        level = int(data.get("level", 1))
        return {"total_xp": total_xp, "level": level}
    except Exception:
        return {"total_xp": 0, "level": 1}


def _save_state(total_xp: int, level: int) -> None:
    with STATE_FILE.open("w", encoding="utf-8") as f:
        json.dump({"total_xp": total_xp, "level": level}, f, ensure_ascii=False, indent=2)


def _evaluate_homework_bytes(payload: bytes) -> EvaluationResult:
    score = _score_from_bytes(payload)
    feedback = _feedback_for_score(score)
    gained_xp = _gained_xp_from_score(score)
    return EvaluationResult(score=score, feedback=feedback, gained_xp=gained_xp)


def _make_unique_filename(original_name: str) -> str:
    safe = secure_filename(original_name) or "upload"
    stem, ext = os.path.splitext(safe)
    # 간단 유니크: 파일 내용 해시 일부 + 원래 확장자
    # (payload 해시를 쓰고 싶다면 upload에서 만든 digest를 넘겨도 됨)
    return f"{stem}_{hashlib.sha1(os.urandom(16)).hexdigest()[:10]}{ext}"


@app.route("/upload", methods=["POST"])
def upload() -> Any:
    if "photo" not in request.files:
        return jsonify({"error": "사진 파일이 필요합니다."}), 400

    file_storage = request.files["photo"]
    if file_storage.filename == "":
        return jsonify({"error": "파일 이름이 비어 있습니다."}), 400

    if not _allowed_file(file_storage.filename):
        return jsonify({"error": "이미지 파일만 업로드할 수 있습니다."}), 400

    # 1) 바이트를 한 번 읽어서 평가 + 저장 모두에 사용
    payload = file_storage.read()
    if not payload:
        return jsonify({"error": "빈 파일입니다."}), 400

    result = _evaluate_homework_bytes(payload)

    # 2) 업로드 파일 저장
    unique_name = _make_unique_filename(file_storage.filename)
    save_path = UPLOAD_DIR / unique_name
    with save_path.open("wb") as f:
        f.write(payload)

    # 3) 누적 상태 업데이트
    state = _load_state()
    total_xp = state["total_xp"] + result.gained_xp
    level = _level_from_total_xp(total_xp)
    _save_state(total_xp=total_xp, level=level)

    return jsonify(
        {
            "score": result.score,
            "feedback": result.feedback,
            "gained_xp": result.gained_xp,
            "total_xp": total_xp,
            "level": level,
            "image_url": f"/uploads/{unique_name}",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
