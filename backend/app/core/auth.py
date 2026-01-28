"""
API Key authentication middleware for securing endpoints.
"""

import os
import logging
from typing import Optional

from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader

logger = logging.getLogger(__name__)

# API Key header configuration
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> str:
    """
    Verify API key from request header.

    Args:
        api_key: API key from X-API-Key header

    Returns:
        Validated API key string

    Raises:
        HTTPException: If API key is missing or invalid
    """
    # Get valid API keys from environment variable
    api_keys_str = os.getenv("API_KEYS", "")

    if not api_keys_str:
        logger.error("API_KEYS environment variable is not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": 1400,
                "message": "API authentication is not configured on the server",
                "timestamp": "2024-01-01T00:00:00Z",
            }
        )

    valid_keys = [key.strip() for key in api_keys_str.split(",") if key.strip()]

    # Check if API key is provided
    if not api_key:
        logger.warning("API request without X-API-Key header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": 1601,
                "message": "API key is required. Please provide X-API-Key header.",
                "timestamp": "2024-01-01T00:00:00Z",
            },
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Validate API key
    if api_key not in valid_keys:
        logger.warning(f"Invalid API key attempted: {api_key[:8]}...")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": 1602,
                "message": "Invalid API key. Access denied.",
                "timestamp": "2024-01-01T00:00:00Z",
            }
        )

    logger.debug(f"API key validated successfully: {api_key[:8]}...")
    return api_key


async def get_optional_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> Optional[str]:
    """
    Get API key from header without enforcing validation.

    Useful for endpoints that support both authenticated and unauthenticated access.

    Args:
        api_key: API key from X-API-Key header

    Returns:
        API key string if provided, None otherwise
    """
    return api_key
