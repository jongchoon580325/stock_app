#!/bin/bash
# 분배금 매니저 로컬 앱 실행 스크립트

# 1. 프로젝트 폴더로 이동
cd "/Users/jongchoonna/Documents/antigravity/etf_dividend/general_etf"

# 2. 서버 실행 (백그라운드)
# -s dist  : SPA 모드로 dist 폴더 서빙
# -l 3000  : 3000번 포트 사용
npx serve -s dist -l 3000 &

# 3. 서버가 올라올 시간 대기
sleep 2

# 4. 기본 브라우저로 로컬 주소 열기
open "http://localhost:3000"
