# Debug Session: beijing-asset-timezone
- **Status**: [OPEN]
- **Issue**: Asset timestamps display eight hours behind China Standard Time.
- **Debug Server**: Pending
- **Log File**: .dbg/trae-debug-log-beijing-asset-timezone.ndjson

## Reproduction Steps
1. Open a project containing newly generated assets.
2. Compare asset creation/update time with the actual China Standard Time.
3. Observe whether the displayed timestamp is eight hours behind.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Expected Signal | Evidence |
|----|------------|------------|--------|-----------------|----------|
| T1 | Host or backend process timezone is not Asia/Shanghai | Medium | Low | OS/process reports UTC or another zone | Rejected: pre-fix line 1 is CST +08:00 |
| T2 | UTC database values are serialized without timezone offset | High | Low | API returns naive ISO timestamp without `Z`/offset | Confirmed: pre-fix line 3 |
| T3 | Database session timezone causes conversion drift | Medium | Medium | DB session timezone and stored values differ by eight hours | Rejected: pre-fix line 2 is +08:00 with expected 28800-second delta |
| T4 | Frontend formatter does not force Asia/Shanghai | High | Low | Formatter uses browser locale without `timeZone` | Confirmed: pre-fix line 4 |
| T5 | Only provider-created asset timestamps are affected | Low | Medium | Project/task timestamps are correct while assets are wrong | Rejected: pre-fix line 3 shows both assets and tasks are affected |

## Instrumentation Plan
1. Compare OS, Python process, database, API and browser time representations.
2. Inspect timestamp creation, schema serialization and frontend formatting code.
3. Instrument only if existing runtime evidence cannot distinguish the cause.

## Log Evidence
- Line 1: macOS and Python local time are CST +08:00.
- Line 2: MySQL global/session timezone are both +08:00.
- Line 3: API serializes UTC asset/task values without `Z` or an offset.
- Line 4: frontend formatter uses browser defaults and does not specify
  `Asia/Shanghai`.

## Verification Conclusion
The system and database timezones are correct. MySQL returns timezone-naive
Python datetimes for UTC values; the API serializes them without an offset,
and the frontend interprets them as local China time. This produces an
eight-hour lag. Fix by restoring UTC tzinfo at the schema boundary and
formatting explicitly in Asia/Shanghai, including legacy naive-string
compatibility.

Post-fix evidence:
- Line 1: API timestamps now include the UTC `Z` suffix.
- Line 2: browser converts `03:00Z` to `08/15 11:00` in Asia/Shanghai.
- Line 3: backend 221 tests, frontend 135 tests, and TypeScript all pass.
- Existing database rows require no migration.
