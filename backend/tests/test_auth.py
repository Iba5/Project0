def test_admin_registration(client):
    """
    Test registration of a new administrative user.
    """
    payload = {
        "name": "Super Admin User",
        "email": "superadmin@votingcorp.com",
        "password": "strongpassword123"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "superadmin@votingcorp.com"
    assert data["user"]["role"] == "Admin"

def test_admin_login(client):
    """
    Test authenticating registered admin credentials.
    """
    # Register first
    payload = {
        "name": "Admin Tester",
        "email": "tester@votingcorp.com",
        "password": "mypassword456"
    }
    client.post("/api/v1/auth/register", json=payload)

    # Attempt login
    login_payload = {
        "email": "tester@votingcorp.com",
        "password": "mypassword456",
        "rememberMe": True
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "tester@votingcorp.com"
