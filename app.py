from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from typing import Any

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


@dataclass(frozen=True)
class EvaluationResult:
    score: int
    feedback: str
    experience: int
    level: int


@app.route("/")
def index() -> str:
    return render_template("index.html")


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


def _experience_from_score(score: int) -> int:
    return 10 + score


def _level_from_experience(experience: int) -> int:
    thresholds = [0, 50, 120, 200, 300, 420, 560]
    for index, cutoff in enumerate(thresholds, start=1):
        if experience < cutoff:
            return max(1, index - 1)
    return len(thresholds)


def _evaluate_homework(file_storage: Any) -> EvaluationResult:
    payload = file_storage.read()
    score = _score_from_bytes(payload)
    feedback = _feedback_for_score(score)
    experience = _experience_from_score(score)
    level = _level_from_experience(experience)
    return EvaluationResult(score=score, feedback=feedback, experience=experience, level=level)


@app.route("/upload", methods=["POST"])
def upload() -> Any:
    if "photo" not in request.files:
        return jsonify({"error": "사진 파일이 필요합니다."}), 400

    file_storage = request.files["photo"]
    if file_storage.filename == "":
        return jsonify({"error": "파일 이름이 비어 있습니다."}), 400

    if not _allowed_file(file_storage.filename):
        return jsonify({"error": "이미지 파일만 업로드할 수 있습니다."}), 400

    result = _evaluate_homework(file_storage)
    return jsonify(
        {
            "score": result.score,
            "feedback": result.feedback,
            "experience": result.experience,
            "level": result.level,
        }
    )


def _allowed_file(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in {".png", ".jpg", ".jpeg", ".webp"}


if __name__ == "__main__":
    app.run(debug=True)
