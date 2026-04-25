const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const SCORE_COLLECTION = "focus_scores";
const PK_COLLECTION = "pk_rooms";

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (event.action === "submit") return submitScore(openid, event.score);
  if (event.action === "top100") return top100();
  if (event.action === "createPkRoom") return createPkRoom(openid, event.payload);
  if (event.action === "submitPkResult") return submitPkResult(openid, event.payload);
  if (event.action === "getPkRoom") return getPkRoom(event.roomId);

  return { error: "unknown action" };
};

async function submitScore(openid, score) {
  const collection = await getCollection(SCORE_COLLECTION);
  const doc = {
    openid,
    level: score.level,
    maxNumber: score.maxNumber,
    elapsed: score.elapsed,
    mode: score.mode,
    nickName: score.userInfo?.nickName || "匿名玩家",
    avatarUrl: score.userInfo?.avatarUrl || "",
    updatedAt: Date.now(),
  };

  const existing = await collection.where({ openid }).limit(1).get();
  if (!existing.data.length) {
    await collection.add({ data: doc });
    return { saved: true };
  }

  const old = existing.data[0];
  const better = doc.level > old.level || (doc.level === old.level && doc.elapsed < old.elapsed);
  if (better) {
    await collection.doc(old._id).update({ data: doc });
  }
  return { saved: better };
}

async function top100() {
  await ensureCollection(SCORE_COLLECTION);
  const res = await db
    .collection(SCORE_COLLECTION)
    .orderBy("level", "desc")
    .orderBy("elapsed", "asc")
    .orderBy("updatedAt", "desc")
    .limit(100)
    .get();
  return { list: res.data };
}

async function createPkRoom(openid, payload) {
  const collection = await getCollection(PK_COLLECTION);
  const roomId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await collection.add({
    data: {
      roomId,
      ownerOpenid: openid,
      level: payload.level,
      seedOffset: payload.seedOffset,
      players: {},
      createdAt: Date.now(),
    },
  });
  return { roomId };
}

async function submitPkResult(openid, payload) {
  const collection = await getCollection(PK_COLLECTION);
  const rooms = await collection.where({ roomId: payload.roomId }).limit(1).get();
  if (!rooms.data.length) return { error: "room not found" };
  const room = rooms.data[0];
  await collection
    .doc(room._id)
    .update({
      data: {
        [`players.${openid}`]: {
          openid,
          elapsed: payload.score.elapsed,
          level: payload.score.level,
          updatedAt: Date.now(),
        },
      },
    });
  return { saved: true };
}

async function getPkRoom(roomId) {
  const collection = await getCollection(PK_COLLECTION);
  const res = await collection.where({ roomId }).limit(1).get();
  return res.data[0] || null;
}

async function getCollection(name) {
  await ensureCollection(name);
  return db.collection(name);
}

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get();
  } catch (error) {
    if (!isCollectionMissing(error)) throw error;
    try {
      await db.createCollection(name);
    } catch (createError) {
      if (!isCollectionAlreadyExists(createError)) throw createError;
    }
  }
}

function isCollectionMissing(error) {
  const message = `${error.errMsg || ""} ${error.message || ""}`;
  return message.includes("collection not exists") || message.includes("DATABASE_COLLECTION_NOT_EXIST") || message.includes("Db or Table not exist");
}

function isCollectionAlreadyExists(error) {
  const message = `${error.errMsg || ""} ${error.message || ""}`;
  return message.includes("already exists") || message.includes("DATABASE_COLLECTION_ALREADY_EXIST");
}
