import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Debug: Log all environment variables (remove in production)
  console.log('All env vars:', Object.keys(process.env));
  console.log('Firebase env vars:', {
    PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'Present' : 'Missing',
  });

  // Check if all required environment variables are present
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('Missing required Firebase environment variables');
    console.error('Available env vars:', {
      PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    });
    throw new Error('Firebase configuration is incomplete');
  }

  try {
    // Simplified service account configuration
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
    });
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

const db = admin.firestore();
const contactsCollection = db.collection("contacts");

export { db, contactsCollection, FieldValue };