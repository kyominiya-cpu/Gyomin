# gws cli - Google Workspace CLI 설치

> 출처: https://lavender-soul-e27.notion.site/gws-cli-Google-Workspace-CLI-eb9d0f53623d83cb8a29019b44258bbd
> 수집: 2026-06-13 · 신동와인 AX 워크숍

---

Google Workspace CLI (gws) 설치하기
Claude Code 설치 페이지를 먼저 마친 상태를 전제로 합니다. (Node.js가 이미 깔려있어야 함)
gws가 뭔가요?
한 줄 요약: Gmail, Calendar, Drive를 터미널에서 다루는 도구. Claude Code와 연결하면 "오늘 일정 알려줘", "이 메일 답장 써줘" 같이 자연어로 시킬 수 있음.
내 컴퓨터 확인
자기 OS 섹션만 처음부터 끝까지 따라가세요.
Mac 사용자 → Mac 설치
Windows 사용자 → Windows 설치
Mac 설치
1단계: 터미널 열기
Cmd + Space → "터미널" 입력 → Enter
2단계: Homebrew 설치
Homebrew는 Mac에서 개발 도구를 쉽게 설치하게 해주는 패키지 관리자입니다. 이미 깔려있어도 다시 실행해도 무해함.
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

​
설치 중 Mac 로그인 비밀번호 입력 요청이 나오면 입력하세요.
3단계: Homebrew를 PATH에 등록 (꼭 필요)
Apple Silicon Mac(M1/M2/M3/M4)은 Homebrew 설치 후 PATH 등록이 반드시 필요합니다. 아래 두 줄을 그대로 붙여넣으세요. (Intel Mac에서도 실행해도 무해함)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

​
4단계: gcloud CLI 설치
Google Cloud를 터미널에서 다루는 도구. gws의 자동 설정에 필요합니다.
brew install --cask google-cloud-sdk

​
5~10분 소요.
5단계: gcloud를 PATH에 등록 (꼭 필요)
Homebrew Cask는 gcloud를 PATH에 자동 등록하지 않습니다. 아래 두 줄을 그대로 붙여넣으세요:
echo 'source "$(brew --prefix)/share/google-cloud-sdk/path.zsh.inc"' >> ~/.zprofile
source "$(brew --prefix)/share/google-cloud-sdk/path.zsh.inc"

​
6단계: Google 계정 로그인
gcloud auth login

​
브라우저가 열리면 Google 계정으로 로그인하고 권한을 허용하세요.
7단계: gws 설치
sudo npm install -g @googleworkspace/cli

​
Mac 로그인 비밀번호 입력 요청이 나오면 입력하세요. (sudo는 관리자 권한으로 실행한다는 뜻)
8단계: Google Cloud 자동 설정 (gws auth setup)
gws auth setup

​
gws auth setup은 5단계로 진행됩니다. 대부분 자동이지만 Step 3에서 한 가지 입력, Step 5에서 수동 작업 4개가 필요합니다.
Step 1/5: gcloud CLI 확인 (자동)
Step 2/5: Google 인증 — 브라우저 자동 열림 → 본인 Google 계정으로 로그인 + 권한 허용
Step 3/5: GCP 프로젝트 생성 — 터미널에서 프로젝트 이름 입력 요청
형식: 영문 소문자 + 하이픈 + 숫자, 6~30글자
예시: my-workspace, gws-camp01, imi-gws
Step 4/5: Workspace APIs 활성화 (자동)
Step 5/5: OAuth credential 생성 (수동 4단계 — 시간이 가장 오래 걸림)
Step 3에서 프로젝트 이름을 입력해도 진행이 안 되면 — 처음 Google Cloud를 사용하는 계정이라 약관 동의가 안 된 상태입니다. 터미널 화면에 작은 글씨로 동의 URL이 표시되어 있습니다. 그 URL을 복사해서 브라우저에 붙여넣고 약관 동의를 마친 뒤, 터미널로 돌아와 프로젝트 이름을 다시 입력하세요. (한 번만 하면 끝)
Step 5/5 상세: OAuth credential 생성
터미널에 Waiting for manual input 메시지와 GCP Console URL이 표시됩니다. 아래 순서로 진행:
5-1. OAuth 동의 화면 설정 (처음이면 필수)
표시된 URL을 클릭 또는 복사해서 브라우저에 붙여넣기
좌측 메뉴 → APIs & Services → OAuth consent screen
Audience 섹션:
개인 Gmail 계정: External 선택
Google Workspace 조직 계정: Internal 선택
Branding 섹션:
App name: gws-cli (또는 원하는 이름)
User support email: 본인 이메일
Developer contact information: 본인 이메일
Save 클릭.
5-2. Test users 추가 (External 선택 시 필수)
개인 Gmail로 External 선택했으면 본인을 Test users에 추가하지 않으면 9단계(gws auth login)에서 "Access blocked" 에러가 납니다.
OAuth consent screen → Test users 탭
+ ADD USERS 클릭
본인 Google 이메일 입력
Save
5-3. OAuth Client ID 생성
좌측 메뉴 → APIs & Services → Credentials
+ CREATE CREDENTIALS → OAuth client ID 선택
Application type: Desktop app 선택
이름: gws-cli-creds (또는 원하는 이름)
Create 클릭
Desktop app이 아닌 다른 타입을 선택하면 redirect_uri_mismatch 에러가 납니다.
5-4. Client ID와 Secret 터미널에 입력
다이얼로그에 두 값이 표시됩니다:
Client ID: 긴 문자열, .apps.googleusercontent.com으로 끝남
Client Secret: 짧은 문자열, GOCSPX- 로 시작
둘을 헷갈리지 않게 주의. Secret 자리에 ID를 잘못 붙여넣으면 인증 저장이 안 되는데 명확한 에러도 안 나옵니다.
Client ID 복사 → 터미널에 붙여넣기 → Enter
Client Secret 복사 → 터미널에 붙여넣기 → Enter
완료 메시지가 나오면 다음 단계로.
9단계: 서비스 인증 (gws auth login)
gws auth login

​
사용할 서비스(Gmail, Calendar, Drive, Sheets 등) 체크박스 → 권한 승인.
서비스를 너무 많이 선택하지 마세요. Testing 모드 앱은 OAuth scope 약 25개 제한이 있어서 모든 서비스 선택 시 invalid_scope 에러로 인증 실패합니다. 보통 Gmail, Calendar, Drive, Sheets 4개면 충분합니다.
끝. 이제 Claude Code에서 자연어로 시킬 수 있습니다.
Windows 설치
1단계: PowerShell 열기
Win + X → "Windows PowerShell" 또는 "터미널" 클릭
2단계: 스크립트 실행 정책 풀기 (꼭 필요)
Windows는 기본적으로 PowerShell 스크립트 실행이 막혀있어서 풀어줘야 합니다.
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

​
3단계: gcloud CLI 설치
Google Cloud를 터미널에서 다루는 도구. gws의 자동 설정에 필요합니다.
https://cloud.google.com/sdk/docs/install 접속
Windows용 GoogleCloudSDKInstaller.exe 다운로드
실행 → 안내에 따라 설치 (기본값 유지)
설치 마지막에 'Run gcloud init' 체크박스 체크
자동으로 열리는 창에서 Google 계정 로그인
4단계: PowerShell 새로 열기
기존 PowerShell 창을 완전히 닫고 새로 여세요. PATH 갱신을 위해 필요합니다.
VS Code 내장 터미널을 쓰는 경우, VS Code 자체를 완전 종료(작업 표시줄 우클릭 → 닫기)하고 다시 열어야 새 PATH가 반영됩니다. 단순히 터미널 창만 닫는 걸로는 안 됩니다.
5단계: Google 계정 로그인 (확인용)
3단계에서 'Run gcloud init' 자동 창에서 로그인을 마쳤다면 "이미 로그인됨" 메시지가 나옵니다. 안 마쳤으면 브라우저가 열리니 로그인 진행.
gcloud auth login

​
6단계: gws 설치
npm install -g @googleworkspace/cli

​
7단계: npm 글로벌 폴더를 PATH에 등록 + PowerShell 새로 열기 (꼭 필요)
npm 글로벌 설치 폴더가 PATH에 없으면 다음 단계에서 gws 명령어를 못 찾습니다. 아래 두 줄을 그대로 붙여넣으세요:
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
[Environment]::SetEnvironmentVariable("PATH", "$userPath;$env:APPDATA\npm", "User")

​
실행 후 PowerShell 창을 완전히 닫고 새로 여세요. (VS Code 사용 시 VS Code 자체 종료 후 재실행)
8단계: Google Cloud 자동 설정 (gws auth setup)
gws auth setup

​
gws auth setup은 5단계로 진행됩니다. 대부분 자동이지만 Step 3에서 한 가지 입력, Step 5에서 수동 작업 4개가 필요합니다.
Step 1/5: gcloud CLI 확인 (자동)
Step 2/5: Google 인증 — 브라우저 자동 열림 → 본인 Google 계정으로 로그인 + 권한 허용
Step 3/5: GCP 프로젝트 생성 — 터미널에서 프로젝트 이름 입력 요청
형식: 영문 소문자 + 하이픈 + 숫자, 6~30글자
예시: my-workspace, gws-camp01, imi-gws
Step 4/5: Workspace APIs 활성화 (자동)
Step 5/5: OAuth credential 생성 (수동 4단계 — 시간이 가장 오래 걸림)
Step 3에서 프로젝트 이름을 입력해도 진행이 안 되면 — 처음 Google Cloud를 사용하는 계정이라 약관 동의가 안 된 상태입니다. 터미널 화면에 작은 글씨로 동의 URL이 표시되어 있습니다. 그 URL을 복사해서 브라우저에 붙여넣고 약관 동의를 마친 뒤, 터미널로 돌아와 프로젝트 이름을 다시 입력하세요. (한 번만 하면 끝)
Step 5/5 상세: OAuth credential 생성
터미널에 Waiting for manual input 메시지와 GCP Console URL이 표시됩니다. 아래 순서로 진행:
5-1. OAuth 동의 화면 설정 (처음이면 필수)
표시된 URL을 클릭 또는 복사해서 브라우저에 붙여넣기
좌측 메뉴 → APIs & Services → OAuth consent screen
Audience 섹션:
개인 Gmail 계정: External 선택
Google Workspace 조직 계정: Internal 선택
Branding 섹션:
App name: gws-cli (또는 원하는 이름)
User support email: 본인 이메일
Developer contact information: 본인 이메일
Save 클릭.
5-2. Test users 추가 (External 선택 시 필수)
개인 Gmail로 External 선택했으면 본인을 Test users에 추가하지 않으면 9단계(gws auth login)에서 "Access blocked" 에러가 납니다.
OAuth consent screen → Test users 탭
+ ADD USERS 클릭
본인 Google 이메일 입력
Save
5-3. OAuth Client ID 생성
좌측 메뉴 → APIs & Services → Credentials
+ CREATE CREDENTIALS → OAuth client ID 선택
Application type: Desktop app 선택
이름: gws-cli-creds (또는 원하는 이름)
Create 클릭
Desktop app이 아닌 다른 타입을 선택하면 redirect_uri_mismatch 에러가 납니다.
5-4. Client ID와 Secret 터미널에 입력
다이얼로그에 두 값이 표시됩니다:
Client ID: 긴 문자열, .apps.googleusercontent.com으로 끝남
Client Secret: 짧은 문자열, GOCSPX- 로 시작
둘을 헷갈리지 않게 주의. Secret 자리에 ID를 잘못 붙여넣으면 인증 저장이 안 되는데 명확한 에러도 안 나옵니다.
Client ID 복사 → 터미널에 붙여넣기 → Enter
Client Secret 복사 → 터미널에 붙여넣기 → Enter
완료 메시지가 나오면 다음 단계로.
9단계: 서비스 인증 (gws auth login)
gws auth login

​
사용할 서비스(Gmail, Calendar, Drive, Sheets 등) 체크박스 → 권한 승인.
서비스를 너무 많이 선택하지 마세요. Testing 모드 앱은 OAuth scope 약 25개 제한이 있어서 모든 서비스 선택 시 invalid_scope 에러로 인증 실패합니다. 보통 Gmail, Calendar, Drive, Sheets 4개면 충분합니다.
끝. 이제 Claude Code에서 자연어로 시킬 수 있습니다.
VS Code 사용자 참고 (Mac / Windows 공통)
VS Code 내장 터미널에서 gcloud, gws, brew 같은 명령어가 안 잡히면 VS Code를 완전 종료(Mac은 Cmd+Q, Windows는 작업 표시줄 우클릭 → 닫기) 후 다시 열어보세요. VS Code가 PATH 설정 전에 이미 실행 중이었으면 옛날 환경을 들고 있어서 발생하는 문제입니다. 단순히 터미널 창만 닫는 걸로는 해결 안 됩니다.
보안 안내
설치 과정에서 생기는 client_secret*.json, credentials.json 파일은 절대 git에 올리거나 다른 사람과 공유하지 마세요. 자동으로 ~/.config/gws/ (Windows는 %USERPROFILE%\.config\gws\)에 보관되므로 별도로 신경 쓸 필요는 없습니다.
막히면
위 단계에서 막히면 알려주세요. 함께 풀어드립니다.
