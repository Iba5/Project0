#!/usr/bin/env python3
import requests
import time
import json
from pathlib import Path

BASE = "http://127.0.0.1:8000/api/v1"


def main():
    print("Checking health...")
    r = requests.get("http://127.0.0.1:8000/health")
    print(r.status_code, r.text)

    # 1) Register bootstrap admin
    print("Registering bootstrap admin...")
    reg = requests.post(
        f"{BASE}/auth/register",
        headers={"X-Bootstrap-Token": "test-bootstrap-token", "Content-Type": "application/json"},
        json={"name": "LiveSuper", "email": "livesuper@example.com", "password": "Password1"}
    )
    print("register ->", reg.status_code, reg.text)
    token = None
    if reg.status_code == 201:
        token = reg.json().get("token")

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    # 2) Upload a file
    print("Uploading test image...")
    tmp = Path("/tmp/e2e_test.jpg")
    tmp.write_bytes(b"dummyimagecontent")
    with open(tmp, "rb") as fh:
        files = {"image": ("e2e.jpg", fh, "image/jpeg")}
        up = requests.post(f"{BASE}/upload", files=files)
    print("upload ->", up.status_code, up.text)
    upload_json = up.json() if up.status_code == 200 else {}
    video_url = upload_json.get("url")

    # 3) Create event
    print("Creating event...")
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    event_payload = {
        "name": "Live E2E Event",
        "description": "Live test",
        "startDate": now,
        "endDate": now,
        "votePrice": 1.0,
        "votesPerPayment": 1,
    }
    ev = requests.post(f"{BASE}/events/", json=event_payload, headers=headers)
    print("create event ->", ev.status_code, ev.text)
    event = ev.json() if ev.status_code in (200,201) else {}

    # 4) Create participant
    print("Creating participant...")
    participant_payload = {
        "name": "LiveContestant",
        "category": "Test",
        "platform": "TikTok",
        "videoUrl": video_url or "/uploads/placeholder.jpg",
    }
    p = requests.post(f"{BASE}/participants/", json=participant_payload, headers=headers)
    print("create participant ->", p.status_code, p.text)

    print("E2E run complete")


if __name__ == "__main__":
    main()
