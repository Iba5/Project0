# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportAttributeAccessIssue=false
import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Dict, Any
from urllib.parse import unquote
from app.core.config import settings

logger = logging.getLogger(__name__)


class PaynowClient:
    """
    Integrates with Paynow Zimbabwe using the official Python SDK.
    Handles payment creation, sending, mobile checkout, and status polling.
    Falls back to manual signature verification for webhook validation.
    
    Supports both sandbox (for testing) and production modes based on TEST_PAYMENT_MODE.
    """
    def __init__(self) -> None:
        # Select sandbox or production credentials based on TEST_PAYMENT_MODE
        if settings.TEST_PAYMENT_MODE:
            self.integration_id = settings.PAYNOW_SANDBOX_INTEGRATION_ID or settings.PAYNOW_INTEGRATION_ID
            self.integration_key = settings.PAYNOW_SANDBOX_INTEGRATION_KEY or settings.PAYNOW_INTEGRATION_KEY
            logger.info("PaynowClient initialized in SANDBOX mode")
        else:
            self.integration_id = settings.PAYNOW_INTEGRATION_ID
            self.integration_key = settings.PAYNOW_INTEGRATION_KEY
            logger.info("PaynowClient initialized in PRODUCTION mode")
        
        self.result_url = settings.PAYNOW_RESULT_URL
        self.return_url = settings.PAYNOW_RETURN_URL
        self._paynow = None

    def _get_sdk(self):
        """
        Lazily initializes the official Paynow SDK instance.
        Only imports paynow when actually needed to avoid import errors
        if the SDK is not installed.
        Thread-safe via simple attribute check (worst case: two instances
        created on first concurrent call; one is discarded — harmless).
        """
        if self._paynow is None:
            try:
                from paynow import Paynow as PaynowSDK
                self._paynow = PaynowSDK(
                    self.integration_id,
                    self.integration_key,
                    self.result_url or "http://localhost:8000/api/v1/payments/paynow/callback",
                    self.return_url or "http://localhost:3000"
                )
                logger.info("Paynow SDK initialized successfully.")
            except ImportError:
                logger.error(
                    "Official 'paynow' Python package not installed. "
                    "Run: pip install paynow"
                )
                raise ImportError(
                    "The official Paynow Python SDK is required. "
                    "Install it with: pip install paynow"
                )
        return self._paynow

    def create_web_payment(
        self,
        reference: str,
        email: str,
        item_name: str,
        amount: Decimal
    ) -> Dict[str, Any]:
        """
        Creates a web payment via Paynow and sends it.
        Returns dict with: success, redirect_url, poll_url, instructions
        """
        sdk = self._get_sdk()

        payment = sdk.create_payment(reference, email)
        payment.add(item_name, amount)
        response = sdk.send(payment)

        if response.success:
            logger.info(f"Paynow web payment initiated: ref={reference}, poll_url={response.poll_url}")
            return {
                "success": True,
                "redirect_url": response.redirect_url,
                "poll_url": response.poll_url,
                "instructions": None
            }
        else:
            logger.error(f"Paynow web payment failed: ref={reference}, errors={response.errors}")
            return {
                "success": False,
                "redirect_url": None,
                "poll_url": None,
                "instructions": None,
                "errors": getattr(response, 'errors', [])
            }

    def create_mobile_payment(
        self,
        reference: str,
        email: str,
        item_name: str,
        amount: Decimal,
        phone: str,
        method: str = "ecocash"
    ) -> Dict[str, Any]:
        """
        Creates a mobile (express) checkout payment via Paynow.
        Supports ecocash and onemoney methods.
        """
        sdk = self._get_sdk()

        method = method.lower().strip()
        if method not in ("ecocash", "onemoney"):
            logger.warning(f"Invalid mobile method '{method}', defaulting to ecocash")
            method = "ecocash"

        payment = sdk.create_payment(reference, email)
        payment.add(item_name, amount)
        response = sdk.send_mobile(payment, phone, method)

        if response.success:
            logger.info(f"Paynow mobile payment initiated: ref={reference}, phone={phone[:4]}***, method={method}")
            return {
                "success": True,
                "redirect_url": None,
                "poll_url": response.poll_url,
                "instructions": response.instructions
            }
        else:
            logger.error(f"Paynow mobile payment failed: ref={reference}, errors={response.errors}")
            return {
                "success": False,
                "redirect_url": None,
                "poll_url": None,
                "instructions": None,
                "errors": getattr(response, 'errors', [])
            }

    def check_transaction_status(self, poll_url: str) -> Dict[str, Any]:
        """
        Actively checks the transaction status using the saved poll_url.
        This is the RECOMMENDED way to verify payments per Paynow docs.
        """
        sdk = self._get_sdk()

        try:
            txn_status = sdk.check_transaction_status(poll_url)
            logger.info(f"Paynow status check via poll_url: paid={txn_status.paid}")
            return {
                "paid": txn_status.paid,
                "status": str(txn_status.status) if hasattr(txn_status, 'status') else None
            }
        except Exception as e:
            logger.error(f"Paynow status check failed for poll_url={poll_url}: {str(e)}")
            return {
                "paid": False,
                "error": "Transaction status check failed"
            }

    def generate_signature(self, fields: Dict[str, str]) -> str:
        """
        Builds the Paynow API signature according to official documentation.
        
        Algorithm (from Paynow docs):
        1. Concatenate the values in the message for each element in their raw form
        2. Append the Integration Key
        3. UTF8 encode the string
        4. Create a SHA512 hash of the string
        5. Output the result as UPPERCASE hexadecimal
        
        IMPORTANT: Do NOT sort keys - concatenate values in their original order
        IMPORTANT: Do NOT URL encode values if from form post (already decoded)
        """
        # Concatenate values in original order, excluding 'hash' field
        values_chain = ""
        for key, value in fields.items():
            if key.lower() != "hash":
                # URL decode the value if it's from a result string
                # (form posts are already decoded)
                decoded_value = unquote(str(value))
                values_chain += decoded_value
        
        # Append integration key
        combined = f"{values_chain}{self.integration_key}"
        
        # UTF8 encode, SHA512 hash, and output as UPPERCASE hexadecimal
        return hashlib.sha512(combined.encode("utf-8")).hexdigest().upper()

    def verify_callback(self, fields: Dict[str, str]) -> bool:
        """
        Verifies the authenticity of status notification webhooks from Paynow.
        
        Algorithm (from Paynow docs):
        1. Split message by & to get key/value pairs
        2. Split each by = to get key and value
        3. Join all values EXCEPT hash
        4. URL DECODE each value before joining
        5. Append integration key
        6. SHA512 hash
        7. Convert to UPPERCASE hexadecimal
        8. Compare with inbound hash

        SECURITY: In production, a valid SHA512 hash is MANDATORY.
        Callbacks without a hash are ALWAYS rejected to prevent forged
        payment notifications from crediting votes for free.
        """
        incoming_hash = fields.get("hash")
        if not incoming_hash:
            logger.error(
                "Paynow callback REJECTED: missing hash field. "
                "This is a potential forged callback attack."
            )
            return False

        expected_hash = self.generate_signature(fields)
        
        # Security Fix: Use constant-time comparison to prevent timing attacks
        # Standard string comparison (==) is vulnerable to timing attacks where
        # an attacker can iteratively forge signatures by measuring response times
        if not hmac.compare_digest(expected_hash.upper(), incoming_hash.upper()):
            logger.error(
                f"Paynow callback REJECTED: hash mismatch. "
                f"Expected: {expected_hash[:16]}..., Got: {incoming_hash[:16]}..."
            )
            return False

        return True