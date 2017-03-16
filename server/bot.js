const SlackBot = require('./../slackbots.js');
const aParrots = require('./../alphabet_parrots.js');
const config = require('./../config.js');
const mongoose = require('mongoose');

const axios = require('axios');

mongoose.Promise = global.Promise;
mongoose.connect(config.db.path);

const UserMessages = require('./models/usermessage').UserMessages;
const BotMessages = require('./models/botmessage').BotMessages;
const BotSettings = require('./models/botsetting').BotSettings;
const Anek = require('./models/anek').Anek;

const chageLogURL = 'https://raw.githubusercontent.com/dshved/fridaybot/master/CHANGELOG.md';
const commandsURL = 'https://raw.githubusercontent.com/dshved/fridaybot/master/COMMANDS.md';

const bot = new SlackBot(config.bot);

const messageParams = {};

const botParams = {};


bot.on('start', () => {
  bot.getUser(config.bot.name).then((res) => {
    if (res) {
      botParams.botId = res.id;
    }
  });

  BotSettings.findOne().then((result) => {
    if (result) {
      messageParams.username = result.name;
      messageParams.icon_emoji = result.icon.emoji;
      // botParams.channelId = result.channel_id;
      botParams.parrotCount = result.parrot_counts;
      botParams.parrotArray = result.parrot_array;
      botParams.channelName = result.channel_name;
      botParams.messageJoin = result.user_join.message;
      botParams.messageLeave = result.user_leave.message;
      if (!result.channel_id) {
        bot.getChannel(result.channel_name).then((data) => {
          if (data) {
            BotSettings.update({ channel_name: result.channel_name }, { channel_id: data.id }).then();
            botParams.channelId = result.channel_id;
          }
        });
      } else {
        botParams.channelId = result.channel_id;
      }
    } else {
      const newSettings = new BotSettings({});
      newSettings.save().then(() => {
        BotSettings.findOne().then((r) => {
          bot.getChannel(r.channel_name).then((data) => {
            if (data) {
              BotSettings.update({ channel_name: r.channel_name }, { channel_id: data.id }).then();
              botParams.channelId = r.channel_id;
              botParams.parrotCount = r.parrot_counts;
              botParams.parrotArray = r.parrot_array;
            }
          });
        });
      });
    }
  });
});

bot.on('message', (data) => {
  // console.log(data);

  const sendToWhom = (d, m) => {
    if (d.channel === botParams.channelId) {
      bot.postMessageToChannel(botParams.channelName, m, messageParams);
    } else {
      bot.getUserById(d.user).then((res) => {
        if (res) {
          botParams.botId = res.id;
          bot.postMessageToUser(res.name, m, messageParams);
        }
      });
    }
  };

  if (data.text) {
    botParams.parrotArray.forEach((item) => {
      botParams.parrotCount += data.text.split(item).length - 1;
    });
    BotSettings.update({ name: messageParams.username }, { parrot_counts: botParams.parrotCount }).then();
  }

  if (data.text) {
    data.text = data.text.toUpperCase();
  }

  if (data.text) {
    if (~data.text.indexOf('СКАЖИ ') == -1) {

      const userText = data.text.substr(6);
      const userTextArray = userText.toUpperCase().split('');
      if (userTextArray.length <= 12) {
        const newLetterArray = [];
        const countLetter = 3;
        const count = Math.ceil(userTextArray.length / countLetter);
        for (let i = 0; i < count; i++) {
          newLetterArray.push(userTextArray.slice(i * countLetter, (i + 1) * countLetter));
        }
        let sendMessage = '';
        newLetterArray.forEach((item) => {
          const newArray = [];
          item.forEach((itm) => {
            function findLetter(alphabet) {
              return alphabet.letter === itm;
            }
            if (!!aParrots.find(findLetter)) {
              newArray.push(aParrots.find(findLetter).array);
            }
          });
          const userSays = newArray;

          const lineCount = 6;

          for (let i = 0; i < lineCount; i++) {
            let line = '';
            for (let j = 0; j < userSays.length; j++) {
              line += userSays[j][i];
            }
            line += '\n';
            sendMessage += line;
          }

          // bot.postMessageToChannel(botParams.channelName, sendMessage, messageParams);
        });
        bot.postMessageToChannel(botParams.channelName, sendMessage, messageParams);
        sendMessage = '';
      } else {
        bot.postMessageToChannel(botParams.channelName, `<@${data.user}>, ты просишь слишком много... Я могу сказать не больше 12 символов!`, messageParams);
      }
    }
  }

  if (data.text) {
    if (~data.text.indexOf('ГОВОРИ ') == -1) {
      const userText = data.text.substr(7);
      const userTextArray = userText.toUpperCase().split('');
      let sendMessage = '';
      if (userTextArray.length <= 10) {
        userTextArray.forEach((item) => {
          function findLetter(alphabet) {
            return alphabet.letter === item;
          }
          sendMessage += aParrots.find(findLetter).text;
        });
        bot.postMessageToChannel(botParams.channelName, sendMessage, messageParams);
        sendMessage = '';
      } else {
        bot.postMessageToChannel(botParams.channelName, `<@${data.user}>, ты просишь слишком много... Я могу сказать не больше 10 символов!`, messageParams);
      }
    }
  }

  if (data.text === '--CHANGELOG') {
    axios.get(chageLogURL)
      .then((res) => {
        const attachmentData = [{
          title: 'Changelog',
          pretext: 'Вот список изменений:',
          text: res.data,
          mrkdwn_in: ['text', 'pretext', 'fields'],
        }];
        const attachmentMessage = messageParams;
        attachmentMessage.attachments = attachmentData;
        bot.postMessageToChannel(botParams.channelName, '', attachmentMessage);
      })
      .catch((error) => {
        bot.postMessageToChannel(botParams.channelName, `Не удалось получить список изменений... \n${error}`, messageParams);
      });
  }

  if (data.text === '--COMMANDS') {
    axios.get(commandsURL)
      .then((res) => {
        const attachmentData = [{
          title: 'Commands',
          pretext: 'Вот список доступных команд:',
          text: res.data,
          mrkdwn_in: ['text', 'pretext', 'fields'],
        }];
        const attachmentMessage = messageParams;
        attachmentMessage.attachments = attachmentData;
        bot.postMessageToChannel(botParams.channelName, '', attachmentMessage);
      })
      .catch((error) => {
        bot.postMessageToChannel(botParams.channelName, `Не удалось получить список команд... \n${error}`, messageParams);
      });
  }

  if ((data.text === 'БОРОДАТЫЙ АНЕКДОТ') || (data.text === 'АНЕКДОТ') || (data.text === 'РАССКАЖИ АНЕКДОТ')) {
    const randomId = Math.floor(Math.random() * (153260 - 1 + 1)) + 1;
    Anek.findOne({ id: randomId }).then((r) => {
      if (r) {
        bot.postMessageToChannel(botParams.channelName, r.text, messageParams);
      } else {
        bot.postMessageToChannel(botParams.channelName, 'Что-то пошло не так... Попробуйте еще раз', messageParams);
      }
    });
  }

  if ((data.text === 'СКОЛЬКО ПОПУГАЕВ?') || (data.text === 'СКОЛЬКО ПОПУГАЕВ') || (data.text === 'СКОЛЬКО?') || (data.text === 'СКОЛЬКО')) {
    BotSettings.findOne().then((r) => {
      if (r) {
        bot.postMessageToChannel(botParams.channelName, `Всего отправлено: ${r.parrot_counts} шт.`, messageParams);
      }
    });
  }
  if ((data.text === 'ЕСТЬ КТО ЖИВОЙ?') || (data.text === 'ЕСТЬ КТО ЖИВОЙ') || (data.text === 'ЕСТЬ КТО') || (data.text === 'ЕСТЬ КТО?') || (data.text === 'КТО ЖИВОЙ?') || (data.text === 'КТО ЖИВОЙ')) {
    UserMessages.find().then((r) => {
      if (r) {
        const result = r.sort((a, b) => {
          const c = a.count_messages;
          const d = b.count_messages;

          if (c < d) {
            return 1;
          } else if (c > d) {
            return -1;
          }

          return 0;
        });
        let mes = '';
        const messagesRus = (num) => {
          num = Math.abs(num);
          num %= 100;
          if (num >= 5 && num <= 20) {
            return 'сообщений';
          }
          num %= 10;
          if (num === 1) {
            return 'сообщение';
          }
          if (num >= 2 && num <= 4) {
            return 'сообщения';
          }
          return 'сообщений';
        };

        if (result.length > 20) {
          mes = 'Вот 20-ка людей, которые подают признаки жизни:\n';
          for (let i = 0; i < 20; i += i) {
            mes += `${i + 1}. ${result[i].user_name}: ${result[i].count_messages} ${messagesRus(result[i].count_messages)} \n`;
          }
        } else {
          mes = 'Вот люди, которые подают признаки жизни: \n';
          result.forEach((item, i) => {
            mes += `${i + 1}. ${item.user_name}: ${item.count_messages} ${messagesRus(result[i].count_messages)}\n`;
          });
        }
        bot.postMessageToChannel(botParams.channelName, mes, messageParams);
      }
    });
  }
  if (data.subtype === 'channel_leave' && data.channel === botParams.channelId) {
    bot.postMessageToChannel(
      botParams.channelName,
      `Мы потеряли бойца :sad_parrot: ${data.user_profile.first_name}  покинул нас`,
      messageParams);
  }

  if (data.subtype === 'channel_join' && data.channel === botParams.channelId) {
    bot.postMessageToChannel(
      botParams.channelName,
      // `Привет <@${data.user_profile.name}>, ${botParams.messageJoin}`,
      `Привет <@${data.user_profile.name}>, добро пожаловать в наш ламповый чатик!\nЕсть два вопроса к тебе:\n- кто твой любимый эмодзи?\n- какая твоя любимая giphy? \n<#${botParams.channelId}> - это место свободного общения. Здесь любят попугаев и поздравлют всех с пятницей. \nP.S. Если будут обижать, то вызывай милицию! :warneng:`,
      messageParams);
  }

  if (data.type === 'message') {
    BotMessages.findOne({ user_message: data.text.toLowerCase() })
      .then((result) => {
        if (result) {
          bot.postMessageToChannel(botParams.channelName, result.bot_message, messageParams);
        }
      });

    bot.getUserById(data.user)
      .then((d) => {
        if (d) {
          UserMessages.findOne({ user_id: d.id })
            .then((result) => {
              if (!result) {
                const newMessage = new UserMessages({
                  user_id: d.id,
                  user_name: d.name,
                  user_full_name: d.real_name,
                  count_messages: 1,
                });
                newMessage.save();
              } else {
                const newCountMessages = result.count_messages + 1;
                UserMessages.findOneAndUpdate({ user_id: d.id }, { count_messages: newCountMessages }).then();
              }
            });
        }
      });
  }
});
