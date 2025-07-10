import express from "express";
import { contactsCollection } from "../config/firebase.config.js";

const router = express.Router();

// POST /api/contacts - Submit contact form
router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({ 
        error: "Name and email are required",
        received: { name, email }
      });
    }

    // Add to Firestore (Admin SDK syntax)
    const docRef = await contactsCollection.add({
      name,
      email,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      id: docRef.id,
      name,
      email,
      message: "Contact submitted successfully"
    });
  } catch (error) {
    console.error("Error submitting contact:", error);
    res.status(500).json({ 
      error: "Failed to submit contact",
      details: error.message 
    });
  }
});

// GET /api/contacts - Get all contacts (for admin)
router.get("/", async (req, res) => {
  try {
    // Get all documents (Admin SDK syntax)
    const snapshot = await contactsCollection.get();
    const contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ 
      error: "Failed to fetch contacts",
      details: error.message 
    });
  }
});

export default router;
// {
//   "type": "service_account",
//   "project_id": "portfolio-9824c",
//   "private_key_id": "4396bede016d4900148eea25810d5f45487fbc3b",
//   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCqCQ8RAcEbGa12\nPzaw1mpydgd8SziMk+T9FBDLduq4djboFdnPZkvIR0//zB0rFjyW4LjwF8uwUK+J\nesMW9hGRZlgxBlVkg4Niu8gC2/ZT0er9JASJ4lO0AsZRZU1yOG0IomBpO9JInuBN\nyU9sO3JY4QDz83g7E62z7+UonV49FINwC08WKCk+MxkTIhHDFn0Cm1T679f1/W+e\nsz2DFRbhVrFCnyfP7/qt/AjkAImt6i5ZB41E+pRo2gJ6EICucikrlTzwfvxa9q3Z\nU2QmkthHkAeUwv/CEunbHPJD072Ug2FYUpQ5w9B8USHZ5gShMUw0DxlFU39pXqzw\nrOucIPvRAgMBAAECggEAU04p5AasgecELb1NwbjjIR4Dj9lYpMMmuvlUOyMRX3uH\nbhCajHrNYRvTLXtmxP/ZgoAqC3NVF5aIUf5jy4GWXNq8FZTJTHwEaGCg3wm+dxWP\nICO/14Aby0Nav3E2zuGnRcYsHxKwdWTldybMczXy0Wm3ak3cF3GONmyvpMTo8Vop\njQYL9MZnfxCuyZmAPsLhMxkFeM8L1Q6MqvXXV15iaPHvhbyeOCaNrXAuZUpIbjIm\nT4ImLQX6BlvRADxmgX8BEelqKhswcatznxfY1fqD9ly2zvdcPajadh2vYifFL+EU\n9FmG7jMvPsyb01N3O02SdlyAiOq/ze3pv3R9HnbkYwKBgQDUZG3MXiuYUds+bY4W\nRr9b7wCOgdOfGhh8IiuFrvxyjOzzcokMH9opNY2mx1EEwmSBvkZD8B6eGmZVuJEq\nDYJ249ZGrdTbW9F0AVLJujWoCT1OWrNsdA/B8CV5UEZcRKXGDRObZRIZhXOQewnK\n0tjH3rkM+p8VZeMVCPw3DhOd5wKBgQDM8k3nmiECJMElcWOCChUvY2NoDfkuBuCm\n4tbU2C02xD9B/L/y2iX/K+pulgNIDPG3QlXMJH97ujY1Vx91IlFK/8YrPZhNClsy\nVjwO5dRRJyDc/PRl3NbcdDZQvbGTHSnVX6EHfsvpCusuQlWraSN0aGpse3keDcEU\nkkcomASxhwKBgQDR6pSOiYBi4nxjfhoRsEjPTy/oqS4EMOGERq1nSiSd/uTuVARZ\npF2VnyVqcdKEdrCpfuqpmPhZ4NPF404uFv4cDWEpqAMZ7uzbz7cIQ+9mLgOWnpR5\nG1i7oGMZPJrd9Mc3MJNxYXp7GOe4I7Lw8GVrXZjd2BJFLtc6YhANRe9jfwKBgQC6\ns9ZCscd2Q3NtH9HN6k+IXxt09J3Wz08i2S1qsxDlfnw+KfnXS+InhqNHYQPWRGyD\nTTwKAAne9jFiAF9Y/w1drIqkY7V2IYQY5DRMQhVcZK/sgchHb5qRNJEylszJP10X\n08lHobwzLc430xhmUh6JcoHZF9ariU4m5mdK1MoZywKBgHOsF3EvvROGXCfzp/r7\negfAnU62v8vwlGYQLiLIFF+90XCJvRyTO1bJV6g9CfIwUWkS9hPHRi4UZRcpiSBM\nYpjd0Jr2eC1/y1vbRlT2hqAM0hPITQcskQVGLbpsuPAYC2nWHSIFeF0VJvj3pNll\nEMmgfC4l9MrrAwMfBLqmsEHa\n-----END PRIVATE KEY-----\n",
//   "client_email": "firebase-adminsdk-fbsvc@portfolio-9824c.iam.gserviceaccount.com",
//   "client_id": "100929917495279000829",
//   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//   "token_uri": "https://oauth2.googleapis.com/token",
//   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//   "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40portfolio-9824c.iam.gserviceaccount.com",
//   "universe_domain": "googleapis.com"
// }
