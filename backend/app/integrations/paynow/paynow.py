import logging
import hashlib
from typing import Dict
from app.core.config import settings

logger = logging.getLogger(__name__)

class PaynowClient:
    """
    Integrates directly with Paynow Zimbabwe API.
    Calculates SHA512 transaction hashes and validates callback headers.
    """
    def __init__(self):
        self.integration_id = settings.PAYNOW_INTEGRATION_ID
        self.integration_key = settings.PAYNOW_INTEGRATION_KEY

    def generate_signature(self, fields: Dict[str, str]) -> str:
        """
        Builds the Paynow API signature by joining sorted key values 
        and hashing the payload with SHA512 using the integration key.
        """
        sorted_keys = sorted(fields.keys())
        values_chain = "".join(str(fields[k]) for k in sorted_keys if k != "hash")
        combined = f"{values_chain}{self.integration_key}"
        return hashlib.sha512(combined.encode("utf-8")).hexdigest().upper()

    def verify_callback(self, fields: Dict[str, str]) -> bool:
        """
        Verifies the authenticity of status notification webhooks from Paynow.
        """
        incoming_hash = fields.get("hash")
        if not incoming_hash:
            logger.warning("Paynow callback missing hash field.")
            return False
        
        expected_hash = self.generate_signature(fields)
        return expected_hash == incoming_hash
