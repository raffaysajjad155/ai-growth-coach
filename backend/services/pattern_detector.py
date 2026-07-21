import re
from collections import Counter
from datetime import datetime, timezone

TAXONOMY_KEYWORDS = {
    "missing_error_handling": ["error handling", "exception", "try", "except", "catch", "crash", "division by zero", "runtime error", "unexpected behavior"],
    "no_input_validation": ["validation", "validate", "null", "none", "missing check", "not found", "invalid", "invalid input", "invalid value"],
    "outdated_syntax": ["var", "outdated", "deprecated", "let", "const", "best practice"],
    "array_bounds_error": ["out-of-bounds", "out of bounds", "index", "bounds", "array size"],
    "inefficient_loop": ["inefficient", "nested loop", "o(n", "performance", "unnecessary"],
}


def categorize_feedback(why_it_is_wrong: str) -> str:
    text = why_it_is_wrong.lower()
    for category, keywords in TAXONOMY_KEYWORDS.items():
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, text):
                return category
    return "uncategorized"


def get_recent_submissions(supabase_client, member_id: str, limit: int = 5):
    response = (
        supabase_client.table("submissions")
        .select("id, feedback_json, created_at")
        .eq("member_id", member_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


def detect_patterns(supabase_client, member_id: str, threshold: int = 3, window: int = 5):
    submissions = get_recent_submissions(supabase_client, member_id, limit=window)

    if len(submissions) < 3:
        return {"status": "not_enough_data", "count": len(submissions)}

    categories = []
    for sub in submissions:
        feedback = sub.get("feedback_json") or {}
        why = feedback.get("why_it_is_wrong")
        if why:
            categories.append(categorize_feedback(why))

    counts = Counter(categories)
    flagged = {cat: cnt for cat, cnt in counts.items() if cnt >= threshold}

    for category, count in flagged.items():
        supabase_client.table("pattern_flags").insert({
            "member_id": member_id,
            "category": category,
            "count": count,
            "window_start": submissions[-1]["created_at"],
            "window_end": submissions[0]["created_at"],
        }).execute()

    return {"status": "done", "flagged": flagged, "all_counts": dict(counts)}