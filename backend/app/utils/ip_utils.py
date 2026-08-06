import logging
import ipaddress
from typing import Optional, List
from fastapi import Request
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> str:
    """
    Extract the real client IP from a request, accounting for reverse proxies.
    
    This function implements a secure IP extraction strategy:
    1. Check if the direct connection IP is a trusted proxy
    2. If trusted, check X-Forwarded-For header (leftmost is the original client)
    3. If trusted, check X-Real-IP header
    4. If trusted, check Forwarded header (RFC 7239)
    5. Fall back to request.client.host
    
    Security: Only trust forwarded headers when the request comes from
    a trusted proxy. This prevents IP spoofing attacks.
    
    Returns:
        str: The resolved client IP address
    """
    # Get the direct connection IP
    direct_ip = request.client.host if request.client else "127.0.0.1"
    
    # Check if the direct connection IP is a trusted proxy
    trusted = is_trusted_proxy(direct_ip)
    
    # Only trust forwarded headers if the connection is from a trusted proxy
    if trusted:
        # Check X-Forwarded-For header
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            # X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
            # The leftmost IP is the original client
            forwarded_ips = [ip.strip() for ip in x_forwarded_for.split(",")]
            if forwarded_ips:
                client_ip = forwarded_ips[0]
                return client_ip
        
        # Check X-Real-IP header
        x_real_ip = request.headers.get("x-real-ip")
        if x_real_ip:
            return x_real_ip
        
        # Check Forwarded header (RFC 7239)
        forwarded = request.headers.get("forwarded")
        if forwarded:
            # Parse RFC 7239 Forwarded header: "for=192.0.2.43;by=203.0.113.43"
            # This is more complex to parse, so we'll do a simple extraction
            if "for=" in forwarded:
                # Extract the for= value
                for_part = forwarded.split("for=")[1].split(";")[0].strip()
                # Remove quotes if present
                for_part = for_part.strip('"')
                if for_part and for_part != "unknown":
                    return for_part
    
    # Fall back to direct connection IP
    return direct_ip


def is_trusted_proxy(ip: str) -> bool:
    """
    Check if an IP address belongs to a trusted proxy.
    
    This is used to determine whether to trust forwarded headers.
    In production, this should be configured with your proxy/load balancer IPs
    via the TRUSTED_PROXIES environment variable.
    
    Args:
        ip: IP address to check
        
    Returns:
        bool: True if the IP is a trusted proxy
    """
    # If TRUSTED_PROXIES is not configured, trust all forwarded headers in development
    # In production, TRUSTED_PROXIES should be configured for security
    if not settings.TRUSTED_PROXIES:
        return settings.DEBUG  # Trust all in development, none in production
    
    # Parse TRUSTED_PROXIES configuration
    trusted_patterns = [pattern.strip() for pattern in settings.TRUSTED_PROXIES.split(",")]
    
    try:
        # Try to match as a network (CIDR) or exact IP
        ip_obj = ipaddress.ip_address(ip)
        
        for pattern in trusted_patterns:
            if not pattern:
                continue
            
            try:
                # Try to parse as a network
                network = ipaddress.ip_network(pattern, strict=False)
                if ip_obj in network:
                    return True
            except ValueError:
                # Not a network, try exact match
                if ip == pattern:
                    return True
    except ValueError:
        # Invalid IP address, don't trust
        return False
    
    return False

