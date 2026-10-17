# 密码长度策略调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有新设置密码的长度规则改为 8 至 32 个字符，同时允许已有 33 至 128 个字符密码继续登录。

**Architecture:** 后端将新密码策略常量与登录请求兼容上限分离，服务层继续作为最终安全校验。前端同步认证表单和管理员表单的长度规则、提示和占位符，不限制登录表单中的旧长密码。

**Tech Stack:** Python 3.11+、FastAPI、Pydantic、Pytest、React 19、TypeScript、Vitest、Testing Library

---

## File Structure

- Modify: `backend/app/schemas/auth.py`
  - 定义 8 至 32 的新密码策略和 128 字符登录兼容上限。
- Modify: `backend/tests/test_auth_service.py`
  - 覆盖新密码边界和旧长密码登录。
- Modify: `frontend/components/auth/form-controls.tsx`
  - 更新认证表单共用密码校验。
- Modify: `frontend/components/auth/setup-form.tsx`
  - 更新初始化密码占位符。
- Modify: `frontend/components/auth/change-password-form.tsx`
  - 更新改密占位符。
- Modify: `frontend/components/admin/user-management.tsx`
  - 更新创建与重置用户的密码校验。
- Modify: `frontend/tests/auth-pages.test.tsx`
  - 覆盖认证表单新边界与文案。
- Modify: `frontend/tests/admin-users.test.tsx`
  - 覆盖管理员密码表单新边界。

### Task 1: 后端密码策略与兼容登录

**Files:**
- Modify: `backend/tests/test_auth_service.py`
- Modify: `backend/app/schemas/auth.py`

- [x] **Step 1: 编写后端边界测试**

在 `backend/tests/test_auth_service.py` 导入 `ValidationError`、`UserRecord` 和 `validate_password`，增加：

```python
from pydantic import ValidationError

from backend.app.schemas.auth import (
    LoginRequest,
    UserRecord,
    validate_password,
)


@pytest.mark.parametrize("length", [8, 32])
def test_new_password_accepts_policy_boundaries(length: int) -> None:
    password = "x" * length
    assert validate_password(password, "admin.user") == password


@pytest.mark.parametrize("length", [7, 33])
def test_new_password_rejects_values_outside_policy(length: int) -> None:
    with pytest.raises(
        ValueError,
        match="password must be between 8 and 32 characters",
    ):
        validate_password("x" * length, "admin.user")


def test_login_accepts_existing_password_longer_than_new_policy(
    auth_context,
) -> None:
    repository, service, _ = auth_context
    legacy_password = "L" * 64
    user = UserRecord(
        username="legacy.admin",
        display_name="Legacy Admin",
        password_hash=PasswordHasher(
            time_cost=1,
            memory_cost=1024,
            parallelism=1,
        ).hash(legacy_password),
        role=UserRole.ADMIN,
        must_change_password=False,
    )
    repository.create_user(user)

    authenticated = service.login(
        LoginRequest(username=user.username, password=legacy_password),
        source_ip="192.0.2.50",
    )

    assert authenticated.user.id == user.id


def test_login_rejects_password_over_compatibility_limit() -> None:
    with pytest.raises(ValidationError):
        LoginRequest(username="legacy.admin", password="x" * 129)
```

- [x] **Step 2: 运行测试并确认失败**

Run:

```bash
.venv/bin/pytest backend/tests/test_auth_service.py -q
```

Expected: 8 字符测试失败、33 字符测试未失败，错误文案仍为 12 至 128。

- [x] **Step 3: 实现后端常量分离**

将 `backend/app/schemas/auth.py` 的常量和登录请求改为：

```python
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 32
LOGIN_PASSWORD_MAX_LENGTH = 128
```

```python
def validate_password(password: str, username: str) -> str:
    if not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        raise ValueError("password must be between 8 and 32 characters")
    if password.casefold() == normalize_username(username).casefold():
        raise ValueError("password must not match username")
    return password
```

```python
class LoginRequest(UsernameRequest):
    password: SecretStr = Field(
        min_length=1,
        max_length=LOGIN_PASSWORD_MAX_LENGTH,
    )
```

`ChangePasswordRequest.new_password` 和 `ResetPasswordRequest.password` 继续使用 `PASSWORD_MIN_LENGTH`、`PASSWORD_MAX_LENGTH`。

- [x] **Step 4: 运行后端认证测试**

Run:

```bash
.venv/bin/pytest backend/tests/test_auth_service.py backend/tests/test_auth_api.py -q
```

Expected: PASS。

- [x] **Step 5: 提交后端修改**

```bash
git add backend/app/schemas/auth.py backend/tests/test_auth_service.py
git commit -m "feat(auth): enforce 8 to 32 character new passwords"
```

### Task 2: 前端密码规则与文案

**Files:**
- Modify: `frontend/components/auth/form-controls.tsx`
- Modify: `frontend/components/auth/setup-form.tsx`
- Modify: `frontend/components/auth/change-password-form.tsx`
- Modify: `frontend/components/admin/user-management.tsx`
- Modify: `frontend/tests/auth-pages.test.tsx`
- Modify: `frontend/tests/admin-users.test.tsx`

- [x] **Step 1: 更新认证页面测试**

在 `frontend/tests/auth-pages.test.tsx` 将旧文案断言改为：

```tsx
expect(screen.getByText("密码需为 8 至 32 个字符。")).toBeVisible();
```

增加共用校验边界测试，通过初始化表单分别提交 7、8、32、33 个字符密码，断言 7 和 33 显示错误，8 和 32 会调用 `setup`。

- [x] **Step 2: 更新管理员页面测试**

在 `frontend/tests/admin-users.test.tsx` 增加创建用户密码边界测试：

```tsx
fill("临时密码", "x".repeat(7));
fill("确认临时密码", "x".repeat(7));
fireEvent.click(screen.getByRole("button", { name: "创建用户" }));
expect(screen.getByText("密码需为 8 至 32 个字符。")).toBeVisible();
expect(apiMocks.createUser).not.toHaveBeenCalled();
```

再以 33 个字符执行同样断言，并确认 8 和 32 个字符可提交。

- [x] **Step 3: 运行前端定向测试并确认失败**

Run:

```bash
cd frontend
npx vitest run tests/auth-pages.test.tsx tests/admin-users.test.tsx
```

Expected: FAIL；页面仍显示 12 至 128 文案，8 字符密码仍被拒绝，33 字符密码仍被接受。

- [x] **Step 4: 更新共用认证校验**

将 `frontend/components/auth/form-controls.tsx` 改为：

```tsx
export function validatePassword(password: string): string | null {
  return password.length >= 8 && password.length <= 32
    ? null
    : "密码需为 8 至 32 个字符。";
}
```

- [x] **Step 5: 更新管理员校验**

将 `frontend/components/admin/user-management.tsx` 中的长度判断改为：

```tsx
if (password.length < 8 || password.length > 32) {
  return "密码需为 8 至 32 个字符。";
}
```

保留用户名相同和两次密码不一致校验。

- [x] **Step 6: 更新输入提示**

在以下文件中将 `placeholder="12 至 128 个字符"` 改为：

```tsx
placeholder="8 至 32 个字符"
```

- `frontend/components/auth/setup-form.tsx`
- `frontend/components/auth/change-password-form.tsx`

- [x] **Step 7: 运行前端定向测试**

Run:

```bash
cd frontend
npx vitest run tests/auth-pages.test.tsx tests/admin-users.test.tsx
```

Expected: PASS。

- [x] **Step 8: 运行前端静态检查**

Run:

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

Expected: 两条命令均退出码 0。

- [x] **Step 9: 提交前端修改**

```bash
git add frontend/components/auth/form-controls.tsx \
  frontend/components/auth/setup-form.tsx \
  frontend/components/auth/change-password-form.tsx \
  frontend/components/admin/user-management.tsx \
  frontend/tests/auth-pages.test.tsx \
  frontend/tests/admin-users.test.tsx
git commit -m "feat(auth): align password forms with 8 to 32 policy"
```

### Task 3: 回归验证

**Files:**
- Verify: `backend/app/schemas/auth.py`
- Verify: `frontend/components/auth/`
- Verify: `frontend/components/admin/user-management.tsx`

- [x] **Step 1: 运行后端认证回归**

Run:

```bash
.venv/bin/pytest \
  backend/tests/test_auth_service.py \
  backend/tests/test_auth_api.py \
  backend/tests/test_auth_repository.py \
  backend/tests/test_role_permissions.py \
  -q
```

Expected: PASS。

- [x] **Step 2: 运行完整前端测试**

Run:

```bash
cd frontend
npm test -- --run
```

Expected: PASS。

- [x] **Step 3: 运行生产构建**

Run:

```bash
cd frontend
npm run build
```

Expected: Next.js 构建成功。

- [x] **Step 4: 检查差异**

Run:

```bash
git diff --check
git status --short
```

Expected: 无空白错误；工作树只包含计划内修改或用户已有改动。
