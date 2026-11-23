# Date picker

`src/components/shared/DatePicker/` is the application's one date control. Use it anywhere a native `type="date"` or `type="datetime-local"` input would go; do not add native date inputs.

```tsx
<DatePicker value={from} onChange={setFrom} max={to || undefined} ariaLabel="Registered from" placeholder="Any date" size="dense" />
<DatePicker value={publishAt} onChange={setPublishAt} mode="datetime" clearable={false} ariaLabel="Publish Date" />
```

- **Same value strings as a native input:** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` (local time) in `mode="datetime"`. Empty means no date. `min` and `max` are `YYYY-MM-DD`. Existing parsing and validation code does not change.
- **Standard styling:** the closed control is the canonical Underline dropdown trigger (`drm-dropdown`, `dv-underline-dropdown`, sizes `dense`/`compact`/`default`) with a calendar icon, and the calendar opens on the dropdown's own popover surface (`drm-dropdown__menu`): portaled to the body, below or above the trigger, closed by an outside click or Escape. Only the calendar's contents are styled in `DatePicker.css`, with the dropdown's type roles, accent and hover language. The time fields are the canonical text input (`DreamVizTextInput`).
- **Labels:** pass `label` for a label above the control, or `ariaLabel`/`ariaLabelledBy` when the label is elsewhere. Inside a `rv-ctrl-row`, use `DateTimeRow` (`features/admin/AdminFields.tsx`), which is the label-above row around the picker.
- **Behaviour:** a day click picks and closes (`date`); `datetime` keeps the time, stays open, and has hour and minute fields (12 hour with AM/PM where the viewer's locale uses it) and **Now**/**Done**. **Today** and **Clear** are offered (turn Clear off with `clearable={false}` for a date that must have a value). Title opens a month and year view. Days outside `min`/`max` are disabled.
- **Keyboard:** ←/→ a day, ↑/↓ a week, Home/End the week's ends, PageUp/PageDown a month (Shift: a year), Enter or Space picks, Escape closes and returns focus to the trigger, Tab stays inside the open calendar, ArrowDown on the trigger opens it.
- **Date maths** (`dateValue.ts`) works in local calendar dates, so no time zone can move a day.

Used by: Admin Console → User Accounts (Registered from / to) and Message Center (Publish Date).
