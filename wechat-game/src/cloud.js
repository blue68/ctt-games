import { CLOUD_ENV, STORAGE_KEYS } from "./config";

export class CloudService {
  constructor() {
    this.enabled = false;
    this.openid = "";
  }

  init() {
    if (!wx.cloud) return;
    wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
    this.enabled = CLOUD_ENV !== "replace-with-your-cloud-env-id";
  }

  async login() {
    const localUser = wx.getStorageSync(STORAGE_KEYS.user);
    if (localUser?.openid) {
      this.openid = localUser.openid;
      return localUser;
    }
    if (!this.enabled) return null;
    const res = await wx.cloud.callFunction({ name: "login" });
    const user = { openid: res.result.openid };
    this.openid = user.openid;
    wx.setStorageSync(STORAGE_KEYS.user, user);
    return user;
  }

  async submitScore(score) {
    if (!this.enabled) return { offline: true };
    return wx.cloud.callFunction({ name: "leaderboard", data: { action: "submit", score } });
  }

  async top100() {
    if (!this.enabled) return { result: { list: [] } };
    return wx.cloud.callFunction({ name: "leaderboard", data: { action: "top100" } });
  }

  async createPkRoom(payload) {
    if (!this.enabled) return { result: { roomId: `local-${Date.now()}` } };
    return wx.cloud.callFunction({ name: "leaderboard", data: { action: "createPkRoom", payload } });
  }

  async submitPkResult(payload) {
    if (!this.enabled) return { result: { offline: true, payload } };
    return wx.cloud.callFunction({ name: "leaderboard", data: { action: "submitPkResult", payload } });
  }

  async getPkRoom(roomId) {
    if (!this.enabled) return { result: null };
    return wx.cloud.callFunction({ name: "leaderboard", data: { action: "getPkRoom", roomId } });
  }
}

