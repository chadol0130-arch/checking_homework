# 숙제 검사 AI 앱 MVP 정의 (1~3번 정리)

## 1) MVP 기능 정의서

### 목표
- 학생이 숙제 사진을 올리면 AI가 기본 채점과 피드백을 제공한다.
- 점수에 따라 경험치가 지급되고 3D 캐릭터 레벨이 올라간다.

### 주요 기능
| 기능 | 설명 | MVP 포함 | 비고 |
| --- | --- | --- | --- |
| 사진 업로드 | 숙제 사진 촬영/선택 후 업로드 | ✅ | PNG/JPG/WEBP |
| AI 채점 | 점수 산정, 기본 피드백 생성 | ✅ | 규칙 기반 + 간단 모델 |
| 결과 화면 | 점수/피드백 표시 | ✅ | 카드 형태 UI |
| 레벨 시스템 | 경험치 계산 및 레벨 업데이트 | ✅ | 간단한 레벨 테이블 |
| 3D 캐릭터 표시 | 레벨에 따른 색상/표정 변화 | ✅ | MVP는 2D/간단 3D |
| 보상/아이템 | 캐릭터 아이템 지급 | ❌ | 2차 확장 |
| 학부모/교사 리포트 | 주간 리포트, 성장 추적 | ❌ | 2차 확장 |

### 성공 기준
- 사진 업로드 → 결과 수신까지 10초 이내.
- 레벨 변화가 직관적으로 보임.
- 학생이 “숙제 제출” 행동을 반복하도록 보상 구조가 작동.

## 2) AI 분석 방식 설계

### 입력
- 학생이 업로드한 숙제 이미지.

### 처리 단계
1. **이미지 전처리**: 회전/크롭/노이즈 제거.
2. **텍스트/수식 인식**: OCR 또는 수식 인식 모델 적용.
3. **문항 분리**: 문제 영역 단위로 분리.
4. **정답 비교**: 정답 데이터베이스 또는 규칙 기반 비교.
5. **피드백 생성**: 오답 유형에 따라 텍스트 코멘트 생성.

### MVP에서의 간소화
- OCR + 간단 규칙 기반 비교로 시작.
- 피드백은 점수 구간별 템플릿으로 제공.
- 후속 단계에서 멀티모달 LLM 적용.

### 품질 지표
- OCR 인식 정확도.
- 오답 탐지 정확도.
- 피드백 만족도(사용자 평가).

## 3) DB 구조 설계 (초안)

### 핵심 테이블
- `users`
  - id (PK)
  - role (student/parent/teacher)
  - name
  - email
  - created_at

- `homeworks`
  - id (PK)
  - student_id (FK -> users.id)
  - image_url
  - status (pending/completed/failed)
  - created_at

- `evaluations`
  - id (PK)
  - homework_id (FK -> homeworks.id)
  - score
  - feedback
  - created_at

- `levels`
  - id (PK)
  - student_id (FK -> users.id)
  - experience
  - level
  - updated_at

### 확장 테이블 (2차)
- `rewards`
  - id, student_id, reward_type, metadata

- `progress_reports`
  - id, student_id, week, summary

### 관계 요약
- `users (학생)` 1:N `homeworks`
- `homeworks` 1:1 `evaluations`
- `users (학생)` 1:1 `levels`
