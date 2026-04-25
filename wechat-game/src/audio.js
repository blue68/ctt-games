import { STORAGE_KEYS } from "./config";

export class SoundManager {
  constructor() {
    this.enabled = wx.getStorageSync(STORAGE_KEYS.sound) !== false;
    this.cache = {};
  }

  toggle() {
    this.enabled = !this.enabled;
    wx.setStorageSync(STORAGE_KEYS.sound, this.enabled);
    return this.enabled;
  }

  play(type) {
    if (!this.enabled) return;
    const src = makeTone(type);
    if (!src) return;
    try {
      const audio = this.cache[type] || wx.createInnerAudioContext();
      audio.obeyMuteSwitch = false;
      audio.src = src;
      audio.stop();
      audio.play();
      this.cache[type] = audio;
    } catch (error) {
      wx.vibrateShort?.({ type: type === "wrong" ? "heavy" : "light" });
    }
  }
}

function makeTone(type) {
  const map = {
    tap: { freq: 660, duration: 0.06 },
    wrong: { freq: 180, duration: 0.12 },
    pass: { freq: 880, duration: 0.18 },
  };
  const tone = map[type];
  if (!tone) return "";
  return wavDataUri(tone.freq, tone.duration);
}

function wavDataUri(freq, duration) {
  const sampleRate = 8000;
  const length = Math.floor(sampleRate * duration);
  const dataSize = length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < length; i += 1) {
    const envelope = 1 - i / length;
    const sample = Math.sin((Math.PI * 2 * freq * i) / sampleRate) * 0.35 * envelope;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  return `data:audio/wav;base64,${arrayBufferToBase64(buffer)}`;
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer) {
  if (wx.arrayBufferToBase64) return wx.arrayBufferToBase64(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = new Uint8Array(buffer);
  let result = "";
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += chars[(value >> 18) & 63] + chars[(value >> 12) & 63] + chars[(value >> 6) & 63] + chars[value & 63];
  }

  if (i < bytes.length) {
    const value = bytes[i] << 16 | ((bytes[i + 1] || 0) << 8);
    result += chars[(value >> 18) & 63] + chars[(value >> 12) & 63];
    result += i + 1 < bytes.length ? chars[(value >> 6) & 63] : "=";
    result += "=";
  }

  return result;
}
