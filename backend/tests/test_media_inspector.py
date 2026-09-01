from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image
from pillow_heif import register_heif_opener

from backend.app.schemas import ReferenceAssetKind
from backend.app.services.media_inspector import (
    AUDIO_MAX_BYTES,
    IMAGE_MAX_BYTES,
    MediaInspection,
    MediaInspectionError,
    _parse_audio_probe,
    _parse_video_probe,
    _validate_file_size,
    inspect_image,
    validate_seedance_media_inputs,
)


def image_bytes(format_name: str, size: tuple[int, int] = (640, 480)) -> bytes:
    register_heif_opener()
    output = BytesIO()
    Image.new("RGB", size, color=(20, 40, 60)).save(output, format=format_name)
    return output.getvalue()


@pytest.mark.parametrize(
    ("format_name", "container", "mime_type"),
    [
        ("BMP", "bmp", "image/bmp"),
        ("GIF", "gif", "image/gif"),
        ("HEIF", "heif", "image/heif"),
        ("JPEG", "jpeg", "image/jpeg"),
        ("PNG", "png", "image/png"),
        ("TIFF", "tiff", "image/tiff"),
        ("WEBP", "webp", "image/webp"),
    ],
)
def test_image_inspection_detects_supported_content(
    format_name: str,
    container: str,
    mime_type: str,
) -> None:
    inspected = inspect_image(image_bytes(format_name))

    assert inspected.container == container
    assert inspected.mime_type == mime_type
    assert inspected.width == 640
    assert inspected.height == 480


def test_image_inspection_rejects_invalid_dimensions_and_content() -> None:
    with pytest.raises(MediaInspectionError, match="300 and 6000"):
        inspect_image(image_bytes("PNG", (299, 300)))
    with pytest.raises(MediaInspectionError, match="supported image"):
        inspect_image(b"not-an-image")


def video_probe(
    *,
    video_codec: str = "h264",
    audio_codec: str | None = "aac",
    width: int = 1280,
    height: int = 720,
    fps: str = "30/1",
    duration: str = "10.0",
    major_brand: str = "isom",
) -> dict[str, object]:
    streams: list[dict[str, object]] = [
        {
            "codec_type": "video",
            "codec_name": video_codec,
            "width": width,
            "height": height,
            "avg_frame_rate": fps,
            "duration": duration,
        }
    ]
    if audio_codec:
        streams.append({"codec_type": "audio", "codec_name": audio_codec})
    return {
        "format": {
            "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
            "duration": duration,
            "tags": {"major_brand": major_brand},
        },
        "streams": streams,
    }


@pytest.mark.parametrize("codec", ["h264", "hevc"])
def test_video_probe_accepts_mp4_supported_codecs(codec: str) -> None:
    inspected = _parse_video_probe(
        video_probe(video_codec=codec),
        filename="clip.mp4",
        mime_type="video/mp4",
    )

    assert inspected.container == "mp4"
    assert inspected.video_codec == codec
    assert inspected.audio_codec == "aac"
    assert inspected.fps == 30


def test_video_probe_accepts_mov_pcm_and_rejects_invalid_media() -> None:
    inspected = _parse_video_probe(
        video_probe(audio_codec="pcm_s16le", major_brand="qt  "),
        filename="clip.mov",
        mime_type="video/quicktime",
    )
    assert inspected.container == "mov"
    assert inspected.audio_codec == "pcm_s16le"

    with pytest.raises(MediaInspectionError, match="video codec"):
        _parse_video_probe(
            video_probe(video_codec="vp9"),
            filename="clip.mp4",
            mime_type="video/mp4",
        )
    with pytest.raises(MediaInspectionError, match="audio codec"):
        _parse_video_probe(
            video_probe(audio_codec="opus"),
            filename="clip.mp4",
            mime_type="video/mp4",
        )
    with pytest.raises(MediaInspectionError, match="frame rate"):
        _parse_video_probe(
            video_probe(fps="23/1"),
            filename="clip.mp4",
            mime_type="video/mp4",
        )


def test_audio_probe_accepts_wav_and_mp3() -> None:
    wav = _parse_audio_probe(
        {
            "format": {"format_name": "wav", "duration": "4.5"},
            "streams": [{"codec_type": "audio", "codec_name": "pcm_s16le"}],
        },
        filename="voice.wav",
        mime_type="audio/wav",
    )
    mp3 = _parse_audio_probe(
        {
            "format": {"format_name": "mp3", "duration": "5"},
            "streams": [{"codec_type": "audio", "codec_name": "mp3"}],
        },
        filename="voice.mp3",
        mime_type="audio/mpeg",
    )

    assert wav.container == "wav"
    assert wav.duration_seconds == 4.5
    assert mp3.container == "mp3"


def test_file_size_boundaries_match_seedance_rules() -> None:
    with pytest.raises(MediaInspectionError, match="smaller than 30 MB"):
        _validate_file_size(ReferenceAssetKind.IMAGE, IMAGE_MAX_BYTES)
    with pytest.raises(MediaInspectionError, match="exceeds 15 MB"):
        _validate_file_size(ReferenceAssetKind.AUDIO, AUDIO_MAX_BYTES + 1)


def test_seedance_media_duration_rules_include_task_type_and_totals() -> None:
    video = MediaInspection(
        kind=ReferenceAssetKind.VIDEO,
        mime_type="video/mp4",
        container="mp4",
        duration_seconds=3,
    )
    validate_seedance_media_inputs(
        model="doubao-seedance-2-5-260628",
        task_type="generate",
        videos=[video],
        audios=[],
    )
    with pytest.raises(MediaInspectionError, match="between 4 and 30"):
        validate_seedance_media_inputs(
            model="doubao-seedance-2-5-260628",
            task_type="edit",
            videos=[video],
            audios=[],
        )
    with pytest.raises(MediaInspectionError, match="total duration"):
        validate_seedance_media_inputs(
            model="doubao-seedance-2-0-260128",
            task_type="generate",
            videos=[
                video,
                MediaInspection(
                    kind=ReferenceAssetKind.VIDEO,
                    mime_type="video/mp4",
                    container="mp4",
                    duration_seconds=13,
                ),
            ],
            audios=[],
        )
