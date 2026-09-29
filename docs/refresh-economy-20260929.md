# Refresh economy — September 29, 2026

The inventory refresh policy now follows the requested 45-second / 4-minute split. These intervals synchronize other people's saved changes; they do not delay saving or updating the current user's screen.

| Area | Previous background interval | New behavior |
| --- | --- | --- |
| Shared apparatus and inventory checks | 5 seconds | 45 seconds while visible and online |
| Inventory lists, equipment, air systems, stock, repairs, reports and templates | 60 seconds | 4 minutes while visible and online |
| Home operational briefing | 60 seconds | 60 seconds; cancel pending reads when hidden or offline |
| Home policy and box-card counts | 60 seconds, even in collapsed details | Load when More detail opens; refresh every 15 minutes while open and visible |
| Home staffing preview | 60 seconds, even in collapsed details | Mount only when More detail opens; refresh every 4 minutes while visible |

Inventory retains its manual Refresh control, fresh reads on return/reconnection, deduplication, and immediate updates after acknowledged saves. The visible screen explains its refresh interval and last received time. Hidden/offline nonessential polling pauses and cancels pending reads.

Dispatch delivery, Respond live updates, active incidents, TV board event updates/fallbacks, and the 15-second access check retain their previous timing. Local clocks and carousel timers are not database reads and remain unchanged.

The scheduled inventory reads drop from 12 per minute to about 1.33 for active checks (about 89% fewer), and from 1 per minute to 0.25 for browsing (75% fewer). Entry, save, manual refresh, and reconnect reads are additional. These are timer-based estimates, not measured database CPU or billing savings.

## Validation

- 46 focused tests passed, including immediate-save behavior, conditional reads, hidden/offline cancellation, request deduplication, and unchanged dispatch/security intervals.
- Production build and targeted application lint passed.
- Isolated browser fixture: collapsed Home made only its briefing read; opening details loaded each document count and the staffing preview once; reopening refreshed each once.
- Isolated inventory browser fixture: browsing showed 4 minutes; an active check showed 45 seconds; saving a test result immediately changed progress from 0/3 to 1/3 and showed the server acknowledgment. No production records were created by these tests.

Browser visibility guidance: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

This policy supersedes the earlier refresh intervals recorded in the same-day First Due inventory review.
