import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import sanitizeHtml from "sanitize-html";
import { db } from "../../config/firebase.config.js";

// ───────────────────────── CLOUDINARY + MULTER ─────────────────────────
// Vercel's filesystem is read-only, so files are kept in memory and
// uploaded straight to Cloudinary. We store the returned URLs in Firestore.

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const upload = multer({
    storage: multer.memoryStorage(),
    // Vercel rejects request bodies over ~4.5MB in total
    limits: { files: 10, fileSize: 4 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
        file.mimetype.startsWith("image/")
            ? cb(null, true)
            : cb(new Error("Only image files are allowed")),
});

export const uploadToCloudinary = (file) =>
    new Promise((resolve, reject) => {
        if (
            !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET
        ) {
            return reject(
                new Error("Cloudinary is not configured. Set the CLOUDINARY_* environment variables.")
            );
        }
        cloudinary.uploader
            .upload_stream({ folder: "portfolio", resource_type: "image" }, (err, result) =>
                err ? reject(err) : resolve(result.secure_url)
            )
            .end(file.buffer);
    });

export const uploadImages = (files) => Promise.all(files.map(uploadToCloudinary));

// Wraps a multer middleware so upload errors come back as JSON (with CORS headers)
const runUpload = (middleware) => (req, res, next) => {
    middleware(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        return res.status(400).json({ error: error.message || "Unable to process uploaded image" });
    });
};

// Frontends may submit images as `images`, `image` or `images[]`. Accept all three.
export const projectImageUpload = runUpload(
    upload.fields([
        { name: "images", maxCount: 10 },
        { name: "image", maxCount: 10 },
        { name: "images[]", maxCount: 10 },
    ])
);

export const teamImageUpload = runUpload(upload.single("image"));

export const getProjectImageFiles = (req) => [
    ...(req.files?.images || []),
    ...(req.files?.image || []),
    ...(req.files?.["images[]"] || []),
];

// ───────────────────────── HELPERS ─────────────────────────

export const now = () => new Date().toISOString();

export const parseArr = (v) =>
    Array.isArray(v)
        ? v
        : typeof v === "string"
        ? v.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

// Accepts a JSON string ('["a","b"]'), a comma-separated string, or an array
export const parseTechnologies = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string" || !v.trim()) return [];
    try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return parseArr(v);
    }
};

export const parseJsonOrCsv = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string" || !v.trim()) return [];
    try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : parseArr(v);
    } catch {
        return parseArr(v);
    }
};

export const docsToList = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

// Rich text coming from the admin editor is stored as HTML. Only the tags the
// editor can produce are kept, so a compromised session cannot persist scripts.
const RICH_TEXT_OPTIONS = {
    allowedTags: [
        "p",
        "div",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "strike",
        "h2",
        "h3",
        "h4",
        "ul",
        "ol",
        "li",
        "a",
        "blockquote",
        "code",
        "pre",
        "hr",
        "span",
    ],
    allowedAttributes: { a: ["href", "title", "target", "rel"], span: [] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
        b: "strong",
        i: "em",
        a: (tagName, attribs) => ({
            tagName: "a",
            attribs: {
                ...attribs,
                target: "_blank",
                rel: "noopener noreferrer nofollow",
            },
        }),
    },
};

export const sanitizeRichText = (value) =>
    typeof value === "string" ? sanitizeHtml(value, RICH_TEXT_OPTIONS).trim() : "";

// Older records may hold raw text or HTML saved before the editor existed.
// Only HTML-looking values are sanitized so plain text keeps its characters.
export const sanitizeRichTextIfHtml = (value) => {
    if (typeof value !== "string") return "";
    return /<\/?[a-z][\s\S]*>/i.test(value) ? sanitizeRichText(value) : value;
};

export const richTextToPlain = (value) =>
    typeof value === "string"
        ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
              .replace(/\s+/g, " ")
              .trim()
        : "";

// Sort in memory so documents without an `order` field never disappear
// (Firestore's orderBy() silently drops documents that lack the field).
export const sortByOrder = (items) =>
    [...items].sort(
        (a, b) =>
            (Number(a.order) || Number.MAX_SAFE_INTEGER) -
            (Number(b.order) || Number.MAX_SAFE_INTEGER)
    );

export const maxOrder = (items) => items.reduce((max, i) => Math.max(max, Number(i.order) || 0), 0);

// Writes default documents to an empty collection and returns them
export const seedCollection = async (collectionName, defaults, extra = () => ({})) => {
    const batch = db.batch();
    const seeded = defaults.map((item, idx) => {
        const docRef = db.collection(collectionName).doc();
        const data = { ...item, ...extra(item, idx), createdAt: now() };
        batch.set(docRef, data);
        return { id: docRef.id, ...data };
    });
    await batch.commit();
    return seeded;
};
