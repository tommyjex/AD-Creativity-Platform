# Debug Session: subtitle-worker-interrupted
- **Status**: [OPEN]
- **Issue**: Production task video_subtitle_extraction-4b3d3f74-f456-4155-ad90-450e5fefbeaf failed with worker_interrupted after 1 minute 41 seconds.
- **Debug Server**: Not started; existing production evidence will be inspected first.
- **Log File**: Not created.

## Reproduction Steps
1. Run video subtitle extraction in production.
2. Observe Attempt #1 start at 2026-10-09 22:32:27 Beijing time.
3. Observe failure at 2026-10-09 22:34:08 with `AIGC worker stopped before completing the task`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| H1 | Backend service restarted or received a termination signal while the attempt was running | High | Low | Confirmed: orderly systemd stop at 22:34:07 exactly precedes task cancellation |
| H2 | The global AIGC worker lease expired or moved to another instance | Medium | Low | Rejected as primary cause: no lease-loss event; cancellation coincides with application shutdown |
| H3 | MediaKit or FFmpeg subtitle subprocess exit cancelled the worker coroutine | Medium | Medium | Rejected as primary cause: provider dispatch started normally and no provider/subprocess failure preceded cancellation |
| H4 | Attempt heartbeat stopped and stale-attempt recovery marked it interrupted | Medium | Medium | Rejected as primary cause: active process emitted cancellation during shutdown, not stale recovery |
| H5 | Kernel OOM or systemd watchdog killed the backend process | Low | Low | Rejected: systemd recorded a clean stop/deactivation and immediate explicit start, with exit status 0 |

## Log Evidence
- 22:32:27.124: run `1982eb5f-b977-4ac2-af8c-0fa138cb2785` started.
- 22:32:27.163: task `c69cde31-b4fe-4d3b-bd5c-3cb9abc97828`, attempt 1 entered execution.
- 22:32:27.164: MediaKit provider dispatch started.
- 22:34:07: systemd logged `Stopping ad-creativity-backend.service`.
- 22:34:07.873: the same run failed and the same task attempt was canceled during application shutdown.
- 22:34:08.958: replacement backend process `4018211` completed startup.
- Current state: service active, `NRestarts=0`, main PID `4018211`.

## Verification Conclusion
Root cause confirmed: an operator-triggered backend service restart interrupted the in-flight subtitle extraction. This was not a subtitle extraction or MediaKit failure. No code or data fix is required; verification is to retry the node while the service remains stable.
