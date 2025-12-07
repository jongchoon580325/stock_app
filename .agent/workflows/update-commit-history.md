---
description: How to update commit_history.md after commits
---

# Commit History Update Workflow

## 규칙

1. **기능/수정 커밋만 기록:** `commit_history.md` 문서 자체를 수정하는 커밋은 기록하지 않음.
2. **푸시 후 검증:** 코드 커밋 & 푸시 완료 후 `git fetch && git log origin/main -n 1 --oneline`으로 원격 해시 확인.
3. **검증된 해시 사용:** 로컬 커밋 출력이 아닌, 원격(`origin/main`)에서 확인된 해시를 문서에 기록.
4. **덮어쓰기 방식:** 문서 업데이트 커밋 자체는 다음 기능 커밋 시 해당 항목에 덮어씀.

## 워크플로우 순서

### Step 1: 코드 커밋 & 푸시

```bash
git add <files>
git commit -m "feat/fix/refactor: 커밋 메시지"
git push
```

### Step 2: 원격 해시 확인

```bash
git fetch && git log origin/main -n 1 --oneline
```

출력 예시: `abc1234 feat: 새로운 기능 추가`

### Step 3: commit_history.md 업데이트

- 확인된 해시 `abc1234`를 문서에 추가.
- 이전 "문서 업데이트 커밋" 항목이 있다면 새 항목으로 **덮어쓰기**.

### Step 4: 문서 커밋 & 푸시

```bash
git add public/document/git_hub/commit_history.md
git commit -m "docs: Update commit history"
git push
```

> **주의:** Step 4의 커밋 해시는 다음 기능 커밋 시 덮어쓰이므로 별도 기록 불필요.
