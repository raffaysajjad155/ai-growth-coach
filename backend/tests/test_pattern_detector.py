from services.pattern_detector import categorize_feedback


def test_categorize_missing_error_handling():
    text = "This can lead to a runtime error if not handled with try except."
    assert categorize_feedback(text) == "missing_error_handling"


def test_categorize_no_input_validation():
    text = "The input value is invalid and not validated before use."
    assert categorize_feedback(text) == "no_input_validation"


def test_categorize_unknown_returns_uncategorized():
    text = "This code has a completely different problem not covered here."
    assert categorize_feedback(text) == "uncategorized"