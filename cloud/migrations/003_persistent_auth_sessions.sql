-- Desktop sessions persist until the user logs out or an administrator revokes access.
-- Existing active sessions are migrated to the same policy.
UPDATE auth_tokens
SET expires_at = NULL
WHERE revoked_at IS NULL;
