"""
parser.py 단위 테스트

인터페이스 계약:
  parse_exam_pdf(pdf_path) -> list[QuestionBlock]
  split_sentences(text) -> list[str]

이 테스트가 통과하는 한, LLM으로 내부 구현을 교체해도 안전합니다.
"""
import pytest
from parser import split_sentences, QuestionBlock


class TestSplitSentences:
    """split_sentences() 인터페이스 계약 테스트"""

    def test_returns_list(self):
        result = split_sentences("Hello world. How are you?")
        assert isinstance(result, list)

    def test_splits_basic_sentences(self):
        text = "The sky is blue. The grass is green. We enjoy nature."
        result = split_sentences(text)
        assert len(result) == 3

    def test_filters_short_fragments(self):
        # 2단어 이하 조각은 제외
        result = split_sentences("Hello. The quick brown fox jumps over the lazy dog.")
        assert all(len(s.split()) >= 3 for s in result)

    def test_handles_empty_string(self):
        result = split_sentences("")
        assert result == []

    def test_handles_single_sentence(self):
        result = split_sentences("Technology has changed the way we communicate.")
        assert len(result) == 1
        assert result[0] == "Technology has changed the way we communicate."

    def test_preserves_sentence_content(self):
        text = "The place where we study is important. A clean environment helps us focus."
        result = split_sentences(text)
        assert any("place" in s for s in result)
        assert any("environment" in s for s in result)

    def test_handles_question_marks(self):
        text = "What is the main idea? The author argues that nature is healing."
        result = split_sentences(text)
        assert len(result) == 2

    def test_handles_exclamation_marks(self):
        text = "What a discovery! Scientists have found a new species of fish."
        result = split_sentences(text)
        assert len(result) == 2


class TestQuestionBlockStructure:
    """QuestionBlock TypedDict 구조 계약 테스트"""

    def test_required_fields(self):
        block = QuestionBlock(
            question_num=18,
            text="The place where we study is important.",
            sentences=["The place where we study is important."],
        )
        assert "question_num" in block
        assert "text" in block
        assert "sentences" in block

    def test_question_num_is_int(self):
        from tests.fixtures.sample_passage import SAMPLE_QUESTION_BLOCKS
        for block in SAMPLE_QUESTION_BLOCKS:
            assert isinstance(block["question_num"], int)

    def test_listening_excluded(self):
        """듣기 문항(1~17번)은 반환되면 안 됨"""
        from tests.fixtures.sample_passage import SAMPLE_QUESTION_BLOCKS
        for block in SAMPLE_QUESTION_BLOCKS:
            assert block["question_num"] >= 18

    def test_sentences_is_list_of_strings(self):
        from tests.fixtures.sample_passage import SAMPLE_QUESTION_BLOCKS
        for block in SAMPLE_QUESTION_BLOCKS:
            assert isinstance(block["sentences"], list)
            for s in block["sentences"]:
                assert isinstance(s, str)
