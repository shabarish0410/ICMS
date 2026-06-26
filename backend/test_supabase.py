# test_supabase.py

from supabase import create_client

url = "https://fjdmijjsixtbamhwourc.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZG1pampzaXh0YmFtaHdvdXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTg2MjgsImV4cCI6MjA5Nzc5NDYyOH0.KxnxPw2tT5FX5O7NBJWjIha2YYRspeIlKVZKCAdlxiA"

supabase = create_client(url, key)

response = supabase.table("projects").select("*").execute()

print(response.data)
