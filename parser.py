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


# ---------------------------------------------------------------------------
# 필터링 패턴 — 각주·보기·점수 제거
# ---------------------------------------------------------------------------
# * yearn: 갈망하다  /  ** rubric: 항목  형태의 각주 줄
_FOOTNOTE_LINE  = re.compile(r"^\*{1,2}\s*\S")
# ①②③④⑤ 원문자를 포함하는 줄 (보기)
_CIRCLED_NUMBER = re.compile(r"[①②③④⑤]")
# [3점] [2점] 등 점수 표시 (인라인 제거)
_SCORE_MARK     = re.compile(r"\[\d점\]")


class QuestionBlock(TypedDict):
    question_num: int
    text: str        # 추출된 원문 텍스트
    sentences: list[str]  # 문장 단위로 분리된 리스트


def parse_exam_pdf(pdf_path: str) -> list[QuestionBlock]:
    """
    수능 영어 PDF를 파싱하여 독해 지문 블록 목록을 반환합니다.

    - 20~24번 독해 지문만 추출
    - Claude Vision API 우선 → pdfplumber fallback

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
    import logging
    logger = logging.getLogger(__name__)

    # Claude Vision API 우선 시도 (이미지 기반 PDF도 처리 가능)
    try:
        from llm import parse_pdf_with_claude
        blocks = parse_pdf_with_claude(pdf_path)
        if blocks:
            logger.info("Claude Vision으로 %d개 블록 추출 성공", len(blocks))
            return blocks
        logger.warning("Claude Vision이 빈 결과 반환 → pdfplumber fallback")
    except Exception as e:
        logger.warning("Claude Vision 실패 (%s) → pdfplumber fallback", e)

    # pdfplumber fallback (텍스트 기반 PDF 전용)
    try:
        import pdfplumber  # noqa: F401
    except ImportError:
        raise ImportError("pdfplumber 패키지가 필요합니다: pip install pdfplumber")

    raw_text = _extract_text_from_pdf(pdf_path)
    logger.debug("pdfplumber 추출 텍스트 앞 500자:\n%s", raw_text[:500])

    blocks = _split_into_question_blocks(raw_text)
    logger.info("전체 블록 수: %d, 번호 목록: %s",
                len(blocks), [b["question_num"] for b in blocks])

    reading_blocks = [b for b in blocks if 20 <= b["question_num"] <= 24]
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
    """
    PDF에서 전체 텍스트를 추출합니다.
    두 단 레이아웃(수능 시험지)을 고려해 왼쪽/오른쪽 열을 분리하여 추출합니다.
    """
    import pdfplumber

    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            if not words:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
                continue

            # 페이지 중앙을 기준으로 왼쪽/오른쪽 열 분리
            midpoint = page.width / 2
            left_words  = [w for w in words if w["x0"] < midpoint]
            right_words = [w for w in words if w["x0"] >= midpoint]

            def _words_to_text(word_list: list) -> str:
                if not word_list:
                    return ""
                # y 좌표 기준으로 줄 단위 묶기 (5pt 허용 오차)
                sorted_words = sorted(word_list, key=lambda w: (round(w["top"] / 5) * 5, w["x0"]))
                lines: list[str] = []
                cur_y: float | None = None
                cur_line: list[str] = []
                for w in sorted_words:
                    line_y = round(w["top"] / 5) * 5
                    if cur_y is None or abs(line_y - cur_y) > 4:
                        if cur_line:
                            lines.append(" ".join(cur_line))
                        cur_line = [w["text"]]
                        cur_y = line_y
                    else:
                        cur_line.append(w["text"])
                if cur_line:
                    lines.append(" ".join(cur_line))
                return "\n".join(lines)

            combined = _words_to_text(left_words) + "\n" + _words_to_text(right_words)
            pages_text.append(combined)

    return "\n".join(pages_text)


def _split_into_question_blocks(text: str) -> list[QuestionBlock]:
    """
    추출된 텍스트를 문항 번호 단위로 분리합니다.
    수능 포맷 기준: '18.' '19.' ... '45.' 형태
    (점 뒤 공백 없이 한글이 바로 오는 경우도 처리: '18.다음 글의...')
    """
    # 문항 번호 패턴: 줄 시작 + 숫자 + 점 (뒤에 공백이나 한글 문자가 오는 경우)
    # \s? : 공백 없어도 매치, (?=\S) : 뭔가 이어지는 경우만
    pattern = re.compile(r'(?:^|\n)\s*(\d{1,2})\.(?=\s|\S)', re.MULTILINE)
    matches = list(pattern.finditer(text))

    if not matches:
        return []

    # 번호가 1~45 범위인 것만 필터 (페이지 번호 등 오탐 제거)
    matches = [m for m in matches if 1 <= int(m.group(1)) <= 45]

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

    제거 대상:
    - 한글 지시문 ('다음 글을 읽고...' 등, 한글 비율 30% 이상)
    - 각주 줄 (* yearn: 갈망하다, ** rubric: 항목 등)
    - 보기 줄 (①②③④⑤ 원문자 포함)
    - 점수 표시 ([3점], [2점] 등, 인라인 치환)
    """
    lines = text.splitlines()
    english_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # [1] 각주 줄 전체 제거 (* 또는 ** 로 시작)
        if _FOOTNOTE_LINE.match(stripped):
            continue
        # [2] 보기 원문자 포함 줄 제거
        if _CIRCLED_NUMBER.search(stripped):
            continue
        # [3] 점수 표시 인라인 제거 (줄 자체는 유지)
        stripped = _SCORE_MARK.sub("", stripped).strip()
        if not stripped:
            continue
        # [4] 한글로 시작하는 줄은 한국어 지시문으로 간주 (예: '밑줄 친 X이 다음 글에서...')
        if "\uAC00" <= stripped[0] <= "\uD7A3":
            continue
        # [5] 한글 비율이 30% 미만인 줄만 영어 지문으로 간주
        korean_chars = sum(1 for c in stripped if "\uAC00" <= c <= "\uD7A3")
        if len(stripped) > 0 and korean_chars / len(stripped) < 0.3:
            english_lines.append(stripped)
    return " ".join(english_lines)
