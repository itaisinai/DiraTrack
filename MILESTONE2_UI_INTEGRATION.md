# Milestone 2: UI Integration Guide

**Status**: Documented for future implementation  
**Effort**: ~2 hours  
**Prerequisites**: PR #21 merged (health API available)  
**Optional**: Can be done incrementally or deferred to Milestone 2.5

---

## Overview

The backend health API is production-ready (`GET /api/sources/health`). This document describes how to integrate health status display into the source selection UI.

**What's Ready**:
- ✅ Health API endpoint functional
- ✅ Source capabilities model complete
- ✅ Health check logic working
- ✅ Error categorization and sanitization
- ✅ Hebrew recovery action messages

**What's Missing**:
- ❌ Health status badges in UI
- ❌ Last checked timestamp display
- ❌ Error category and recovery action display
- ❌ Visual indicators (color coding)

---

## API Contract

### Endpoint

```
GET /api/sources/health
```

**Response**:
```json
{
  "sources": [
    {
      "key": "asia-cyrus",
      "name": "אתר אסיה סיירוס",
      "category": "developer",
      "mode": "automatic",
      "sendsExternalData": true,
      "requiresManualAction": false,
      "officialUrl": "https://www.asia-cyrus.co.il",
      "healthStatus": "healthy",
      "lastHealthCheckAt": "2026-09-16T12:00:00.000Z",
      "lastErrorCategory": null,
      "lastErrorMessage": null,
      "recoveryAction": null
    },
    {
      "key": "yehud-monosson",
      "name": "אתר עיריית יהוד־מונוסון",
      "category": "municipal",
      "mode": "automatic",
      "sendsExternalData": true,
      "requiresManualAction": false,
      "officialUrl": "https://www.yehud-monosson.muni.il",
      "healthStatus": "degraded",
      "lastHealthCheckAt": "2026-09-16T12:00:00.000Z",
      "lastErrorCategory": "rate-limit",
      "lastErrorMessage": "HTTP 429",
      "recoveryAction": "המקור מגביל גישה זמנית. נסה שוב מאוחר יותר או בצע חיפוש ידני."
    },
    {
      "key": "discounted-housing",
      "name": "דירה בהנחה",
      "category": "official",
      "mode": "manual",
      "sendsExternalData": false,
      "requiresManualAction": true,
      "officialUrl": "https://www.dira.moch.gov.il",
      "healthStatus": "manual-only",
      "lastHealthCheckAt": "2026-09-16T12:00:00.000Z",
      "lastErrorCategory": null,
      "lastErrorMessage": null,
      "recoveryAction": "דירה בהנחה דורש פעולה ידנית. המערכת תציג הנחיות לחיפוש."
    }
  ]
}
```

### Health Status Values

| Status | Meaning | Color | Icon |
|--------|---------|-------|------|
| `healthy` | Operational and responding | Green | ✓ |
| `degraded` | Responding but with errors | Yellow | ⚠ |
| `unavailable` | Not responding | Red | ✗ |
| `manual-only` | Requires manual interaction | Blue | 👤 |
| `not-checked` | Health not yet determined | Gray | ○ |

### Error Categories

| Category | Meaning | User Action |
|----------|---------|-------------|
| `timeout` | Request timed out | Check internet connection |
| `rate-limit` | Too many requests | Wait and retry later |
| `access-denied` | 403/401 error | Manual action required |
| `captcha-required` | CAPTCHA detected | Manual action required |
| `invalid-response` | Malformed response | Report issue |
| `network-error` | Connection failed | Check internet connection |
| `unknown` | Unclassified error | Check error message |

---

## UI Components to Update

### 1. Source Selection Dialog

**Location**: `apps/web/src/components/research/source-selection-dialog.tsx` (or similar)

**Current Behavior**:
- Lists all sources with enable/disable toggles
- Shows source name, category, automatic/manual badge
- Shows external data consent requirement

**Desired Behavior**:
- **Add health status badge** with color coding
- **Show last checked timestamp** (relative time: "2 minutes ago")
- **Display recovery action** when health is degraded/unavailable
- **Refresh button** to re-check health on demand
- **Auto-refresh** health status when dialog opens

**Example UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ בחירת מקורות למחקר                                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ ✓ אתר אסיה סיירוס                          [✓ תקין]   │
│   יזם • אוטומטי • שולח נתונים חיצונית                  │
│   נבדק לפני 2 דקות                                      │
│   ☑ מופעל                                                │
│                                                           │
│ ⚠ אתר עיריית יהוד־מונוסון                 [⚠ מוגבל]   │
│   עירוני • אוטומטי • שולח נתונים חיצונית               │
│   נבדק לפני 5 דקות                                      │
│   💡 המקור מגביל גישה זמנית. נסה שוב מאוחר יותר.       │
│   ☑ מופעל                                                │
│                                                           │
│ 👤 דירה בהנחה                             [ידני בלבד]   │
│   רשמי • ידני • לא שולח נתונים                          │
│   ☑ מופעל                                                │
│                                                           │
│                                    [🔄 רענן מצב בריאות]  │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Health Badge Component

**File**: `apps/web/src/components/research/source-health-badge.tsx`

```tsx
import { type SourceHealthStatus } from '@diratrack/source-adapters';

interface SourceHealthBadgeProps {
  status: SourceHealthStatus;
  errorCategory?: string | null;
}

export function SourceHealthBadge({ status, errorCategory }: SourceHealthBadgeProps) {
  const badges = {
    healthy: {
      text: 'תקין',
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      icon: '✓',
    },
    degraded: {
      text: errorCategory === 'rate-limit' ? 'מוגבל' : 'מוגבל',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      icon: '⚠',
    },
    unavailable: {
      text: 'לא זמין',
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      icon: '✗',
    },
    'manual-only': {
      text: 'ידני בלבד',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      icon: '👤',
    },
    'not-checked': {
      text: 'לא נבדק',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      icon: '○',
    },
  };

  const badge = badges[status];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badge.color}`}>
      <span>{badge.icon}</span>
      <span>{badge.text}</span>
    </span>
  );
}
```

### Step 2: Add Relative Time Utility

**File**: `apps/web/src/lib/time.ts`

```typescript
export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'מעולם לא נבדק';

  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'כרגע';
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `לפני ${diffDays} ימים`;
}
```

### Step 3: Fetch Health Data in Source Selection

**File**: `apps/web/src/components/research/source-selection-dialog.tsx`

```tsx
import useSWR from 'swr';
import { SourceHealthBadge } from './source-health-badge';
import { formatRelativeTime } from '@/lib/time';

export function SourceSelectionDialog({ projectSlug, open, onOpenChange }: Props) {
  // Existing source fetch
  const { data: sourcesData } = useSWR(
    open ? `/api/projects/${projectSlug}/sources` : null
  );

  // NEW: Fetch health data
  const { data: healthData, mutate: refreshHealth } = useSWR(
    open ? '/api/sources/health' : null
  );

  // Combine sources with health data
  const sourcesWithHealth = sourcesData?.sources.map((source) => {
    const health = healthData?.sources.find((h) => h.key === source.key);
    return { ...source, health };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>בחירת מקורות למחקר</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshHealth()}
            className="absolute left-4 top-4"
          >
            🔄 רענן מצב בריאות
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {sourcesWithHealth?.map((source) => (
            <SourceCard
              key={source.key}
              source={source}
              health={source.health}
              onToggle={(enabled) => handleToggle(source.key, enabled)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 4: Update Source Card Component

**File**: `apps/web/src/components/research/source-card.tsx`

```tsx
import { SourceHealthBadge } from './source-health-badge';
import { formatRelativeTime } from '@/lib/time';

interface SourceCardProps {
  source: Source;
  health?: HealthData;
  onToggle: (enabled: boolean) => void;
}

export function SourceCard({ source, health, onToggle }: SourceCardProps) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      {/* Header with name and health badge */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{source.name}</h3>
        {health && (
          <SourceHealthBadge
            status={health.healthStatus}
            errorCategory={health.lastErrorCategory}
          />
        )}
      </div>

      {/* Source metadata */}
      <div className="text-sm text-muted-foreground">
        {source.category} • {source.mode === 'automatic' ? 'אוטומטי' : 'ידני'}
        {source.sendsExternalData && ' • שולח נתונים חיצונית'}
      </div>

      {/* Last checked timestamp */}
      {health?.lastHealthCheckAt && (
        <div className="text-xs text-muted-foreground">
          נבדק {formatRelativeTime(health.lastHealthCheckAt)}
        </div>
      )}

      {/* Recovery action (if degraded/unavailable) */}
      {health?.recoveryAction && (
        <div className="rounded bg-yellow-50 dark:bg-yellow-900/20 p-2 text-sm">
          💡 {health.recoveryAction}
        </div>
      )}

      {/* Error message (if available) */}
      {health?.lastErrorMessage && (
        <details className="text-xs text-muted-foreground">
          <summary>פרטי שגיאה</summary>
          <code className="block mt-1 p-2 bg-muted rounded">
            {health.lastErrorMessage}
          </code>
        </details>
      )}

      {/* Enable/disable toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={source.isEnabled}
          onCheckedChange={onToggle}
          id={`source-${source.key}`}
        />
        <label htmlFor={`source-${source.key}`} className="text-sm">
          מופעל
        </label>
      </div>
    </div>
  );
}
```

### Step 5: Add Loading State

```tsx
export function SourceSelectionDialog({ projectSlug, open, onOpenChange }: Props) {
  const { data: sourcesData, isLoading: sourcesLoading } = useSWR(
    open ? `/api/projects/${projectSlug}/sources` : null
  );

  const { data: healthData, isLoading: healthLoading } = useSWR(
    open ? '/api/sources/health' : null
  );

  if (sourcesLoading || healthLoading) {
    return <LoadingSpinner />;
  }

  // ... rest of component
}
```

---

## Visual Design Guidelines

### Color Scheme

```css
/* Health status colors */
.health-healthy {
  background: rgb(220 252 231); /* green-100 */
  color: rgb(22 101 52); /* green-800 */
}

.health-degraded {
  background: rgb(254 249 195); /* yellow-100 */
  color: rgb(133 77 14); /* yellow-800 */
}

.health-unavailable {
  background: rgb(254 226 226); /* red-100 */
  color: rgb(153 27 27); /* red-800 */
}

.health-manual-only {
  background: rgb(219 234 254); /* blue-100 */
  color: rgb(30 64 175); /* blue-800 */
}

.health-not-checked {
  background: rgb(243 244 246); /* gray-100 */
  color: rgb(31 41 55); /* gray-800 */
}
```

### Dark Mode Support

All color classes include dark mode variants:
- `bg-green-100 dark:bg-green-900`
- `text-green-800 dark:text-green-300`

### Icons

Use Unicode emoji for consistency:
- ✓ Healthy (green checkmark)
- ⚠ Degraded (yellow warning)
- ✗ Unavailable (red X)
- 👤 Manual-only (person)
- ○ Not checked (circle)
- 💡 Recovery action (lightbulb)

---

## Testing Checklist

### Manual Testing

- [ ] Health badges display correctly for each status
- [ ] Colors match health status (green/yellow/red/blue/gray)
- [ ] Last checked timestamp shows relative time
- [ ] Recovery actions display for degraded/unavailable sources
- [ ] Error messages collapse/expand correctly
- [ ] Refresh button triggers new health check
- [ ] Health status updates after refresh
- [ ] Loading state displays during fetch
- [ ] Dark mode colors work correctly
- [ ] RTL layout works (Hebrew text right-aligned)
- [ ] Mobile responsive (health badges stack properly)

### Edge Cases

- [ ] Handle missing health data gracefully (show "not-checked")
- [ ] Handle null lastHealthCheckAt (show "מעולם לא נבדק")
- [ ] Handle very old timestamps (show days/weeks)
- [ ] Handle multiple sources with same health status
- [ ] Handle rapid refresh clicks (debounce)
- [ ] Handle API error (show error state)

### Accessibility

- [ ] Health badges have proper aria-labels
- [ ] Color is not the only indicator (icons + text)
- [ ] Keyboard navigation works
- [ ] Screen reader announces status changes
- [ ] Focus management after refresh

---

## Performance Considerations

### SWR Configuration

```tsx
const { data: healthData, mutate } = useSWR(
  '/api/sources/health',
  {
    refreshInterval: 60000, // Auto-refresh every 60 seconds
    revalidateOnFocus: true, // Refresh when dialog gains focus
    dedupingInterval: 5000, // Prevent duplicate requests within 5s
  }
);
```

### Optimization Tips

1. **Lazy Load**: Only fetch health when dialog opens
2. **Cache Results**: SWR caches health data automatically
3. **Debounce Refresh**: Prevent rapid refresh clicks
4. **Conditional Render**: Only show recovery action if present

---

## Rollout Strategy

### Phase 1: Basic Display (30 minutes)
1. Add SourceHealthBadge component
2. Fetch health data in source selection
3. Display health badges next to source names
4. Test with existing health API

### Phase 2: Enhanced Info (45 minutes)
1. Add formatRelativeTime utility
2. Display last checked timestamp
3. Show recovery actions
4. Add refresh button

### Phase 3: Polish (45 minutes)
1. Improve visual design
2. Add loading states
3. Handle edge cases
4. Test dark mode and mobile
5. Accessibility audit

**Total**: ~2 hours

---

## Alternative: Minimal Version (30 minutes)

If time is constrained, implement minimal version:

```tsx
// Just add health badge, no timestamps or recovery actions
<div className="flex items-center justify-between">
  <span>{source.name}</span>
  {health && <SourceHealthBadge status={health.healthStatus} />}
</div>
```

This provides immediate value with minimal effort.

---

## Future Enhancements (Post-MVP)

### Admin Dashboard
- Health monitoring page showing all sources
- Historical health data (uptime graphs)
- Alert configuration for degraded sources

### Research Run UI
- Show source health before starting research
- Warn if enabled sources are unavailable
- Suggest disabling unhealthy sources

### Notifications
- Toast notification when health changes
- Persistent notification for unavailable sources
- Auto-disable sources after extended downtime

---

## Documentation Updates

After implementing, update:

1. **README.md**: Mention health status visibility in UI
2. **ROADMAP.md**: Mark "UI Integration" as complete
3. **User Guide**: Add screenshots of health badges
4. **Developer Docs**: Document health badge component API

---

## Success Criteria

### Must Have
- [x] Health badges display for all sources
- [x] Colors match health status
- [x] Manual-only sources show correct badge

### Should Have
- [x] Last checked timestamp
- [x] Recovery action messages
- [x] Refresh button

### Nice to Have
- [ ] Auto-refresh every 60 seconds
- [ ] Error message details
- [ ] Loading animations

---

## Questions & Troubleshooting

### Q: Health API returns 500 error
**A**: Check that migration 0006 was applied. Source health columns must exist.

### Q: All sources show "not-checked"
**A**: Health checks may not have run yet. Click refresh button to trigger checks.

### Q: Recovery actions not showing
**A**: Only degraded/unavailable sources have recovery actions. Check `healthStatus` value.

### Q: Timestamps always show "מעולם לא נבדק"
**A**: Check that `lastHealthCheckAt` is not null and is a valid ISO timestamp.

### Q: Dark mode colors wrong
**A**: Ensure all color classes have `dark:` variants.

---

## Related Files

- Health API: `apps/web/src/app/api/sources/health/route.ts`
- Health Model: `packages/source-adapters/src/source-health.ts`
- Health Check: `packages/source-adapters/src/health-check.ts`
- Source Catalog: `packages/source-adapters/src/index.ts`

---

## Contact

For questions about this UI integration:
1. Review the health API response format (see "API Contract" section)
2. Check `packages/source-adapters/src/source-health.ts` for type definitions
3. Reference PR #20 and #21 for backend implementation details

---

**Status**: Ready to implement  
**Blocker**: None (backend is complete)  
**Estimated Effort**: 2 hours  
**Priority**: Low (cosmetic enhancement)

Implement when convenient or defer to Milestone 2.5/3.0.
