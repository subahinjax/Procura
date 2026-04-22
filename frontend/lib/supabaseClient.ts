// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hoqcgfgnktrzdknnsvxt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcWNnZmdua3RyemRrbm5zdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzE1NTYsImV4cCI6MjA5MTkwNzU1Nn0.b6GbI5X8N4CwdwOIN_lejJuTZdmxbsZUQGawaV9saUw';

export const supabase = createClient(supabaseUrl, supabaseKey);