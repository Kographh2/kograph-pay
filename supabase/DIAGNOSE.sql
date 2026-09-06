-- Cek fungsi apa saja yang tersedia dari pgcrypto
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE '%digest%'
ORDER BY p.proname;

-- Atau cek semua function di public schema yang mirip crypto
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%digest%' OR p.proname LIKE '%crypt%' OR p.proname LIKE '%hash%')
ORDER BY p.proname;

-- Cek search path saat ini
SHOW search_path;
