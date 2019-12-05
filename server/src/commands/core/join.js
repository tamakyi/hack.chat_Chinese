/*
  Description: Initial entry point, applies `channel` and `nick` to the calling socket
*/

// module support functions
const crypto = require('crypto');

const hash = (password) => {
  const sha = crypto.createHash('sha256');
  sha.update(password);
  return sha.digest('base64').substr(0, 6);
};

const verifyNickname = (nick) => /^[a-zA-Z0-9_]{1,24}$/.test(nick);

// exposed "login" function to allow hooks to verify user join events
// returns object containing user info or string if error
export function parseNickname(core, data) {
  const userInfo = {
    nick: '',
    uType: 'user',
    trip: null,
  };

  // seperate nick from password
  const nickArray = data.nick.split('#', 2);
  userInfo.nick = nickArray[0].trim();

  if (!verifyNickname(userInfo.nick)) {
    // return error as string
    return 'Nickname must consist of up to 24 letters, numbers, and underscores';
  }

  const password = nickArray[1];

  if (hash(password + core.config.tripSalt) === core.config.adminTrip) {
    userInfo.uType = 'admin';
    userInfo.trip = 'Admin';
  } else if (userInfo.nick.toLowerCase() === core.config.adminName.toLowerCase()) {
    // they've got the main-admin name while not being an admin
    return '你不是管理员,骗子!';
  } else if (password) {
    userInfo.trip = hash(password + core.config.tripSalt);
  }

  // TODO: disallow moderator impersonation
  // for (const mod of core.config.mods) {
  core.config.mods.forEach((mod) => {
    if (userInfo.trip === mod.trip) {
      userInfo.uType = 'mod';
    }
  });

  return userInfo;
}

// module main
export async function run(core, server, socket, data) {
  // check for spam
  if (server.police.frisk(socket.address, 3)) {
    return server.reply({
      cmd: 'warn',
      text: 'You are joining channels too fast. Wait a moment and try again.',
    }, socket);
  }

  // calling socket already in a channel
  if (typeof socket.channel !== 'undefined') {
    return true;
  }

  // check user input
  if (typeof data.channel !== 'string' || typeof data.nick !== 'string') {
    return true;
  }

  const channel = data.channel.trim();
  if (!channel) {
    // must join a non-blank channel
    return true;
  }

  const userInfo = this.parseNickname(core, data);
  if (typeof userInfo === 'string') {
    return server.reply({
      cmd: 'warn',
      text: userInfo,
    }, socket);
  }

  // check if the nickname already exists in the channel
  const userExists = server.findSockets({
    channel: data.channel,
    nick: (targetNick) => targetNick.toLowerCase() === userInfo.nick.toLowerCase(),
  });

  if (userExists.length > 0) {
    // that nickname is already in that channel
    return server.reply({
      cmd: 'warn',
      text: 'Nickname taken',
    }, socket);
  }

  userInfo.userHash = server.getSocketHash(socket);

  // prepare to notify channel peers
  const newPeerList = server.findSockets({ channel: data.channel });
  const nicks = [];

  const joinAnnouncement = {
    cmd: 'onlineAdd',
    nick: userInfo.nick,
    trip: userInfo.trip || 'null',
    hash: userInfo.userHash,
  };

  // send join announcement and prep online set
  for (let i = 0, l = newPeerList.length; i < l; i += 1) {
    server.reply(joinAnnouncement, newPeerList[i]);
    nicks.push(newPeerList[i].nick);
  }

  // store user info
  socket.uType = userInfo.uType;
  socket.nick = userInfo.nick;
  socket.channel = data.channel;
  socket.hash = userInfo.userHash;
  if (userInfo.trip !== null) socket.trip = userInfo.trip;

  nicks.push(socket.nick);

  // reply with channel peer list
  server.reply({
    cmd: 'onlineSet',
    nicks,
  }, socket);

  // stats are fun
  core.stats.increment('users-joined');

  return true;
}

export const requiredData = ['channel', 'nick'];
export const info = {
  name: 'join',
  description: 'Place calling socket into target channel with target nick & broadcast event to channel',
  usage: `
    API: { cmd: 'join', nick: '<your nickname>', channel: '<target channel>' }`,
};
