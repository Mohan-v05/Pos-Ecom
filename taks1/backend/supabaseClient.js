const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// The service-role key is server-only and bypasses Supabase RLS for controlled
// backend operations such as Storage uploads. Fall back to the older variable
// to keep existing local development configuration working.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
