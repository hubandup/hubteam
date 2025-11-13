-- Add revenue_current_year column to clients table
ALTER TABLE clients ADD COLUMN revenue_current_year NUMERIC DEFAULT 0;