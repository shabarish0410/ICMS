const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fjdmijjsixtbamhwourc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZG1pampzaXh0YmFtaHdvdXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTg2MjgsImV4cCI6MjA5Nzc5NDYyOH0.KxnxPw2tT5FX5O7NBJWjIha2YYRspeIlKVZKCAdlxiA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('attendance_sessions').select('*');
  console.log('Anon Data:', data);
  console.log('Anon Error:', error);
}

test();
