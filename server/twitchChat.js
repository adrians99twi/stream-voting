// twitchChat.js
// Liest den Chat eines Twitch-Kanals rein lesend mit, ueber tmi.js.
// Es ist KEIN Twitch-Login der Zuschauer noetig. Auch du als Streamer
// brauchst dafuer keinen eigenen Bot-Account - tmi.js kann sich
// "anonym" verbinden, rein zum Lesen.

const tmi = require('tmi.js');

function createTwitchListener({ channel, onMessage, onStatusChange }) {
  let client = null;
  let currentChannel = channel;

  function connect(newChannel) {
    if (client) {
      try { client.disconnect(); } catch (e) { /* ignore */ }
    }
    currentChannel = (newChannel || currentChannel || '').toLowerCase().trim();
    if (!currentChannel) {
      onStatusChange && onStatusChange({ connected: false, channel: null, error: 'Kein Kanalname angegeben' });
      return;
    }

    client = new tmi.Client({
      options: { skipMembership: true },
      connection: { reconnect: true, secure: true },
      channels: [currentChannel],
    });

    client.on('connected', () => {
      onStatusChange && onStatusChange({ connected: true, channel: currentChannel, error: null });
    });

    client.on('disconnected', (reason) => {
      onStatusChange && onStatusChange({ connected: false, channel: currentChannel, error: reason || null });
    });

    client.on('message', (chan, tags, message, self) => {
      if (self) return;
      const username = tags['display-name'] || tags.username || 'unknown';
      onMessage && onMessage({ username, message });
    });

    client.connect().catch((err) => {
      onStatusChange && onStatusChange({ connected: false, channel: currentChannel, error: String(err) });
    });
  }

  function disconnect() {
    if (client) {
      try { client.disconnect(); } catch (e) { /* ignore */ }
      client = null;
    }
  }

  if (channel) connect(channel);

  return { connect, disconnect, getChannel: () => currentChannel };
}

module.exports = { createTwitchListener };
