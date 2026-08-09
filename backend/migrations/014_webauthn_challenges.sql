-- WebAuthn challenges — short-lived, single-use nonces
-- Each challenge is generated server-side, stored here, and verified on return.
-- After verification the row is marked used=TRUE, preventing replay.

CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- base64url random bytes (32 bytes → 43 chars)
    challenge   TEXT NOT NULL UNIQUE,

    -- The student this challenge was issued to (from JWT)
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- The attendance session this challenge is tied to (null for standalone registration)
    session_id  UUID,

    -- 'register' or 'authenticate'
    purpose     TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),

    -- Auto-expires 2 minutes after creation
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 minutes'),

    -- Marked true after first verification — prevents replay
    used        BOOLEAN NOT NULL DEFAULT FALSE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_lookup
    ON webauthn_challenges(challenge) WHERE used = FALSE;

ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Optional: auto-clean old challenges older than 10 minutes to keep table small
-- (Run this periodically via pg_cron or a scheduled job)
-- DELETE FROM webauthn_challenges WHERE expires_at < now() - INTERVAL '10 minutes';
