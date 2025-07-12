import express from "express";
import { contactsCollection } from "../config/firebase.config.js";

const router = express.Router();

// POST /api/contacts - Submit contact form
router.post("/", async (req, res) => {
  try {
    const { name, email, comment } = req.body;

    // Basic validation
    if (!name || !email || !comment) {
      return res.status(400).json({ 
        error: "Name, email and comment are required",
        received: { name, email, comment }
      });
    }

    // Add to Firestore
    const docRef = await contactsCollection.add({
      name,
      email,
      comment,
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      id: docRef.id,
      name,
      email,
      comment,
      likes: 0,
      createdAt: new Date().toISOString(),
      message: "Comment submitted successfully"
    });
  } catch (error) {
    console.error("Error submitting contact:", error);
    res.status(500).json({ 
      error: "Failed to submit comment",
      details: error.message 
    });
  }
});

// GET /api/contacts - Get all contacts
router.get("/", async (req, res) => {
  try {
    const snapshot = await contactsCollection.get();
    const contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ 
      error: "Failed to fetch comments",
      details: error.message 
    });
  }
});

// PATCH /api/contacts/:id/like - Like a comment
router.patch("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const docRef = contactsCollection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const comment = doc.data();
    const likedBy = comment.likedBy || [];

    if (likedBy.includes(userId)) {
      return res.status(400).json({ error: "Already liked" });
    }

    await docRef.update({
      likes: (comment.likes || 0) + 1,
      likedBy: [...likedBy, userId]
    });

    res.status(200).json({
      id,
      likes: (comment.likes || 0) + 1,
      message: "Like added successfully"
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).json({ 
      error: "Failed to like comment",
      details: error.message 
    });
  }
});

export default router;
