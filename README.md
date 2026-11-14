# ResoGuard-AI · SIH26104

A real-time voice-clone risk dashboard for enterprise calls. The Next.js frontend streams 16 kHz mono audio to the ResoGuard FastAPI service over WebSocket; the backend supplies scores, thresholds, alerts, and audit verification. When its health endpoint is unavailable, the page switches to a clearly labeled simulation that never captures microphone audio.

## Backend URL

Set `NEXT_PUBLIC_API_URL` to the FastAPI base URL (for example, `https://your-service.example.com`, without a trailing slash). In Vercel, add it in **Project Settings → Environment Variables** for the Preview and Production environments, then redeploy. The frontend checks `/health`, streams to `/ws`, and calls the backend's enrollment and audit routes. Configure the backend's allowed origins to include the deployed Vercel origin.

For local development, set the same variable in `.env.local`. Leaving it unset starts the offline demo mode.

## Privacy and deployment

In live mode, microphone audio is streamed to the ResoGuard backend for scoring. Audio is not stored; only scores and metadata are logged in a hash-chained audit trail. The audit tamper control is a destructive backend demonstration and should only be enabled against disposable demo data.

The FastAPI backend and detector model run as a separate container service; Vercel hosts the frontend. The backend origin must be included in the FastAPI service's allowed-origin configuration.
