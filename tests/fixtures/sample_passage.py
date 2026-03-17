"""
테스트용 샘플 데이터 픽스처
실제 수능 지문과 유사한 구조로 구성
"""

# 샘플 파싱 결과 — parse_exam_pdf()가 이 형태를 반환해야 함
SAMPLE_QUESTION_BLOCKS = [
    {
        "question_num": 18,
        "text": (
            "The place where we study is important. "
            "A clean and quiet environment helps us focus. "
            "Students who study in organized spaces tend to perform better."
        ),
        "sentences": [
            "The place where we study is important.",
            "A clean and quiet environment helps us focus.",
            "Students who study in organized spaces tend to perform better.",
        ],
    },
    {
        "question_num": 19,
        "text": (
            "Technology has changed the way we communicate. "
            "People now send messages instantly across the world. "
            "This has both positive and negative effects on society."
        ),
        "sentences": [
            "Technology has changed the way we communicate.",
            "People now send messages instantly across the world.",
            "This has both positive and negative effects on society.",
        ],
    },
]

# 샘플 문장 평가 케이스
EVALUATION_CASES = [
    {
        "english": "The place where we study is important.",
        "model_answer": "우리가 공부하는 장소는 중요하다.",
        "good_translations": [
            "우리가 공부하는 장소는 중요하다.",
            "우리가 공부하는 그 장소는 중요합니다.",
            "공부하는 장소가 중요하다.",
        ],
        "bad_translations": [
            "날씨가 맑고 화창하다.",
            "우리는 오늘 점심을 먹었다.",
            "",
        ],
    },
    {
        "english": "A clean and quiet environment helps us focus.",
        "model_answer": "깨끗하고 조용한 환경은 우리가 집중하는 데 도움이 된다.",
        "good_translations": [
            "깨끗하고 조용한 환경은 집중하는 데 도움이 된다.",
            "깨끗하고 조용한 환경이 우리의 집중을 돕는다.",
        ],
        "bad_translations": [
            "음악은 우리를 즐겁게 한다.",
        ],
    },
]
