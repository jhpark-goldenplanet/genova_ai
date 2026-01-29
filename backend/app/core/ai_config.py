"""
Google AI services configuration and client management.
"""

import os
from typing import Optional

from google.cloud import aiplatform, translate_v2 as translate
from google.oauth2 import service_account
from google import genai
import vertexai


class AIConfig:
    """Configuration for Google AI services."""

    def __init__(self):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.location = os.getenv("GOOGLE_CLOUD_LOCATION", "asia-northeast3")
        self.vertex_ai_location = os.getenv("GOOGLE_CLOUD_LOCATION_VERTEX_AI", "us-central1")
        self.credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        # Vertex AI configuration
        self.vertex_model_name = os.getenv("VERTEX_AI_MODEL", "gemini-3-flash-preview")

        # Genai API configuration
        self.genai_api_key = os.getenv("GENAI_API_KEY")

        # Translation configuration
        self.default_target_language = os.getenv("DEFAULT_TARGET_LANGUAGE", "en")
        
        # Allow missing project ID in test environments
        if not self.project_id and not self._is_test_environment():
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is required")
    
    def _is_test_environment(self) -> bool:
        """Check if running in test environment."""
        import sys
        return "pytest" in sys.modules or os.getenv("TESTING") == "true"

    def get_credentials(self) -> Optional[service_account.Credentials]:
        """Get Google Cloud credentials from service account file."""
        if self.credentials_path and os.path.exists(self.credentials_path):
            return service_account.Credentials.from_service_account_file(
                self.credentials_path
            )
        return None


class AIClientManager:
    """Manages Google AI service clients."""

    def __init__(self):
        self.config = AIConfig()
        self._vertex_initialized = False
        self._genai_client: Optional[genai.Client] = None
        self._translate_client: Optional[translate.Client] = None

    def init_vertex_ai(self) -> None:
        """Initialize Vertex AI with project configuration."""
        if not self._vertex_initialized:
            credentials = self.config.get_credentials()
            vertexai.init(
                project=self.config.project_id,
                location=self.config.vertex_ai_location,
                credentials=credentials
            )
            self._vertex_initialized = True

    def get_genai_client(self) -> genai.Client:
        """Get Google Genai client with API key."""
        if self._genai_client is None:
            self._genai_client = genai.Client(api_key=self.config.genai_api_key)
        return self._genai_client

    def get_translate_client(self) -> translate.Client:
        """Get Translation API client."""
        if self._translate_client is None:
            credentials = self.config.get_credentials()
            if credentials:
                self._translate_client = translate.Client(credentials=credentials)
            else:
                self._translate_client = translate.Client()
        return self._translate_client

    @property
    def is_vertex_initialized(self) -> bool:
        """Check if Vertex AI is initialized."""
        return self._vertex_initialized


# Global AI client manager instance
ai_client_manager = AIClientManager()