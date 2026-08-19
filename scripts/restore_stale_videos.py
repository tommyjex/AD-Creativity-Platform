"""One-off recovery: restore every VIDEO asset that was wrongly marked STALE by
the (now-fixed) unconditional character-edit invalidation.

All 7 video assets in the target project were flipped to STALE even though the
character *image* never changed. Of these, 5 are referenced by a current
storyboard shot's `video_asset_id` (these are what the compose stage stitches
into the final film via the primary path); the remaining 2 are older,
superseded orphans. Restoring all of them to SUCCEEDED is safe: the compose
stage's primary path only consumes the storyboard-linked clips, so the orphans
do not pollute the final video.
"""
import os
import sys

sys.path.insert(0, "/Users/bytedance/AD-Creativity")

from backend.app.repositories.mysql import MySQLRepository
from backend.app.schemas import Stage, Status

PROJECT_ID = "1b03d3a3-f3e2-4db2-a612-946f57d35a85"
APPLY = os.environ.get("APPLY") == "1"

repo = MySQLRepository()
project = repo.get_project(PROJECT_ID)

linked_video_ids = {
    shot.video_asset_id
    for shot in project.storyboard
    if shot.video_asset_id
}

video_assets = [
    asset for asset in repo.list_project_assets(PROJECT_ID)
    if asset.stage == Stage.VIDEO
]

print(f"project: {project.name}")
print(f"total video assets: {len(video_assets)}")

to_restore = [asset.id for asset in video_assets if asset.status == Status.STALE]

for asset in sorted(video_assets, key=lambda a: a.created_at):
    tag = "LINKED" if asset.id in linked_video_ids else "orphan"
    marker = "  <-- will restore to SUCCEEDED" if asset.status == Status.STALE else ""
    print(f"  {asset.id} status={asset.status.value:10} {tag}{marker}")

print(f"\n{'APPLYING' if APPLY else 'DRY RUN'}: {len(to_restore)} video(s) to restore")

if APPLY:
    for asset_id in to_restore:
        updated = repo.update_asset(asset_id, status=Status.SUCCEEDED)
        print(f"  restored {asset_id} -> {updated.status.value}")
    print("done")
