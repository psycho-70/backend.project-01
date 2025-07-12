import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Check if all required environment variables are present
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('Missing required Firebase environment variables');
    throw new Error('Firebase configuration is incomplete');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newlines properly
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`, // Optional
  });
}

const db = admin.firestore();
const contactsCollection = db.collection("contacts"); // Define the collection here

export { db, contactsCollection, FieldValue };