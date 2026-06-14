# Claude Code Installation Guide

> 출처: https://lavender-soul-e27.notion.site/Claude-Code-Installation-Guide-0e4d0f53623d822183f401cafe804d43
> 수집: 2026-06-13 · 신동와인 AX 워크숍

---

Claude Code 설치하기
처음이라도 괜찮습니다. 천천히 따라오세요.
Claude Code가 뭔가요?
💡
한 줄 요약: 터미널에서 AI와 대화하면서 코딩하는 도구
웹 ChatGPT/Claude vs Claude Code 차이:
웹 ChatGPT/Claude: 브라우저에서 대화만 → Claude Code: 내 컴퓨터 파일을 직접 수정
웹 ChatGPT/Claude: 코드 복사-붙여넣기 → Claude Code: 코드를 바로 실행
웹 ChatGPT/Claude: 수동으로 파일 저장 → Claude Code: 자동으로 파일 생성/수정
쉽게 말해, AI가 내 컴퓨터에서 직접 일하는 것입니다.
내 컴퓨터 확인
자기 OS 섹션만 처음부터 끝까지 따라가세요.
Mac 사용자 → Mac 설치
Windows 사용자 → Windows 설치
Mac 설치
1단계: 터미널 열기
Cmd + Space → "터미널" 입력 → Enter
2단계: Xcode Command Line Tools 설치
터미널에 붙여넣기:
> Loading Bash code…
​
설치 팝업이 뜨면 "설치" 클릭. 5~10분 소요.
팝업이 안 보이면 Cmd + Tab으로 찾거나 Dock 확인. "이미 설치되어 있습니다" 메시지가 나오면 다음 단계로.
3단계: Node.js 설치
💡
Claude Code 자체는 Node.js가 없어도 동작하지만, 이후 다른 도구(gws CLI 등)를 npm으로 설치할 때 필요해서 미리 깔아둡니다.
https://nodejs.org 접속
"LTS" 버전 클릭해서 다운로드
다운로드된 .pkg 파일 실행 → Continue 계속 → 완료
4단계: Claude Code 설치
터미널에 붙여넣기:
> Loading Bash code…
​
1-2분 소요.
5단계: 경로 등록 (꼭 필요)
설치 직후에는 claude 명령어가 안 잡힙니다. 아래 한 줄을 그대로 붙여넣으세요:
> Loading Bash code…
​
6단계: 실행
> Loading Bash code…
​
대화 화면이 뜨면 성공.
Windows 설치
1단계: PowerShell 열기
Win + X → "Windows PowerShell" 또는 "터미널" 클릭
2단계: Git for Windows 설치
Claude Code는 내부적으로 ls, cat, grep 같은 Mac/Linux 명령어를 씁니다. Windows는 원래 못 알아듣는데, Git for Windows를 깔면 "Git Bash"가 같이 깔려서 통역사 역할을 합니다.
https://git-scm.com/downloads/win 접속
"64-bit Git for Windows Setup" 클릭해서 다운로드
실행 → "Next" 계속 클릭 (기본값이 좋음)
3단계: Node.js 설치
💡
Claude Code 자체는 Node.js가 없어도 동작하지만, 이후 다른 도구(gws CLI 등)를 npm으로 설치할 때 필요해서 미리 깔아둡니다.
https://nodejs.org 접속
"LTS" 버전 클릭해서 다운로드
다운로드된 .msi 파일 실행 → Next 계속 → 완료
4단계: Claude Code 설치
PowerShell에 붙여넣기:
> Loading PowerShell code…
​
5단계: 경로 등록 (꼭 필요)
설치 직후에는 claude 명령어가 안 잡힙니다. 아래 한 줄을 그대로 붙여넣으세요:
> Loading PowerShell code…
​
6단계: PowerShell 새로 열기
기존 PowerShell 창을 완전히 닫고 새로 여세요. 환경변수 갱신을 위해 반드시 필요합니다.
7단계: 실행
> Loading PowerShell code…
​
대화 화면이 뜨면 성공.
VS Code 설치 (Mac / Windows 공통, 권장)
Claude Code가 만든 코드를 눈으로 보고 수정할 수 있는 편집기입니다. 터미널 화면만 보는 것보다 훨씬 편해요. (코드에 색깔도 입혀주고, 에러도 알려줌)
https://code.visualstudio.com/ 접속해서 다운로드
다운로드된 파일 실행 → Next 계속 → 완료
💡
VS Code 내장 터미널에서 claude 명령어가 안 잡히면, VS Code를 완전히 종료(Mac은 Cmd+Q, Windows는 작업 표시줄에서 우클릭→닫기) 후 다시 열어보세요. VS Code가 PATH 설정 전에 이미 실행 중이었으면 옛날 환경을 들고 있어서 발생하는 문제입니다.
처음 실행해보기
1. 작업할 폴더로 이동
Mac (터미널) / Windows (PowerShell):
> Loading Bash code…
​
2. Claude Code 실행
> Loading Bash code…
​
3. 로그인
처음 실행하면 브라우저가 뜹니다. Claude 계정으로 로그인하세요. (Pro/Max 구독 필요)
4. 말 걸어보기
> Loading Plain Text code…
​
대답이 오면 성공.
정리
Mac 설치 순서
터미널 열기
Xcode Command Line Tools
Node.js
Claude Code 설치
경로 등록
claude 실행
VS Code (권장)
Windows 설치 순서
PowerShell 열기
Git for Windows
Node.js
Claude Code 설치
경로 등록
PowerShell 새로 열기
claude 실행
VS Code (권장)
