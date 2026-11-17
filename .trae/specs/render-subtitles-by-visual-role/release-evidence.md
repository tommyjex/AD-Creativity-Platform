# Task 4 Release Evidence

Date: 2026-11-16. Scope: release metadata, artifacts, vendor dependency and installed-wheel verification only. Core/frontend implementation and broader task 5 acceptance belong to their respective owners.

## Artifacts

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `vendor/video_subtitle_grounding-0.2.2-py3-none-any.whl` | 47959 | `3108406c8e99f5877fc00eeace68beaba63f00af27272cea3fa91c551daa25ca` |
| `exports/video-subtitle-grounding-0.2.2-source.tar.gz` | 111045 | `f71fbc66f53ffa111820f9f33ff7f119ee02f59f88686010bdb7a2157f241b56` |

The wheel is byte-identical to `standalone/video-subtitle-grounding/dist/video_subtitle_grounding-0.2.2-py3-none-any.whl`. The source export is byte-identical to `standalone/video-subtitle-grounding/dist/video_subtitle_grounding-0.2.2.tar.gz`; only the export filename changes.

Build cwd: `/Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding`.

```bash
/tmp/ad-subtitle-split-build/isolated-env/bin/python -m build --no-isolation
```

The supplied temporary environment lacked `pyvenv.cfg` and resolved to system Homebrew Python. Initial pip installation was correctly blocked by PEP 668. Repaired it using root `.venv/bin/python -m venv /tmp/ad-subtitle-split-build/isolated-env`, without clearing it or modifying system Python. Installed `build==1.6.1` and `setuptools==84.2.1` in that temporary environment. Build completed successfully, producing the wheel from the sdist.

## Content Checks

- Wheel: exact allowlist of 21 files, comprising 17 Python modules and four distribution metadata files. All 17 modules match current standalone source bytes. Metadata name/version/Python requirement and `py3-none-any` tag verified; every hashed RECORD entry matches both digest and size.
- Sdist: exact allowlist of 44 regular files, including source, packaging metadata, README/integration docs, Dockerfile, configuration example, offline tests and OFL fixture font/license. Source/docs/tests match the prepared tree. Safe relative paths; no links, `.git`, actual `.env`, runtime configuration, logs, caches, user media or business data. Test/example credentials are fixtures, not production credentials.
- Prepared versions remain `0.2.2` in `pyproject.toml` and `__init__.py`; README and integration instructions agree with the vendored requirement.
- `requirements.txt` points to the 0.2.2 wheel; `vendor/README.md` records both artifact hashes, role rules and synchronized rollback requirements.
- Rollback wheels are byte-identical to platform HEAD: 0.2.1 `02bdef75ac48cfd98cad654167bf6c89ee260eced27104df2486529160f17db8`; 0.2.0 `7e99ad2301447fe331635739078102f6354b34c748c96b85f97624d69eaebc8c`; 0.1.0 `a624c11143bc0bdc8514dd77adfa51d82a5874e22d923808811ea4ef9b2684d3`. Existing source exports remain untouched.

## Installed Verification

Root installation, cwd `/Users/bytedance/AD-Creativity`:

```bash
.venv/bin/python -m pip install --no-deps --no-index ./vendor/video_subtitle_grounding-0.2.2-py3-none-any.whl
```

- Root `python -I` probe: distribution and module version both `0.2.2`; package and layout loaded from `/Users/bytedance/AD-Creativity/.venv/lib/python3.14/site-packages/video_subtitle_grounding/`, not standalone source.
- Separate acceptance venv: `/tmp/ad-subtitle-role-font-wheel-env`, created without system-site-packages. Installed the built wheel with dev/server extras and dependencies; root dependencies were not changed. Isolated `pip check`: no broken requirements.
- Both environments: `direct_url.json` archive SHA256 equals the release wheel hash; all 17 installed Python modules are byte-identical to wheel entries.
- Layout version: `single-line-adaptive-panel35-role-font-v2`.
- Headline automatic font: `https://xujianhua-utils.tos-cn-beijing.volces.com/CenturyGothic/centurygothic_bold.ttf`.
- Body/footnote/missing/null/unknown automatic font: `https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf`.
- Root compatibility module `backend.app.services.subtitle_translation_layout` is the installed package layout module, sharing its globals and font cache.

Test runs used inline pytest harnesses with session-end assertions on installed package import locations. A Python audit hook rejected `socket.connect` and `socket.getaddrinfo` throughout each test run.

| Environment | Entry Point / Pytest Arguments | Result |
| --- | --- | --- |
| Separate installed wheel; cwd `/tmp` | `/tmp/ad-subtitle-role-font-wheel-env/bin/python -I -`; `pytest.main(['/Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/tests', '--import-mode=importlib', '-q'], plugins=[InstalledOnly()])` | 379 passed, 1 warning, 6.32s; 17 package imports confirmed from isolated site-packages |
| Root installed wheel; root cwd; `PYTHONPATH=.` | `.venv/bin/python -`; `pytest.main(['backend/tests/test_subtitle_translation_layout.py', '-q'], plugins=[InstalledOnly()])` | 124 passed, 1 warning, 1.74s; installed imports and compatibility identity confirmed |

Both warnings were Starlette/httpx TestClient deprecations. Tests cover role selection, same-block different roles, manual/cleared overrides, fallback payloads and distinct deterministic font metrics; other font tests use mocked HTTP with the OFL fixture and real FreeType metrics. No font downloads or supplier requests occurred during these runs.

Additional checks: standalone fatal Ruff (`E9,F63,F7,F82`), standalone `compileall -q src tests`, and both repositories' `git diff --check` passed.

## Boundaries

Root installation was reported immediately to unblock final host verification. This evidence does not replace broader host/frontend acceptance. No source behavior was edited by this release agent; existing concurrent changes were preserved. No commit, push, deployment, paid call or production secret access. No service restart was performed.

Real MediaKit render remains **UNEXECUTED**. Offline tests validate selection, measurement wiring and payload contracts, not actual Century Gothic appearance, provider fallback metrics/weight, vertical anchoring or capacity. Production takes effect only after the platform update installs this vendored wheel and the backend is restarted through its authorized deployment process; no second repository checkout is required.
