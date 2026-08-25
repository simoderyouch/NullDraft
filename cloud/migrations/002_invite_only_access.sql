-- Passwords are no longer used for new accounts. Access is granted only by
-- an administrator-created, single-use invitation.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMPTZ;

ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS device_name TEXT;

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_active ON invitations(expires_at) WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_tokens_device ON auth_tokens(user_id, device_id);
