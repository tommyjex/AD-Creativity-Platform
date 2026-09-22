# AIGC Multi-Track Color Picker Design

## Goal

Replace the plain text-only color controls in the multi-track inspector with
an anchored visual color picker for text and text-background colors, while
preserving precise `#RRGGBBAA` editing and the existing MediaKit contract.

## Scope

- Text and subtitle element `style.color`.
- Text and subtitle element `style.background_color`.
- No backend schema or Provider payload changes.
- Canvas background remains on the existing compact text field.

## Interaction

Each field shows a color swatch and an uppercase `#RRGGBBAA` input. Activating
the swatch opens an anchored popover containing:

- a saturation/value color area;
- a hue control;
- an alpha control;
- a hexadecimal alpha input.

The popover closes on Escape, outside click, or trigger activation, and avoids
viewport edges.

Picker movement updates the stage preview immediately. A complete pointer or
keyboard gesture creates one undo history entry. Hex input keeps a local draft
and commits only on Enter or blur. Invalid drafts remain visible with an inline
error and do not modify the configuration.

## Implementation

- Use `react-colorful` for color and alpha interaction.
- Use `@radix-ui/react-popover` for positioning, focus behavior, dismissal,
  and viewport collision handling.
- Add a reusable `AigcMultitrackColorField` component.
- Add transient configuration replacement actions to the editor store:
  transient updates change the current config without appending history;
  gesture commit records the gesture's initial snapshot once.
- Keep the canonical stored value as uppercase `#RRGGBBAA`.

## Validation

Accept exactly eight hexadecimal digits after `#`. The UI never commits an
invalid draft. Existing multi-track normalization and validation remain the
final boundary.

## Accessibility

- The swatch trigger has an explicit accessible name.
- Popover controls retain library keyboard support.
- The text input remains available for precise entry.
- Invalid input uses `aria-invalid` and an associated alert.

## Testing

- Color parsing, normalization, and validation unit tests.
- Component tests for popover opening, picker-to-hex synchronization,
  hex-to-picker synchronization, alpha updates, invalid drafts, and dismissal.
- Store tests proving multiple transient updates plus one commit produce one
  undo entry.
- Editor tests for text and subtitle style updates.
- Desktop, tablet, and mobile Playwright checks for visibility, clipping,
  overlap, and undo behavior.
