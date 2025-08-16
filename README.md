# 디스코드 음성 검열 봇

이 봇은 디스코드 서버에서 텍스트 및 음성 채팅 모두에서 특정단어를 감지하여 자동으로 타임아웃(일시 정지) 처리를 해주는 한국어 전용 디스코드 봇입니다.

## 주요 기능
- 디스코드 서버에서 특정단어 삭제.

## 설치 및 실행 방법
1. Node.js(22버전 이상)와 npm이 설치되어 있어야 합니다.
2. 클론하세용
```bash
npm install
```

3. `index.js` 파일의 `TOKEN` 변수에 본인의 디스코드 봇 토큰을 입력합니다.
4. `const LOG_CHANNEL_ID = 'chnnelidhere';` 여기에 차단 알림을 받을 채널 ID를 넣어주세요!
5. 아래 명령어로 봇을 실행합니다.

```bash
node index.js
```

## 사용법
- 봇을 서버에 초대하고, 텍스트/음성 채널에서 금지어를 입력하거나 말하면 자동으로 타임아웃 처리됩니다.
- 금지어는 `blacklist.json`에서 자유롭게 추가/수정할 수 있습니다.
- 금지어는 다양한 우회 표현(글자 사이에 다른 글자 삽입 등)도 자동으로 감지합니다.
- `!말 ` 를 사용해서 봇으로 말을 시킬수 있습니다.
- `!등록허용단어 (단어)` 를 사용해서 whitelist.json에 등록시킬수 있답니다.
  
## 주의사항
- 봇이 음성 채널에 입장하려면 충분한 권한(음성 채널 입장, 메시지 관리 등)이 필요합니다. 역할 위로 올려주세요
- 금지어 감지 로직은 한글 기준으로 설계되어 있습니다.

## 사용된 주요 라이브러리
- [discord.js](https://discord.js.org/)
- [@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice)
- [discord-speech-recognition](https://www.npmjs.com/package/discord-speech-recognition)

---

1000-7972-6842

