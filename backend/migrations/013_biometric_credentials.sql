-- WebAuthn biometric credentials
-- Stores one or more public key credentials per student.
-- A student may have multiple rows (one per registered device/platform).
-- The fingerprint NEVER leaves the device — only the public key is stored here.

CREATE TABLE IF NOT EXISTS biometric_credentials (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- base64url-encoded credential ID produced by navigator.credentials.create()
    credential_id TEXT NOT NULL UNIQUE,

    -- COSE-encoded public key (base64url), extracted from authenticatorData
    public_key    TEXT NOT NULL,

    -- Signature counter — must increase with each assertion to prevent replay attacks
    sign_count    BIGINT NOT NULL DEFAULT 0,

    -- Human-readable label set at registration time (e.g. "Samsung Galaxy S23")
    device_label  TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ
);

-- Fast lookup of all credentials for a given student (used by auth-options)
CREATE INDEX IF NOT EXISTS idx_biometric_creds_student
    ON biometric_credentials(student_id);

-- RLS: enabled. Students cannot write directly from the browser.
-- Only Edge Functions using the service-role key may insert/update.
ALTER TABLE biometric_credentials ENABLE ROW LEVEL SECURITY;
