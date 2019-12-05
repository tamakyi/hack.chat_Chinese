/*
  Description: Generates a semi-unique channel name then broadcasts it to each client
*/

// module support functions
const verifyNickname = (nick) => /^[a-zA-Z0-9_]{1,24}$/.test(nick);

// module main
export async function run(core, server, socket, data) {
  // check for spam
  if (server.police.frisk(socket.address, 2)) {
    return server.reply({
      cmd: 'warn',
      text: 'You are sending invites too fast. Wait a moment before trying again.',
    }, socket);
  }

  // verify user input
  if (typeof data.nick !== 'string' || !verifyNickname(data.nick)) {
    return true;
  }

  // why would you invite yourself?
  if (data.nick === socket.nick) {
    return true;
  }

  // generate common channel
  const channel = Math.random().toString(36).substr(2, 8);

  // build and send invite
  const payload = {
    cmd: 'info',
    type: 'invite',
    from: socket.nick,
    invite: channel,
    text: `${socket.nick} 邀请你加入聊天室→ ?${channel}`,
  };

  const inviteSent = server.broadcast(payload, {
    channel: socket.channel,
    nick: data.nick,
  });

  // server indicates the user was not found
  if (!inviteSent) {
    return server.reply({
      cmd: 'warn',
      text: '找不到这个用户',
    }, socket);
  }

  // reply with common channel
  server.reply({
    cmd: 'info',
    type: 'invite',
    invite: channel,
    text: `你邀请了 ${data.nick} 加入→ ?${channel}`,
  }, socket);

  // stats are fun
  core.stats.increment('invites-sent');

  return true;
}

export const requiredData = ['nick'];
export const info = {
  name: 'invite',
  description: 'Generates a unique (more or less) room name and passes it to two clients',
  usage: `
    API: { cmd: 'invite', nick: '<target nickname>' }`,
};
