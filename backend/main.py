from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError
from supabase import create_client
from dotenv import load_dotenv
import requests
import json
import os
from services.pattern_detector import detect_patterns
from services.report_generator import generate_monthly_report

from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)


class SubmissionRequest(BaseModel):
    code: str
    language: str
    member_id: str


class FeedbackSchema(BaseModel):
    what_is_wrong: str
    why_it_is_wrong: str
    how_to_fix: str
    concept_to_study: str


def build_json_prompt(code: str, language: str) -> str:
    return f"""You are a senior code reviewer. Analyze the following {language} code and respond ONLY with a valid JSON object — no extra text, no markdown, no explanation outside the JSON.

The JSON must have exactly these 4 keys:
- "what_is_wrong": one sentence describing the specific issue
- "why_it_is_wrong": one sentence explaining the underlying reason/risk
- "how_to_fix": one sentence with a concrete fix
- "concept_to_study": a short topic name (2-4 words) the developer should study

Code:
{code}

Respond with ONLY the JSON object, nothing else."""


def call_ollama(prompt: str) -> str:
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "gemma2:2b",
            "prompt": prompt,
            "format": "json",
            "stream": False
        }
    )
    return response.json()["response"]


def clean_json_text(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json", "", 1).strip()
    return text


def normalize_keys(data: dict) -> dict:
    key_map = {
        "what_is_wrong": ["what_is_wrong", "what's_wrong", "whats_wrong"],
        "why_it_is_wrong": ["why_it_is_wrong", "why_it_s_wrong", "whyitiswrong", "why_its_wrong"],
        "how_to_fix": ["how_to_fix", "howtofix"],
        "concept_to_study": ["concept_to_study", "concepttostudy"],
    }
    normalized = {}
    for target_key, variants in key_map.items():
        for v in variants:
            if v in data:
                normalized[target_key] = data[v]
                break
    return normalized


def clean_json_text(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json", "", 1).strip()
    return text


def normalize_keys(data: dict) -> dict:
    key_map = {
        "what_is_wrong": ["what_is_wrong", "what's_wrong", "whats_wrong"],
        "why_it_is_wrong": ["why_it_is_wrong", "why_it_s_wrong", "whyitiswrong", "why_its_wrong"],
        "how_to_fix": ["how_to_fix", "howtofix"],
        "concept_to_study": ["concept_to_study", "concepttostudy"],
    }
    normalized = {}
    for target_key, variants in key_map.items():
        for v in variants:
            if v in data:
                normalized[target_key] = data[v]
                break
    return normalized


def get_validated_feedback(code: str, language: str, max_retries: int = 3):
    prompt = build_json_prompt(code, language)
    last_raw = None

    for attempt in range(max_retries + 1):
        raw_output = call_ollama(prompt)
        last_raw = raw_output
        try:
            cleaned = clean_json_text(raw_output)
            data = json.loads(cleaned)
            data = normalize_keys(data)
            validated = FeedbackSchema(**data)
            return {"status": "success", "data": validated.dict()}
        except (json.JSONDecodeError, ValidationError):
            continue

    return {"status": "parsing_failed", "raw": last_raw}

@app.get("/")
def health_check():
    return {"status": "ok", "message": "AI Growth Coach backend is running"}


@app.post("/submit")
def submit_code(payload: SubmissionRequest):
    result = get_validated_feedback(payload.code, payload.language)

    feedback_to_store = result.get("data") if result["status"] == "success" else {"error": "parsing_failed"}

    insert_response = supabase.table("submissions").insert({
        "member_id": payload.member_id,
        "language": payload.language,
        "code": payload.code,
        "feedback_json": feedback_to_store
    }).execute()

    return {
        "feedback_result": result,
        "stored_row_id": insert_response.data[0]["id"] if insert_response.data else None
    }


@app.get("/check-patterns/{member_id}")
def check_patterns(member_id: str):
    result = detect_patterns(supabase, member_id)
    return result

@app.get("/submissions/{member_id}")
def get_submissions(member_id: str):
    response = (
        supabase.table("submissions")
        .select("id, language, code, feedback_json, created_at")
        .eq("member_id", member_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


class CommentRequest(BaseModel):
    submission_id: str
    author_id: str
    comment_text: str


class VoteRequest(BaseModel):
    submission_id: str
    voter_id: str
    vote_type: str


@app.get("/all-submissions")
def get_all_submissions():
    response = (
        supabase.table("submissions")
        .select("id, member_id, language, code, feedback_json, created_at")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return response.data


@app.post("/comment")
def add_comment(payload: CommentRequest):
    response = supabase.table("comments").insert({
        "submission_id": payload.submission_id,
        "author_id": payload.author_id,
        "comment_text": payload.comment_text,
    }).execute()
    return response.data


@app.get("/comments/{submission_id}")
def get_comments(submission_id: str):
    response = (
        supabase.table("comments")
        .select("*")
        .eq("submission_id", submission_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data


@app.post("/vote")
def add_vote(payload: VoteRequest):
    response = supabase.table("feedback_votes").insert({
        "submission_id": payload.submission_id,
        "voter_id": payload.voter_id,
        "vote_type": payload.vote_type,
    }).execute()
    return response.data





@app.get("/report/{member_id}")
def get_report(member_id: str):
    return generate_monthly_report(supabase, member_id)


@app.get("/mentor-dashboard")
def mentor_dashboard():
    response = (
        supabase.table("submissions")
        .select("member_id, created_at, feedback_json")
        .order("created_at", desc=True)
        .execute()
    )
    rows = response.data

    members = {}
    for row in rows:
        mid = row["member_id"]
        if mid not in members:
            members[mid] = {
                "member_id": mid,
                "last_active": row["created_at"],
                "total_submissions": 0,
            }
        members[mid]["total_submissions"] += 1

    return {"members": list(members.values())}