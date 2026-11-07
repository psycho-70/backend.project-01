import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
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

// ───────────────────────── RICH TEXT SANITIZER ─────────────────────────
// The admin editor submits HTML that is rendered with dangerouslySetInnerHTML
// on the public site. Instead of trusting that markup, it is rebuilt from an
// allowlist: unknown tags are dropped, attribute values are re-escaped, and
// links must use a safe scheme. Everything here is dependency-free so the
// server bundle stays CommonJS-only and cold starts never hit an ESM error.

const ALLOWED_TAGS = new Set([
    "p",
    "div",
    "br",
    "strong",
    "em",
    "u",
    "s",
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
]);
const VOID_TAGS = new Set(["br", "hr"]);
const TAG_ALIASES = { b: "strong", i: "em", strike: "s" };

// The contents of these tags are raw text, not markup. Dropping only the tag
// would leave the payload visible, so the whole element is removed.
const RAW_TEXT_TAGS = new Set([
    "script",
    "style",
    "textarea",
    "title",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
]);

const BLOCK_TAGS_RE = /<\/?(?:p|div|h2|h3|h4|ul|ol|li|blockquote|pre|hr|br)\b[^>]*>/gi;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decodeEntities = (value) =>
    value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]*));/gi, (match, dec, hex, name) => {
        if (dec) return String.fromCodePoint(Math.min(Number(dec), 0x10ffff));
        if (hex) return String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff));
        const entity = ENTITIES[name.toLowerCase()];
        return entity === undefined ? match : entity;
    });

const escapeText = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttr = (value) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// Browsers decode entities and ignore control characters before resolving a
// URL, so `java&#9;script:` still runs. Normalise first, then allowlist.
const sanitizeUrl = (raw) => {
    const value = decodeEntities(raw)
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim();
    if (!value) return null;
    const lower = value.toLowerCase();
    if (lower.startsWith("#")) return value;
    if (lower.startsWith("/") && !lower.startsWith("//") && !lower.startsWith("/\\")) return value;
    if (lower.startsWith("http://") || lower.startsWith("https://")) return value;
    if (lower.startsWith("mailto:")) return value;
    return null;
};

const isAsciiLetter = (ch) => {
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
};

const TAG_NAME_RE = /[a-zA-Z][a-zA-Z0-9:-]*/y;

// Reads one tag starting at `start` (which must be "<"). Returns the parsed
// tag plus the index just past ">", or null when the markup is malformed.
const readTag = (html, start) => {
    let i = start + 1;
    let closing = false;
    if (html[i] === "/") {
        closing = true;
        i += 1;
    }

    TAG_NAME_RE.lastIndex = i;
    const nameMatch = TAG_NAME_RE.exec(html);
    const name = nameMatch ? nameMatch[0].toLowerCase() : "";
    if (nameMatch) i = TAG_NAME_RE.lastIndex;

    const attrs = new Map();
    let selfClosing = false;
    let terminated = false;

    while (i < html.length) {
        const ch = html[i];
        if (ch === ">") {
            terminated = true;
            i += 1;
            break;
        }
        if (ch === "/" && html[i + 1] === ">") {
            terminated = true;
            selfClosing = true;
            i += 2;
            break;
        }
        if (ch === "/" || /\s/.test(ch)) {
            i += 1;
            continue;
        }
        if (closing) {
            // Closing tags carry no attributes; ignore anything before ">".
            i += 1;
            continue;
        }

        const attrStart = i;
        while (i < html.length && !/[\s=/>]/.test(html[i])) i += 1;
        if (i === attrStart) {
            i += 1;
            continue;
        }
        const attrName = html.slice(attrStart, i).toLowerCase();

        while (i < html.length && /\s/.test(html[i])) i += 1;

        let attrValue = "";
        if (html[i] === "=") {
            i += 1;
            while (i < html.length && /\s/.test(html[i])) i += 1;
            const quote = html[i];
            if (quote === '"' || quote === "'") {
                const close = html.indexOf(quote, i + 1);
                if (close === -1) return null;
                attrValue = html.slice(i + 1, close);
                i = close + 1;
            } else {
                const valueStart = i;
                while (i < html.length && !/[\s>]/.test(html[i])) i += 1;
                attrValue = html.slice(valueStart, i);
            }
        }

        if (!attrs.has(attrName)) attrs.set(attrName, attrValue);
    }

    return terminated ? { name, closing, attrs, selfClosing, end: i } : null;
};

const skipRawText = (html, lowerHtml, from, name) => {
    const marker = `</${name}`;
    let i = from;
    while (i < html.length) {
        const index = lowerHtml.indexOf(marker, i);
        if (index === -1) return html.length;
        const after = index + marker.length;
        const next = lowerHtml[after];
        if (next === ">" || next === undefined || /\s/.test(next)) {
            const close = html.indexOf(">", after);
            return close === -1 ? html.length : close + 1;
        }
        i = after;
    }
    return html.length;
};

const emitOpenTag = (name, attrs) => {
    if (VOID_TAGS.has(name)) return `<${name} />`;
    if (name !== "a") return `<${name}>`;

    let tag = "<a";
    const href = attrs.get("href");
    if (href !== undefined) {
        const safeHref = sanitizeUrl(href);
        if (safeHref) tag += ` href="${escapeAttr(safeHref)}"`;
    }
    const title = attrs.get("title");
    if (title !== undefined) tag += ` title="${escapeAttr(decodeEntities(title))}"`;
    return `${tag} target="_blank" rel="noopener noreferrer nofollow">`;
};

export const sanitizeRichText = (value) => {
    if (typeof value !== "string") return "";
    const html = value;
    const lowerHtml = html.toLowerCase();
    let out = "";
    let i = 0;

    while (i < html.length) {
        const lt = html.indexOf("<", i);
        if (lt === -1) {
            out += escapeText(decodeEntities(html.slice(i)));
            break;
        }
        if (lt > i) out += escapeText(decodeEntities(html.slice(i, lt)));
        i = lt;

        if (html.startsWith("<!--", i)) {
            const end = html.indexOf("-->", i + 4);
            i = end === -1 ? html.length : end + 3;
            continue;
        }
        if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
            const end = html.indexOf(">", i + 2);
            i = end === -1 ? html.length : end + 1;
            continue;
        }

        const next = html[i + 1];
        if (next !== "/" && !isAsciiLetter(next)) {
            out += "&lt;";
            i += 1;
            continue;
        }

        const tag = readTag(html, i);
        if (!tag || !tag.name) {
            out += "&lt;";
            i += 1;
            continue;
        }

        const name = TAG_ALIASES[tag.name] || tag.name;

        if (RAW_TEXT_TAGS.has(name)) {
            i = tag.closing ? tag.end : skipRawText(html, lowerHtml, tag.end, name);
            continue;
        }

        if (!ALLOWED_TAGS.has(name)) {
            i = tag.end;
            continue;
        }

        if (tag.closing) {
            if (!VOID_TAGS.has(name)) out += `</${name}>`;
        } else {
            out += emitOpenTag(name, tag.attrs);
        }
        i = tag.end;
    }

    return out.trim();
};

// Older records may hold raw text or HTML saved before the editor existed.
// Only HTML-looking values are sanitized so plain text keeps its characters.
export const sanitizeRichTextIfHtml = (value) => {
    if (typeof value !== "string") return "";
    return /<\/?[a-z][\s\S]*>/i.test(value) ? sanitizeRichText(value) : value;
};

export const richTextToPlain = (value) => {
    if (typeof value !== "string") return "";
    return decodeEntities(
        sanitizeRichText(value).replace(BLOCK_TAGS_RE, " ").replace(/<[^>]*>/g, "")
    )
        .replace(/\s+/g, " ")
        .trim();
};

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
