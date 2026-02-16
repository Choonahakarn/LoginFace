"""Supabase client for backend."""
import os

try:
    from supabase import create_client, Client
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    # Only create client if both variables are set
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    else:
        print("WARNING: Supabase environment variables not set!")
        print("  SUPABASE_URL:", SUPABASE_URL or "MISSING")
        print("  SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY and "SET" or "MISSING")
        print("  Face embeddings will not be saved to Supabase.")
        print("  Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env")
        supabase = None
except ImportError:
    print("WARNING: supabase package not installed!")
    print("  Install with: pip install supabase")
    print("  Face embeddings will not be saved to Supabase.")
    supabase = None
except Exception as e:
    print(f"WARNING: Error initializing Supabase client: {e}")
    print("  Face embeddings will not be saved to Supabase.")
    supabase = None
