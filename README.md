# CoffeeLog

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Expo](https://img.shields.io/badge/Expo-54-black.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue.svg)](https://reactnative.dev/)

CoffeeLog는 원두 구매부터 에스프레소 추출 기록, 잔량 관리, 타이머, AI 프롬프트 복사까지 한곳에서 관리하는 개인용 커피 로그 앱입니다. Expo / React Native 기반으로 만들었고, 데이터는 로컬 SQLite에 저장합니다.

## 어필 포인트

- 원두 제품과 구매분을 분리해 관리하므로 같은 원두를 여러 번 구매해도 구매분별 로스팅일, 개봉일, 잔량, 상태를 따로 추적할 수 있습니다.
- 추출 기록은 분쇄도, 도징량, 추출량, 시간처럼 다음 샷에 바로 쓰는 핵심값을 중심으로 보여줍니다.
- BES876 같은 반자동 머신 흐름에 맞춰 AUTO/MANUAL 도징, 도즈 게이지, 압력 구간, 첫 방울, 프리인퓨전 시간을 함께 기록할 수 있습니다.
- 도징량이 비어 있으면 잔량에 반영되지 않는다는 경고를 표시해 재고 계산 누락을 줄입니다.
- 빈 값은 `-` 대신 `미입력`, `기록 없음`, `입력값 부족`처럼 의미가 드러나는 문구로 보여줘 기록 상태를 빠르게 판단할 수 있습니다.
- 좋은 기록과 최근 패턴을 바탕으로 다음 샷에서 바꿀 값 하나를 추천하고, ChatGPT/Gemini에 붙여넣기 쉬운 프롬프트를 생성합니다.
- 타이머에서 측정한 총 추출 시간, 첫 방울, 프리인퓨전 값을 새 기록으로 넘길 수 있어 실제 추출 흐름이 끊기지 않습니다.
- CSV, JSON, ZIP 내보내기와 로컬 백업을 지원해 개인 기록을 앱 밖에서도 보관할 수 있습니다.

## 오픈소스

CoffeeLog는 MIT 라이선스로 공개된 오픈소스 프로젝트입니다. 버그 제보, 기능 제안, 문서 개선, 작은 UI 문구 수정도 모두 환영합니다.

- 기여 가이드: [CONTRIBUTING.md](CONTRIBUTING.md)
- 행동 강령: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 보안 정책: [SECURITY.md](SECURITY.md)
- 라이선스: [LICENSE](LICENSE)

## 주요 기능

- 원두 제품/구매분 등록, 수정, 상태 관리
- 구매분별 신선도 표시와 잔량 자동 차감
- 빠른 기록, 가이드 기록, 정밀 기록 모드
- 샷 사진 슬롯 관리: 도즈 게이지, 탬핑 후 퍽, 압력 게이지, 추출 컵, 사용 후 퍽
- 최근 30일 패턴, 좋은 기록, 추천 액션 요약
- 추출 타이머와 로그 연동
- AI 분석용 프롬프트 복사 및 ChatGPT/Gemini 열기
- 로컬 SQLite 저장소
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

## 기여 흐름

1. 이슈에서 작업할 내용을 확인하거나 새 이슈를 만듭니다.
2. 변경 후 `npm run typecheck`로 기본 검증을 실행합니다.
3. Pull Request에는 변경 이유, 확인한 명령, 화면 변경이 있다면 스크린샷을 함께 적습니다.

## 프로젝트 구조

```text
app/
  (tabs)/
    index.tsx      홈/요약
    beans.tsx      원두/구매분 관리
    log.tsx        추출 기록
    timer.tsx      타이머
    equipment.tsx  장비
    export.tsx     내보내기/백업
    settings.tsx   설정
src/
  components.tsx   공용 UI 컴포넌트
  constants/       테마와 용어 도움말
  db/              SQLite 스키마와 쿼리
  services/        AI, 재고, 사진, 추천, 내보내기, 위젯 서비스
  store/           Zustand 상태 및 SQLite 연동
  types/           앱 데이터 타입
android/           Android 네이티브 프로젝트
```

## 라이선스

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.
