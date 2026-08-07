# 실기기 품질 게이트

이 점검은 시뮬레이터 결과를 실기기 결과로 오인하지 않도록 VoiceOver·TalkBack, 패널 보정, 60/120Hz 동작을 별도 증거로 관리한다. 기본 실행은 연결 상태와 누락 항목을 보고하고, 릴리스 게이트는 모든 항목이 확인되지 않으면 실패한다.

```bash
pnpm quality:physical
pnpm quality:physical:require-all -- --evidence /절대경로/physical-quality-evidence.json
```

Android는 현재 연결된 기기의 TalkBack 활성 상태를 `adb settings`로 직접 확인한다. iOS VoiceOver 상태와 각 화면 판독 결과, 패널 환경은 점검자가 아래 형식으로 기록한다. 증거 파일에는 개인 정보나 화면 캡처를 넣지 않는다.

```json
{
  "accessibility": {
    "android": {
      "deviceId": "adb-device-id",
      "flow": { "entry": true, "menu": true, "directions": true, "close": true }
    },
    "ios": {
      "deviceId": "xctrace-device-id",
      "screenReaderEnabled": true,
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
      "settledJitterPx": 0.25
    }
  ]
}
```

패널 항목은 `oled-low-brightness`, `oled-outdoor-p3`, `lcd-low-brightness`, `lcd-outdoor-srgb` 네 가지가 모두 필요하다. 동작 항목은 `60hz-normal`, `120hz-normal`, `60hz-low-power` 세 가지가 모두 필요하다. 결과는 기본적으로 `.superpowers/physical-quality/report.json`에 저장된다.
