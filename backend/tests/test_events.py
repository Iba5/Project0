def test_list_events_unauthorized(client):
    """
    Ensure fetching events without authentication token returns HTTP 401.
    """
    response = client.get("/api/v1/events/")
    assert response.status_code == 401
