# checking_homework

학생 숙제 사진을 업로드하면 간단한 AI 채점과 피드백을 제공하고, 경험치에 따라 캐릭터 레벨이 올라가는 MVP 데모입니다.

## 실행 방법

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

브라우저에서 `http://127.0.0.1:5000` 으로 접속합니다.

## 구조

- `app.py`: Flask API 서버
- `templates/`: HTML 템플릿
- `static/`: CSS/JS 리소스
- `docs/mvp.md`: 1~3번 정리 문서
