from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_db() -> Client:
    """Supabase client using the service role key. Bypasses RLS, so every
    query on user data must filter by user_id explicitly."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)
