"""
llm.py — Claude API 연동 모듈

공개 함수:
  parse_pdf_with_claude(pdf_path) → 수능 PDF에서 20~24번 지문 추출 (Vision API)
  generate_chunks(sentence)       → 문장을 의미 단위 청크로 분리 + 각 청크 번역
  generate_model_answer(sentence) → 문장 전체 직독직해 모범 번역
  evaluate_with_llm(english, chunk, korean) → 학생 번역 LLM 채점

LLM 교체 포인트:
  이 파일 전체를 다른 LLM 구현으로 교체해도 됩니다.
  반환 타입(ChunkItem, EvaluationResult)은 변경하지 마세요.
"""
from __future__ import annotations

import base64
import json
import os
import re
from typing import TypedDict

from evaluator import EvaluationResult


# ---------------------------------------------------------------------------
# 타입 정의
# ---------------------------------------------------------------------------

class ChunkItem(TypedDict):
    english: str   # 청크 원문
    korean: str    # 직독직해 번역


# ---------------------------------------------------------------------------
# 모델 상수 (교체 시 이 부분만 변경)
# ---------------------------------------------------------------------------
_PDF_MODEL    = "claude-opus-4-5"   # PDF 파싱: Vision 지원 모델
_CHUNK_MODEL  = "claude-opus-4-5"   # 청크 분리: 정확도 우선
_ANSWER_MODEL = "claude-haiku-4-5"  # 모범 번역: 속도 우선
_EVAL_MODEL   = "claude-haiku-4-5"  # 번역 평가: 속도 우선


# ---------------------------------------------------------------------------
# 클라이언트 싱글턴
# ---------------------------------------------------------------------------
_client = None


def _get_client():
    """싱글턴 패턴으로 Anthropic 클라이언트를 재사용합니다."""
    global _client
    if _client is None:
        try:
            from anthropic import Anthropic
        except ImportError:
            raise ImportError(
                "anthropic 패키지가 필요합니다: pip install anthropic"
            )
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. "
                ".env 파일 또는 환경변수를 확인하세요."
            )
        _client = Anthropic(api_key=api_key)
    return _client


# ---------------------------------------------------------------------------
# 프롬프트 상수
# ---------------------------------------------------------------------------

_CHUNK_SYSTEM = (
    "당신은 수능 영어 직독직해 전문 교사입니다. "
    "영어 문장을 의미 단위(청크/구)로 나누고 각 청크의 직독직해 번역을 제공합니다. "
    "반드시 JSON 배열만 반환하세요. 다른 텍스트나 마크다운 코드블록은 절대 포함하지 마세요."
)

_CHUNK_USER_TMPL = (
    "다음 영어 문장을 의미 단위(청크)로 나눠주세요.\n"
    "각 청크는 2~7단어 정도로 구성하고, 전체 3~7개 청크가 되도록 하세요.\n"
    "각 청크에 직독직해 한국어 번역을 붙여주세요.\n\n"
    "문장: {sentence}\n\n"
    "형식 (JSON 배열만):\n"
    '[{{"english":"청크 원문","korean":"직독직해 번역"}},...]'
)

_ANSWER_SYSTEM = (
    "수능 영어 직독직해 교사입니다. "
    "학생 수준에 맞는 직독직해 번역을 제공합니다. "
    "번역문만 반환하세요. 다른 설명은 포함하지 마세요."
)

_ANSWER_USER_TMPL = "다음 영어 문장을 직독직해로 번역하세요 (한국어만 반환):\n{sentence}"

_EVAL_SYSTEM = (
    "수능 영어 직독직해 평가 교사입니다. "
    "학생의 번역이 핵심 의미를 전달하면 passed=true입니다. "
    "완벽한 번역이 아니어도 됩니다. 의미가 대략 통하면 통과입니다. "
    "반드시 JSON만 반환하세요: "
    '{{"passed":bool,"score":float,"feedback":"str"}}'
)

_EVAL_USER_TMPL = (
    "영어 청크: {chunk}\n"
    "학생 번역: {korean}\n\n"
    "채점 기준:\n"
    "- score 0.8 이상: 의미가 정확히 전달됨 (passed=true)\n"
    "- score 0.5~0.8: 대략적 의미 전달 (passed=true)\n"
    "- score 0.5 미만: 의미 전달 실패 (passed=false)\n"
    "- feedback: 한국어 1~2문장 피드백 (오답이면 올바른 번역 포함)\n\n"
    "JSON만 반환:"
)

# PDF 파싱용 프롬프트 (Claude Vision)
_PDF_PARSE_PROMPT = (
    "이 수능 영어 시험지에서 20번, 21번, 22번, 23번, 24번 독해 지문의 영어 원문만 추출하세요.\n"
    "반드시 다음 규칙을 지키세요:\n"
    "- 각주(예: * stimulation: 자극)는 포함하지 마세요\n"
    "- 보기(①②③④⑤)가 있는 줄은 포함하지 마세요\n"
    "- [3점] 같은 점수 표시는 제거하세요\n"
    "- 한글 지시문(예: '다음 글의 목적으로 가장 적절한 것은?')은 포함하지 마세요\n"
    "- 영어 지문 본문 텍스트만 추출하세요\n"
    "- 각 문제 번호(20~24)와 해당 지문을 JSON 배열로 반환하세요\n\n"
    "반환 형식 (JSON 배열만, 다른 텍스트 없음):\n"
    '[{"question_num": 20, "text": "영어 지문 전체 텍스트..."}, ...]'
)


# ---------------------------------------------------------------------------
# 내부 유틸리티
# ---------------------------------------------------------------------------

def _strip_code_fence(raw: str) -> str:
    """마크다운 코드블록(```json ... ```) 제거."""
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    return cleaned


def _parse_chunk_response(raw: str, sentence: str) -> list[ChunkItem]:
    """Claude 응답에서 ChunkItem 리스트를 파싱합니다. 실패 시 단일 청크로 fallback."""
    cleaned = _strip_code_fence(raw)
    # 직접 파싱 시도
    try:
        data = json.loads(cleaned)
        if isinstance(data, list) and len(data) > 0:
            return [ChunkItem(english=str(c.get("english", "")), korean=str(c.get("korean", ""))) for c in data]
    except json.JSONDecodeError:
        pass
    # [...] 블록만 추출 시도
    m = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group())
            if isinstance(data, list) and len(data) > 0:
                return [ChunkItem(english=str(c.get("english", "")), korean=str(c.get("korean", ""))) for c in data]
        except json.JSONDecodeError:
            pass
    # fallback: 문장 전체를 단일 청크로
    return [ChunkItem(english=sentence, korean="")]


def _parse_eval_response(raw: str) -> dict:
    """Claude 평가 응답에서 JSON을 파싱합니다."""
    cleaned = _strip_code_fence(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return {}


# ---------------------------------------------------------------------------
# 공개 함수
# ---------------------------------------------------------------------------

def parse_pdf_with_claude(pdf_path: str) -> list:
    """
    수능 영어 PDF를 Claude Vision API로 파싱하여 20~24번 지문을 추출합니다.

    Parameters
    ----------
    pdf_path : str
        업로드된 PDF 파일 경로

    Returns
    -------
    list[QuestionBlock]
        파싱된 문항 블록 목록 (question_num, text, sentences)
        실패 시 예외를 raise → parser.py에서 pdfplumber fallback으로 처리
    """
    import logging
    logger = logging.getLogger(__name__)

    # 순환 import 방지: 함수 내부에서 import
    from parser import QuestionBlock, split_sentences

    client = _get_client()

    with open(pdf_path, "rb") as f:
        pdf_b64 = base64.standard_b64encode(f.read()).decode("utf-8")

    logger.info("Claude Vision PDF 파싱 시작: %s (모델: %s)", pdf_path, _PDF_MODEL)

    response = client.messages.create(
        model=_PDF_MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_b64,
                    },
                },
                {"type": "text", "text": _PDF_PARSE_PROMPT},
            ],
        }],
    )

    raw = response.content[0].text
    logger.debug("Claude Vision 응답 앞 300자: %s", raw[:300])
    cleaned = _strip_code_fence(raw)

    # JSON 파싱
    data = None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group())
            except json.JSONDecodeError:
                pass

    if not isinstance(data, list):
        logger.warning("Claude Vision 응답이 JSON 배열이 아님: %s", cleaned[:200])
        return []

    blocks = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if "question_num" not in item or "text" not in item:
            continue
        try:
            num = int(item["question_num"])
        except (ValueError, TypeError):
            continue
        if not (20 <= num <= 24):
            continue
        text = str(item["text"]).strip()
        if not text:
            continue
        blocks.append(QuestionBlock(
            question_num=num,
            text=text,
            sentences=split_sentences(text),
        ))

    logger.info("Claude Vision으로 추출된 블록: %d개", len(blocks))
    return sorted(blocks, key=lambda b: b["question_num"])


def generate_chunks(sentence: str) -> list[ChunkItem]:
    """
    영어 문장 하나를 의미 단위 청크로 분리하고, 각 청크의 직독직해 번역을 반환합니다.

    Parameters
    ----------
    sentence : str
        청크로 분리할 영어 문장

    Returns
    -------
    list[ChunkItem]
        [{"english": "청크 원문", "korean": "직독직해 번역"}, ...]
        실패 시 단일 청크 [{"english": sentence, "korean": ""}] 반환
    """
    if not sentence or not sentence.strip():
        return [ChunkItem(english=sentence, korean="")]

    try:
        client = _get_client()
        response = client.messages.create(
            model=_CHUNK_MODEL,
            max_tokens=512,
            system=_CHUNK_SYSTEM,
            messages=[{
                "role": "user",
                "content": _CHUNK_USER_TMPL.format(sentence=sentence),
            }],
        )
        raw = response.content[0].text
        return _parse_chunk_response(raw, sentence)
    except Exception:
        return [ChunkItem(english=sentence, korean="")]


def generate_model_answer(sentence: str) -> str:
    """
    영어 문장의 직독직해 모범 번역을 생성합니다.

    Parameters
    ----------
    sentence : str
        번역할 영어 문장

    Returns
    -------
    str
        한국어 직독직해 번역 (실패 시 빈 문자열)
    """
    if not sentence or not sentence.strip():
        return ""

    try:
        client = _get_client()
        response = client.messages.create(
            model=_ANSWER_MODEL,
            max_tokens=200,
            system=_ANSWER_SYSTEM,
            messages=[{
                "role": "user",
                "content": _ANSWER_USER_TMPL.format(sentence=sentence),
            }],
        )
        return response.content[0].text.strip().strip('"').strip("'")
    except Exception:
        return ""


def evaluate_with_llm(english: str, chunk: str, korean: str) -> EvaluationResult:
    """
    학생의 청크 번역을 Claude로 채점합니다.

    Parameters
    ----------
    english : str
        원문 영어 문장 (컨텍스트용)
    chunk : str
        현재 평가할 영어 청크
    korean : str
        학생이 입력한 한국어 번역

    Returns
    -------
    EvaluationResult
        {"passed": bool, "score": float, "feedback": str}
    """
    if not korean or not korean.strip():
        return EvaluationResult(passed=False, score=0.0, feedback="번역을 입력해 주세요.")

    try:
        client = _get_client()
        response = client.messages.create(
            model=_EVAL_MODEL,
            max_tokens=256,
            system=_EVAL_SYSTEM,
            messages=[{
                "role": "user",
                "content": _EVAL_USER_TMPL.format(chunk=chunk, korean=korean),
            }],
        )
        raw = response.content[0].text
        data = _parse_eval_response(raw)

        passed = bool(data.get("passed", False))
        score = float(data.get("score", 0.0))
        score = max(0.0, min(1.0, score))
        feedback = str(data.get("feedback", ""))
        return EvaluationResult(passed=passed, score=round(score, 2), feedback=feedback)

    except Exception as e:
        # LLM 실패 시 fallback (evaluator.py의 키워드 매칭)
        raise  # 상위 호출자가 fallback 처리
