"""
evaluator.py — 직독직해 번역 평가 엔진

LLM 교체 포인트:
  evaluate() 함수만 교체하면 됩니다.
  반환 타입(EvaluationResult)은 변경하지 마세요.
"""
from __future__ import annotations

import re
from typing import TypedDict


class EvaluationResult(TypedDict):
    passed: bool
    score: float   # 0.0 ~ 1.0
    feedback: str


# 번역 pass에 필요한 키워드 매칭 비율 (0~1). 낮을수록 관대함.
PASS_THRESHOLD = 0.5


def evaluate(
    english: str,
    korean: str,
    model_answer: str,
) -> EvaluationResult:
    """
    학생의 한국어 번역을 평가합니다.

    "직독직해" 기준:
    - 완벽한 의역이 아니어도 됨
    - 핵심 의미가 보존되면 pass
    - 의미가 완전히 달라지면 fail

    Parameters
    ----------
    english : str
        원문 영어 문장
    korean : str
        학생이 입력한 한국어 번역
    model_answer : str
        참고 번역 (선생님이 등록하거나 추후 LLM 생성)

    Returns
    -------
    EvaluationResult
        {
            "passed": bool,
            "score": float,   # 0.0 ~ 1.0
            "feedback": str
        }
    """
    if not korean or not korean.strip():
        return EvaluationResult(
            passed=False,
            score=0.0,
            feedback="번역을 입력해 주세요.",
        )

    # LLM 평가 우선 시도 (ANTHROPIC_API_KEY 없거나 실패 시 키워드 매칭 fallback)
    try:
        from llm import evaluate_with_llm
        return evaluate_with_llm(english, chunk=english, korean=korean)
    except Exception:
        pass

    # Fallback: 키워드 매칭 룰베이스
    if model_answer and model_answer.strip():
        # 참고 번역이 있으면 키워드 매칭
        score = _keyword_match_score(model_answer, korean)
        passed = score >= PASS_THRESHOLD
    else:
        # 참고 번역이 없으면 기본 품질 체크 (LLM 없이는 정확한 채점 불가)
        korean_chars = sum(1 for c in korean if "\uAC00" <= c <= "\uD7A3")
        word_count = len(korean.split())
        if word_count >= 3 and korean_chars >= 4:
            score = 0.6   # 최소한 길이와 한글 조건 충족
            passed = True
        else:
            score = 0.2
            passed = False

    feedback = _build_feedback(passed, score, english, model_answer)
    return EvaluationResult(passed=passed, score=round(score, 2), feedback=feedback)


# ---------------------------------------------------------------------------
# 내부 함수 — LLM 탑재 시 evaluate()만 교체하면 이 함수들은 그대로 유지됩니다
# ---------------------------------------------------------------------------

def _extract_keywords(text: str) -> list[str]:
    """
    텍스트에서 의미 있는 키워드를 추출합니다.
    조사/어미 등 1~2글자 단어는 제외합니다.
    """
    tokens = re.split(r'[\s,.!?~·]+', text.strip())
    return [t for t in tokens if len(t) >= 2]


def _stem(word: str) -> str:
    """
    한국어 단어에서 조사/어미를 제거한 어근을 반환합니다.
    끝 1~2글자를 제거해 어근을 추출하는 간단한 휴리스틱을 사용합니다.
    3글자 미만은 그대로 반환합니다.
    """
    if len(word) <= 2:
        return word
    return word[:-1]  # 조사 1글자 제거


def _keyword_match_score(model_answer: str, student_answer: str) -> float:
    """
    model_answer의 키워드 중 student_answer에 포함된 비율을 반환합니다.
    어근 매칭을 사용해 조사 차이를 허용합니다.
    """
    ref_keywords = _extract_keywords(model_answer)
    if not ref_keywords:
        return 1.0  # 참고 번역이 없으면 통과 처리

    def _is_matched(kw: str) -> bool:
        # 정확 매칭 또는 어근 매칭
        return kw in student_answer or _stem(kw) in student_answer

    matched = sum(1 for kw in ref_keywords if _is_matched(kw))
    return matched / len(ref_keywords)


def _build_feedback(
    passed: bool,
    score: float,
    english: str,
    model_answer: str,
) -> str:
    if passed:
        if score >= 0.8:
            return "훌륭해요! 핵심 의미를 모두 잡았어요."
        return "좋아요! 대략적인 의미는 맞았어요."
    else:
        return f"다시 도전해 보세요. 참고 번역: {model_answer}"
