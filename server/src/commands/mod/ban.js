/*
  Description: Adds the target socket's ip to the ratelimiter
*/

// module main
export async function run(core, server, socket, data) {
  // increase rate limit chance and ignore if not admin or mod
  if (socket.uType === 'user') {
    return server.police.frisk(socket.address, 10);
  }

  // check user input
  if (typeof data.nick !== 'string') {
    return true;
  }

  // find target user
  const targetNick = data.nick;
  let badClient = server.findSockets({ channel: socket.channel, nick: targetNick });

  if (badClient.length === 0) {
    return server.reply({
      cmd: 'warn',
      text: 'Could not find user in channel',
    }, socket);
  }

  [badClient] = badClient;

  // i guess banning mods or admins isn't the best idea?
  if (badClient.uType !== 'user') {
    return server.reply({
      cmd: 'warn',
      text: 'Cannot ban other mods, how rude',
    }, socket);
  }

  // commit arrest record
  server.police.arrest(badClient.address, badClient.hash);

  console.log(`${socket.nick} [${socket.trip}] banned ${targetNick} in ${socket.channel}`);

  // notify normal users
  server.broadcast({
    cmd: 'info',
    text: `Banned ${targetNick}`,
  }, { channel: socket.channel, uType: 'user' });

  // notify mods
  server.broadcast({
    cmd: 'info',
    text: `${socket.nick} banned ${targetNick} in ${socket.channel}, userhash: ${badClient.hash}`,
  }, { uType: 'mod' });

  // force connection closed
  badClient.terminate();

  // stats are fun
  core.stats.increment('users-banned');

  return true;
}

export const requiredData = ['nick'];
export const info = {
  name: 'ban',
  description: 'Disconnects the target nickname in the same channel as calling socket & adds to ratelimiter',
  usage: `
    API: { cmd: 'ban', nick: '<target nickname>' }`,
};
