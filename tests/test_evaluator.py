"""
evaluator.py 단위 테스트

인터페이스 계약:
  evaluate(english, korean, model_answer) -> EvaluationResult
  EvaluationResult = {passed: bool, score: float, feedback: str}

이 테스트가 통과하는 한, LLM으로 내부 구현을 교체해도 안전합니다.
"""
import pytest
from evaluator import evaluate, EvaluationResult
from tests.fixtures.sample_passage import EVALUATION_CASES


class TestEvaluateInterface:
    """evaluate() 반환 타입 계약 테스트"""

    def test_returns_dict_with_required_keys(self):
        result = evaluate(
            english="The place where we study is important.",
            korean="우리가 공부하는 장소는 중요하다.",
            model_answer="우리가 공부하는 장소는 중요하다.",
        )
        assert "passed" in result
        assert "score" in result
        assert "feedback" in result

    def test_passed_is_bool(self):
        result = evaluate("Hello world.", "안녕 세계.", "안녕 세계.")
        assert isinstance(result["passed"], bool)

    def test_score_is_float_between_0_and_1(self):
        result = evaluate("Hello world.", "안녕 세계.", "안녕 세계.")
        assert isinstance(result["score"], float)
        assert 0.0 <= result["score"] <= 1.0

    def test_feedback_is_string(self):
        result = evaluate("Hello world.", "안녕 세계.", "안녕 세계.")
        assert isinstance(result["feedback"], str)
        assert len(result["feedback"]) > 0


class TestEvaluatePassFail:
    """번역 pass/fail 판정 로직 테스트"""

    def test_good_translation_passes(self):
        case = EVALUATION_CASES[0]
        for good in case["good_translations"]:
            result = evaluate(case["english"], good, case["model_answer"])
            assert result["passed"] is True, f"'{good}' should pass but failed"

    def test_bad_translation_fails(self):
        case = EVALUATION_CASES[0]
        for bad in case["bad_translations"]:
            if bad == "":
                continue  # 빈 문자열은 별도 테스트
            result = evaluate(case["english"], bad, case["model_answer"])
            assert result["passed"] is False, f"'{bad}' should fail but passed"

    def test_empty_translation_fails(self):
        result = evaluate(
            "The place where we study is important.",
            "",
            "우리가 공부하는 장소는 중요하다.",
        )
        assert result["passed"] is False
        assert result["score"] == 0.0

    def test_whitespace_only_fails(self):
        result = evaluate(
            "The place where we study is important.",
            "   ",
            "우리가 공부하는 장소는 중요하다.",
        )
        assert result["passed"] is False

    def test_exact_match_passes(self):
        model = "우리가 공부하는 장소는 중요하다."
        result = evaluate("The place where we study is important.", model, model)
        assert result["passed"] is True
        assert result["score"] == 1.0

    def test_completely_wrong_fails(self):
        result = evaluate(
            "The place where we study is important.",
            "오늘 날씨는 매우 맑고 화창합니다.",
            "우리가 공부하는 장소는 중요하다.",
        )
        assert result["passed"] is False


class TestEvaluateEdgeCases:
    """엣지 케이스 테스트"""

    def test_no_model_answer_passes_by_default(self):
        # 참고 번역이 없으면 관대하게 통과
        result = evaluate("Hello.", "안녕.", "")
        assert result["passed"] is True

    def test_second_evaluation_case(self):
        case = EVALUATION_CASES[1]
        for good in case["good_translations"]:
            result = evaluate(case["english"], good, case["model_answer"])
            assert result["passed"] is True, f"'{good}' should pass"
