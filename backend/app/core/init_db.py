"""
Database initialization utilities.
"""

import asyncio
import os

from app.core.database import db_manager


async def init_database():
    """Initialize the database with tables."""
    try:
        print("Initializing database...")
        await db_manager.init_database()
        print("Database initialized successfully!")
        print(f"Tables created for models: Video, Segment")
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise
    finally:
        await db_manager.close()


async def reset_database():
    """Reset the database by dropping and recreating tables."""
    try:
        print("Resetting database...")
        await db_manager.init_database()
        await db_manager.drop_tables()
        await db_manager.create_tables()
        print("Database reset successfully!")
    except Exception as e:
        print(f"Error resetting database: {e}")
        raise
    finally:
        await db_manager.close()


if __name__ == "__main__":
    # Run database initialization
    asyncio.run(init_database())
