# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportAttributeAccessIssue=false
import logging
from decimal import Decimal
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class PaynowClient:
    """
    Integrates with Paynow Zimbabwe using the official Python SDK.
    Handles payment creation, sending, mobile checkout, and status polling.
    Falls back to manual signature verification for webhook validation.
    """
    def __init__(self) -> None:
        self.integration_id = settings.PAYNOW_INTEGRATION_ID
        self.integration_key = settings.PAYNOW_INTEGRATION_KEY
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
        Builds the Paynow API signature by joining sorted key values
        and hashing the payload with SHA512 using the integration key.
        Used for webhook callback verification.

        Algorithm (matches Paynow's PHP SDK):
        1. Take all fields except 'hash'
        2. Sort keys alphabetically
        3. Concatenate the VALUES (not key=value pairs)
        4. Append the integration key
        5. SHA512 hash

        BUG 3 FIX: Returns LOWERCASE hex (matching Paynow's behavior).
        Previously returned .upper() which broke comparison since
        Paynow sends hashes in lowercase.
        """
        import hashlib
        sorted_keys = sorted(fields.keys())
        values_chain = "".join(str(fields[k]) for k in sorted_keys if k.lower() != "hash")
        combined = f"{values_chain}{self.integration_key}"
        return hashlib.sha512(combined.encode("utf-8")).hexdigest()

    def verify_callback(self, fields: Dict[str, str]) -> bool:
        """
        Verifies the authenticity of status notification webhooks from Paynow.

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
        # C2 FIX: Case-insensitive comparison. Paynow may send the hash
        # in either case depending on their implementation. Previously
        # the code used .upper() on the generated hash but compared
        # against the raw incoming hash, guaranteeing a mismatch if
        # Paynow sent lowercase.
        if expected_hash.lower() != incoming_hash.lower():
            logger.error(
                f"Paynow callback REJECTED: hash mismatch. "
                f"Expected: {expected_hash[:16]}..., Got: {incoming_hash[:16]}..."
            )
            return False

        return True