from typing import Any


class VotingException(Exception):
    """
    Base exception class for all custom application business logic errors.
    """

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        errors: list[Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors or []


class AuthenticationException(VotingException):
    """Raised when authentication credentials or token validation fails."""

    def __init__(self, message: str = "Unauthenticated request") -> None:
        super().__init__(message, status_code=401)


class AuthorizationException(VotingException):
    """Raised when user permissions do not match the resource requirements."""

    def __init__(self, message: str = "Access forbidden") -> None:
        super().__init__(message, status_code=403)


class NotFoundException(VotingException):
    """Raised when query entity does not exist."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status_code=404)


class ValidationException(VotingException):
    """Raised when input parameter validation fails."""

    def __init__(
        self,
        message: str = "Validation failure",
        errors: list[Any] | None = None,
    ) -> None:
        super().__init__(message, status_code=422, errors=errors)


class PaymentException(VotingException):
    """Raised during Paynow transaction processing failures."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class FraudException(VotingException):
    """Raised when suspect activity is flagged by the Fraud Detection engine."""

    def __init__(
        self,
        message: str = "Suspicious transaction detected",
    ) -> None:
        super().__init__(message, status_code=400)


class IdempotencyException(VotingException):
    """Raised on double-processing attempts of transaction blocks."""

    def __init__(
        self,
        message: str = "Transaction reference already processed",
    ) -> None:
        super().__init__(message, status_code=409)