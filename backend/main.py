from fastapi import FastAPI
from pydantic import BaseModel, ValidationError
from supabase import create_client
from dotenv import load_dotenv
import requests
import json
import os
from services.pattern_detector import detect_patterns

from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

app = FastAPI()

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


def get_validated_feedback(code: str, language: str, max_retries: int = 1):
    prompt = build_json_prompt(code, language)
    last_raw = None

    for attempt in range(max_retries + 1):
        raw_output = call_ollama(prompt)
        last_raw = raw_output
        try:
            data = json.loads(raw_output)
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