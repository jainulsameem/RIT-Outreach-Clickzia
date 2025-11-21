
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables for Server Function.');
}

// Initialize with Service Role Key for server-side admin access
// This bypasses RLS to ensure we can write leads even if no user is logged in
const supabase = createClient(supabaseUrl, supabaseKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = { supabase };
