# AIGC Multi-Track Provider Payload Mapping Design

## Background

The multi-track editor stores a provider-neutral project model:

- Visual placement is stored in an element-level `transform` object with
  `x`, `y`, `width`, `height`, and `rotation`.
- Text and subtitle appearance is stored in a nested `style` object.
- Subtitle assets are represented internally by `asset_id`.

The MediaKit multi-track API uses a different wire format:

- Visual placement must be a `transform` filter inside the element's `extra`
  array.
- Transform coordinates are named `pos_x` and `pos_y`.
- Text and subtitle style fields are top-level element fields.
- Font color is named `font_color`.
- Subtitle file URLs are supplied through the `text` field.

The backend currently forwards the internal `transform` and most of the nested
`style` object directly. MediaKit ignores those unsupported fields and falls
back to its defaults. The observed output therefore rendered text at the
top-left in the default white 200px font instead of using the editor position,
size, and color.

## Goal

Translate every supported visual element from the editor model into the
MediaKit request contract so preview placement and text appearance match the
generated video.

## Scope

The conversion covers:

- Video transforms.
- Image transforms.
- Text transforms and styles.
- Subtitle transforms, styles, and asset URL field.

This design does not change:

- Frontend data structures or preview rendering.
- Pipeline definitions or saved task parameters.
- Track order conversion.
- Element order within a track.
- Timing, trimming, speed, volume, fades, or transitions.
- Font selection and font URL validation.

## Approaches Considered

### Provider Boundary Conversion

Keep the existing editor model and translate it immediately before MediaKit
submission.

Benefits:

- Existing projects require no migration.
- Frontend and validation models remain provider-neutral.
- MediaKit-specific names stay isolated at the integration boundary.
- The output payload can be covered by focused gateway tests.

This is the selected approach.

### Store MediaKit-Native Fields

Replace `transform` and `style` in the persisted model with `extra`,
`font_color`, and other provider fields.

This would couple the editor to MediaKit and require migration of existing
pipeline definitions. It is rejected.

### Match the Preview to Provider Defaults

Change the browser preview to mimic the currently generated video.

This preserves an invalid request and would make the editor less useful. It is
rejected.

## Provider Mapping

### Transform

For each video, image, text, and subtitle element, remove the internal
`transform` field and append this MediaKit filter:

```json
{
  "type": "transform",
  "pos_x": 502,
  "pos_y": 299,
  "width": 1152,
  "height": 162,
  "rotation": 0
}
```

Mapping:

| Internal field | MediaKit field |
|---|---|
| `transform.x` | `extra[].pos_x` |
| `transform.y` | `extra[].pos_y` |
| `transform.width` | `extra[].width` |
| `transform.height` | `extra[].height` |
| `transform.rotation` | `extra[].rotation` |

MediaKit requires integer transform values while the editor supports floats.
Each value is converted with Python's `round()` at the Provider boundary.
Width and height are clamped to at least 1 after rounding.

The conversion creates an `extra` array when one is absent. If later features
add other filters, the transform filter is appended without changing their
relative order.

### Text and Subtitle Style

Remove the internal `style` object and map its fields to the MediaKit element:

| Internal field | MediaKit field |
|---|---|
| `style.font_type` | `font_type` |
| `style.font_size` | `font_size` |
| `style.color` | `font_color` |
| `style.bold` | `bold` |
| `style.italic` | `italic` |
| `style.underline` | `underline` |
| `style.background_color` | `background_color` |

`font_size` is converted with `round()` and clamped to at least 1. A null
`font_type` is omitted so MediaKit can apply its default font. Other style
fields are submitted explicitly to prevent Provider defaults from changing the
previewed appearance.

### Source Fields

- Video and image assets continue to use the MediaKit `source` field.
- Text elements continue to use the resolved content in the `text` field.
- Subtitle assets use their signed URL in the MediaKit `text` field.
- Subtitle elements must not contain `source`, `asset_id`, or internal source
  binding fields.

## Data Flow

1. Validate the saved multi-track project with the existing schema.
2. Resolve text values and media assets without changing the project.
3. Serialize each element into a new dictionary.
4. Convert target times and existing media-specific fields as today.
5. Convert visual transforms into `extra` filters.
6. Flatten text and subtitle style fields.
7. Assign the correct `text` or `source` Provider field.
8. Reverse the filtered outer track list according to the approved layer-order
   design.
9. Submit the converted payload to MediaKit.

The original Pydantic project and `task.params` remain unchanged.

## Error Handling

No new user-facing error path is required. Existing project validation rejects
invalid dimensions, out-of-canvas transforms, invalid colors, unsupported font
URLs, and unresolved assets before Provider conversion.

The mapping is deterministic and cannot silently fall back to nested internal
fields: tests assert that `transform` and `style` are absent from submitted
visual elements.

## Testing

Gateway tests will verify:

- Video, image, text, and subtitle transforms are represented by MediaKit
  `extra` transform filters.
- `x` and `y` become `pos_x` and `pos_y`.
- Float values are rounded at the boundary.
- Text and subtitle styles are top-level fields with `font_color`.
- Null `font_type` is omitted.
- Subtitle signed URLs use `text`, not `source`.
- Internal `transform`, `style`, `asset_id`, `inline_text`, and source bindings
  are absent from the Provider payload.
- Text element order and Provider track reversal remain unchanged.
- Stored `task.params` remain in editor format.

The MediaKit client whitelist test will continue to assert that an already
normalized Provider project passes through without mutation.

## Acceptance Criteria

- Generated text uses the editor's position, bounding box, rotation, font size,
  color, emphasis, underline, and background color.
- Generated subtitle styling and placement follow the same mapping.
- Generated video and image placement use the editor transforms.
- The Provider payload contains only MediaKit-supported placement and style
  fields.
- Existing pipeline definitions require no migration.
- Relevant backend tests pass.
