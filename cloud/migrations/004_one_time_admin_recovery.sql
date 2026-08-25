-- A break-glass recovery may be used once when the initial admin desktop
-- session was not retained. The API records its use before returning a link.
CREATE TABLE IF NOT EXISTS bootstrap_admin_recovery (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    email TEXT NOT NULL,
    invitation_id UUID NOT NULL REFERENCES invitations(id)
);
