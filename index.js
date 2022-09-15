import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();


//Schemas
const participantSchema = joi.object({
  name: joi.string().required().min(1).max(100),
  lastStatus: joi.number(),
});

const messageSchema = joi.object({
  from: joi.string().required(),
  to: joi.string().min(1).required(),
  text: joi.string().min(1).required(),
  type: joi.string().valid("message", "private_message"),
  time: joi.string(),
});


// configs
dotenv.config();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("test");
} catch (err) {
  console.log(err);
}

app.get("/participants", async (req, res) => {
  try {
    const participants = await db
      .collection("participants")
      .find()
      .toArray();

    res.send(participants);
  } catch (err) {
    console.log(err);
    res.sendStatus(422);
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const limit = req.query.limit;

  try {
    const messages = await db
      .collection("messages")
      .find()
      .toArray()
      .filter(message => {
        message.from === user || message.to === user || message.to === "Todos" ||
          message.type === "message";
      });

    console.log(messages);

    if (parseInt(limit) !== NaN) {
      return res.send(messages.slice(-limit));
    }

    res.send(messages);

  } catch (err) {
    console.log(err);
    res.sendStatus(422);
  }
});

app.post("/participants", async (req, res) => {
  const body = req.body;

  const validation = participantSchema.validate(body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.sendStatus(422);
    return;
  }

  try {
    const alreadyTaken = await db.collection("participants").findOne({ name: body.name });

    if (!!alreadyTaken) {
      res.sendStatus(409);
      return;
    }

    await db.collection("participants")
      .insertOne({ ...body, lastStatus: Date.now() });
    await db.collection("messages")
      .insertOne({ from: body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:MM:SS') });

    res.sendStatus(201);
  } catch (err) {
    res.status(422).send(err);
  }

});

app.post("/messages", async (req, res) => {
  const body = req.body;
  const { user } = req.headers;

  const message = {
    from: user,
    to: body.to,
    text: body.text,
    type: body.type,
    time: dayjs().format('HH:MM:SS'),
  }

  const validation = messageSchema.validate(message, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.sendStatus(422);
    return;
  }

  try {
    const isValidParticipant = await db.collection("participants").findOne({ name: user });

    if (!isValidParticipant) {
      res.sendStatus(422);
      return;
    }

    await db.collection("messages").insertOne(message);
    res.sendStatus(201);
  } catch (err) {
    res.status(422).send(err);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const participant = await db.collection("participants").findOne({ name: user });

    if (!participant) {
      res.sendStatus(404);
      return;
    }

    await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (err) {
    res.status(422).send(err);
  }

});


//App
app.listen(5000, () => {
  console.log(`Server running in port: ${5000}`);
});