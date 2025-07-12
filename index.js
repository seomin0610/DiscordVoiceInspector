const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { addSpeechEvent, SpeechEvents } = require('discord-speech-recognition');

const TOKEN = 'YOUR_BOT_TOKEN_HERE';
const bannedWords = ['정예지', '정예찌', '정예지이', '정예지야', '정에지', '정예지에', '정예지으', '정예지읏', '정예쥐', '정에쥐', '정에지이', '정녀지', '정녜지', '저녜지', '저예지', '쩡예지', '쩡에지', '쩡예찌', '쩡예지야', '쩡예지이야', '쩡에지이', '쩡예쥐', '정이예지', '정이예찌', '정에이찌', '정예이찌', '쩡예이', '쩡예이찌', '쩡예이야', '정예쥐이', '정에지야', '정에지이', '정예지으이', '정예지으야', '정에지으', '정예지읏이', '정예지읏야', '정예지읏으', '정예지읏으이', '정예지읏으야', '정에찌', '정예찌이', '쩡예찌이', '쩡예지으', '쩡예지읏', '쩡예지읏이', '쩡예지읏야', '쩡예지읏으', '쩡예지읏으이', '쩡예지읏으야', '정예이', '정예이이', '정예이야', '쩡예이', '쩡예이이', '쩡예이야', '저예지', '저예찌', '저예지야', '정예', '정에', '정이', '쩡이예지', '쩡에지이', '쩡예지아', '정예지아', '정예지이아', '정예지이야', '쩡예지이아', '쩡예지이야', '정에지야', '정예지에이', '쩡예지에이', '쩡예지에', '정예지에', '정예지에이', '쩡예지이으', '쩡예지이으야', '쩡예지이으이', '쩡예지이으아', '쩡예지이으아아', '쩡예지이으야아', '쩡예지이으이아', '쩡예지이으이야', '예지', '예찌', '예쥐', '에쮜'];
const bannedPatterns = bannedWords.map(word => {
  const pattern = word.split('').join('.{0,2}');
  return new RegExp(pattern, 'i');
});
const TIMEOUT_DURATION = 1 * 60 * 1000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

addSpeechEvent(client, {
    lang: 'ko-KR',
  });addSpeechEvent(client);

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
  
    const lowered = message.content.toLowerCase();
    if (bannedWords.some(word => lowered.includes(word.toLowerCase()))) {
      try {
        await message.delete();
        await message.member.timeout(TIMEOUT_DURATION, '금지된 단어 사용');
        console.log(`텍스트 타임아웃: ${message.author.tag}`);
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


client.on(SpeechEvents.speech, async (msg) => {
  if (!msg.content) return;
  console.log(`${msg.member.user.tag} said: ${msg.content}`);

  if (bannedPatterns.some(pattern => pattern.test(msg.content))) {
    const member = msg.member;
    try {
      await member.timeout(TIMEOUT_DURATION, '금지된 단어 사용 (음성)');
      const vc = msg.member.voice.channel;
      if (vc) {
        const conn = joinVoiceChannel({
          channelId: vc.id,
          guildId: vc.guild.id,
          adapterCreator: vc.guild.voiceAdapterCreator,
          selfDeaf: false,
        });
        conn.destroy();
      }
      console.log(`음성 타임아웃: ${member.user.tag}`);
    } catch (err) {
      console.error('음성 타임아웃 실패:', err);
    }
  }
});

client.once(Events.ClientReady, () => {
  console.log(`로그인됨: ${client.user.tag}`);
});

client.login(TOKEN);
