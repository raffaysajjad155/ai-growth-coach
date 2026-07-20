from collections import Counter
from datetime import datetime, timezone


CURATED_RESOURCES = {
    "missing_error_handling": [
        "Python Official Docs: Errors and Exceptions",
        "Real Python: The try/except/else/finally Flow",
        "MDN: Control flow and error handling (JS)",
    ],
    "no_input_validation": [
        "OWASP: Input Validation Cheat Sheet",
        "Real Python: Defensive Programming",
        "Pydantic Docs: Data Validation",
    ],
    "outdated_syntax": [
        "MDN: let vs var in JavaScript",
        "JavaScript.info: Modern variable declarations",
        "Airbnb JS Style Guide",
    ],
    "array_bounds_error": [
        "GeeksforGeeks: Array Index Out of Bounds",
        "C++ Reference: Undefined Behavior",
        "Real Python: Common List Indexing Mistakes",
    ],
    "inefficient_loop": [
        "Big-O Cheat Sheet",
        "Real Python: Writing Efficient Loops",
        "LeetCode: Time Complexity Guide",
    ],
    "uncategorized": [
        "Refactoring Guru: Code Smells",
        "Clean Code by Robert Martin (summary)",
        "Google Style Guides",
    ],
}


def get_member_history(supabase_client, member_id: str):
    response = (
        supabase_client.table("submissions")
        .select("id, feedback_json, created_at")
        .eq("member_id", member_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


def compute_improvement_score(categorized_timeline: list) -> float:
    if len(categorized_timeline) < 2:
        return 0.0
    half = len(categorized_timeline) // 2
    older_flagged = sum(1 for c in categorized_timeline[half:] if c != "clean")
    newer_flagged = sum(1 for c in categorized_timeline[:half] if c != "clean")
    older_rate = older_flagged / max(len(categorized_timeline[half:]), 1)
    newer_rate = newer_flagged / max(len(categorized_timeline[:half]), 1)
    return round((older_rate - newer_rate) * 100, 1)


def generate_monthly_report(supabase_client, member_id: str):
    from services.pattern_detector import categorize_feedback

    submissions = get_member_history(supabase_client, member_id)

    if not submissions:
        return {"status": "no_data", "member_id": member_id}

    timeline = []
    category_counts = Counter()

    for sub in submissions:
        feedback = sub.get("feedback_json") or {}
        why = feedback.get("why_it_is_wrong")
        category = categorize_feedback(why) if why else "clean"
        category_counts[category] += 1
        timeline.append({
            "date": sub["created_at"],
            "category": category,
        })

    weak_categories = [cat for cat, _ in category_counts.most_common(2) if cat != "clean"]
    resources = []
    for cat in weak_categories:
        resources.extend(CURATED_RESOURCES.get(cat, [])[:3])

    improvement_score = compute_improvement_score([t["category"] for t in timeline])

    return {
        "status": "done",
        "member_id": member_id,
        "total_submissions": len(submissions),
        "category_breakdown": dict(category_counts),
        "timeline": timeline,
        "improvement_score": improvement_score,
        "weak_categories": weak_categories,
        "recommended_resources": resources[:3],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }