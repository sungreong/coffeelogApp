# CoffeeLog

CoffeeLog는 개인용 커피 기록 앱입니다. 원두 제품, 구매분, 잔량, 추출 기록, 샷 사진, 타이머, AI 프롬프트 복사를 한곳에서 관리하도록 만든 Expo / React Native 앱입니다.

## 주요 기능

- 원두 제품과 구매분 관리
- 구매분별 잔량 보정 및 추출 기록에 따른 자동 차감
- 최근 히스토리 중심의 추출 기록 추가/수정 흐름
- 도즈/퍽, 압력, 결과 컵 샷 사진 슬롯 관리
- 구매분/기록 정보를 ChatGPT 또는 Gemini에 붙여넣기 쉬운 프롬프트로 복사
- 로컬 SQLite 기반 데이터 저장
- CSV, JSON, ZIP 백업/내보내기

## 개발 환경

- Node.js 18 이상 권장
- npm
- Expo SDK `~54.0.33`
- React Native `0.81.5`
- Android Studio 및 Android SDK, Android 빌드가 필요한 경우

## 처음 실행

```bash
npm install
npm start
```

`npm start`는 Expo 개발 서버를 tunnel 모드로 실행합니다. Expo Go 또는 개발 빌드 앱에서 QR 코드를 스캔해 실행할 수 있습니다.

웹으로 빠르게 확인하려면 다음 명령을 사용합니다.

```bash
npm run web
```

Android 기기 또는 에뮬레이터에 직접 설치해 실행하려면 다음 명령을 사용합니다.

```bash
npm run android
```

## APK 빌드

Debug APK:

```bash
npm run apk:debug
```

결과 파일:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Release APK:

```bash
npm run apk:release
```

결과 파일:

```text
android/app/build/outputs/apk/release/app-release.apk
```

현재 프로젝트의 릴리즈 빌드는 로컬 Android 서명 설정을 사용합니다. `android/keystore.properties`, `android/app/keystores/` 파일은 민감 정보라 Git에 올리지 않습니다.

## 검증 명령

```bash
npm run typecheck
```

필요하면 Expo 환경 점검도 실행할 수 있습니다.

```bash
npm run doctor
```

## 프로젝트 구조

```text
app/
  (tabs)/
    beans.tsx      원두/구매분 관리
    log.tsx        추출 기록
    timer.tsx      타이머
    equipment.tsx  장비
    settings.tsx   설정
src/
  components.tsx   공용 UI 컴포넌트
  services/        AI, 재고, 사진, 추천, 내보내기 서비스
  store/           Zustand 상태 및 SQLite 연동
  types/           앱 데이터 타입
android/           Android 네이티브 프로젝트
```

## Git에 올리지 않는 파일

다음 파일은 로컬 실행/빌드 산출물 또는 민감 정보라 커밋하지 않습니다.

- `node_modules/`
- `.expo/`
- `*.log`
- `android/.gradle/`
- `android/.kotlin/`
- `android/build/`
- `android/app/build/`
- `android/local.properties`
- `android/keystore.properties`
- `android/app/keystores/`
