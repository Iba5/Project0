"""
CLI script to create a Super Admin account, gated by a secret bootstrap token.
"""
import sys
import getpass
import secrets

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import User
from app.enums.enums import UserRole


def main():
    if not settings.BOOTSTRAP_TOKEN:
        print(
            "ERROR: BOOTSTRAP_TOKEN is not set in your .env file.\n"
            "Add a line like:\n"
            f"    BOOTSTRAP_TOKEN={secrets.token_urlsafe(32)}\n"
            "then re-run this script."
        )
        sys.exit(1)

    entered_token = getpass.getpass("Enter BOOTSTRAP_TOKEN: ")
    if entered_token != settings.BOOTSTRAP_TOKEN:
        print("ERROR: Token does not match. Refusing to create Super Admin.")
        sys.exit(1)

    db = SessionLocal()
    try:
        existing_super_admins = (
            db.query(User)
            .filter(User.role == UserRole.SUPER_ADMIN, User.deleted_at.is_(None))
            .all()
        )
        if existing_super_admins:
            print(f"WARNING: {len(existing_super_admins)} Super Admin(s) already exist:")
            for u in existing_super_admins:
                print(f"  - {u.name} <{u.email}>")
            confirm = input("Create another one anyway? [y/N]: ").strip().lower()
            if confirm != "y":
                print("Aborted.")
                sys.exit(0)

        name = input("Name: ").strip()
        email = input("Email: ").strip().lower()

        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"ERROR: A user with email {email} already exists (role: {existing_user.role.value}).")
            sys.exit(1)

        password = getpass.getpass("Password: ")
        password_confirm = getpass.getpass("Confirm password: ")
        if password != password_confirm:
            print("ERROR: Passwords do not match.")
            sys.exit(1)
        if len(password) < 8:
            print("ERROR: Password must be at least 8 characters.")
            sys.exit(1)

        user = User(
            name=name,
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.SUPER_ADMIN,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        print(f"\n✅ Super Admin created: {user.name} <{user.email}> (id: {user.id})")

    finally:
        db.close()


if __name__ == "__main__":
    main()
