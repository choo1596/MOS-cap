# MOS Capacitor 시뮬레이터 (Lecture 5-1)

강의 슬라이드(week5 MOS capacitor)의 그림과 식을 그대로 움직여 보는 단일 파일 시뮬레이터입니다.

**▶ 실행: https://choo1596.github.io/MOS-cap/**

파일 하나(`mos_cap_sim.html`)로 끝나고 외부 의존성이 없습니다. 더블클릭해서 `file://` 로 열어도 동작합니다.

## 사용법
1. **Close switch** — 전선을 연결하면 정공이 게이트로 이동하고 공핍 영역이 생기며 Fermi 준위가 맞춰집니다 (슬라이드 8 → 9).
2. **V_G 슬라이더** — 스위치를 한 번 닫은 뒤부터 좌우로 움직일 수 있습니다 (0.01 V 단위, 방향키·−/+ 버튼).
3. **Open switch** — 게이트가 떠 있게 되어 전하가 그대로 갇힙니다.
4. **Reset device** — 한 번도 연결하지 않은 상태(슬라이드 8)로 돌아갑니다.

## 물리 모델 (슬라이드 식)
| 모드 | 조건 | 식 |
|---|---|---|
| Accumulation | V_G < V_FB | φ_s = 0, Q′_acc = −C_ox(V_G − V_FB) |
| Depletion | V_FB ≤ V_G ≤ V_T | V_G − V_FB = φ_s + b√φ_s, Q′_dep = −√(2eN_aε_sφ_s) |
| Inversion | V_G > V_T | φ_s = 2φ_fp, x_d = x_dT, Q′_inv = −C_ox(V_G − V_T) |

스위치·슬라이더 변화는 τ = 0.4 s 로 새 평형에 다가갑니다.

## 검증
```
node tests/verify.mjs
```
도출량 6개, 평형 상태, 스위치 과도 과정, 전하 중성, 실제 UI(스위치 버튼·슬라이더)를 검사하고 `tests/screenshots/` 에 스크린샷을 남깁니다.
