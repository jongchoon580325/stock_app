# 분배금 매니저 로컬 앱 실행 가이드

## 📋 목차

1. [전체 개요](#전체-개요)
2. [사전 준비](#사전-준비)
3. [환경 설정](#환경-설정)
4. [빌드 및 서버 준비](#빌드-및-서버-준비)
5. [실행 스크립트 만들기](#실행-스크립트-만들기)
6. [앱으로 설치하기](#앱으로-설치하기)
7. [업데이트 워크플로](#업데이트-워크플로)
8. [문제 해결](#문제-해결)

---

## 전체 개요

이 가이드는 Vite로 빌드된 웹앱을 맥북의 로컬 서버로 실행하고, 브라우저의 PWA 설치 기능을 통해 독(Dock)에 고정하여 네이티브 앱처럼 사용하는 방법을 안내합니다.

### 워크플로 요약

```
.env 파일 설정 
  ↓
코드 수정 (import.meta.env 사용)
  ↓
npm run build
  ↓
로컬 서버 실행 (npx serve)
  ↓
.command 파일로 자동 실행
  ↓
브라우저에서 앱 설치
  ↓
Dock에서 앱처럼 실행
```

---

## 사전 준비

### 필요 환경

- **macOS** (맥북)
- **Node.js & npm** 설치
- **프로젝트 폴더** (예: `/Users/내이름/Documents/bunbae-manager`)
- **Chromium 기반 브라우저** (Chrome, Edge 등)

### ⚠️ 보안 주의사항

- API 키는 반드시 `.env` 파일에 저장
- `.gitignore`에 `.env` 추가 필수
- GitHub 등 공개 저장소에 API 키 노출 금지

---

## 환경 설정

### 1. .env 파일 생성

프로젝트 루트 폴더에서 터미널을 열고 다음 명령어를 실행합니다:

```bash
cd "/Users/내이름/Documents/bunbae-manager"
echo 'VITE_API_KEY=AIzaSyCKAWfBz8A2EZjeBwnaCSzVj4UJtt3a720' > .env
```

> **중요**: `VITE_`로 시작하는 환경변수만 Vite가 번들링 시 포함합니다.

### 2. 코드에서 API 키 사용

기존 Node.js 방식에서 Vite 방식으로 변경합니다:

**❌ 기존 방식 (Node.js)**
```javascript
const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
```

**✅ Vite 방식**
```javascript
const apiKey = import.meta.env.VITE_API_KEY;
```

### 3. 앱 스타일 메타 태그 추가 (선택사항)

`index.html`의 `<head>` 섹션에 추가:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>분배금 매니저</title>

  <!-- 앱 느낌을 주는 메타 태그 -->
  <meta name="theme-color" content="#0b1120" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black" />
</head>
```

---

## 빌드 및 서버 준비

### 1. 의존성 설치

처음 한 번만 실행:

```bash
cd "/Users/내이름/Documents/bunbae-manager"
npm install
```

### 2. 프로젝트 빌드

```bash
npm run build
```

- `dist/` 폴더에 정적 파일 생성
- 코드 수정 후에는 항상 재빌드 필요

### 3. 정적 서버 도구 설치

전역 설치:

```bash
npm install -g serve
```

또는 프로젝트 로컬 설치:

```bash
npm install serve --save-dev
```

---

## 실행 스크립트 만들기

### 1. 스크립트 파일 생성

텍스트 편집기를 열고 다음 내용을 입력합니다:

```bash
#!/bin/bash
# 분배금 매니저 로컬 앱 실행 스크립트

# 1. 프로젝트 폴더로 이동 (본인 환경에 맞게 수정)
cd "/Users/내이름/Documents/bunbae-manager"

# 2. 서버 실행 (백그라운드)
# -s dist  : SPA 모드로 dist 폴더 서빙
# -l 3000  : 3000번 포트 사용
npx serve -s dist -l 3000 &

# 3. 서버가 올라올 시간 대기
sleep 2

# 4. 기본 브라우저로 로컬 주소 열기
open "http://localhost:3000"
```

> **주의**: `cd` 경로는 반드시 실제 프로젝트 경로로 수정하세요.

### 2. 파일 저장

- 파일명: `분배금매니저.command`
- 저장 위치: 바탕화면(Desktop) 또는 원하는 위치
- **확장자 `.command` 필수**

### 3. 실행 권한 부여

터미널에서 실행:

```bash
chmod +x ~/Desktop/분배금매니저.command
```

### 4. 실행 테스트

바탕화면의 `분배금매니저.command` 파일을 더블클릭하면:

1. 백그라운드에서 서버 시작
2. 자동으로 브라우저 열림
3. `http://localhost:3000`에 앱 로드

---

## 앱으로 설치하기

### 1. PWA 설치 버튼 찾기

Chrome 브라우저 기준:

1. `http://localhost:3000` 접속
2. 주소창 오른쪽의 **모니터 + 화살표** 아이콘 클릭
3. 또는 메뉴(⋮) → "저장 및 공유" → "앱 설치"

### 2. 설치 진행

- "앱 설치" 버튼 클릭
- Dock과 Launchpad에 앱 아이콘 생성
- 독립된 창으로 실행 가능

### 3. 이후 사용 방법

**최초 1회:**
1. `.command` 파일 실행 → 서버 시작
2. 브라우저에서 "앱 설치"
3. Dock에 고정

**이후:**
- Dock 아이콘 클릭으로 실행
- 맥 재부팅 시 `.command` 파일 재실행 필요 (서버 재시작)

---

## 업데이트 워크플로

코드 수정 시 다음 순서를 따릅니다:

### 1. 코드 수정
```bash
# React/TS/JS 파일 수정 후 저장
```

### 2. 빌드 재실행
```bash
cd "/Users/내이름/Documents/bunbae-manager"
npm run build
```

### 3. 서버 재시작
```bash
# 기존 serve 프로세스 종료 (Ctrl + C)
# 또는 .command 파일 재실행
```

### 4. 앱 확인
- Dock의 앱 아이콘은 그대로 유지
- 내부 콘텐츠만 업데이트됨

---

## 문제 해결

### 1. 포트 충돌 (EADDRINUSE)

**증상**: "포트가 이미 사용 중입니다" 에러

**해결방법:**

```bash
# 포트 사용 프로세스 확인
lsof -i :3000

# 프로세스 종료
kill -9 [PID_번호]
```

또는 `.command` 파일의 포트 번호 변경:
```bash
npx serve -s dist -l 3001 &
open "http://localhost:3001"
```

### 2. 앱 설치 버튼이 보이지 않음

**원인:**
- 브라우저가 PWA 설치를 지원하지 않음
- 설치 조건 미충족

**해결방법:**
- Chrome/Edge 최신 버전 사용
- 주소창 오른쪽 메뉴(⋮) → "앱" 또는 "저장 및 공유" 확인
- `https://` 대신 `http://localhost`는 PWA 설치 가능

### 3. .command 파일 실행 안됨

**증상**: 더블클릭해도 반응 없음

**해결방법:**

1. **권한 확인**
   ```bash
   chmod +x ~/Desktop/분배금매니저.command
   ```

2. **보안 설정 확인**
   - 시스템 설정 → 보안 및 개인정보 보호 → 일반
   - "허용" 또는 "실행" 버튼 클릭

3. **수동 실행 테스트**
   ```bash
   bash ~/Desktop/분배금매니저.command
   ```

---

## 퀵 체크리스트

- [ ] `.env` 파일 생성 및 `VITE_API_KEY` 설정
- [ ] 코드에서 `import.meta.env.VITE_API_KEY` 사용
- [ ] `npm install` 실행
- [ ] `npm run build` 실행
- [ ] `.command` 파일 생성 및 프로젝트 경로 수정
- [ ] `chmod +x` 권한 부여
- [ ] `.command` 파일 더블클릭 테스트
- [ ] 브라우저에서 "앱 설치" 실행
- [ ] Dock에 아이콘 고정 확인

---

## 추가 참고사항

### 포트 변경

다른 포트를 사용하려면 `.command` 파일에서 두 곳을 수정:

```bash
npx serve -s dist -l 4173 &
open "http://localhost:4173"
```

### 서버 자동 시작 (선택사항)

매번 `.command` 실행이 번거롭다면:

1. 시스템 설정 → 일반 → 로그인 항목
2. `.command` 파일 추가
3. 맥 부팅 시 자동 서버 시작

### 대안 서버 방식

`serve` 대신 다른 옵션:

```bash
# Vite preview 모드
npm run preview

# Python 간단 서버
python3 -m http.server 3000 --directory dist
```

---

**문서 작성일**: 2025년 12월  
**대상 환경**: macOS, Vite, Node.js  
**버전**: 1.0