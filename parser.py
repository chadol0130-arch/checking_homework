"""
parser.py — 수능 영어 시험 PDF 파서

LLM 교체 포인트:
  parse_exam_pdf() 함수만 교체하면 됩니다.
  반환 타입(list[QuestionBlock])은 변경하지 마세요.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import TypedDict


class QuestionBlock(TypedDict):
    question_num: int
    text: str        # 추출된 원문 텍스트
    sentences: list[str]  # 문장 단위로 분리된 리스트


def parse_exam_pdf(pdf_path: str) -> list[QuestionBlock]:
    """
    수능 영어 PDF를 파싱하여 독해 지문 블록 목록을 반환합니다.

    - 듣기 문항(1~17번) 자동 제외
    - 각 문항의 영어 지문 텍스트와 문장 목록을 포함

    Parameters
    ----------
    pdf_path : str
        업로드된 PDF 파일 경로

    Returns
    -------
    list[QuestionBlock]
        파싱된 문항 블록 목록. 각 항목:
        {
            "question_num": int,
            "text": str,
            "sentences": list[str]
        }
    """
    try:
        import pdfplumber
    except ImportError:
        raise ImportError("pdfplumber 패키지가 필요합니다: pip install pdfplumber")

    raw_text = _extract_text_from_pdf(pdf_path)
    blocks = _split_into_question_blocks(raw_text)
    reading_blocks = [b for b in blocks if b["question_num"] >= 18]
    for block in reading_blocks:
        block["sentences"] = split_sentences(block["text"])
    return reading_blocks


def split_sentences(text: str) -> list[str]:
    """
    영어 텍스트를 문장 단위로 분리합니다.

    Parameters
    ----------
    text : str
        분리할 영어 텍스트

    Returns
    -------
    list[str]
        문장 목록 (빈 항목 제외)
    """
    # 마침표/물음표/느낌표 뒤 공백+대문자 패턴으로 분리
    # 약어(Mr., Dr., etc.)를 오탐하지 않도록 최소 단어 길이 체크
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text.strip())
    result = []
    for s in sentences:
        s = s.strip()
        if s and len(s.split()) >= 3:  # 3단어 미만은 문장 아닌 것으로 간주
            result.append(s)
    return result


# ---------------------------------------------------------------------------
# 내부 함수 — LLM 탑재 시 아래 함수들을 교체합니다
# ---------------------------------------------------------------------------

def _extract_text_from_pdf(pdf_path: str) -> str:
    """PDF에서 전체 텍스트를 추출합니다."""
    import pdfplumber

    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
    return "\n".join(pages_text)


def _split_into_question_blocks(text: str) -> list[QuestionBlock]:
    """
    추출된 텍스트를 문항 번호 단위로 분리합니다.
    수능 포맷 기준: '18.' '19.' ... '45.' 형태
    """
    # 문항 번호 패턴: 줄 시작 또는 공백 후 숫자+점
    pattern = re.compile(r'(?:^|\n)\s*(\d{1,2})\.\s', re.MULTILINE)
    matches = list(pattern.finditer(text))

    if not matches:
        return []

    blocks: list[QuestionBlock] = []
    for i, match in enumerate(matches):
        num = int(match.group(1))
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block_text = text[start:end].strip()

        # 영어 문장만 추출 (한글 지시문 제거)
        english_text = _extract_english_passages(block_text)

        blocks.append(
            QuestionBlock(
                question_num=num,
                text=english_text,
                sentences=[],
            )
        )
    return blocks


def _extract_english_passages(text: str) -> str:
    """
    블록 텍스트에서 영어 지문 부분만 추출합니다.
    한글 지시문('다음 글을 읽고...' 등)은 제거합니다.
    """
    lines = text.splitlines()
    english_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # 한글 비율이 30% 미만인 줄만 영어 지문으로 간주
        korean_chars = sum(1 for c in stripped if '\uAC00' <= c <= '\uD7A3')
        if len(stripped) > 0 and korean_chars / len(stripped) < 0.3:
            english_lines.append(stripped)
    return " ".join(english_lines)
