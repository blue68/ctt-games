# 微信小游戏版本

这是 `视觉专注力训练 H5` 的微信小游戏工程，可用微信开发者工具导入 `wechat-game` 目录运行。

## 导入方式

1. 安装微信开发者工具：<https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>
2. 选择“导入项目”，项目目录选择本目录 `wechat-game`。
3. AppID 替换为你自己的小游戏 AppID。
4. 在云开发控制台创建云环境，并把 `src/config.js` 中的 `CLOUD_ENV` 改成你的环境 ID。
5. 上传并部署 `cloudfunctions/login` 和 `cloudfunctions/leaderboard`。

## 已实现功能

- 49 关视觉专注力训练。
- 自主选关模式。
- 连续冲关模式，自动记忆最高连续关卡、当前进度、最佳成绩。
- 音效开关，点击、错误、通关音效。
- 微信授权入口，使用 `wx.createUserInfoButton`。
- 云开发 TOP100 排行榜，按“最高关卡优先、同关用时更短优先”排序。
- 微信海报分享，生成 Canvas 分享图并调用 `wx.shareAppMessage`。
- 对战 PK 模式：通过分享携带房间 ID，好友进入后跑同一关卡种子，比较完成用时。

## 云数据库

云函数会自动使用集合：

- `focus_scores`：排行榜成绩。
- `pk_rooms`：对战房间与双方成绩。

## 排行榜规则

1. 连续闯关最高关卡越高排名越靠前。
2. 最高关卡相同，完成用时更短者靠前。
3. 再相同，更新时间更晚者靠前。

