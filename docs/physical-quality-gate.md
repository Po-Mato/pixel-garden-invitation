# 실기기 품질 게이트

이 점검은 시뮬레이터 결과를 실기기 결과로 오인하지 않도록 VoiceOver·TalkBack, 패널 보정, 60/120Hz 동작을 별도 증거로 관리한다. 기본 실행은 연결 상태와 누락 항목을 보고하고, 릴리스 게이트는 모든 항목이 확인되지 않으면 실패한다.

```bash
pnpm quality:physical
pnpm quality:physical:require-all -- --evidence /절대경로/physical-quality-evidence.json
```

Android는 현재 연결된 기기의 TalkBack 활성 상태를 `adb settings`로 직접 확인한다. iOS VoiceOver 상태와 각 화면 판독 결과, 패널 환경은 점검자가 아래 형식으로 기록한다. 각 판정은 14일 이내의 캡처 파일과 SHA-256으로 묶이며, 캡처에는 개인 정보를 넣지 않는다. `artifactPath`는 증거 JSON 파일 기준 상대 경로다.

```json
{
  "version": 2,
  "accessibility": {
    "android": {
      "deviceId": "adb-device-id",
      "reviewedBy": "검토자 이름",
      "capturedAt": "2026-08-07T03:00:00.000Z",
      "artifactPath": "evidence/android-talkback.mp4",
      "artifactSha256": "64자리 sha256",
      "flow": { "entry": true, "menu": true, "directions": true, "close": true }
    },
    "ios": {
      "deviceId": "xctrace-device-id",
      "screenReaderEnabled": true,
      "reviewedBy": "검토자 이름",
      "capturedAt": "2026-08-07T03:00:00.000Z",
      "artifactPath": "evidence/ios-voiceover.mp4",
      "artifactSha256": "64자리 sha256",
      "flow": { "entry": true, "menu": true, "directions": true, "close": true }
    }
  },
  "displayCalibration": [
    {
      "id": "oled-low-brightness",
      "deviceModel": "기기명",
      "panel": "oled",
      "brightnessPercent": 20,
      "ambientLux": 30,
      "reviewedBy": "검토자 이름",
      "capturedAt": "2026-08-07T03:00:00.000Z",
      "artifactPath": "evidence/oled-low-brightness.jpg",
      "artifactSha256": "64자리 sha256",
      "labelsReadable": true,
      "characterEdgesClear": true,
      "uiOverlapFree": true
    }
  ],
  "motion": [
    {
      "id": "60hz-normal",
      "inputLatencyMs": 34,
      "settleLatencyMs": 150,
      "settledJitterPx": 0.25,
      "reviewedBy": "검토자 이름",
      "capturedAt": "2026-08-07T03:00:00.000Z",
      "artifactPath": "evidence/60hz-normal.mp4",
      "artifactSha256": "64자리 sha256"
    }
  ]
}
```

패널 항목은 `oled-low-brightness`, `oled-outdoor-p3`, `lcd-low-brightness`, `lcd-outdoor-srgb` 네 가지가 모두 필요하다. 동작 항목은 `60hz-normal`, `120hz-normal`, `60hz-low-power` 세 가지가 모두 필요하다. SHA-256은 `shasum -a 256 파일경로`로 계산한다. 연결 기기, 14일 유효기간, 검토자, 파일 해시 중 하나라도 맞지 않으면 통과하지 않는다. 결과는 기본적으로 `.superpowers/physical-quality/report.json`에 저장된다.
