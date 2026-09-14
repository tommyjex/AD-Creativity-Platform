# AIGC Multi-Track Provider Layer Order Design

## Background

The multi-track editor presents tracks from foreground to background. A track
with a smaller array index is rendered above tracks with larger indices in the
browser preview.

MediaKit uses the opposite contract for its `track` array:

- `track[0]` is the bottom layer.
- A larger track index means a higher render layer.

The backend currently forwards editor tracks to MediaKit without converting
between these two conventions. For a project ordered as text then video, the
provider receives text at index 0 and a full-canvas video at index 1. The video
therefore covers the text in the rendered output even though the browser
preview shows the text above the video.

Run 15 of pipeline `7fc13c4b-d2f9-4757-b88c-2943f77d31c2` confirmed this
failure mode:

- MediaKit received both resolved text values.
- Text timing and transforms were inside the 1920x1080 canvas.
- The task completed successfully.
- Frames captured at 0.5 seconds and 4.5 seconds contained only the source
  video.

## Goal

Make MediaKit output use the same visible layer order as the multi-track editor
preview.

## Compatibility Decision

This design supersedes the direct provider-order assumptions in:

- `2026-09-05-aigc-mediakit-multitrack-editor-design.md`
- `2026-09-09-aigc-multitrack-preview-layer-order-design.md`

Those documents describe saved track order as MediaKit bottom-to-top order.
That convention does not match the current editor implementation or the
foreground-to-background behavior selected for the timeline. Existing saved
projects already rely on the current editor behavior, so the provider adapter
must perform the conversion instead of changing the editor or migrating saved
definitions.

## Non-Goals

- Changing the editor's track ordering convention.
- Reordering tracks in saved pipeline definitions.
- Changing element order inside a track.
- Changing text, font, transform, timing, mute, or hidden-track behavior.
- Migrating existing pipeline definitions.

## Design

### Editor Contract

The editor keeps its existing foreground-to-background track order:

- Smaller track index: higher visual layer.
- Larger track index: lower visual layer.

This preserves the current timeline and preview behavior.

### Provider Conversion

The backend continues to resolve and render each track using the existing
logic. After hidden and empty tracks have been omitted, it reverses the
resulting provider track list before calling MediaKit.

Example:

```text
Editor:   [text, image, video]
MediaKit: [video, image, text]
```

The conversion occurs only at the MediaKit request boundary. The saved project,
task parameters, asset metadata, and editor state retain editor order.

Reversing after filtering is intentional. It gives the provider a compact
bottom-to-top list while preserving the relative layer order of all submitted
tracks.

### Element Order

Elements within each track remain in their original order. The fix changes only
the outer track array because MediaKit uses only that dimension for visual
layer priority.

## Error Handling

No new runtime error path is introduced. Existing validation still rejects
projects without visible elements before provider submission.

## Testing

Backend gateway coverage will assert that:

- A project ordered as foreground text then background video is submitted as
  video then text.
- More than two visible tracks are reversed as one ordered list.
- Hidden and empty tracks remain excluded.
- Element order within a submitted track is unchanged.
- Stored task parameters remain in editor order.

The existing frontend preview layer test remains the contract for editor
ordering. No frontend behavior change is required.

## Acceptance Criteria

- A full-canvas background video no longer covers a text track placed above it
  in the editor.
- The MediaKit payload is ordered from background to foreground.
- The browser preview and provider output use equivalent visual stacking.
- Relevant backend tests pass without changing saved pipeline definitions.
