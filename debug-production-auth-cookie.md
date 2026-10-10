# Debug Session: production-auth-cookie
- **Status**: [OPEN]
- **Issue**: Production login appears successful, but artifact loading returns authentication errors and subsequent actions redirect to login.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-production-auth-cookie.ndjson`

## Reproduction Steps
1. Deploy with production database `ad-creativity`.
2. Sign in as `admin`.
3. Navigate to the generated outputs page.
4. Observe `Authentication is required`.
5. Click another authenticated action and observe redirect to login.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Browser rejects or omits the `Secure` session cookie because the site is opened over HTTP | High | Low | **Confirmed**: production URL is `http://101.126.86.254/` while production requires `AUTH_COOKIE_SECURE=true` |
| B | Frontend and API are cross-origin while wildcard CORS disables credentialed responses | High | Low | **Rejected for the observed flow**: deployed frontend is built with a relative `/api` base and accessed from the same public origin |
| C | Cookie is omitted from `/api/auth/me` because of its attributes | Medium | Low | **Confirmed as consequence of A**: a `Secure` cookie is not sent over this HTTP origin |
| D | Cookie reaches the backend but the session is absent, expired, revoked, or stored in a different database | Medium | Medium | **Rejected as primary cause**: the transport contract prevents the cookie from reaching authentication before session lookup can succeed |

## Log Evidence
- TLS event at `2026-10-09T13:47:37.562Z`: `GET /api/auth/me` returned 401 in 0.982 ms.
- Screenshot shows the authenticated shell with administrator identity while the generated outputs request reports `Authentication is required`.
- Static configuration evidence: production requires `AUTH_COOKIE_SECURE=true`; a browser opened over plain HTTP will reject or omit that cookie.
- Instrumentation added to `frontend/lib/api-client.ts` for login and current-user request origin, protocol, credential mode, and response status. No credentials, cookie values, or response bodies are collected.
- User confirmed the production page is opened at `http://101.126.86.254/`.
- The successful login response explains the transient administrator UI state; the next authenticated request has no usable session cookie and resets the frontend state on 401.

## Verification Conclusion
Root cause confirmed: the deployment serves the application over HTTP while the
production authentication contract requires an HTTPS-only `Secure` cookie.
Remediation must either terminate HTTPS before the application (recommended) or
explicitly weaken the production cookie policy for HTTP access.
