const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const { addSpeechEvent, SpeechEvents, SpeechRecognition } = require('discord-speech-recognition');
const googleTTS = require('google-tts-api');
const { createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, getVoiceConnection, StreamType } = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { workerData } = require('worker_threads');

const TOKEN = 'TOKEN_HERE디스코드봇토큰여기에넣어줘요';
const whitelistPath = path.join(__dirname, 'whitelist.json');
const blacklistPath = path.join(__dirname, 'blacklist.json');

function loadList(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveList(filePath, list) {
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
}

let whitelistedWords = loadList(whitelistPath);
let bannedWords = loadList(blacklistPath);
let bannedPatterns = bannedWords.map(word =>
  new RegExp(word.split('').join('.{0,2}'), 'i')
);

const TIMEOUT_DURATION = 1 * 60 * 1000;
const LOG_CHANNEL_ID = 'chnnelidhere'; //<---------- 로그용 채널 ID

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

async function sendLogEmbed({ guild, member, type, content }) {
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel || !logChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(`🚨 금지어 감지 (${type})`)
    .setColor(0xff0000)
    .addFields(
      { name: '유저', value: `${member.user.tag} (${member.id})`, inline: true },
      { name: '내용', value: content.slice(0, 100) || '없음', inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

addSpeechEvent(client, { lang: 'ko-KR' });

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
  
    // !말 명령어 처리
    if (message.content.startsWith('!말 ')) {
      const text = message.content.slice(3).trim();
      if (!text) return message.reply('읽을 내용을 입력해주세요.');
      const member = message.member;
      const vc = member.voice.channel;
      if (!vc) return message.reply('음성 채널에 먼저 들어가주세요.');
      try {
        // TTS 음성 생성
        const url = googleTTS.getAudioUrl(text, {
          lang: 'ko',
          slow: false,
          host: 'https://translate.google.com',
        });
        console.log('TTS URL:', url);
        const tempFilePath = path.join(__dirname, 'tts.mp3');
        const writer = fs.createWriteStream(tempFilePath);
        const response = await axios({
          url,
          method: 'GET',
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        response.data.pipe(writer);
        writer.on('finish', () => {
          let connection = getVoiceConnection(vc.guild.id);
          if (!connection) {
            connection = joinVoiceChannel({
              channelId: vc.id,
              guildId: vc.guild.id,
              adapterCreator: vc.guild.voiceAdapterCreator,
              selfDeaf: false,
            });
          }
          const resource = createAudioResource(tempFilePath, {
            inlineVolume: true,
          });
          resource.volume.setVolume(3.0); // 1.0이 기본, 2.0은 2배, 0.5는 절반
          const player = createAudioPlayer();
          player.play(resource);
          connection.subscribe(player);
          player.on(AudioPlayerStatus.Playing, () => {
            console.log('🎵 오디오 재생 시작됨!');
          });
          player.on(AudioPlayerStatus.Idle, () => {
            console.log('🛑 오디오 재생 완료됨!');
            fs.unlinkSync(tempFilePath); // ✅ 재생 끝난 후 임시 파일 삭제
          });
          player.on('error', (err) => {
            console.error('오디오 플레이어 오류', err);
          });
        });
        writer.on('error', (err) => {
          console.error('TTS 파일 저장 실패:', err);
        });
      } catch (err) {
        console.error('TTS 오류:', err);
        message.reply('TTS 재생 중 오류가 발생했습니다.');
      }
      return;
    }

    const lowered = message.content.toLowerCase();

    // !등록허용단어 명령어 처리
    if (lowered.startsWith('!등록허용단어 ')) {
      const word = message.content.slice('!등록허용단어 '.length).trim();
      if (!word) return message.reply('등록할 단어를 입력해주세요.');
      if (whitelistedWords.includes(word)) return message.reply('이미 등록된 허용 단어입니다.');
      whitelistedWords.push(word);
      saveList(whitelistPath, whitelistedWords);
      return message.reply(`✅ \`${word}\` 를 허용 단어로 등록했어요.`);
    }

    // !등록금지단어 명령어 처리
    if (lowered.startsWith('!등록금지단어 ')) {
      const word = message.content.slice('!등록금지단어 '.length).trim();
      if (!word) return message.reply('등록할 단어를 입력해주세요.');
      if (bannedWords.includes(word)) return message.reply('이미 등록된 금지 단어입니다.');
      bannedWords.push(word);
      saveList(blacklistPath, bannedWords);
      bannedPatterns = bannedWords.map(word =>
        new RegExp(word.split('').join('.{0,2}'), 'i')
      );
      return message.reply(`⛔ \`${word}\` 를 금지 단어로 등록했어요.`);
    }

    if (bannedWords.some(word => lowered.includes(word.toLowerCase()))) {
      try {
        await message.delete();
        await message.member.timeout(TIMEOUT_DURATION, '금지된 단어 사용');
        console.log(`-----------------------------------------------`);
        console.log(`텍스트 타임아웃: ${message.author.tag}`);
        console.log(`-----------------------------------------------`);
        await sendLogEmbed({
          guild: message.guild,
          member: message.member,
          type: '채팅',
          content: message.content,
        });
      } catch (err) {
        console.error('텍스트 타임아웃 실패:', err);
      }
    }
  });

client.on(Events.VoiceStateUpdate, (oldState, newState) => {

    if (!oldState.channel && newState.channel && !newState.member.user.bot) {
      const voiceChannel = newState.channel;
  
      const botInChannel = voiceChannel.members.find(m => m.user.bot);
      if (!botInChannel) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: false,
        });

        console.log(`봇이 ${voiceChannel.name} 채널에 입장했습니다.`);
      }
    }
  });


client.on(SpeechEvents.speech, async (msg) => {
  if (!msg.content) return;
  const content = msg.content.toLowerCase();
  
  if (
    whitelistedWords.some(allow => content.includes(allow))
  ) {
    console.log(`-----------------------------------------------`);
    console.log(`✅ 허용 단어 포함 → 무시: ${content}`);
    console.log(`-----------------------------------------------`);
    return;
  }

  if (
    bannedPatterns.some(pattern => pattern.test(content))
  ) {
    const member = msg.member;
    try {
      await member.timeout(TIMEOUT_DURATION, '금지된 단어 사용 (음성)');
      await sendLogEmbed({
        guild: msg.guild,
        member: member,
        type: '음성',
        content: msg.content,
      });
      console.log(`-----------------------------------------------`);
      console.log(`❌ 음성 타임아웃: ${member.user.tag}`);
      console.log(`-----------------------------------------------`);
    } catch (err) {
      console.error('음성 타임아웃 실패:', err);
    }
  }
});

client.once(Events.ClientReady, () => {
  console.log(`로그인됨: ${client.user.tag}`);
  
  client.user.setActivity('github.com/seomin0610', { type: 2 }); // 2는 "듣는 중" 상태
});

client.login(TOKEN);
