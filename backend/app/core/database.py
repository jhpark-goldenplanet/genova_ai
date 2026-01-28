"""
Database connection management with async support.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.models.base import Base


class DatabaseManager:
    """Manages database connections and sessions."""

    def __init__(self):
        self.engine: AsyncEngine | None = None
        self.async_session: async_sessionmaker[AsyncSession] | None = None
        self._initialized = False

    async def init_database(self, database_url: str | None = None) -> None:
        """Initialize database connection and create tables."""
        if self._initialized:
            return

        # Use provided URL or get from configuration
        if database_url is None:
            from app.core.config import get_database_settings
            db_settings = get_database_settings()
            database_url = db_settings.url

        # Configure engine parameters based on database type
        engine_kwargs = {
            "echo": False,  # Will be set from config
            "pool_pre_ping": True,
        }

        # Get database settings for configuration
        try:
            from app.core.config import get_database_settings
            db_settings = get_database_settings()
            engine_kwargs["echo"] = db_settings.echo
        except Exception:
            # Fallback to environment variables if config not available
            engine_kwargs["echo"] = os.getenv("DATABASE_ECHO", "false").lower() == "true"

        # Add SSL configuration and custom JSON serializer for asyncpg
        if "asyncpg" in database_url:
            import json
            import functools
            engine_kwargs["connect_args"] = {"ssl": False}
            engine_kwargs["json_serializer"] = functools.partial(json.dumps, ensure_ascii=False)

        # SQLite doesn't support pool_size and max_overflow
        if "sqlite" not in database_url.lower():
            try:
                from app.core.config import get_database_settings
                db_settings = get_database_settings()
                engine_kwargs.update({
                    "pool_size": db_settings.pool_size,
                    "max_overflow": db_settings.max_overflow,
                })
            except Exception:
                # Fallback to environment variables
                engine_kwargs.update({
                    "pool_size": int(os.getenv("DATABASE_POOL_SIZE", "10")),
                    "max_overflow": int(os.getenv("DATABASE_MAX_OVERFLOW", "20")),
                })

        # Use NullPool for testing to avoid connection issues
        if "test" in database_url or ":memory:" in database_url:
            engine_kwargs["poolclass"] = NullPool

        # Create async engine
        self.engine = create_async_engine(database_url, **engine_kwargs)

        # Create session factory
        self.async_session = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

        # Create tables
        await self.create_tables()

        self._initialized = True

    async def create_tables(self) -> None:
        """Create all database tables."""
        if not self.engine:
            raise RuntimeError("Database engine not initialized")

        # Import models to ensure they are registered with Base.metadata
        from app.models import Segment, Video  # noqa: F401

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def drop_tables(self) -> None:
        """Drop all database tables (useful for testing)."""
        if not self.engine:
            raise RuntimeError("Database engine not initialized")

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def close(self) -> None:
        """Close database connections."""
        if self.engine:
            await self.engine.dispose()
            self.engine = None
            self.async_session = None
            self._initialized = False

    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session as async generator."""
        if not self.async_session:
            raise RuntimeError("Database not initialized")

        async with self.async_session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def get_session_context(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session as async context manager."""
        if not self.async_session:
            raise RuntimeError("Database not initialized")

        async with self.async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @property
    def is_initialized(self) -> bool:
        """Check if database is initialized."""
        return self._initialized


# Global database manager instance
db_manager = DatabaseManager()


# Dependency for FastAPI
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency to get database session."""
    async for session in db_manager.get_session():
        yield session
