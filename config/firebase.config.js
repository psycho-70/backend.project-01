import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Initialization must never throw at import time: in a serverless function a
// top-level throw fails every route (including CORS preflight), which the
// browser surfaces as a confusing CORS error. Instead we record the problem
// and expose it through /api/health and a clear 503 response.
let dbInstance = null;
let firebaseError = null;

const trim = (value) => (typeof value === "string" ? value.trim() : "");

const normalizePrivateKey = (value) =>
  trim(value)
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

try {
  if (!admin.apps.length) {
    const projectId = trim(process.env.FIREBASE_PROJECT_ID);
    const clientEmail = trim(process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    const missing = [
      !projectId && "FIREBASE_PROJECT_ID",
      !clientEmail && "FIREBASE_CLIENT_EMAIL",
      !privateKey && "FIREBASE_PRIVATE_KEY",
    ].filter(Boolean);

    if (missing.length > 0) {
      firebaseError = `Missing environment variable(s): ${missing.join(", ")}`;
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

// Routes import `db` and use it inside request handlers. When initialization
// failed, touching it throws a descriptive error instead of a TypeError.
const unavailableDb = new Proxy(
  {},
  {
    get() {
      throw new Error(`Firebase is unavailable${firebaseError ? `: ${firebaseError}` : ""}`);
    },
  }
);

export const db = dbInstance || unavailableDb;

// Kept as an object so importing modules never touch a missing database at load.
export const contactsCollection = {
  add: (data) => getDb().collection("contacts").add(data),
  get: () => getDb().collection("contacts").get(),
  doc: (id) => getDb().collection("contacts").doc(id),
};

export { FieldValue };
