// ============================================================================
// Supabase client — CHỈ dùng anon key (public, an toàn để lộ ra frontend).
// Toàn bộ phân quyền thật sự nằm ở Row Level Security trên PostgreSQL,
// KHÔNG được đưa service_role key vào file này hay bất kỳ đâu ở frontend.
// ============================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Điền 2 giá trị này sau khi tạo Supabase project (Project Settings > API).
// Đây là URL và anon/public key — được thiết kế để công khai, an toàn.
export const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
