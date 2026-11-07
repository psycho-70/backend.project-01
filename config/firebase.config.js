import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Values pasted into Vercel can arrive with surrounding quotes or stray
// whitespace, and the private key may still contain literal \n sequences.
const clean = (value) =>
  typeof value === "string" ? value.trim().replace(/^["']|["']$/g, "") : "";

let dbInstance = null;
let firebaseError = null;

try {
  if (!admin.apps.length) {
    const projectId = clean(process.env.FIREBASE_PROJECT_ID);
    const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n");

    const missing = [
      !projectId && "FIREBASE_PROJECT_ID",
      !clientEmail && "FIREBASE_CLIENT_EMAIL",
      !privateKey && "FIREBASE_PRIVATE_KEY",
    ].filter(Boolean);

    if (missing.length > 0) {
      firebaseError = `Missing Firebase environment variable(s): ${missing.join(", ")}`;
      console.error(firebaseError);
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      console.log("Firebase initialized successfully");
    }
  }

  dbInstance = admin.apps.length ? admin.firestore() : null;
} catch (error) {
  firebaseError = error?.message || String(error);
  console.error("Firebase initialization failed:", firebaseError);
}

export const firebaseReady = Boolean(dbInstance);
export const getFirebaseError = () => firebaseError;

export const getDb = () => {
  if (!dbInstance) {
    throw new Error(`Firebase is unavailable${firebaseError ? `: ${firebaseError}` : ""}`);
  }
  return dbInstance;
};

// Route handlers only touch `db` inside request handlers, so a bad config
// fails that request with a readable message instead of crashing the
// whole serverless function at cold start.
const unavailableDb = new Proxy(
  {},
  {
    get() {
      throw new Error(`Firebase is unavailable${firebaseError ? `: ${firebaseError}` : ""}`);
    },
  }
);

export const db = dbInstance || unavailableDb;

export const contactsCollection = {
  add: (data) => getDb().collection("contacts").add(data),
  get: () => getDb().collection("contacts").get(),
  doc: (id) => getDb().collection("contacts").doc(id),
};

export { FieldValue };
