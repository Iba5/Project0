from fastapi.testclient import TestClient

from app.main import app


def test_api_routes_accept_paths_with_trailing_slashes(client):
    """Verify that collection endpoints accept requests with trailing slashes."""
    for path in [
        "/api/v1/events/",
        "/api/v1/participants/",
        "/api/v1/dashboard/",
        "/api/v1/settings/",
    ]:
        response = client.get(path)
        # Should not return 404 (may return 401 due to auth, but that's expected)
        assert response.status_code != 404, f"{path} should not return 404"
