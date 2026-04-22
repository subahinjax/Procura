const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 🔒 Allowed file types
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

// 📁 Ensure upload directory exists
const uploadDir = path.join(__dirname, "..", "uploads", "po-documents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

filename: (req, file, cb) => {
  const { poid } = req.params;

  let prefix = "";

  if (file.fieldname === "file" && req.path.includes("documents")) {
    prefix = "relpo";
  } else {
    switch (file.fieldname) {
      case "PO_QUOTATION":
        prefix = "quot";
        break;
      case "PO_APPROVED":
        prefix = "apppo";
        break;
      case "PO_RELEASED":
        prefix = "relpo";
        break;
      default:
        return cb(new Error("Invalid document type"));
    }
  }

  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, `${prefix}_${poid}${ext}`);
}
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    cb(new Error("Only PDF, JPG or PNG files are allowed"), false);
  } else {
    cb(null, true);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
