#!/usr/bin/env bash
# Updates Site URL, redirect allow-list, and confirm-email template via Management API.
# Requires: SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
# Usage: SUPABASE_ACCESS_TOKEN=sbp_... ./scripts/update-supabase-auth-urls.sh

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-hstxsytpcpusmjlcrhfz}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"

SITE_URL="https://retainwrite.com"
ALLOW_LIST=$(cat <<'EOF'
https://retainwrite.com/**
https://www.retainwrite.com/**
https://retainwrite.vercel.app/**
https://retainwrite.com/auth/confirm
https://retainwrite.com/auth/callback
https://www.retainwrite.com/auth/confirm
https://www.retainwrite.com/auth/callback
EOF
)

TEMPLATE_CONTENT=$(cat <<'EOF'
<h2>Confirm your email</h2>
<p>Thanks for joining RetainWrite. Confirm this email to finish creating your account.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app">Confirm email address</a></p>
<p>If the button doesn’t work, copy and paste this URL into Safari or Chrome:</p>
<p>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app</p>
EOF
)

# Build JSON with jq if available, else python
BODY=$(SITE_URL="$SITE_URL" ALLOW_LIST="$ALLOW_LIST" TEMPLATE_CONTENT="$TEMPLATE_CONTENT" python3 - <<'PY'
import json, os
print(json.dumps({
  "site_url": os.environ["SITE_URL"],
  "uri_allow_list": os.environ["ALLOW_LIST"].strip(),
  "mailer_templates_confirmation_content": os.environ["TEMPLATE_CONTENT"],
}))
PY
)

echo "PATCH auth config for $PROJECT_REF ..."
curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("site_url=", d.get("site_url")); print("uri_allow_list=", d.get("uri_allow_list")); print("template_set=", bool(d.get("mailer_templates_confirmation_content")))'

echo "Done."
