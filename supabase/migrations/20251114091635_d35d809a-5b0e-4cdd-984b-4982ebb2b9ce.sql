-- Add client_contact to team_member_type enum
ALTER TYPE team_member_type ADD VALUE IF NOT EXISTS 'client_contact';