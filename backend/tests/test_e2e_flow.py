import json
from datetime import datetime, timedelta
from app.core import config


def test_e2e_admin_event_upload_participant(client):
    # Ensure bootstrap token is set for this test
    config.settings.BOOTSTRAP_TOKEN = "test-bootstrap-token"

    # 1) Register initial admin (bootstrap)
    resp = client.post(
        "/api/v1/auth/register",
        headers={"X-Bootstrap-Token": "test-bootstrap-token"},
        json={
            "name": "Super",
            "email": "super@example.com",
            "password": "Password1",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "token" in body
    token = body["token"]

    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2) Create an event
    now = datetime.utcnow()
    event_payload = {
        "name": "E2E Test Event",
        "description": "Integration test event",
        "startDate": now.isoformat(),
        "endDate": (now + timedelta(days=2)).isoformat(),
        "votePrice": 1.00,
        "votesPerPayment": 1,
    }

    resp = client.post("/api/v1/events/", json=event_payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    event = resp.json()
    assert event["name"] == "E2E Test Event"

    # 3) Upload an image
    files = {"image": ("test.jpg", b"dummydata", "image/jpeg")}
    resp = client.post("/api/v1/upload", files=files)
    assert resp.status_code == 200, resp.text
    up = resp.json()
    assert up.get("url") and up.get("fileName")
    video_url = up["url"]

    # 4) Create a participant using uploaded URL
    participant_payload = {
        "name": "Contestant One",
        "category": "Singing",
        "platform": "TikTok",
        "videoUrl": video_url,
    }

    resp = client.post("/api/v1/participants/", json=participant_payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    p = resp.json()
    assert p["name"] == "Contestant One"
    assert p["videoUrl"] == video_url
