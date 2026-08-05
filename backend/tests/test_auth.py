from app.core.config import settings

def test_admin_registration(client):
    """
    Test registration of a new administrative user.
    """
    payload = {
        "name": "Super Admin User",
        "email": "superadmin@votingcorp.com",
        "password": "StrongPassword123"
    }
    headers = {"X-Bootstrap-Token": settings.BOOTSTRAP_TOKEN}
    response = client.post("/api/v1/auth/register", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "superadmin@votingcorp.com"
    assert data["user"]["role"] in ("super_admin", "admin")

def test_admin_login(client):
    """
    Test authenticating registered admin credentials.
    """
    # Register first with bootstrap token
    payload = {
        "name": "Admin Tester",
        "email": "tester@votingcorp.com",
        "password": "MyPassword456"
    }
    headers = {"X-Bootstrap-Token": settings.BOOTSTRAP_TOKEN}
    reg_res = client.post("/api/v1/auth/register", json=payload, headers=headers)
    assert reg_res.status_code == 201

    # Attempt login
    login_payload = {
        "email": "tester@votingcorp.com",
        "password": "MyPassword456",
        "rememberMe": True
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "tester@votingcorp.com"

