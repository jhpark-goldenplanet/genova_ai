"""
YouTube cookies and OAuth token management API endpoints.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.auth import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/youtube", tags=["YouTube Authentication"])

# Cookie file path
COOKIE_FILE_PATH = "/tmp/youtube_cookies.txt"

# OAuth token file path
OAUTH_TOKEN_DIR = "/tmp/yt-dlp/youtube-oauth2"
OAUTH_TOKEN_FILE = f"{OAUTH_TOKEN_DIR}/token.json"


class OAuthTokenRequest(BaseModel):
    """OAuth token upload request."""
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[float] = None
    token_type: Optional[str] = "Bearer"


@router.post("/upload-cookies", dependencies=[Depends(verify_api_key)])
async def upload_youtube_cookies(file: UploadFile = File(...)):
    """
    Upload YouTube cookies file for authentication.

    This allows downloading age-restricted or member-only videos.

    Export your cookies using a browser extension like:
    - "Get cookies.txt LOCALLY" (Chrome/Firefox)
    - "cookies.txt" (Chrome)

    Args:
        file: Netscape format cookies file

    Returns:
        Success message
    """
    try:
        # Validate file extension
        if not file.filename or not file.filename.endswith('.txt'):
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. Please upload a .txt file"
            )

        # Read file content
        content = await file.read()

        # Validate basic cookie format
        content_str = content.decode('utf-8')
        if '# Netscape HTTP Cookie File' not in content_str:
            raise HTTPException(
                status_code=400,
                detail="Invalid cookie format. Please use Netscape format cookies"
            )

        # Save to file
        with open(COOKIE_FILE_PATH, 'wb') as f:
            f.write(content)

        # Set read permissions
        os.chmod(COOKIE_FILE_PATH, 0o644)

        logger.info(f"YouTube cookies uploaded successfully: {file.filename}")

        return {
            "message": "YouTube cookies uploaded successfully",
            "cookie_file": COOKIE_FILE_PATH
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload YouTube cookies: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload cookies: {str(e)}"
        )


@router.get("/cookies-status")
async def get_cookies_status():
    """
    Check if YouTube cookies are configured.

    Returns:
        Cookie file status
    """
    cookie_exists = os.path.exists(COOKIE_FILE_PATH)

    if cookie_exists:
        stat = os.stat(COOKIE_FILE_PATH)
        return {
            "configured": True,
            "cookie_file": COOKIE_FILE_PATH,
            "file_size": stat.st_size,
            "last_modified": stat.st_mtime
        }
    else:
        return {
            "configured": False,
            "message": "No YouTube cookies configured. Upload cookies to enable authentication."
        }


@router.delete("/cookies", dependencies=[Depends(verify_api_key)])
async def delete_cookies():
    """
    Delete YouTube cookies.

    Returns:
        Success message
    """
    try:
        if os.path.exists(COOKIE_FILE_PATH):
            os.remove(COOKIE_FILE_PATH)
            logger.info("YouTube cookies deleted")
            return {"message": "YouTube cookies deleted successfully"}
        else:
            return {"message": "No cookies to delete"}

    except Exception as e:
        logger.error(f"Failed to delete YouTube cookies: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete cookies: {str(e)}"
        )


# ==================== OAuth 2.0 Token Management ====================

@router.post("/upload-oauth-token", dependencies=[Depends(verify_api_key)])
async def upload_oauth_token(token: OAuthTokenRequest):
    """
    Upload YouTube OAuth 2.0 token for authentication.

    OAuth tokens are more reliable than cookies and support automatic refresh.
    Generate token locally using: yt-dlp --username oauth2 --password "" <url>

    Args:
        token: OAuth token data (access_token, refresh_token, expires_at)

    Returns:
        Success message with token info
    """
    try:
        # Create directory if not exists
        os.makedirs(OAUTH_TOKEN_DIR, exist_ok=True)

        # Prepare token data
        token_data = {
            "access_token": token.access_token,
            "refresh_token": token.refresh_token,
            "expires_at": token.expires_at,
            "token_type": token.token_type or "Bearer",
        }

        # Save token file
        with open(OAUTH_TOKEN_FILE, 'w') as f:
            json.dump(token_data, f, indent=2)

        # Set permissions
        os.chmod(OAUTH_TOKEN_FILE, 0o600)

        logger.info("YouTube OAuth token uploaded successfully")

        # Calculate expiration info
        expires_info = "unknown"
        if token.expires_at:
            expires_dt = datetime.fromtimestamp(token.expires_at)
            expires_info = expires_dt.isoformat()

        return {
            "message": "YouTube OAuth token uploaded successfully",
            "token_file": OAUTH_TOKEN_FILE,
            "has_refresh_token": bool(token.refresh_token),
            "expires_at": expires_info,
        }

    except Exception as e:
        logger.error(f"Failed to upload OAuth token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload OAuth token: {str(e)}"
        )


@router.get("/oauth-status")
async def get_oauth_status():
    """
    Check YouTube OAuth token status.

    Returns:
        OAuth token configuration status
    """
    try:
        if not os.path.exists(OAUTH_TOKEN_FILE):
            return {
                "configured": False,
                "message": "No OAuth token configured. Run youtube_oauth_setup.py to configure.",
            }

        with open(OAUTH_TOKEN_FILE, 'r') as f:
            token_data = json.load(f)

        expires_at = token_data.get("expires_at")
        expires_info = None
        is_expired = False

        if expires_at:
            expires_dt = datetime.fromtimestamp(expires_at)
            expires_info = expires_dt.isoformat()
            is_expired = datetime.now() > expires_dt

        stat = os.stat(OAUTH_TOKEN_FILE)

        return {
            "configured": True,
            "token_file": OAUTH_TOKEN_FILE,
            "has_refresh_token": bool(token_data.get("refresh_token")),
            "expires_at": expires_info,
            "is_expired": is_expired,
            "can_auto_refresh": bool(token_data.get("refresh_token")),
            "file_size": stat.st_size,
            "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to check OAuth status: {str(e)}")
        return {
            "configured": False,
            "error": str(e),
        }


@router.delete("/oauth-token", dependencies=[Depends(verify_api_key)])
async def delete_oauth_token():
    """
    Delete YouTube OAuth token.

    Returns:
        Success message
    """
    try:
        if os.path.exists(OAUTH_TOKEN_FILE):
            os.remove(OAUTH_TOKEN_FILE)
            logger.info("YouTube OAuth token deleted")
            return {"message": "YouTube OAuth token deleted successfully"}
        else:
            return {"message": "No OAuth token to delete"}

    except Exception as e:
        logger.error(f"Failed to delete OAuth token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete OAuth token: {str(e)}"
        )
