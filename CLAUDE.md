# Checking Homework — 아키텍처 가이드

기능을 추가할 때 이 파일을 먼저 읽고, **기존 계약(contract)을 깨지 않도록** 확인하세요.

---

## 핵심 데이터 계약 (절대 변경 금지)

### `QuestionBlock` — `parser.py`
```python
class QuestionBlock(TypedDict):
    question_num: int        # 문제 번호 (20~24)
    text: str                # 영어 지문 전체 텍스트
    sentences: list[str]     # 문장 단위로 분리된 리스트
```
- `parse_exam_pdf()` 반환 타입. LLM 교체 시 이 타입만 유지하면 됨.

### `ChunkItem` — `llm.py`
```python
class ChunkItem(TypedDict):
    english: str   # 청크 원문
    korean: str    # 직독직해 번역
```

### `EvaluationResult` — `evaluator.py`
```python
class EvaluationResult(TypedDict):
    passed: bool
    score: float   # 0.0 ~ 1.0
    feedback: str
```

### 시험지 JSON 스키마 — `data/exams/{exam_id}.json`
```json
{
  "exam_id": "12자리 hex",
  "title": "string",
  "created_at": "ISO8601",
  "passages": [
    {
      "passage_id": "string",
      "question_num": 20,
      "original_text": "지문 전체 텍스트",
      "sentences": [
        {
          "sentence_id": "20_0",
          "english": "문장 원문",
          "hints": [],
          "model_answer": "모범 번역",
          "chunks": [{"english": "청크", "korean": "번역"}, ...]
        }
      ],
      "comprehension_questions": []
    }
  ]
}
```

### 세션 JSON 스키마 — `data/sessions/{exam_id}_{session_id}.json`
```json
{
  "session_id": "string",
  "exam_id": "string",
  "created_at": "ISO8601",
  "total_xp": 0,
  "accuracy": 0.0,
  "session_log": [
    {
      "passageNum": 20,
      "sentenceIdx": 0,
      "english": "문장",
      "mode": "chunk",
      "chunks": [{"english":"청크","modelKorean":"모범","studentKorean":"학생","passed":true}],
      "allPassed": true
    }
  ]
}
```

---

## 모듈 역할 분담

| 파일 | 역할 | 교체 방법 |
|---|---|---|
| `parser.py` | PDF → QuestionBlock 변환 | `parse_exam_pdf()` 함수만 교체 |
| `llm.py` | Claude API 연동 (파싱/청크/평가) | 파일 전체 교체 가능, 반환 타입 유지 |
| `evaluator.py` | 번역 채점 | `evaluate()` 함수만 교체 |
| `app.py` | Flask 라우터 | 라우트 경로/응답 형식 유지 |
| `templates/reading.html` | 직독직해 UI | EXAM JSON 구조에 의존 |
| `templates/exam_list.html` | 시험지 관리 UI | `/exam/upload`, `/exam/save` API에 의존 |

---

## API 엔드포인트 목록

| Method | Path | 설명 |
|---|---|---|
| GET | `/exam` | 시험지 목록 페이지 |
| GET | `/exam/list-json` | 시험지 목록 JSON |
| POST | `/exam/upload` | PDF 업로드 + 지문 파싱 |
| POST | `/exam/save` | 선택된 지문 시험지로 저장 |
| GET | `/exam/<exam_id>` | 직독직해 연습 페이지 |
| POST | `/exam/<exam_id>/session` | 세션 결과 저장 |
| POST | `/exam/generate-chunks` | Claude 청크 + 번역 자동 생성 |
| POST | `/evaluate-translation` | 번역 채점 |

---

## 기능 추가 체크리스트

새 기능을 추가하기 전에 확인하세요:

- [ ] QuestionBlock / ChunkItem / EvaluationResult 타입 변경 없음
- [ ] 시험지 JSON 스키마에 **필드 추가**는 OK, **기존 필드 제거/타입 변경**은 NG
- [ ] `parse_exam_pdf()` 반환 타입 동일
- [ ] `/exam/upload` 응답 형식: `{pdf_filename, blocks, total}` 유지
- [ ] `/exam/save` 요청 형식: `{title, passages}` 유지
- [ ] `/evaluate-translation` 응답 형식: `{passed, score, feedback}` 유지
- [ ] `data/exams/` 디렉토리는 `.gitignore`에 포함됨 (민감 데이터)

---

## 중요 구현 노트

### PDF 파싱 흐름
```
parse_exam_pdf()
  └─ Claude Vision 우선 (parse_pdf_with_claude)
       └─ 실패/빈결과 시 pdfplumber fallback
            └─ _extract_text_from_pdf (2단 레이아웃 처리)
            └─ _split_into_question_blocks (정규식: r'\d{1,2}\.(?=\S|\s)')
            └─ _extract_english_passages (한글/각주/보기 필터)
```

### 직독직해 UI 화면 흐름
```
showPassage() → startReading() → renderSentence()
  ├─ isChunkMode() → renderChunkMode() → submitChunkTranslation() → advanceChunk()
  └─ (legacy) renderLegacyMode() → submitLegacyTranslation()
nextSentence() → [MCQ있으면 showMcq()] → moveToNextPassage() → showPassage() 또는 showDone()
showDone() → [세션 자동저장] → showReview() 가능
```

### 채점 흐름
```
evaluate(english, korean, model_answer)  # evaluator.py
  └─ evaluate_with_llm() 우선 시도       # llm.py
       └─ 실패 시 _keyword_match_score() fallback
```

### 모델 상수 (`llm.py`)
- `_PDF_MODEL = "claude-opus-4-6"` — PDF 파싱 (Vision 지원)
- `_CHUNK_MODEL = "claude-sonnet-4-6"` — 청크 분리
- `_ANSWER_MODEL = "claude-haiku-4-5-20251001"` — 모범 번역 (속도)
- `_EVAL_MODEL = "claude-haiku-4-5-20251001"` — 번역 평가 (속도)

---

## 테스트

```bash
cd checking_homework
pytest tests/ -v
```
24개 테스트 모두 통과해야 합니다. 기능 추가 후 반드시 실행하세요.
