# AIGC Multi-Track Track Deletion Design

## Goal

Make every user-added multi-track timeline track removable from its track
header without overcrowding the narrow header or allowing accidental loss of
contained clips.

## Interaction

Each track header keeps its move-up and move-down controls and adds a
`MoreHorizontal` action button. The anchored menu contains:

- show or hide track;
- mute or unmute track;
- delete track.

Removing an empty track happens immediately. Removing a non-empty track opens
a confirmation dialog that names the track and states the number of clips that
will also be removed. Cancel and Escape preserve the track.

## State Behavior

Deletion continues to use the existing `track/remove` editor-store action, so
the complete track and all clips are captured as one undo history step.

The editor owns deletion coordination because it also owns selection state.
After deletion it clears:

- `selectedTrackId` when it references the deleted track;
- `selectedElementId` when the selected element belongs to the deleted track.

Undo restores the track and clips but intentionally leaves selection empty.

## Components

- `AigcMultitrackTimeline` receives `onDeleteTrack(track)` from the editor.
- `TrackHeader` owns the open state for its actions popover and confirmation
  dialog.
- Existing Radix Popover and Dialog primitives provide viewport collision,
  focus restoration, Escape handling, and accessible dialog semantics.
- Existing direct show/hide and mute buttons move into the action menu to keep
  the header width stable.

## Accessibility

- The trigger is named `轨道操作：<track name>`.
- Menu actions have explicit labels reflecting current state.
- The confirmation dialog exposes a title, description, cancel button, and
  destructive confirmation button.
- Focus returns to the menu trigger when a menu or dialog closes.

## Validation

Tests cover empty-track deletion, non-empty confirmation, cancellation,
selection cleanup, one-step undo, menu state labels, desktop/mobile viewport
fit, and absence of real MediaKit requests.
