from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator, Iterable
from pathlib import Path

import httpx
import pytest

from backend.app.core.config import Settings
from backend.app.schemas.video_subtitle_grounding import (
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
)
from backend.app.services.media_inspector import (
    MediaInspectionError,
    VideoDisplayMetadata,
    parse_video_display_metadata,
)
from backend.app.services.video_subtitle_grounding_media import (
    RemoteVideoError,
    SecureRemoteVideoDownloader,
    SecureRemoteVideoPreparer,
    validate_public_https_url,
)

PUBLIC_IPV4 = "93.184.216.34"
PUBLIC_IPV6 = "2606:2800:220:1:248:1893:25c8:1946"


async def public_resolver(_hostname: str, _port: int) -> Iterable[str]:
    return [PUBLIC_IPV4, PUBLIC_IPV6]


def downloader(
    tmp_path: Path,
    handler,
    *,
    resolver=public_resolver,
    max_bytes: int = 32,
    total_timeout_seconds: float = 1,
    max_redirects: int = 3,
) -> SecureRemoteVideoDownloader:
    return SecureRemoteVideoDownloader(
        Settings(),
        transport=httpx.MockTransport(handler),
        resolver=resolver,
        temp_dir=tmp_path,
        max_bytes=max_bytes,
        connect_timeout_seconds=1,
        read_timeout_seconds=1,
        total_timeout_seconds=total_timeout_seconds,
        max_redirects=max_redirects,
    )


def assert_no_temporary_videos(tmp_path: Path) -> None:
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "url",
    [
        "http://example.test/video.mp4",
        "https:///video.mp4",
        "https://user@example.test/video.mp4",
        "https://example.test/video.mp4#page",
        "https://example.test/video.mp4#",
        "https://example.test:70000/video.mp4",
        "file:///tmp/video.mp4",
        "https://metadata.google.internal/video.mp4",
        "https://127.0.0.1/video.mp4",
        "https://169.254.169.254/latest/meta-data",
        "https://[::1]/video.mp4",
    ],
)
def test_url_validation_rejects_unsafe_structures_without_dns(url: str) -> None:
    resolver_calls = 0

    async def resolver(_hostname: str, _port: int) -> Iterable[str]:
        nonlocal resolver_calls
        resolver_calls += 1
        return [PUBLIC_IPV4]

    with pytest.raises(RemoteVideoError) as captured:
        asyncio.run(validate_public_https_url(url, resolver=resolver))

    assert captured.value.code == VideoSubtitleGroundingErrorCode.INVALID_VIDEO_URL
    assert captured.value.phase == VideoSubtitleGroundingErrorPhase.URL_VALIDATION
    assert resolver_calls == 0


@pytest.mark.parametrize(
    "addresses",
    [
        ["10.0.0.1"],
        ["172.16.0.1"],
        ["192.168.1.1"],
        ["169.254.1.2"],
        ["224.0.0.1"],
        ["0.0.0.0"],
        ["2001:db8::1"],
        [PUBLIC_IPV4, "127.0.0.1"],
    ],
)
def test_url_validation_requires_every_dns_address_to_be_public(
    addresses: list[str],
) -> None:
    async def resolver(_hostname: str, _port: int) -> Iterable[str]:
        return addresses

    with pytest.raises(RemoteVideoError, match="not public"):
        asyncio.run(
            validate_public_https_url(
                "https://media.example.test/video.mp4",
                resolver=resolver,
            )
        )


def test_url_validation_accepts_public_dns_addresses() -> None:
    asyncio.run(
        validate_public_https_url(
            "https://media.example.test:8443/video.mp4?token=private",
            resolver=public_resolver,
        )
    )


def test_downloader_streams_to_restricted_file_and_cleans_success(
    tmp_path: Path,
) -> None:
    class Chunks(httpx.AsyncByteStream):
        async def __aiter__(self) -> AsyncIterator[bytes]:
            yield b"video-"
            yield b"bytes"

    service = downloader(
        tmp_path,
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4", "content-length": "11"},
            stream=Chunks(),
        ),
    )
    observed_path: Path | None = None

    async def run() -> None:
        nonlocal observed_path
        async with service.open(
            "https://media.example.test/video.mp4"
        ) as downloaded:
            observed_path = downloaded.path
            assert downloaded.path.read_bytes() == b"video-bytes"
            assert downloaded.mime_type == "video/mp4"
            assert downloaded.size_bytes == 11
            assert os.stat(downloaded.path).st_mode & 0o777 == 0o600

    asyncio.run(run())

    assert observed_path is not None
    assert not observed_path.exists()
    assert_no_temporary_videos(tmp_path)


def test_redirect_is_validated_before_requesting_private_target(
    tmp_path: Path,
) -> None:
    requests: list[str] = []

    async def resolver(hostname: str, _port: int) -> Iterable[str]:
        return ["10.0.0.8"] if hostname == "private.example.test" else [PUBLIC_IPV4]

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return httpx.Response(
            302,
            headers={"location": "https://private.example.test/video.mp4"},
        )

    service = downloader(tmp_path, handler, resolver=resolver)

    async def run() -> None:
        with pytest.raises(RemoteVideoError) as captured:
            async with service.open("https://public.example.test/start"):
                pass
        assert captured.value.code == VideoSubtitleGroundingErrorCode.INVALID_VIDEO_URL

    asyncio.run(run())

    assert requests == ["https://public.example.test/start"]
    assert_no_temporary_videos(tmp_path)


def test_redirect_limit_is_enforced_without_following_extra_hop(
    tmp_path: Path,
) -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        index = int(request.url.path.removeprefix("/"))
        return httpx.Response(302, headers={"location": f"/{index + 1}"})

    service = downloader(tmp_path, handler, max_redirects=2)

    async def run() -> None:
        with pytest.raises(RemoteVideoError, match="redirect"):
            async with service.open("https://media.example.test/0"):
                pass

    asyncio.run(run())

    assert requests == ["/0", "/1", "/2"]
    assert_no_temporary_videos(tmp_path)


@pytest.mark.parametrize(
    ("headers", "content", "message"),
    [
        ({"content-type": "text/plain"}, b"not-video", "supported video"),
        (
            {"content-type": "video/mp4", "content-length": "33"},
            b"",
            "maximum size",
        ),
        (
            {"content-type": "video/mp4", "content-length": "invalid"},
            b"",
            "size is invalid",
        ),
        ({"content-type": "video/mp4"}, b"", "empty"),
        ({"content-type": "video/mp4"}, b"x" * 33, "maximum size"),
    ],
)
def test_downloader_rejects_mime_declared_and_actual_size_and_cleans(
    tmp_path: Path,
    headers: dict[str, str],
    content: bytes,
    message: str,
) -> None:
    service = downloader(
        tmp_path,
        lambda _request: httpx.Response(200, headers=headers, content=content),
    )

    async def run() -> None:
        with pytest.raises(RemoteVideoError, match=message) as captured:
            async with service.open("https://media.example.test/video"):
                pass
        assert (
            captured.value.code
            == VideoSubtitleGroundingErrorCode.INVALID_VIDEO_INPUT
        )

    asyncio.run(run())
    assert_no_temporary_videos(tmp_path)


def test_downloader_cleans_partial_file_on_stream_failure(tmp_path: Path) -> None:
    class BrokenStream(httpx.AsyncByteStream):
        async def __aiter__(self) -> AsyncIterator[bytes]:
            yield b"partial"
            raise httpx.ReadError("private transport detail")

    service = downloader(
        tmp_path,
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=BrokenStream(),
        ),
    )

    async def run() -> None:
        with pytest.raises(RemoteVideoError, match="could not be downloaded"):
            async with service.open("https://media.example.test/video"):
                pass

    asyncio.run(run())
    assert_no_temporary_videos(tmp_path)


def test_downloader_total_timeout_cleans_partial_file(tmp_path: Path) -> None:
    class SlowStream(httpx.AsyncByteStream):
        async def __aiter__(self) -> AsyncIterator[bytes]:
            yield b"partial"
            await asyncio.sleep(1)
            yield b"late"

    service = downloader(
        tmp_path,
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=SlowStream(),
        ),
        total_timeout_seconds=0.01,
    )

    async def run() -> None:
        with pytest.raises(RemoteVideoError, match="timed out") as captured:
            async with service.open("https://media.example.test/video"):
                pass
        assert (
            captured.value.code
            == VideoSubtitleGroundingErrorCode.VIDEO_DOWNLOAD_FAILED
        )

    asyncio.run(run())
    assert_no_temporary_videos(tmp_path)


def test_downloader_cancellation_cleans_partial_file(tmp_path: Path) -> None:
    started = asyncio.Event()

    class HangingStream(httpx.AsyncByteStream):
        async def __aiter__(self) -> AsyncIterator[bytes]:
            yield b"partial"
            started.set()
            await asyncio.Event().wait()

    service = downloader(
        tmp_path,
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=HangingStream(),
        ),
    )

    async def run() -> None:
        async def download() -> None:
            async with service.open("https://media.example.test/video"):
                pass

        task = asyncio.create_task(download())
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    assert_no_temporary_videos(tmp_path)


def video_probe(
    *,
    width: int = 1920,
    height: int = 1080,
    duration: str = "12.345",
    side_data: list[dict[str, object]] | None = None,
    tags: dict[str, object] | None = None,
    major_brand: str = "isom",
) -> dict[str, object]:
    stream: dict[str, object] = {
        "codec_type": "video",
        "codec_name": "h264",
        "width": width,
        "height": height,
        "duration": duration,
    }
    if side_data is not None:
        stream["side_data_list"] = side_data
    if tags is not None:
        stream["tags"] = tags
    return {
        "format": {
            "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
            "duration": duration,
            "tags": {"major_brand": major_brand},
        },
        "streams": [stream],
    }


@pytest.mark.parametrize(
    ("rotation_data", "tags", "rotation", "display_size"),
    [
        ([{"rotation": -90}], None, 270, (1080, 1920)),
        ([{"rotation": 90}], None, 90, (1080, 1920)),
        ([{"rotation": 180}], None, 180, (1920, 1080)),
        (
            [{"displaymatrix": "Display Matrix\nrotation of -90.00 degrees"}],
            None,
            270,
            (1080, 1920),
        ),
        (None, {"rotate": "90"}, 90, (1080, 1920)),
        (None, None, 0, (1920, 1080)),
    ],
)
def test_probe_parses_rotation_display_matrix_and_display_dimensions(
    rotation_data: list[dict[str, object]] | None,
    tags: dict[str, object] | None,
    rotation: int,
    display_size: tuple[int, int],
) -> None:
    metadata = parse_video_display_metadata(
        video_probe(side_data=rotation_data, tags=tags),
        max_duration_seconds=600,
    )

    assert (metadata.encoded_width, metadata.encoded_height) == (1920, 1080)
    assert (metadata.display_width, metadata.display_height) == display_size
    assert metadata.rotation == rotation
    assert metadata.duration_ms == 12_345
    assert metadata.container == "mp4"
    assert metadata.codec == "h264"


def test_probe_rejects_missing_stream_invalid_duration_and_non_quarter_rotation() -> None:
    with pytest.raises(MediaInspectionError, match="no video stream"):
        parse_video_display_metadata({"streams": []})
    with pytest.raises(MediaInspectionError, match="exceeds 600"):
        parse_video_display_metadata(
            video_probe(duration="600.001"),
            max_duration_seconds=600,
        )
    with pytest.raises(MediaInspectionError, match="quarter turn"):
        parse_video_display_metadata(
            video_probe(side_data=[{"rotation": 45}]),
        )


def test_probe_reports_quicktime_container_from_major_brand() -> None:
    metadata = parse_video_display_metadata(video_probe(major_brand="qt  "))

    assert metadata.container == "mov"


def metadata() -> VideoDisplayMetadata:
    return parse_video_display_metadata(video_probe())


def test_preparer_cleans_after_success_and_probe_failure(tmp_path: Path) -> None:
    download_service = downloader(
        tmp_path,
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=b"video",
        ),
    )
    seen_paths: list[Path] = []

    class Inspector:
        def __init__(self, *, fail: bool = False) -> None:
            self.fail = fail

        async def inspect(self, path: Path) -> VideoDisplayMetadata:
            seen_paths.append(path)
            assert path.exists()
            if self.fail:
                raise MediaInspectionError("private ffprobe detail")
            return metadata()

    async def run_success() -> None:
        preparer = SecureRemoteVideoPreparer(download_service, Inspector())
        async with preparer.open(
            "https://media.example.test/video"
        ) as prepared:
            assert prepared.path.exists()
            assert prepared.metadata.display_width == 1920

    asyncio.run(run_success())
    assert not seen_paths[-1].exists()

    async def run_failure() -> None:
        preparer = SecureRemoteVideoPreparer(
            download_service,
            Inspector(fail=True),
        )
        with pytest.raises(RemoteVideoError) as captured:
            async with preparer.open("https://media.example.test/video"):
                pass
        assert captured.value.code == VideoSubtitleGroundingErrorCode.MEDIA_PROBE_FAILED
        assert captured.value.phase == VideoSubtitleGroundingErrorPhase.MEDIA_PROBE

    asyncio.run(run_failure())
    assert not seen_paths[-1].exists()
    assert_no_temporary_videos(tmp_path)


def test_preparer_cancellation_during_probe_cleans_file(tmp_path: Path) -> None:
    download_service = downloader(
        tmp_path,
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=b"video",
        ),
    )
    probe_started = asyncio.Event()

    class HangingInspector:
        async def inspect(self, path: Path) -> VideoDisplayMetadata:
            assert path.exists()
            probe_started.set()
            await asyncio.Event().wait()
            raise AssertionError("unreachable")

    async def run() -> None:
        preparer = SecureRemoteVideoPreparer(
            download_service,
            HangingInspector(),
        )

        async def prepare() -> None:
            async with preparer.open("https://media.example.test/video"):
                pass

        task = asyncio.create_task(prepare())
        await probe_started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    assert_no_temporary_videos(tmp_path)
