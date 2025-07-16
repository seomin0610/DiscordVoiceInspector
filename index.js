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

const TOKEN = 'YOURTOKENHERE';
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
const LOG_CHANNEL_ID = '1234567899090909090909000000000000000000000000000000000000000000';  실제 채널 ID로 교체

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

let leaveAuthCode = null;
let leaveAuthTimeout = null;

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;


  if (message.content.trim() === '!나가') {

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789가나다라마사아자카타파하!*#';
    leaveAuthCode = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    console.log(`-----------------------------------------------`);
    console.log(`🔒 봇 종료 인증코드: ${leaveAuthCode}`);
    console.log(`-----------------------------------------------`);
    if (leaveAuthTimeout) clearTimeout(leaveAuthTimeout);
    leaveAuthTimeout = setTimeout(() => {
      leaveAuthCode = null;
      leaveAuthTimeout = null;
      console.log('!나가 인증코드가 만료되었습니다.');
    }, 60000);

    const embed = new EmbedBuilder()
      .setTitle('🔒 봇 종료 인증')
      .setDescription('아래 버튼을 눌러 콘솔에 발급된 인증코드를 입력하면 봇이 음성채널에서 나가고 종료됩니다.\n\n인증코드는 **1분간 유효**합니다.')
      .setColor(0x5865f2)
      .setTimestamp();
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('leave_auth')
        .setLabel('인증코드 입력')
        .setStyle(ButtonStyle.Primary)
    );
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }


    if (message.content.startsWith('!말 ')) {
      const text = message.content.slice(3).trim();
      if (!text) return message.reply('읽을 내용을 입력해주세요.');
      const member = message.member;
      const vc = member.voice.channel;
      if (!vc) return message.reply('음성 채널에 먼저 들어가주세요.');
      try {

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
          resource.volume.setVolume(3.0); 
          const player = createAudioPlayer();
          player.play(resource);
          connection.subscribe(player);
          player.on(AudioPlayerStatus.Playing, () => {
            console.log('🎵 오디오 재생 시작됨!');
          });
          player.on(AudioPlayerStatus.Idle, () => {
            console.log('🛑 오디오 재생 완료됨!');
            fs.unlinkSync(tempFilePath);
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


    if (lowered.startsWith('!등록허용단어 ')) {
      const word = message.content.slice('!등록허용단어 '.length).trim();
      if (!word) return message.reply('등록할 단어를 입력해주세요.');
      if (whitelistedWords.includes(word)) return message.reply('이미 등록된 허용 단어입니다.');
      whitelistedWords.push(word);
      saveList(whitelistPath, whitelistedWords);
      return message.reply(`✅ \`${word}\` 를 허용 단어로 등록했어요.`);
    }

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
      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      console.log(`봇이 ${voiceChannel.name} 채널에 입장했습니다.`);
    }
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {

  if (
    oldState.member && oldState.member.user.bot && 
    oldState.channel && !newState.channel
  ) {
    const guild = oldState.guild;
    const channel = oldState.channel;

    let kickerTag = '알 수 없음. 아래 시간을 참고해서 감사로그를 참고하세요.';
    try {
      const fetchedLogs = await guild.fetchAuditLogs({
        limit: 5,
        type: 40 
      });

      const kickLog = fetchedLogs.entries.find(entry => {
        const targetIdMatch = entry.target?.id === oldState.member.id;
        const extraMatch = entry.extra?.id === oldState.member.id;
        return targetIdMatch || extraMatch;
      });

      if (kickLog) {
        kickerTag = `${kickLog.executor.tag} (${kickLog.executor.id})`;
      } else {
        console.warn('❗ 킥 로그를 찾을 수 없음');
      }
    } catch (err) {
      console.error('감사 로그 조회 실패:', err);
    }


    setTimeout(async () => {
      let kickerTag = '알 수 없음. 아래 시간을 참고해서 감사로그를 확인하세요.';
      try {
        const fetchedLogs = await guild.fetchAuditLogs({
          limit: 5,
          type: 40 // MEMBER_DISCONNECT
        });

        const kickLog = fetchedLogs.entries.find(entry => {
          const targetIdMatch = entry.target?.id === oldState.member.id;
          const extraMatch = entry.extra?.id === oldState.member.id;
          return targetIdMatch || extraMatch;
        });

        if (kickLog) {
          kickerTag = `${kickLog.executor.tag} (${kickLog.executor.id})`;
        } else {
          console.warn('❗ 킥 로그를 찾을 수 없음');
        }
      } catch (err) {
        console.error('감사 로그 조회 실패:', err);
      }

      const stillChannel = guild.channels.cache.get(channel.id);
      if (stillChannel && stillChannel.members.filter(m => !m.user.bot).size > 0) {
        joinVoiceChannel({
          channelId: channel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
        });
      }

      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel && logChannel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('❗️봇이 음성채널에서 추방됨')
          .setDescription(`봇이 **${channel.name}** 음성채널에서 추방(킥) 당했습니다.\n잠시 후 자동으로 재입장합니다.`)
          .addFields({ name: '킥한 유저', value: kickerTag })
          .setColor(0xffa500)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    }, 2000);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'leave_auth') {
    if (!leaveAuthCode) {
      await interaction.reply({ content: '인증코드가 만료되었거나 요청되지 않았습니다. 다시 시도해 주세요.' });
      return;
    }
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('leave_auth_modal')
      .setTitle('봇 종료 인증코드 입력');
    const input = new TextInputBuilder()
      .setCustomId('leave_auth_code')
      .setLabel('인증코드 8자리')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(8)
      .setMinLength(8);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId === 'leave_auth_modal') {
    const code = interaction.fields.getTextInputValue('leave_auth_code');
    if (!leaveAuthCode) {
      await interaction.reply({ content: '인증코드가 만료되었거나 요청되지 않았습니다. 다시 시도해 주세요.' });
      return;
    }
    if (code === leaveAuthCode) {
      leaveAuthCode = null;
      if (leaveAuthTimeout) clearTimeout(leaveAuthTimeout);
      leaveAuthTimeout = null;
      const member = interaction.member;
      const guild = interaction.guild;
      const connection = require('@discordjs/voice').getVoiceConnection(guild.id);
      if (connection) connection.destroy();
      await interaction.reply({ content: '인증 성공! 봇이 음성채널에서 나가고 종료됩니다.' });
      console.log('🛑 봇이 종료 되었습니다.');
      setTimeout(() => process.exit(0), 1000);
    } else {
      await interaction.reply({ content: '인증코드가 올바르지 않습니다.' });
    }
  }
}
);

client.on(SpeechEvents.speech, async (msg) => {
  if (!msg.content) return;
  console.log(`${msg.member.user.tag} said: ${msg.content}`);
  const content = msg.content.toLowerCase();

  if (
    whitelistedWords.some(allow => content.includes(allow))
  ) {
    console.log(`✅ 허용 단어 포함 → 무시: ${content}`);
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
  
  client.user.setActivity('github.com/seomin0610', { type: 2 });
});

client.login(TOKEN);
