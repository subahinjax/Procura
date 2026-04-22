const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");

const { exec } = require("child_process");
const fs = require("fs");

const XLSX    = require("xlsx");
const mammoth = require("mammoth");
const multer  = require("multer");  // ✅ ADD THIS


require('dotenv').config();

const app = express();

const upload = require("./utils/multerPoDocs");
const { REQUIRED_RELEASE_DOCS } = require("./constants/poDocuments");

// in-memory multer for CS file upload (parse only, no disk write)
const csUpload = multer({ storage: multer.memoryStorage() });



app.set("trust proxy", 1);

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "subashinjax@gmail.com",
    pass: "qhgporqvynslehbm",
  },
});

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://10.1.24.102:3000"
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log("Request received:", req.method, req.url);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  name: "connect.sid",
  secret: process.env.SESSION_SECRET || "1234",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 30
  }
}));

app.use((req, res, next) => {
  console.log("SID:", req.sessionID);
  console.log("User:", req.session?.user?.username);
  console.log("Expires:", req.session?.cookie?.expires);
  next();
});

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.use(
  "/uploads/po-documents",
  express.static(path.join(__dirname, "uploads", "po-documents"))
);

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function query(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// ------------------- AUTH/ME ---------------------
app.get("/api/auth/me", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ loggedIn: false });
  }
  req.session.touch();
  res.json({
    loggedIn: true,
    username: req.session.user.username,
    user_type: req.session.user.user_type,
  });
});

// ------------------- LOGIN ---------------------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await query(
      `SELECT * FROM users WHERE username = $1 AND password = $2`,
      [username, password]
    );
    if (result.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const user = result[0];
    req.session.user = {
      id: user.id,
      username: user.username,
      user_type: user.user_type,
      email: user.email,
      dept_id: user.dept_id,   // ← add this
      dept_id: user.dept_id,   // ← add this too (for AuthContext)
    };
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      return res.status(200).json({
        success: true,
        username: user.username,
        user_type: user.user_type,
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// ------------------- LOGOUT ---------------------
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie("connect.sid", {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    return res.status(200).json({ message: "Logged out" });
  });
});

// ------------------- SESSION CHECK ---------------------
app.get("/api/session", (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username });
  } else {
    res.status(401).json({ loggedIn: false });
  }
});

// ------------------- CURRENT USER ---------------------
app.get("/api/current-user", requireAuth, (req, res) => {
  res.json({
    username: req.session.user.username,
    user_type: req.session.user.user_type,
    email: req.session.user.email,
  });
});

// ---------------- MASTER APIs -------------------------

app.get("/api/categories", async (req, res) => {
  try {
    const result = await query("SELECT * FROM category");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/items", async (req, res) => {
  try {
    const result = await query("SELECT * FROM mas_item WHERE active = true ORDER BY item_name");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/suppliers", async (req, res) => {
  try {
    const result = await query("SELECT * FROM mas_sup");
    res.json(result);
  } catch (error) {
    console.error("❌ Error fetching suppliers:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/department", async (req, res) => {
  try {
    const result = await query("SELECT * FROM mas_dept ORDER BY dept_name ASC");
    res.json(result);
  } catch (error) {
    console.error("❌ Error fetching departments:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/subdepartment/:dept_id", async (req, res) => {
  const { dept_id } = req.params;
  try {
    const result = await query(
      "SELECT * FROM mas_subdept WHERE dept_id = $1 ORDER BY subdept_name",
      [dept_id]
    );
    res.json(result);
  } catch (error) {
    console.error("❌ Error fetching subdepartments:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/terms', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, title, content FROM terms_cond ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching terms:', err);
    res.status(500).json({ error: 'Failed to load terms & conditions' });
  }
});

app.get("/api/approvers", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, desig FROM approvers ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching approvers:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------------- PURCHASE ORDER APIs -------------------------

app.get("/api/purchase-orders", async (req, res) => {
  const client = await pool.connect();
  try {
    // Optional filters: supplier_id, exclude_complete (for GRN form dropdown)
    const { supplier_id, exclude_complete } = req.query;
    const conditions = [];
    const params = [];
    if (supplier_id) {
      params.push(Number(supplier_id));
      conditions.push(`ph.sup_id = $${params.length}`);
    }
    if (exclude_complete === 'true') {
      // Only Released POs that are not fully received
      conditions.push(`ph.status = 'Released'`);
      conditions.push(`COALESCE(ph.grn_status, 'PENDING') != 'COMPLETE'`);
    }
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await client.query(`
      SELECT
        ph.id, ph.po_no, ph.sup_id, ph.sup_name, ph.po_date, ph.created_by,
        ph.sub_total, ph.gst_total, ph.grand_total,
        ph.released_by, ph.released_on, ph.status,
        COALESCE(ph.invoice_status, 'PENDING') AS invoice_status,
        COALESCE(ph.grn_status, 'PENDING')     AS grn_status,
        COALESCE(
          json_agg(
            json_build_object(
              'file_name', pd.file_name,
              'file_path', pd.file_path,
              'doc_type', pd.doc_type
            )
          ) FILTER (WHERE pd.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM po_header ph
      LEFT JOIN po_documents pd ON pd.po_id = ph.id
      ${whereClause}
      GROUP BY ph.id
      ORDER BY ph.id DESC;
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching PO list:", err.message);
    res.status(500).json({ error: "Failed to fetch PO list" });
  } finally {
    client.release();
  }
});

app.get("/api/purchase-orders/:poid", async (req, res) => {
  const { poid } = req.params;
  const client = await pool.connect();
  try {
    const { rows: headerRows } = await client.query(`
      SELECT ph.*, a.name AS approved_by_name, r.name AS released_by_name
      FROM po_header ph
      LEFT JOIN approvers a ON ph.approved_by::int = a.id
      LEFT JOIN approvers r ON ph.released_by::int = r.id
      WHERE ph.id = $1
    `, [poid]);
    if (headerRows.length === 0)
      return res.status(404).json({ error: "PO not found" });
    const { rows: itemRows } = await client.query(
      `SELECT * FROM po_details WHERE po_id = $1 ORDER BY id ASC`, [poid]
    );
    const { rows: termRows } = await client.query(`
      SELECT t.id AS term_id, t.content, t.title
      FROM po_terms pt
      JOIN terms_cond t ON pt.term_id = t.id
      WHERE pt.po_id = $1 ORDER BY t.id ASC
    `, [poid]);
   const { rows: chargeRows } = await client.query(
  `SELECT id, item_code, item_name, amount, is_discount
     FROM po_other_charges
    WHERE po_id = $1
    ORDER BY id ASC`,
  [poid]
);
res.json({
  header:        headerRows[0],
  items:         itemRows,
  terms:         termRows,
  other_charges: chargeRows,   // ← NEW
});
  } catch (err) {
    console.error("❌ Error fetching PO:", err.message);
    res.status(500).json({ error: "Failed to fetch PO" });
  } finally {
    client.release();
  }
});



app.post("/api/po", async (req, res) => {
  const { header, items, terms } = req.body;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Session expired. Please login again." });
  }
  if (!header || !items) return res.status(400).json({ error: "Missing header or items" });
  if (!header.po_date) return res.status(400).json({ error: "PO date is required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertHeaderText = `
      INSERT INTO po_header (
        po_date, sup_id, quot_no, freight, del_day, warranty, pay_term,
        sup_gst, sup_add, acct_name, acct_no, bank_name, ifsc_code,
        bank_branch, sup_person, sup_phone, sup_email, sup_name,
        po_title, dept_id, subdept_id, prepared_by, review_by,
        prepared_review, approved_by, approved_date, released_by, created_by,
        sub_total, gst_total, grand_total, advance_required, advance_percent, status, po_type
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
      RETURNING id
    `;
    const headerValues = [
      header.po_date || null, header.sup_id || null, header.quot_no || null,
      header.freight || null, header.del_day || null, header.warranty || null,
      header.pay_term || null, header.sup_gst || null, header.sup_add || null,
      header.acct_name || null, header.acct_no || null, header.bank_name || null,
      header.ifsc_code || null, header.bank_branch || null, header.sup_person || null,
      header.sup_phone || null, header.sup_email || null, header.sup_name || null,
      header.po_title || null, header.dept_id || null, header.subdept_id || null,
      header.prepared_by || null, header.review_by || null, header.prepared_review || null,
      header.approved_by || null, new Date().toISOString().split("T")[0],
      header.released_by || null,
      req.session.user.username,
      header.sub_total || 0, header.gst_total || 0, header.grand_total || 0,
      header.advance_required || false, header.advance_percent || 0,
      header.status || "Draft", header.po_type || null,
    ];
    const result = await client.query(insertHeaderText, headerValues);
    const savedPoId = result.rows[0].id;
    const financialYear = getFinancialYear();
    const departmentName = await getDepartmentName(header.dept_id);
    const poType = header.po_type || "PO";
    const po_no = `HITS/${poType}/${financialYear}/${departmentName}/${savedPoId}`;
    await client.query(`UPDATE po_header SET po_no = $1 WHERE id = $2`, [po_no, savedPoId]);
    for (const item of items) {
      const amount = parseFloat(((item.qty ?? 0) * (item.rate ?? 0)).toFixed(2));
      await client.query(`
        INSERT INTO po_details (po_id, item_code, item_name, description, unit, qty, rate, amount, hsn_code, gst_per, disc_amt, is_discount_applicable)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [savedPoId, item.item_code ?? "", item.item_name ?? "", item.description ?? "",
          item.unit ?? "", item.qty ?? 0, item.rate ?? 0, amount, item.hsn_code ?? "", item.gst_per ?? 0, parseFloat((Number(item.disc_amt) || 0).toFixed(2)), Boolean(item.is_discount_applicable ?? false)]);
    }
    if (terms && terms.length > 0) {
      for (const term of terms) {
        const termContent = term.content || term.text || term.term || "";
        if (!termContent.trim()) continue;
        let termId = term.id || term.term_id || null;
        if (!termId) {
          const { rows } = await client.query(
            `INSERT INTO terms_cond(title, content) VALUES($1,$2) RETURNING id`,
            [termContent.substring(0, 30), termContent]
          );
          termId = rows[0].id;
        }
        await client.query(`INSERT INTO po_terms(po_id, term_id) VALUES($1,$2)`, [savedPoId, termId]);
      }
    }
if (req.body.other_charges && req.body.other_charges.length > 0) {
  for (const oc of req.body.other_charges) {
    const ocName = (oc.item_name || "").trim();
    if (!ocName || Number(oc.amount) <= 0) continue;   // skip blank rows
    await client.query(
      `INSERT INTO po_other_charges (po_id, item_code, item_name, amount, is_discount)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        savedPoId,
        oc.item_code || null,
        ocName,
        Number(oc.amount),
        Boolean(oc.is_discount),
      ]
    );
  }
}


    await client.query("COMMIT");
    res.json({ success: true, poId: savedPoId, po_no, message: "✅ PO saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error saving PO:", err);
    res.status(500).json({ error: "Failed to save PO" });
  } finally {
    client.release();
  }
});

app.put("/api/purchase-orders/:poid", async (req, res) => {
  const { poid } = req.params;
  const { header, items, terms } = req.body;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const username = req.session.user.username;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: existingRows } = await client.query(
      "SELECT created_by, released_by FROM po_header WHERE id = $1", [poid]
    );
    if (existingRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "PO not found" });
    }
    const existing = existingRows[0];
    if (existing.created_by && existing.created_by !== username) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: `Not authorized. Created by: ${existing.created_by}` });
    }
    if (existing.released_by) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "This PO has already been released and cannot be edited." });
    }
    const poType = header.po_type || "PO";
    const financialYear = getFinancialYear();
    const departmentName = await getDepartmentName(header.dept_id);
    const po_no = `HITS/${poType}/${financialYear}/${departmentName}/${poid}`;
    const releasedBy = header.released_by?.trim() ? header.released_by.trim().substring(0, 10) : null;
    const newStatus = releasedBy ? "Approved" : "Draft";
    const approvedDate = releasedBy ? new Date().toISOString().split("T")[0] : null;
    await client.query(`
      UPDATE po_header SET
        po_no=$1, po_date=$2, sup_id=$3, quot_no=$4, freight=$5, del_day=$6,
        warranty=$7, pay_term=$8, sup_gst=$9, sup_add=$10, acct_name=$11,
        acct_no=$12, bank_name=$13, ifsc_code=$14, bank_branch=$15, sup_person=$16,
        sup_phone=$17, sup_email=$18, sup_name=$19, po_title=$20, dept_id=$21,
        subdept_id=$22, prepared_by=$23, review_by=$24, prepared_review=$25,
        approved_by=$26, approved_date=$27, released_by=$28, sub_total=$29,
        gst_total=$30, grand_total=$31, advance_required=$32, advance_percent=$33,
        status=$34, po_type=$35
      WHERE id=$36
    `, [po_no, header.po_date, header.sup_id, header.quot_no, header.freight,
        header.del_day, header.warranty, header.pay_term, header.sup_gst, header.sup_add,
        header.acct_name, header.acct_no, header.bank_name, header.ifsc_code, header.bank_branch,
        header.sup_person, header.sup_phone, header.sup_email, header.sup_name, header.po_title,
        header.dept_id, header.subdept_id, header.prepared_by, header.review_by, header.prepared_review,
        header.approved_by, approvedDate, releasedBy, header.sub_total || 0, header.gst_total || 0,
        header.grand_total || 0, header.advance_required || false, header.advance_percent || 0,
        newStatus, header.po_type, poid]);
    await client.query(`DELETE FROM po_details WHERE po_id = $1`, [poid]);
    for (const item of items) {
      await client.query(`
        INSERT INTO po_details (po_id, item_code, item_name, description, unit, qty, rate, amount, hsn_code, gst_per, disc_amt, is_discount_applicable)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [poid, item.item_code || null, item.item_name || null, item.description ?? "",
          item.unit || null, item.qty ?? 0, item.rate ?? 0,
          parseFloat(((item.qty ?? 0) * (item.rate ?? 0)).toFixed(2)),
          item.hsn_code ?? "", item.gst_per || null, parseFloat((Number(item.disc_amt) || 0).toFixed(2)), Boolean(item.is_discount_applicable ?? false)]);
    }
    await client.query(`DELETE FROM po_terms WHERE po_id = $1`, [poid]);
    if (terms && terms.length > 0) {
      for (const term of terms) {
        let termId = term.id ?? term.term_id;
        if (term.isCustom) {
          const { rows } = await client.query(
            `INSERT INTO terms_cond (title, content) VALUES ($1, $2) RETURNING id`,
            [term.content.substring(0, 30), term.content]
          );
          termId = rows[0].id;
        }
        await client.query(`INSERT INTO po_terms (po_id, term_id) VALUES ($1, $2)`, [poid, termId]);
      }
    }
await client.query(`DELETE FROM po_other_charges WHERE po_id = $1`, [poid]);

if (req.body.other_charges && req.body.other_charges.length > 0) {
  for (const oc of req.body.other_charges) {
    const ocName = (oc.item_name || "").trim();
    if (!ocName || Number(oc.amount) <= 0) continue;   // skip blank rows
    await client.query(
      `INSERT INTO po_other_charges (po_id, item_code, item_name, amount, is_discount)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        poid,
        oc.item_code || null,
        ocName,
        Number(oc.amount),
        Boolean(oc.is_discount),
      ]
    );
  }
}



    await client.query("COMMIT");
    res.json({ success: true, poId: poid, po_no, status: newStatus });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating PO:", err.message);
    res.status(500).json({ error: "Failed to update PO" });
  } finally {
    client.release();
  }
});

app.put("/api/purchase-orders/:id/cancel", async (req, res) => {
  const poId = req.params.id;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const currentUser = req.session.user.username;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, status, created_by FROM po_header WHERE id = $1", [poId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "PO not found" });
    const po = rows[0];
    if (po.status !== "Draft")
      return res.status(400).json({ message: "Only Draft POs can be cancelled" });
    if (po.created_by !== currentUser)
      return res.status(403).json({ message: "You can only cancel your own POs" });
    await client.query("UPDATE po_header SET status = 'Cancelled' WHERE id = $1", [poId]);
    return res.json({ message: "Purchase Order cancelled successfully" });
  } catch (err) {
    console.error("Cancel PO error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
});

app.put("/api/purchase-orders/:poid/release", async (req, res) => {
  const { poid } = req.params;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const poCheck = await client.query(`SELECT status FROM po_header WHERE id = $1`, [poid]);
    if (poCheck.rowCount === 0) return res.status(404).json({ error: "PO not found" });
    if (poCheck.rows[0].status !== "Approved")
      return res.status(400).json({ error: "Only Approved PO can be Released" });
    const docCheck = await client.query(
      `SELECT 1 FROM po_documents WHERE po_id = $1 AND doc_type = 'PO_RELEASED'`, [poid]
    );
    if (docCheck.rowCount === 0)
      return res.status(400).json({ error: "Released copy not uploaded" });
    await client.query(
      `UPDATE po_header SET status = 'Released', released_on = NOW() WHERE id = $1`, [poid]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Release error:", err);
    res.status(500).json({ error: "Release failed" });
  } finally {
    client.release();
  }
});

app.post("/api/purchase-orders/:poid/documents",
  upload.fields([{ name: "PO_QUOTATION", maxCount: 1 }, { name: "PO_APPROVED", maxCount: 1 }]),
  async (req, res) => {
    const { poid } = req.params;
    if (!req.session || !req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const username = req.session.user.username;
    const files = req.files;
    if (!files || (!files.PO_QUOTATION && !files.PO_APPROVED))
      return res.status(400).json({ error: "Quotation or Approved PO document required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const poCheck = await client.query(`SELECT status FROM po_header WHERE id = $1`, [poid]);
      if (poCheck.rowCount === 0) throw new Error("PO not found");
      if (poCheck.rows[0].status !== "Approved") throw new Error("Documents allowed only in Approved stage");
      const insertDoc = async (file, docType) => {
        await client.query(`
          INSERT INTO po_documents (po_id, doc_type, file_name, file_path, mime_type, file_size, uploaded_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (po_id, doc_type) DO UPDATE SET
            file_name=EXCLUDED.file_name, file_path=EXCLUDED.file_path,
            mime_type=EXCLUDED.mime_type, file_size=EXCLUDED.file_size,
            uploaded_by=EXCLUDED.uploaded_by, uploaded_at=NOW()
        `, [poid, docType, file.filename, file.filename, file.mimetype, file.size, username]);
      };
      if (files.PO_QUOTATION) await insertDoc(files.PO_QUOTATION[0], "SUPPLIER_QUOTATION");
      if (files.PO_APPROVED) await insertDoc(files.PO_APPROVED[0], "PO_APPROVED");
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);

app.post("/api/purchase-orders/:poid/documents/release",
  upload.single("PO_RELEASED"),
  async (req, res) => {
    const { poid } = req.params;
    if (!req.session || !req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const username = req.session.user.username;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const po = await client.query(`SELECT status FROM po_header WHERE id = $1`, [poid]);
      if (po.rowCount === 0) throw new Error("PO not found");
      if (po.rows[0].status !== "Approved") throw new Error("Only Approved PO can upload Released copy");
      const ext = path.extname(req.file.originalname);
      const finalFileName = `relpo_${poid}${ext}`;
      await client.query(`
        INSERT INTO po_documents (po_id, doc_type, file_name, file_path, mime_type, file_size, uploaded_by)
        VALUES ($1,'PO_RELEASED',$2,$3,$4,$5,$6)
        ON CONFLICT (po_id, doc_type) DO UPDATE SET
          file_name=EXCLUDED.file_name, file_path=EXCLUDED.file_path,
          mime_type=EXCLUDED.mime_type, file_size=EXCLUDED.file_size,
          uploaded_by=EXCLUDED.uploaded_by, uploaded_at=NOW()
      `, [poid, finalFileName, finalFileName, req.file.mimetype, req.file.size, username]);
      await client.query("COMMIT");
      res.json({ success: true, file: finalFileName });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);

app.get("/download/po-document/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "po-documents", req.params.filename);
  res.download(filePath);
});

app.get("/view/po-document/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "po-documents", req.params.filename);
  res.sendFile(filePath);
});

// ------------------- OTP ROUTES ---------------------
app.post("/api/request-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("Email is required");
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(404).send("Email not found");
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000;
    otpStore[email] = { otp, expires };
    await transporter.sendMail({
      from: '"Procura HITS Pilot" <yourgmail@gmail.com>',
      to: email,
      subject: "Your OTP for Password Reset",
      html: `<p>Your OTP is <b>${otp}</b>. It will expire in 5 minutes.</p>`,
    });
    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("❌ Error sending OTP:", error);
    res.status(500).send("Failed to send OTP");
  }
});

app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];
  if (!record) return res.status(400).send("No OTP found for this email");
  if (Date.now() > record.expires) return res.status(400).send("OTP expired");
  if (record.otp !== otp) return res.status(400).send("Invalid OTP");
  delete otpStore[email];
  res.json({ success: true, message: "OTP verified" });
});

app.post("/api/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).send("Email and new password are required");
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(404).send("Email not found");
    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [newPassword, email]);
    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("❌ Error updating password:", error);
    res.status(500).send("Failed to update password");
  }
});




app.get("/api/units", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, unit_code, active FROM mas_unit WHERE active = true ORDER BY unit_code");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching units:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =============================================
// GRN APIs
// =============================================

// GET /api/grn — list all GRNs
app.get("/api/grn", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT
        gh.id, gh.grn_number, gh.grn_date, gh.dc_number, gh.dc_date,
        gh.remarks, gh.created_by, gh.created_at,
        gh.po_id,
        gh.supplier_id,
        gh.dept_id,
        gh.subdept_id,                                          -- ← was missing
        COALESCE(gh.invoice_status, 'PENDING') AS invoice_status,
        COALESCE(ph.grn_status, 'PENDING')     AS po_grn_status,
        ph.po_no,
        s.sup_name  AS supplier_name,
        d.dept_name,
        ds.subdept_name                                         -- ← added too
      FROM grn_header gh
      LEFT JOIN mas_sup    s  ON s.sup_id::text      = gh.supplier_id::text
      LEFT JOIN po_header  ph ON ph.id               = gh.po_id
      LEFT JOIN mas_dept   d  ON d.dept_id::text     = gh.dept_id::text
      LEFT JOIN mas_subdept ds ON ds.subdept_id::text = gh.subdept_id::text
      ORDER BY gh.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/grn error:", err);
    res.status(500).json({ error: "Failed to fetch GRNs" });
  }
});


// GET /api/grn/new-number — generate GRN number
app.get("/api/grn/new-number", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query("SELECT generate_grn_number() AS grn_number");
    res.json({ grn_number: rows[0].grn_number });
  } catch (err) {
    console.error("GET /api/grn/new-number error:", err);
    res.status(500).json({ error: "Failed to generate GRN number" });
  }
});

// GET /api/grn/:id — get single GRN with details
app.get("/api/grn/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const headerResult = await client.query(`
      SELECT gh.*, s.sup_name AS supplier_name
      FROM grn_header gh
      LEFT JOIN mas_sup s ON s.sup_id = gh.supplier_id
      WHERE gh.id = $1
    `, [id]);
    if (headerResult.rows.length === 0)
      return res.status(404).json({ error: "GRN not found" });
    const detailsResult = await client.query(`
      SELECT gd.*, i.item_name AS item_name_master
      FROM grn_details gd
      LEFT JOIN mas_item i ON i.item_code = gd.item_id
      WHERE gd.grn_id = $1
      ORDER BY gd.id
    `, [id]);
    res.json({ header: headerResult.rows[0], details: detailsResult.rows });
  } catch (err) {
    console.error("GET /api/grn/:id error:", err);
    res.status(500).json({ error: "Failed to fetch GRN" });
  } finally {
    client.release();
  }
});

// Helper: update po_details.received_qty and po_header.grn_status on GRN save/delete
// Rules: ALL zero=PENDING | ALL>=qty=COMPLETE | else=PARTIAL
async function updatePoReceivedQty(client, poId, grnDetails, multiplier) {
  if (!poId) return;
  for (const item of grnDetails) {
    if (!item.item_name) continue;
    await client.query(
      `UPDATE po_details
       SET received_qty = GREATEST(0, COALESCE(received_qty,0) + $1)
       WHERE po_id = $2 AND LOWER(TRIM(item_name)) = LOWER(TRIM($3))`,
      [multiplier * Number(item.quantity_received), poId, item.item_name]
    );
  }
  const { rows } = await client.query(
    `SELECT qty, COALESCE(received_qty,0) AS received_qty FROM po_details WHERE po_id = $1`,
    [poId]
  );
  if (!rows.length) return;
  const allZero = rows.every(r => Number(r.received_qty) === 0);
  const allDone = rows.every(r => Number(r.received_qty) >= Number(r.qty));
  const status  = allZero ? 'PENDING' : allDone ? 'COMPLETE' : 'PARTIAL';
  await client.query(
    `UPDATE po_header SET grn_status = $1 WHERE id = $2`,
    [status, poId]
  );
}

// GET /api/grn/po-balance/:po_id — items with balance qty for GRN form
app.get("/api/grn/po-balance/:po_id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { po_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT
        pd.item_code,
        pd.item_name,
        pd.description,
        pd.unit                                              AS unit_of_measure,
        pd.qty                                               AS po_qty,
        COALESCE(pd.received_qty, 0)                         AS received_qty,
        (pd.qty - COALESCE(pd.received_qty, 0))              AS balance_qty,
        pd.rate,
        pd.gst_per
      FROM po_details pd
      WHERE pd.po_id = $1
      ORDER BY pd.id
    `, [po_id]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/grn/po-balance error:", err);
    res.status(500).json({ error: "Failed to fetch PO balance" });
  }
});

// POST /api/grn — create new GRN
app.post("/api/grn", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { grn_date, supplier_id, dc_number, dc_date, gate_entry_no, gate_entry_date, remarks, po_id, dept_id, subdept_id, details } = req.body;
  const created_by = req.session.user.username;
  if (!grn_date || !supplier_id || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const numResult = await client.query("SELECT generate_grn_number() AS grn_number");
    const grn_number = numResult.rows[0].grn_number;
    const headerResult = await client.query(`
      INSERT INTO grn_header (grn_number, grn_date, supplier_id, dc_number, dc_date, gate_entry_no, gate_entry_date, invoice_reference, remarks, po_id, dept_id, subdept_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, grn_number
    `, [grn_number, grn_date, supplier_id, dc_number || null, dc_date || null,
        gate_entry_no || null, gate_entry_date || null,
        null, remarks || null, po_id || null, dept_id || null, subdept_id || null, created_by]);
    const grn_id = headerResult.rows[0].id;
    for (const item of details) {
      await client.query(`
        INSERT INTO grn_details (grn_id, item_id, item_name, description, quantity_received, unit_of_measure, remarks)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [grn_id, item.item_id || null, item.item_name, item.description, item.quantity_received,
          item.unit_of_measure || null, item.remarks || null]);
    }
    await updatePoReceivedQty(client, po_id, details, 1);
    await addGrnToStock(client, grn_id, grn_number, grn_date, dept_id, subdept_id, details);
    await client.query("COMMIT");
    res.json({ success: true, grn_id, grn_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/grn error:", err);
    res.status(500).json({ error: "Failed to create GRN" });
  } finally {
    client.release();
  }
});

// PUT /api/grn/:id — update GRN
app.put("/api/grn/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { grn_date, supplier_id, dc_number, dc_date, gate_entry_no, gate_entry_date, remarks, dept_id, subdept_id, po_id, details } = req.body;
  if (!grn_date || !supplier_id || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Reverse old received_qty
    const { rows: oldDetails } = await client.query(
      "SELECT * FROM grn_details WHERE grn_id = $1", [id]
    );
    const { rows: oldHeader } = await client.query(
      "SELECT po_id FROM grn_header WHERE id = $1", [id]
    );
    await updatePoReceivedQty(client, oldHeader[0]?.po_id, oldDetails, -1);
    await reverseGrnFromStock(client, id);
    await client.query(`
      UPDATE grn_header
      SET grn_date=$1, supplier_id=$2, dc_number=$3, dc_date=$4,
          gate_entry_no=$5, gate_entry_date=$6, remarks=$7, dept_id=$8, subdept_id=$9
      WHERE id=$10
    `, [grn_date, supplier_id, dc_number || null, dc_date || null,
        gate_entry_no || null, gate_entry_date || null,
        remarks || null, dept_id || null, subdept_id || null, id]);
    await client.query("DELETE FROM grn_details WHERE grn_id = $1", [id]);
    for (const item of details) {
      await client.query(`
        INSERT INTO grn_details (grn_id, item_id, item_name, description, quantity_received, unit_of_measure, remarks)
        VALUES ($1, $2, $3, $4, $5, $6,$7)
      `, [id, item.item_id || null, item.item_name, item.description, item.quantity_received,
          item.unit_of_measure || null, item.remarks || null]);
    }
    await updatePoReceivedQty(client, po_id || oldHeader[0]?.po_id, details, 1);
    const effectiveDeptId = dept_id || oldHeader[0]?.dept_id;
    const effectiveSubdeptId = subdept_id || oldHeader[0]?.subdept_id;
    await addGrnToStock(client, id, oldHeader[0]?.grn_number || '', grn_date, effectiveDeptId, effectiveSubdeptId, details);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/grn/:id error:", err);
    res.status(500).json({ error: "Failed to update GRN" });
  } finally {
    client.release();
  }
});

// DELETE /api/grn/:id — reverse received_qty then delete
app.delete("/api/grn/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: oldDetails } = await client.query(
      "SELECT * FROM grn_details WHERE grn_id = $1", [id]
    );
    const { rows: oldHeader } = await client.query(
      "SELECT po_id FROM grn_header WHERE id = $1", [id]
    );
    await updatePoReceivedQty(client, oldHeader[0]?.po_id, oldDetails, -1);
    await reverseGrnFromStock(client, id);
    await client.query("DELETE FROM grn_header WHERE id = $1", [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/grn/:id error:", err);
    res.status(500).json({ error: "Failed to delete GRN" });
  } finally {
    client.release();
  }
});

// =============================================
// HELPER FUNCTIONS
// =============================================
function getFinancialYear() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  let startYear, endYear;
  if (month >= 4) {
    startYear = year % 100;
    endYear = (year + 1) % 100;
  } else {
    startYear = (year - 1) % 100;
    endYear = year % 100;
  }
  return `${startYear}-${endYear}`;
}

async function getDepartmentName(dept_id) {
  if (!dept_id) return "UNKNOWN";
  try {
    const { rows } = await pool.query(
      "SELECT dept_name FROM mas_dept WHERE dept_id = $1", [dept_id]
    );
    return rows.length > 0 ? rows[0].dept_name : "UNKNOWN";
  } catch (err) {
    console.error("❌ Error fetching department name:", err.message);
    return "UNKNOWN";
  }
}

// ---------------- Start Server -------------------
app.listen(5001, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:5001");
});

// =============================================
// INVOICE APIs
// =============================================

// Helper: update grn_details.invoiced_qty and grn_header.invoice_status
// grn_ids[] from invoice_header is the source of truth for which GRNs to update
// grn_detail_ids is a comma-separated string of all grn_details.id values for this item row
// Rules: ALL zero=PENDING | ALL>=received=COMPLETE (excess to remarks) | else=PARTIAL
async function updateGrnInvoicedQty(client, invoiceDetails, grn_ids, multiplier) {
  for (const item of invoiceDetails) {
    const detailIdList = (item.grn_detail_ids || "")
      .split(",").map(s => s.trim()).filter(s => s && s !== "null");

    if (detailIdList.length > 0) {
      // Step 1a — exact match via grn_detail_ids
      // grn_detail_qtys has the sequentially allocated qty per detail id
      // Use it for precise update; fallback to quantity_received if not present
      const detailQtyList = (item.grn_detail_qtys || "")
        .split(",").map(s => s.trim()).filter(Boolean);

      for (let idx = 0; idx < detailIdList.length; idx++) {
        const detailId = Number(detailIdList[idx]);
        const hasAllocatedQty = detailQtyList[idx] !== undefined && detailQtyList[idx] !== "";
        if (hasAllocatedQty) {
          // Use exact allocated qty stored at save time
          await client.query(
            `UPDATE grn_details
             SET invoiced_qty = GREATEST(0, COALESCE(invoiced_qty,0) + $1)
             WHERE id = $2`,
            [multiplier * Number(detailQtyList[idx]), detailId]
          );
        } else {
          // Fallback: use quantity_received (full GRN coverage)
          await client.query(
            `UPDATE grn_details
             SET invoiced_qty = GREATEST(0, COALESCE(invoiced_qty,0) + ($1 * quantity_received))
             WHERE id = $2`,
            [multiplier, detailId]
          );
        }
      }
    } else {
      // Step 1b — fallback: match by grn_id + item_name (old rows with null grn_detail_ids)
      const grnIdList = (item.grn_ids_for_item || (item.grn_id ? String(item.grn_id) : ""))
        .split(",").map(s => s.trim()).filter(s => s && s !== "null");

      if (grnIdList.length > 0 && item.item_name) {
        for (const grnId of grnIdList) {
          await client.query(
            `UPDATE grn_details
             SET invoiced_qty = GREATEST(0, COALESCE(invoiced_qty,0) + ($1 * quantity_received))
             WHERE grn_id::text = $2
               AND LOWER(TRIM(item_name)) = LOWER(TRIM($3))`,
            [multiplier, grnId, item.item_name]
          );
        }
      }
    }
  }

  // Step 2 — evaluate and update status for EVERY grn_id in grn_ids[]
  const grnIdList = Array.isArray(grn_ids) ? grn_ids : [];
  for (const grnId of grnIdList) {
    const { rows: grnRows } = await client.query(
      "SELECT id, quantity_received, COALESCE(invoiced_qty,0) AS invoiced_qty FROM grn_details WHERE grn_id = $1",
      [grnId]
    );
    if (!grnRows.length) continue;

    const allZero = grnRows.every(r => Number(r.invoiced_qty) === 0);
    const allDone = grnRows.every(r => Number(r.invoiced_qty) >= Number(r.quantity_received));
    const status  = allZero ? 'PENDING' : allDone ? 'COMPLETE' : 'PARTIAL';

    for (const row of grnRows) {
      const excess = Number(row.invoiced_qty) - Number(row.quantity_received);
      if (excess > 0) {
        await client.query(
          "UPDATE grn_details SET remarks = $1 WHERE id = $2",
          ["Excess qty: " + excess, row.id]
        );
      } else {
        await client.query(
          "UPDATE grn_details SET remarks = CASE WHEN remarks LIKE 'Excess qty:%' THEN NULL ELSE remarks END WHERE id = $1",
          [row.id]
        );
      }
    }
    await client.query(
      "UPDATE grn_header SET invoice_status = $1 WHERE id = $2",
      [status, grnId]
    );
  }
}

// Helper: update po_details.invoiced_qty and po_header.invoice_status
// Rules: ALL zero=PENDING | ALL>=qty=COMPLETE | else=PARTIAL
async function updatePoInvoicedQty(client, invoiceDetails, poId, multiplier) {
  if (!poId) return;
  for (const item of invoiceDetails) {
    if (!item.item_name) continue;
    await client.query(
      "UPDATE po_details SET invoiced_qty = GREATEST(0, COALESCE(invoiced_qty,0) + $1) WHERE po_id = $2 AND item_name = $3",
      [multiplier * Number(item.quantity), poId, item.item_name]
    );
  }
  const { rows: poRows } = await client.query(
    "SELECT qty, COALESCE(invoiced_qty,0) AS invoiced_qty FROM po_details WHERE po_id = $1",
    [poId]
  );
  if (!poRows.length) return;
  const allZero = poRows.every(r => Number(r.invoiced_qty) === 0);
  const allDone = poRows.every(r => Number(r.invoiced_qty) >= Number(r.qty));
  const status  = allZero ? 'PENDING' : allDone ? 'COMPLETE' : 'PARTIAL';
  await client.query("UPDATE po_header SET invoice_status = $1 WHERE id = $2", [status, poId]);
}

// GET /api/invoice/charge-items — items from mas_item where cat_code = '20010'
app.get("/api/invoice/charge-items", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT mi.item_code, mi.item_name
      FROM mas_item mi
      WHERE mi.cat_code = '20010'
        AND mi.active = true
      ORDER BY mi.item_name
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/invoice/charge-items error:", err);
    res.status(500).json({ error: "Failed to fetch charge items" });
  }
});

// GET /api/invoice — list all invoices
app.get("/api/invoice", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT
        ih.id, ih.invoice_number, ih.invoice_date,
        ih.bill_no, ih.bill_date,
        ih.sub_total, ih.discount, ih.excise_duty, ih.gst_total, ih.grand_total,
        ih.remarks, ih.created_by, ih.created_at,
        ih.grn_ids, ih.po_id,
        ih.dept_id, ih.subdept_id,
        s.sup_name AS supplier_name,
        d.dept_name, sd.subdept_name,
        -- grns_all_complete: true if ALL linked GRNs have invoice_status = COMPLETE
        CASE
          WHEN array_length(ih.grn_ids, 1) IS NULL THEN false
          WHEN (
            SELECT COUNT(*) FROM grn_header gh
            WHERE gh.id = ANY(ih.grn_ids)
              AND COALESCE(gh.invoice_status, 'PENDING') != 'COMPLETE'
          ) = 0 THEN true
          ELSE false
        END AS grns_all_complete
      FROM invoice_header ih
      LEFT JOIN mas_sup s   ON s.sup_id::text        = ih.supplier_id::text
      LEFT JOIN mas_dept d  ON d.dept_id::text        = ih.dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text = ih.subdept_id::text
      ORDER BY ih.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/invoice error:", err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// GET /api/invoice/new-number
app.get("/api/invoice/new-number", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query("SELECT generate_invoice_number() AS invoice_number");
    res.json({ invoice_number: rows[0].invoice_number });
  } catch (err) {
    console.error("GET /api/invoice/new-number error:", err);
    res.status(500).json({ error: "Failed to generate invoice number" });
  }
});

// GET /api/invoice/grns-by-supplier/:sup_id
// grn_header confirmed columns: id, grn_number, grn_date, supplier_id, dept_id, subdept_id, po_id, invoice_status
app.get("/api/invoice/grns-by-supplier/:sup_id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { sup_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT
        gh.id, gh.grn_number, gh.grn_date,
        gh.dept_id, gh.subdept_id, gh.po_id,
        COALESCE(gh.invoice_status, 'PENDING') AS invoice_status,
        d.dept_name, sd.subdept_name
      FROM grn_header gh
      LEFT JOIN mas_dept d   ON d.dept_id::text  = gh.dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id  = gh.subdept_id
      WHERE gh.supplier_id = $1
        AND COALESCE(gh.invoice_status, 'PENDING') != 'COMPLETE'
        AND EXISTS (
          SELECT 1 FROM grn_details gd
          WHERE gd.grn_id = gh.id
            AND (gd.quantity_received - COALESCE(gd.invoiced_qty, 0)) > 0
        )
      ORDER BY gh.grn_date DESC, gh.id DESC
    `, [sup_id]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/invoice/grns-by-supplier error:", err);
    res.status(500).json({ error: "Failed to fetch GRNs" });
  }
});

// GET /api/invoice/grn-balance/:grn_id
// Returns GRN details with balance qty (received - invoiced)
app.get("/api/invoice/grn-balance/:grn_id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { grn_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT
        gd.id                                                    AS grn_detail_id,
        gd.grn_id,
        gd.item_name,
        gd.description,
        gd.unit_of_measure                                       AS uom,
        gd.quantity_received,
        COALESCE(gd.invoiced_qty, 0)                             AS invoiced_qty,
        (gd.quantity_received - COALESCE(gd.invoiced_qty, 0))   AS balance_qty
      FROM grn_details gd
      JOIN grn_header gh ON gh.id = gd.grn_id
      WHERE gd.grn_id = $1
        AND (gd.quantity_received - COALESCE(gd.invoiced_qty, 0)) > 0
        AND COALESCE(gh.invoice_status, 'PENDING') != 'COMPLETE'
      ORDER BY gd.id
    `, [grn_id]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/invoice/grn-balance error:", err);
    res.status(500).json({ error: "Failed to fetch GRN balance" });
  }
});

// GET /api/invoice/po-rates/:po_id
// po_details confirmed columns: po_id, item_code, item_name, unit, qty, rate, amount, gst_per
app.get("/api/invoice/po-rates/:po_id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { po_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT
        id                                               AS po_detail_id,
        item_name,
        rate,
        unit                                             AS uom,
        gst_per,
        qty,
        COALESCE(invoiced_qty, 0)                        AS invoiced_qty,
        (qty - COALESCE(invoiced_qty, 0))                AS balance_qty,
        ROW_NUMBER() OVER (ORDER BY id)                  AS sort_order
      FROM po_details
      WHERE po_id = $1
      ORDER BY id
    `, [po_id]);
    const { rows: poRows } = await pool.query(
      `SELECT grand_total, po_no FROM po_header WHERE id = $1`, [po_id]
    );
    res.json({
      items: rows,
      po_grand_total: poRows[0]?.grand_total || 0,
      po_number: poRows[0]?.po_no || ""
    });
  } catch (err) {
    console.error("GET /api/invoice/po-rates error:", err);
    res.status(500).json({ error: "Failed to fetch PO rates" });
  }
});

// GET /api/invoice/:id — single invoice with details
app.get("/api/invoice/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const headerResult = await client.query(`
      SELECT ih.*, s.sup_name AS supplier_name,
             d.dept_name, sd.subdept_name
      FROM invoice_header ih
      LEFT JOIN mas_sup s      ON s.sup_id::text        = ih.supplier_id::text
      LEFT JOIN mas_dept d     ON d.dept_id::text        = ih.dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text    = ih.subdept_id::text
      WHERE ih.id = $1
    `, [id]);
    if (headerResult.rows.length === 0)
      return res.status(404).json({ error: "Invoice not found" });
    const detailsResult = await client.query(
      `SELECT * FROM invoice_details WHERE invoice_id = $1 ORDER BY id`, [id]
    );
    const chargesResult = await client.query(
      `SELECT id, item_code, item_name, amount, is_discount
       FROM invoice_other_charges WHERE invoice_id = $1 ORDER BY id`, [id]
    );
    res.json({
      header:        headerResult.rows[0],
      details:       detailsResult.rows,
      other_charges: chargesResult.rows
    });
  } catch (err) {
    console.error("GET /api/invoice/:id error:", err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  } finally {
    client.release();
  }
});

// POST /api/invoice — create invoice
app.post("/api/invoice", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const {
    invoice_date, bill_no, bill_date, supplier_id,
    grn_ids, po_id, dept_id, subdept_id,
    sub_total, gst_total, grand_total,
    remarks, details, other_charges
  } = req.body;
  const created_by = req.session.user.username;
  if (!invoice_date || !supplier_id || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  if (!bill_no || !bill_date)
    return res.status(400).json({ error: "Bill No. and Bill Date are required" });
  // Block save if all invoice quantities are zero
  const allZeroQty = details.every(d => !d.quantity || Number(d.quantity) === 0);
  if (allZeroQty)
    return res.status(400).json({ error: "Invoice cannot be saved with all zero quantities" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const numResult = await client.query("SELECT generate_invoice_number() AS invoice_number");
    const invoice_number = numResult.rows[0].invoice_number;
    const headerResult = await client.query(`
      INSERT INTO invoice_header
        (invoice_number, invoice_date, bill_no, bill_date, supplier_id,
         grn_ids, po_id, dept_id, subdept_id,
         sub_total, discount, excise_duty, gst_total, grand_total,
         remarks, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id, invoice_number
    `, [invoice_number, invoice_date, bill_no || null, bill_date || null,
        supplier_id, grn_ids || null, po_id || null, dept_id || null, subdept_id || null,
        sub_total || 0, 0, 0, gst_total || 0, grand_total || 0,
        remarks || null, created_by]);
    const invoice_id = headerResult.rows[0].id;
    for (const item of details) {
      const discountPercent = Number(item.discount_percent || 0);
      const discountAmount  = Number(item.discount_amount  || 0);
      const itemAmount      = Number(item.amount           || 0);
      const taxableAmount   = parseFloat((Number(item.taxable_amount  || 0) || (itemAmount - discountAmount)).toFixed(2));
      const gstAmount       = parseFloat((taxableAmount * Number(item.gst_percent || 0) / 100).toFixed(2));

      await client.query(
        `INSERT INTO invoice_details
          (invoice_id, grn_detail_ids, grn_ids_for_item, grn_detail_qtys, grn_detail_maxqtys,
           item_name, description, uom, quantity, rate, amount,
           discount_percent, discount_amount, taxable_amount,
           gst_percent, gst_amount, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          invoice_id,
          item.grn_detail_ids     || null,
          item.grn_ids_for_item   || null,
          item.grn_detail_qtys    || null,
          item.grn_detail_maxqtys || null,
          item.item_name,
          item.description 	  || null,
          item.uom                || null,
          item.quantity           || 0,
          item.rate               || 0,
          itemAmount,
          discountPercent,                          // ← new
          discountAmount,                           // ← new
          taxableAmount,                            // ← new
          item.gst_percent        || 0,
          gstAmount,
          item.remarks            || null,
        ]
      );
    }
    // Update invoiced_qty on grn_details and po_details
    await updateGrnInvoicedQty(client, details, grn_ids || [], 1);
    await updatePoInvoicedQty(client, details, po_id, 1);
    // Save other charges
    if (other_charges?.length) {
      for (const oc of other_charges) {
        await client.query(`
          INSERT INTO invoice_other_charges (invoice_id, item_code, item_name, amount, is_discount)
          VALUES ($1,$2,$3,$4,$5)
        `, [invoice_id, oc.item_code||null, oc.item_name, Number(oc.amount)||0, oc.is_discount||false]);
      }
    }
    await client.query("COMMIT");
    res.json({ success: true, invoice_id, invoice_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/invoice error:", err);
    res.status(500).json({ error: "Failed to create invoice" });
  } finally {
    client.release();
  }
});

// PUT /api/invoice/:id — update invoice
app.put("/api/invoice/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const {
    invoice_date, bill_no, bill_date, supplier_id,
    grn_ids, po_id, dept_id, subdept_id,
    sub_total, gst_total, grand_total,
    remarks, details, other_charges
  } = req.body;
  if (!invoice_date || !supplier_id || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Reverse previous invoiced_qty
    const { rows: oldDetails } = await client.query(
      `SELECT * FROM invoice_details WHERE invoice_id = $1`, [id]
    );
    const { rows: oldHeader } = await client.query(
      `SELECT po_id, grn_ids FROM invoice_header WHERE id = $1`, [id]
    );
    await updateGrnInvoicedQty(client, oldDetails, oldHeader[0]?.grn_ids || [], -1);
    await updatePoInvoicedQty(client, oldDetails, oldHeader[0]?.po_id, -1);
    // Update header
    await client.query(`
      UPDATE invoice_header SET
        invoice_date=$1, bill_no=$2, bill_date=$3, supplier_id=$4,
        grn_ids=$5, po_id=$6, dept_id=$7, subdept_id=$8,
        sub_total=$9, discount=$10, excise_duty=$11, gst_total=$12,
        grand_total=$13, remarks=$14
      WHERE id=$15
    `, [invoice_date, bill_no || null, bill_date || null, supplier_id,
        grn_ids || null, po_id || null, dept_id || null, subdept_id || null,
        sub_total || 0, 0, 0, gst_total || 0,
        grand_total || 0, remarks || null, id]);
    // Delete and re-insert details
    await client.query(`DELETE FROM invoice_details WHERE invoice_id = $1`, [id]);

   for (const item of details) {
      const discountPercent = Number(item.discount_percent || 0);
      const discountAmount  = Number(item.discount_amount  || 0);
      const itemAmount      = Number(item.amount           || 0);
      const taxableAmount   = parseFloat((Number(item.taxable_amount  || 0) || (itemAmount - discountAmount)).toFixed(2));
      const gstAmount       = parseFloat((taxableAmount * Number(item.gst_percent || 0) / 100).toFixed(2));

      await client.query(
        `INSERT INTO invoice_details
          (invoice_id, grn_detail_ids, grn_ids_for_item, grn_detail_qtys, grn_detail_maxqtys,
           item_name, description, uom, quantity, rate, amount,
           discount_percent, discount_amount, taxable_amount,
           gst_percent, gst_amount, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          id,                                       // ← PUT uses `id`
          item.grn_detail_ids     || null,
          item.grn_ids_for_item   || null,
          item.grn_detail_qtys    || null,
          item.grn_detail_maxqtys || null,
          item.item_name,
          item.description	  || null,
          item.uom                || null,
          item.quantity           || 0,
          item.rate               || 0,
          itemAmount,
          discountPercent,                          // ← new
          discountAmount,                           // ← new
          taxableAmount,                            // ← new
          item.gst_percent        || 0,
          gstAmount,
          item.remarks            || null,
        ]
      );
    }
    // Apply new invoiced_qty
    await updateGrnInvoicedQty(client, details, grn_ids || [], 1);
    await updatePoInvoicedQty(client, details, po_id, 1);
    // Re-save other charges
    await client.query(`DELETE FROM invoice_other_charges WHERE invoice_id=$1`, [id]);
    if (other_charges?.length) {
      for (const oc of other_charges) {
        await client.query(`
          INSERT INTO invoice_other_charges (invoice_id, item_code, item_name, amount, is_discount)
          VALUES ($1,$2,$3,$4,$5)
        `, [id, oc.item_code||null, oc.item_name, Number(oc.amount)||0, oc.is_discount||false]);
      }
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/invoice/:id error:", err);
    res.status(500).json({ error: "Failed to update invoice" });
  } finally {
    client.release();
  }
});

// DELETE /api/invoice/:id — reverse invoiced_qty before delete
app.delete("/api/invoice/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: oldDetails } = await client.query(
      `SELECT * FROM invoice_details WHERE invoice_id = $1`, [id]
    );
    const { rows: oldHeader } = await client.query(
      `SELECT po_id, grn_ids FROM invoice_header WHERE id = $1`, [id]
    );
    await updateGrnInvoicedQty(client, oldDetails, oldHeader[0]?.grn_ids || [], -1);
    await updatePoInvoicedQty(client, oldDetails, oldHeader[0]?.po_id, -1);
    await client.query(`DELETE FROM invoice_header WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/invoice/:id error:", err);
    res.status(500).json({ error: "Failed to delete invoice" });
  } finally {
    client.release();
  }
});

// =============================================
// STOCK MODULE
// =============================================


// ─── Helper: upsert stock balance (forward entries only) ─────────────────────
async function upsertStockBalance(client, itemId, deptId, subdeptId, itemName, uom, deltaIn, deltaOut) {
  await client.query(`
    INSERT INTO stock_balance (item_id, dept_id, subdept_id, item_name, unit_of_measure, opening_qty, total_in, total_out, last_updated)
    VALUES ($1, $2, $3, $4, $5, 0, GREATEST(0, $6), GREATEST(0, $7), NOW())
    ON CONFLICT (item_id, dept_id, subdept_id) DO UPDATE
      SET total_in        = stock_balance.total_in  + EXCLUDED.total_in,
          total_out       = stock_balance.total_out + EXCLUDED.total_out,
          item_name       = EXCLUDED.item_name,
          unit_of_measure = EXCLUDED.unit_of_measure,
          last_updated    = NOW()
  `, [itemId, deptId, subdeptId || null, itemName, uom, deltaIn, deltaOut]);
}

// ─── Helper: reverse a previous stock balance entry ──────────────────────────
// Use ONLY for reversals (edit/delete).
// Subtracts from total_in or total_out directly, flooring at 0.
// deltaIn  = amount to subtract from total_in
// deltaOut = amount to subtract from total_out
async function reverseStockBalance(client, itemId, deptId, subdeptId, deltaIn, deltaOut) {
  await client.query(`
    UPDATE stock_balance
      SET total_in     = GREATEST(0, total_in  - $4),
          total_out    = GREATEST(0, total_out - $5),
          last_updated = NOW()
    WHERE item_id    = $1
      AND dept_id    = $2
      AND subdept_id IS NOT DISTINCT FROM $3
  `, [itemId, deptId, subdeptId || null, deltaIn, deltaOut]);
}



// ─── Helper: add stock_ledger entry ──────────────────────────────────────────
async function addStockLedger(client, { date, type, refId, refNumber, itemId, itemName, uom, qtyIn, qtyOut, deptId, subdeptId }) {
  await client.query(`
    INSERT INTO stock_ledger
      (transaction_date, transaction_type, reference_id, reference_number,
       item_id, item_name, unit_of_measure, qty_in, qty_out, dept_id, subdept_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `, [date, type, refId, refNumber, itemId, itemName, uom,
      qtyIn || 0, qtyOut || 0, deptId, subdeptId || null]);
}

// ─── Helper: reverse stock_ledger entries for a reference ────────────────────
// Reads ledger rows, reverses their effect on stock_balance, then deletes them.
async function reverseStockLedger(client, refId, refType) {
  const { rows } = await client.query(
    `SELECT * FROM stock_ledger WHERE reference_id = $1 AND transaction_type = $2`,
    [refId, refType]
  );
  for (const row of rows) {
    // ✅ Undo qty_in → subtract from total_in
    // ✅ Undo qty_out → subtract from total_out
    await reverseStockBalance(
      client,
      row.item_id, row.dept_id, row.subdept_id,
      Number(row.qty_in),   // subtract from total_in
      Number(row.qty_out)   // subtract from total_out
    );
  }
  await client.query(
    `DELETE FROM stock_ledger WHERE reference_id = $1 AND transaction_type = $2`,
    [refId, refType]
  );
}

// ─── GRN stock integration ────────────────────────────────────────────────────
async function addGrnToStock(client, grnId, grnNumber, grnDate, deptId, subdeptId, details) {
  for (const item of details) {
    await upsertStockBalance(
      client,
      item.item_id, deptId, subdeptId || null,
      item.item_name, item.unit_of_measure,
      item.quantity_received, 0
    );
    await addStockLedger(client, {
      date: grnDate, type: "GRN", refId: grnId, refNumber: grnNumber,
      itemId: item.item_id, itemName: item.item_name, uom: item.unit_of_measure,
      qtyIn: item.quantity_received, qtyOut: 0,
      deptId, subdeptId: subdeptId || null
    });
  }
}

async function reverseGrnFromStock(client, grnId) {
  // reverseStockLedger reads subdept_id from ledger rows — no need to pass it
  await reverseStockLedger(client, grnId, "GRN");
}

// ─── Stock routes ─────────────────────────────────────────────────────────────

// GET /api/stock/all-item-names
app.get("/api/stock/all-item-names", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT item_id, item_name, unit_of_measure
      FROM stock_balance
      ORDER BY item_name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch item names" });
  }
});

// GET /api/stock/balance
app.get("/api/stock/balance", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { dept_id, subdept_id, item_name, category_type, cat_code } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (dept_id) {
      params.push(dept_id);
      conditions.push(`sb.dept_id::text = $${params.length}::text`);
    }
    if (subdept_id) {
      params.push(subdept_id);
      conditions.push(`sb.subdept_id::text = $${params.length}::text`);
    }
    if (item_name) {
      params.push(`%${item_name}%`);
      conditions.push(`LOWER(sb.item_name) LIKE LOWER($${params.length})`);
    }
    if (category_type) {
      params.push(category_type);
      conditions.push(`COALESCE(mc.category_type, mc2.category_type) = $${params.length}`);
    }
    if (cat_code) {
      params.push(cat_code);
      conditions.push(`COALESCE(mi.cat_code, mi2.cat_code) = $${params.length}`);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(`
      SELECT sb.item_id, sb.dept_id, sb.item_name, sb.unit_of_measure,
             sb.opening_qty, sb.total_in, sb.total_out, sb.current_qty,
             d.dept_name,
             COALESCE(mi.cat_code,           mi2.cat_code)           AS cat_code,
             COALESCE(mc.category,           mc2.category)           AS category,
             COALESCE(mc.category_type,      mc2.category_type)      AS category_type
      FROM stock_balance sb
      LEFT JOIN mas_dept d ON d.dept_id::text = sb.dept_id::text
      LEFT JOIN mas_item mi
             ON sb.item_id IS NOT NULL AND sb.item_id::text != ''
            AND mi.item_code::text = sb.item_id::text
      LEFT JOIN mas_cat mc  ON mc.cat_code = mi.cat_code
      LEFT JOIN mas_item mi2
             ON (sb.item_id IS NULL OR sb.item_id::text = '')
            AND LOWER(mi2.item_name) = LOWER(sb.item_name)
      LEFT JOIN mas_cat mc2 ON mc2.cat_code = mi2.cat_code
      ${where}
      ORDER BY d.dept_name,
               COALESCE(mc.category_type, mc2.category_type),
               COALESCE(mc.category,      mc2.category),
               sb.item_name
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/stock/balance error:", err);
    res.status(500).json({ error: "Failed to fetch stock balance" });
  }
});

// GET /api/stock/items-for-issue — Stores items (dept 2009, subdept 200901 only)
app.get("/api/stock/items-for-issue", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { all } = req.query;
  try {
    // ✅ Filter by both dept_id=2009 AND subdept_id=200901
    const extraWhere = all === 'true' ? '' : 'AND sb.current_qty > 0';
    const { rows } = await pool.query(`
      SELECT sb.item_id, sb.item_name, sb.unit_of_measure, sb.current_qty
      FROM stock_balance sb
      WHERE sb.dept_id::text = '2009'
        AND sb.subdept_id::text = '200901'
        ${extraWhere}
      ORDER BY sb.item_name
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/stock/items-for-issue error:", err);
    res.status(500).json({ error: "Failed to fetch items for issue" });
  }
});

// GET /api/stock/ledger
app.get("/api/stock/ledger", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { dept_id, from_date, to_date, item_id } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (dept_id)   { params.push(dept_id);   conditions.push(`sl.dept_id = $${params.length}`); }
    if (item_id)   { params.push(item_id);   conditions.push(`sl.item_id = $${params.length}`); }
    if (from_date) { params.push(from_date); conditions.push(`sl.transaction_date >= $${params.length}`); }
    if (to_date)   { params.push(to_date);   conditions.push(`sl.transaction_date <= $${params.length}`); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await pool.query(`
      SELECT sl.*, d.dept_name
      FROM stock_ledger sl
      LEFT JOIN mas_dept d ON d.dept_id = sl.dept_id
      ${where}
      ORDER BY sl.transaction_date, sl.id
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/stock/ledger error:", err);
    res.status(500).json({ error: "Failed to fetch ledger" });
  }
});

// GET /api/stock/category-types
app.get("/api/stock/category-types", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT COALESCE(mc.category_type, mc2.category_type) AS category_type
      FROM stock_balance sb
      LEFT JOIN mas_item mi
             ON sb.item_id IS NOT NULL AND sb.item_id::text != ''
            AND mi.item_code::text = sb.item_id::text
      LEFT JOIN mas_cat mc  ON mc.cat_code = mi.cat_code
      LEFT JOIN mas_item mi2
             ON (sb.item_id IS NULL OR sb.item_id::text = '')
            AND LOWER(mi2.item_name) = LOWER(sb.item_name)
      LEFT JOIN mas_cat mc2 ON mc2.cat_code = mi2.cat_code
      WHERE COALESCE(mc.category_type, mc2.category_type) IS NOT NULL
        AND COALESCE(mc.category_type, mc2.category_type) != ''
      ORDER BY category_type
    `);
    res.json(rows.map(r => r.category_type));
  } catch (err) {
    console.error("GET /api/stock/category-types error:", err);
    res.status(500).json({ error: "Failed to fetch category types" });
  }
});

// GET /api/stock/categories
app.get("/api/stock/categories", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { category_type } = req.query;
  try {
    const params = [];
    let typeFilter = '';
    if (category_type) {
      params.push(category_type);
      typeFilter = `AND COALESCE(mc.category_type, mc2.category_type) = $${params.length}`;
    }
    const { rows } = await pool.query(`
      SELECT DISTINCT
             COALESCE(mi.cat_code,      mi2.cat_code)      AS cat_code,
             COALESCE(mc.category,      mc2.category)      AS category,
             COALESCE(mc.category_type, mc2.category_type) AS category_type
      FROM stock_balance sb
      LEFT JOIN mas_item mi
             ON sb.item_id IS NOT NULL AND sb.item_id::text != ''
            AND mi.item_code::text = sb.item_id::text
      LEFT JOIN mas_cat mc  ON mc.cat_code = mi.cat_code
      LEFT JOIN mas_item mi2
             ON (sb.item_id IS NULL OR sb.item_id::text = '')
            AND LOWER(mi2.item_name) = LOWER(sb.item_name)
      LEFT JOIN mas_cat mc2 ON mc2.cat_code = mi2.cat_code
      WHERE COALESCE(mc.category,      mc2.category)      IS NOT NULL
        AND COALESCE(mc.category,      mc2.category)      != ''
        ${typeFilter}
      ORDER BY category_type, category
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/stock/categories error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});


// ─── Opening Balance ───────────────────────────────────────────────────────────

// GET /api/stock/opening-balance
app.get("/api/stock/opening-balance", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { dept_id, subdept_id, item_id } = req.query;
    const conditions = [];
    const params = [];
    if (dept_id) {
      params.push(dept_id);
      conditions.push(`ob.dept_id::text = $${params.length}::text`);
    }
    if (subdept_id) {
      params.push(subdept_id);
      conditions.push(`ob.subdept_id::text = $${params.length}::text`);
    }
    if (item_id) {
      params.push(item_id);
      conditions.push(`ob.item_id::text = $${params.length}::text`);
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await pool.query(`
      SELECT ob.*, d.dept_name, sd.subdept_name
      FROM opening_balance ob
      LEFT JOIN mas_dept    d  ON d.dept_id::text     = ob.dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text = ob.subdept_id::text
      ${where}
      ORDER BY d.dept_name, sd.subdept_name NULLS FIRST, ob.item_name
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/stock/opening-balance error:", err);
    res.status(500).json({ error: "Failed to fetch opening balances" });
  }
});

// POST /api/stock/opening-balance
app.post("/api/stock/opening-balance", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { entries } = req.body;
  if (!entries?.length) return res.status(400).json({ error: "No entries provided" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const e of entries) {
      const subdeptId = e.subdept_id || null;
      const { rows } = await client.query(`
        INSERT INTO opening_balance
          (item_id, item_name, unit_of_measure, dept_id, subdept_id, opening_qty, opening_date, entered_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (item_id, dept_id, subdept_id) DO UPDATE
          SET opening_qty  = $6,
              opening_date = $7,
              entered_by   = $8
        RETURNING id
      `, [e.item_id, e.item_name, e.uom, e.dept_id, subdeptId,
          e.opening_qty, e.opening_date, req.session.user.username]);
      const obId = rows[0].id;

      // Remove old OP ledger entry for this OB
      await client.query(
        `DELETE FROM stock_ledger WHERE reference_id = $1 AND transaction_type = 'OP'`, [obId]
      );

      // Fresh OP ledger entry
      await addStockLedger(client, {
        date: e.opening_date, type: "OP", refId: obId, refNumber: "OPENING",
        itemId: e.item_id, itemName: e.item_name, uom: e.uom,
        qtyIn: Number(e.opening_qty), qtyOut: 0,
        deptId: e.dept_id, subdeptId,
      });

      // Upsert stock_balance — reset opening_qty, keep total_in/total_out intact
      await client.query(`
        INSERT INTO stock_balance
          (item_id, dept_id, subdept_id, item_name, unit_of_measure, opening_qty, total_in, total_out, last_updated)
        VALUES ($1,$2,$3,$4,$5,$6,0,0,NOW())
        ON CONFLICT (item_id, dept_id, subdept_id) DO UPDATE
          SET opening_qty     = $6,
              item_name       = $4,
              unit_of_measure = $5,
              last_updated    = NOW()
      `, [e.item_id, e.dept_id, subdeptId, e.item_name, e.uom, Number(e.opening_qty)]);
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/stock/opening-balance error:", err);
    res.status(500).json({ error: "Failed to save opening balance" });
  } finally {
    client.release();
  }
});

// PUT /api/stock/opening-balance/:id
app.put("/api/stock/opening-balance/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { item_id, item_name, uom, dept_id, subdept_id, opening_qty, opening_date } = req.body;
  if (!item_id || !dept_id || opening_qty === undefined || !opening_date)
    return res.status(400).json({ error: "Missing required fields" });
  const subdeptId = subdept_id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: oldRows } = await client.query(
      `SELECT * FROM opening_balance WHERE id = $1`, [id]
    );
    if (!oldRows.length) return res.status(404).json({ error: "Not found" });
    const old = oldRows[0];

    // Update opening_balance record
    await client.query(`
      UPDATE opening_balance
      SET item_id=$1, item_name=$2, unit_of_measure=$3, dept_id=$4, subdept_id=$5,
          opening_qty=$6, opening_date=$7, entered_by=$8
      WHERE id=$9
    `, [item_id, item_name, uom, dept_id, subdeptId,
        Number(opening_qty), opening_date, req.session.user.username, id]);

    // Remove old OP ledger
    await client.query(
      `DELETE FROM stock_ledger WHERE reference_id = $1 AND transaction_type = 'OP'`, [id]
    );

    // ✅ Reverse old opening_qty — filter by dept_id AND subdept_id
    await client.query(`
      UPDATE stock_balance
      SET opening_qty  = GREATEST(0, opening_qty - $1),
          last_updated = NOW()
      WHERE item_id              = $2
        AND dept_id::text        = $3::text
        AND subdept_id IS NOT DISTINCT FROM $4
    `, [Number(old.opening_qty), old.item_id, old.dept_id, old.subdept_id || null]);

    // ✅ Apply new opening_qty — filter by dept_id AND subdept_id
    await client.query(`
      INSERT INTO stock_balance
        (item_id, dept_id, subdept_id, item_name, unit_of_measure, opening_qty, total_in, total_out, last_updated)
      VALUES ($1,$2,$3,$4,$5,$6,0,0,NOW())
      ON CONFLICT (item_id, dept_id, subdept_id) DO UPDATE
        SET opening_qty     = stock_balance.opening_qty + $6,
            item_name       = $4,
            unit_of_measure = $5,
            last_updated    = NOW()
    `, [item_id, dept_id, subdeptId, item_name, uom, Number(opening_qty)]);

    // Fresh OP ledger entry
    await addStockLedger(client, {
      date: opening_date, type: "OP", refId: Number(id), refNumber: "OPENING",
      itemId: item_id, itemName: item_name, uom,
      qtyIn: Number(opening_qty), qtyOut: 0,
      deptId: dept_id, subdeptId,
    });

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/stock/opening-balance/:id error:", err);
    res.status(500).json({ error: "Failed to update opening balance" });
  } finally {
    client.release();
  }
});

// DELETE /api/stock/opening-balance/:id
app.delete("/api/stock/opening-balance/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: oldRows } = await client.query(
      `SELECT * FROM opening_balance WHERE id = $1`, [id]
    );
    if (!oldRows.length) return res.status(404).json({ error: "Not found" });
    const old = oldRows[0];

    // ✅ Reverse opening_qty — filter by dept_id AND subdept_id
    await client.query(`
      UPDATE stock_balance
      SET opening_qty  = GREATEST(0, opening_qty - $1),
          last_updated = NOW()
      WHERE item_id              = $2
        AND dept_id::text        = $3::text
        AND subdept_id IS NOT DISTINCT FROM $4
    `, [Number(old.opening_qty), old.item_id, old.dept_id, old.subdept_id || null]);

    // Delete ledger and record
    await client.query(
      `DELETE FROM stock_ledger WHERE reference_id = $1 AND transaction_type = 'OP'`, [id]
    );
    await client.query(`DELETE FROM opening_balance WHERE id = $1`, [id]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/stock/opening-balance/:id error:", err);
    res.status(500).json({ error: "Failed to delete opening balance" });
  } finally {
    client.release();
  }
});

// ─── Issue ─────────────────────────────────────────────────────────────────────

// GET /api/issue/new-number
app.get("/api/issue/new-number", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query("SELECT generate_issue_number() AS issue_number");
    res.json({ issue_number: rows[0].issue_number });
  } catch (err) {
    console.error("GET /api/issue/new-number error:", err);
    res.status(500).json({ error: "Failed to generate issue number" });
  }
});

// GET /api/issue
app.get("/api/issue", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { dept_id, item_id } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (dept_id) { params.push(dept_id); conditions.push(`ih.to_dept_id::text = $${params.length}::text`); }
    if (item_id) { params.push(item_id); conditions.push(`EXISTS (SELECT 1 FROM issue_details idp WHERE idp.issue_id = ih.id AND idp.item_id::text = $${params.length}::text)`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(`
      SELECT ih.id, ih.issue_number, ih.issue_date, ih.remarks,
             ih.issued_by, ih.created_at,
             ih.from_dept_id, ih.to_dept_id, ih.to_subdept_id,
             fd.dept_name AS from_dept_name,
             td.dept_name AS to_dept_name,
             sd.subdept_name AS to_subdept_name,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'item_name', id2.item_name,
                   'quantity_issued', id2.quantity_issued,
                   'unit_of_measure', id2.unit_of_measure
                 ) ORDER BY id2.id
               ) FILTER (WHERE id2.id IS NOT NULL),
               '[]'
             ) AS items
      FROM issue_header ih
      LEFT JOIN mas_dept fd    ON fd.dept_id::text    = ih.from_dept_id::text
      LEFT JOIN mas_dept td    ON td.dept_id::text    = ih.to_dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text = ih.to_subdept_id::text
      LEFT JOIN issue_details id2 ON id2.issue_id = ih.id
      ${where}
      GROUP BY ih.id, fd.dept_name, td.dept_name, sd.subdept_name
      ORDER BY ih.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/issue error:", err);
    res.status(500).json({ error: "Failed to fetch issues" });
  }
});

// GET /api/issue/:id
app.get("/api/issue/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const headerRes = await client.query(`
      SELECT ih.*,
             fd.dept_name AS from_dept_name,
             td.dept_name AS to_dept_name,
             sd.subdept_name AS to_subdept_name
      FROM issue_header ih
      LEFT JOIN mas_dept fd    ON fd.dept_id::text    = ih.from_dept_id::text
      LEFT JOIN mas_dept td    ON td.dept_id::text    = ih.to_dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text = ih.to_subdept_id::text
      WHERE ih.id = $1
    `, [id]);
    if (!headerRes.rows.length) return res.status(404).json({ error: "Issue not found" });
    const detailsRes = await client.query(
      `SELECT * FROM issue_details WHERE issue_id = $1 ORDER BY id`, [id]
    );
    res.json({ header: headerRes.rows[0], details: detailsRes.rows });
  } catch (err) {
    console.error("GET /api/issue/:id error:", err);
    res.status(500).json({ error: "Failed to fetch issue" });
  } finally {
    client.release();
  }
});

// POST /api/issue
app.post("/api/issue", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { issue_date, to_dept_id, to_subdept_id, remarks, details } = req.body;
  if (!issue_date || !to_dept_id || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const numRes = await client.query("SELECT generate_issue_number() AS issue_number");
    const issue_number = numRes.rows[0].issue_number;
    const headerRes = await client.query(`
      INSERT INTO issue_header (issue_number, issue_date, from_dept_id, to_dept_id, to_subdept_id, remarks, issued_by)
      VALUES ($1,$2,2009,$3,$4,$5,$6)
      RETURNING id
    `, [issue_number, issue_date, to_dept_id, to_subdept_id || null,
        remarks || null, req.session.user.username]);
    const issue_id = headerRes.rows[0].id;

    for (const item of details) {
      const balRes = await client.query(
        `SELECT current_qty FROM stock_balance
         WHERE item_id = $1 AND dept_id::text = '2009' AND subdept_id::text = '200901'`,
        [item.item_id]
      );
      const balAtIssue = balRes.rows[0]?.current_qty || 0;

      await client.query(`
        INSERT INTO issue_details (issue_id, item_id, item_name, quantity_issued, unit_of_measure, stock_balance_at_issue, remarks)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [issue_id, item.item_id, item.item_name, item.quantity_issued,
          item.unit_of_measure || null, balAtIssue, item.remarks || null]);

      // Stock OUT from Stores (dept 2009, subdept 200901)
      await addStockLedger(client, {
        date: issue_date, type: 'ISSUE', refId: issue_id, refNumber: issue_number,
        itemId: item.item_id, itemName: item.item_name, uom: item.unit_of_measure,
        qtyIn: 0, qtyOut: Number(item.quantity_issued),
        deptId: 2009, subdeptId: 200901
      });
      await upsertStockBalance(client, item.item_id, 2009, 200901, item.item_name,
        item.unit_of_measure, 0, Number(item.quantity_issued));

      // Stock IN to receiving dept
      await addStockLedger(client, {
        date: issue_date, type: 'ISSUE', refId: issue_id, refNumber: issue_number,
        itemId: item.item_id, itemName: item.item_name, uom: item.unit_of_measure,
        qtyIn: Number(item.quantity_issued), qtyOut: 0,
        deptId: to_dept_id, subdeptId: to_subdept_id || null
      });
      await upsertStockBalance(client, item.item_id, to_dept_id, to_subdept_id || null,
        item.item_name, item.unit_of_measure, Number(item.quantity_issued), 0);
    }

    await client.query("COMMIT");
    res.json({ success: true, issue_id, issue_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/issue error:", err);
    res.status(500).json({ error: "Failed to create issue" });
  } finally {
    client.release();
  }
});

// PUT /api/issue/:id
app.put("/api/issue/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const { issue_date, to_dept_id, to_subdept_id, remarks, details } = req.body;
  if (!issue_date || !to_dept_id || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: oldHeader } = await client.query(
      `SELECT * FROM issue_header WHERE id = $1`, [id]
    );
    if (!oldHeader.length) return res.status(404).json({ error: "Issue not found" });
    const oldToDept    = oldHeader[0].to_dept_id;
    const oldToSubdept = oldHeader[0].to_subdept_id || null;

    const { rows: oldDetails } = await client.query(
      `SELECT * FROM issue_details WHERE issue_id = $1`, [id]
    );

    // STEP 1 — Reverse old stock balances
    for (const item of oldDetails) {
      // ✅ Undo OUT from Stores: subtract from total_out
      await reverseStockBalance(client, item.item_id, 2009, 200901,
        0, Number(item.quantity_issued));
      // ✅ Undo IN to old receiving dept: subtract from total_in
      await reverseStockBalance(client, item.item_id, oldToDept, oldToSubdept,
        Number(item.quantity_issued), 0);
    }

    // STEP 2 — Delete old ledger, update header, delete old details
    await client.query(
      `DELETE FROM stock_ledger WHERE reference_id = $1 AND transaction_type = 'ISSUE'`, [id]
    );
    await client.query(`
      UPDATE issue_header SET issue_date=$1, to_dept_id=$2, to_subdept_id=$3, remarks=$4 WHERE id=$5
    `, [issue_date, to_dept_id, to_subdept_id || null, remarks || null, id]);
    await client.query(`DELETE FROM issue_details WHERE issue_id = $1`, [id]);

    const { rows: hRows } = await client.query(
      `SELECT issue_number FROM issue_header WHERE id = $1`, [id]
    );
    const issue_number = hRows[0].issue_number;

    // STEP 3 — Insert new details and apply new stock movements
    for (const item of details) {
      const balRes = await client.query(
        `SELECT current_qty FROM stock_balance
         WHERE item_id = $1 AND dept_id::text = '2009' AND subdept_id::text = '200901'`,
        [item.item_id]
      );
      const balAtIssue = balRes.rows[0]?.current_qty || 0;

      await client.query(`
        INSERT INTO issue_details (issue_id, item_id, item_name, quantity_issued, unit_of_measure, stock_balance_at_issue, remarks)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [id, item.item_id, item.item_name, item.quantity_issued,
          item.unit_of_measure || null, balAtIssue, item.remarks || null]);

      // Stock OUT from Stores (dept 2009, subdept 200901)
      await addStockLedger(client, {
        date: issue_date, type: 'ISSUE', refId: id, refNumber: issue_number,
        itemId: item.item_id, itemName: item.item_name, uom: item.unit_of_measure,
        qtyIn: 0, qtyOut: Number(item.quantity_issued),
        deptId: 2009, subdeptId: 200901
      });
      await upsertStockBalance(client, item.item_id, 2009, 200901, item.item_name,
        item.unit_of_measure, 0, Number(item.quantity_issued));

      // Stock IN to receiving dept
      await addStockLedger(client, {
        date: issue_date, type: 'ISSUE', refId: id, refNumber: issue_number,
        itemId: item.item_id, itemName: item.item_name, uom: item.unit_of_measure,
        qtyIn: Number(item.quantity_issued), qtyOut: 0,
        deptId: to_dept_id, subdeptId: to_subdept_id || null
      });
      await upsertStockBalance(client, item.item_id, to_dept_id, to_subdept_id || null,
        item.item_name, item.unit_of_measure, Number(item.quantity_issued), 0);
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/issue/:id error:", err);
    res.status(500).json({ error: "Failed to update issue" });
  } finally {
    client.release();
  }
});

// DELETE /api/issue/:id
app.delete("/api/issue/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: oldHeader } = await client.query(
      `SELECT * FROM issue_header WHERE id = $1`, [id]
    );
    if (!oldHeader.length) return res.status(404).json({ error: "Issue not found" });
    const { rows: oldDetails } = await client.query(
      `SELECT * FROM issue_details WHERE issue_id = $1`, [id]
    );
    const oldToDept    = oldHeader[0].to_dept_id;
    const oldToSubdept = oldHeader[0].to_subdept_id || null;

    for (const item of oldDetails) {
      // ✅ Undo OUT from Stores: subtract from total_out
      await reverseStockBalance(client, item.item_id, 2009, 200901,
        0, Number(item.quantity_issued));
      // ✅ Undo IN to receiving dept: subtract from total_in
      await reverseStockBalance(client, item.item_id, oldToDept, oldToSubdept,
        Number(item.quantity_issued), 0);
    }

    await client.query(
      `DELETE FROM stock_ledger WHERE reference_id = $1 AND transaction_type = 'ISSUE'`, [id]
    );
    await client.query(`DELETE FROM issue_header WHERE id = $1`, [id]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/issue/:id error:", err);
    res.status(500).json({ error: "Failed to delete issue" });
  } finally {
    client.release();
  }
});

// ─── Dept Transfer ─────────────────────────────────────────────────────────────

// GET /api/transfer/new-number
app.get("/api/transfer/new-number", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query("SELECT generate_transfer_number() AS transfer_number");
    res.json({ transfer_number: rows[0].transfer_number });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate transfer number" });
  }
});

// GET /api/transfer — list
app.get("/api/transfer", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT th.id, th.transfer_number, th.transfer_date, th.remarks, th.transferred_by,
             fd.dept_name AS from_dept_name, td.dept_name AS to_dept_name
      FROM dept_transfer_header th
      LEFT JOIN mas_dept fd ON fd.dept_id::text = th.from_dept_id::text
      LEFT JOIN mas_dept td ON td.dept_id::text = th.to_dept_id::text
      ORDER BY th.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transfers" });
  }
});

// GET /api/transfer/:id
app.get("/api/transfer/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const hRes = await client.query(`
      SELECT th.*, fd.dept_name AS from_dept_name, td.dept_name AS to_dept_name
      FROM dept_transfer_header th
      LEFT JOIN mas_dept fd ON fd.dept_id::text = th.from_dept_id::text
      LEFT JOIN mas_dept td ON td.dept_id::text = th.to_dept_id::text
      WHERE th.id = $1
    `, [id]);
    if (!hRes.rows.length) return res.status(404).json({ error: "Transfer not found" });
    const dRes = await client.query(
      `SELECT * FROM dept_transfer_details WHERE transfer_id = $1 ORDER BY id`, [id]
    );
    res.json({ header: hRes.rows[0], details: dRes.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transfer" });
  } finally {
    client.release();
  }
});

// GET /api/stock/items-for-transfer/:dept_id — items with balance for a dept
app.get("/api/stock/items-for-transfer/:dept_id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { dept_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT item_id, item_name, unit_of_measure, current_qty
      FROM stock_balance
      WHERE dept_id::text = $1::text AND current_qty > 0
      ORDER BY item_name
    `, [dept_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch items for transfer" });
  }
});

// POST /api/transfer
app.post("/api/transfer", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { transfer_date, from_dept_id, from_subdept_id, to_dept_id, to_subdept_id, remarks, details } = req.body;
  if (!transfer_date || !from_dept_id || !to_dept_id || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const numRes = await client.query("SELECT generate_transfer_number() AS transfer_number");
    const transfer_number = numRes.rows[0].transfer_number;
    const hRes = await client.query(`
      INSERT INTO dept_transfer_header
        (transfer_number, transfer_date, from_dept_id, from_subdept_id, to_dept_id, to_subdept_id, remarks, transferred_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [transfer_number, transfer_date, from_dept_id, from_subdept_id || null,
        to_dept_id, to_subdept_id || null, remarks || null, req.session.user.username]);
    const transfer_id = hRes.rows[0].id;
    for (const item of details) {
      await client.query(`
        INSERT INTO dept_transfer_details (transfer_id, item_id, item_name, quantity_transferred, unit_of_measure, remarks)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [transfer_id, item.item_id, item.item_name, item.quantity_transferred,
          item.unit_of_measure || null, item.remarks || null]);
      // OUT from source dept
      await addStockLedger(client, {
        date: transfer_date, type: 'TRANSFER', refId: transfer_id, refNumber: transfer_number,
        itemId: item.item_id, itemName: item.item_name, uom: item.unit_of_measure,
        qtyIn: 0, qtyOut: Number(item.quantity_transferred),
        deptId: from_dept_id, subdeptId: from_subdept_id || null
      });
      await upsertStockBalance(client, item.item_id, from_dept_id, item.item_name,
        item.unit_of_measure, 0, Number(item.quantity_transferred));
      // IN to destination dept
      await addStockLedger(client, {
        date: transfer_date, type: 'TRANSFER', refId: transfer_id, refNumber: transfer_number,
        itemId: item.item_id, itemName: item.item_name, uom: item.unit_of_measure,
        qtyIn: Number(item.quantity_transferred), qtyOut: 0,
        deptId: to_dept_id, subdeptId: to_subdept_id || null
      });
      await upsertStockBalance(client, item.item_id, to_dept_id, item.item_name,
        item.unit_of_measure, Number(item.quantity_transferred), 0);
    }
    await client.query("COMMIT");
    res.json({ success: true, transfer_id, transfer_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/transfer error:", err);
    res.status(500).json({ error: "Failed to create transfer" });
  } finally {
    client.release();
  }
});

// DELETE /api/transfer/:id
app.delete("/api/transfer/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: oldH } = await client.query(`SELECT * FROM dept_transfer_header WHERE id = $1`, [id]);
    const { rows: oldD } = await client.query(`SELECT * FROM dept_transfer_details WHERE transfer_id = $1`, [id]);
    for (const item of oldD) {
      await upsertStockBalance(client, item.item_id, oldH[0].from_dept_id, item.item_name,
        item.unit_of_measure, 0, -Number(item.quantity_transferred));
      await upsertStockBalance(client, item.item_id, oldH[0].to_dept_id, item.item_name,
        item.unit_of_measure, -Number(item.quantity_transferred), 0);
    }
    await client.query(`DELETE FROM stock_ledger WHERE reference_id = $1 AND transaction_type = 'TRANSFER'`, [id]);
    await client.query(`DELETE FROM dept_transfer_header WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to delete transfer" });
  } finally {
    client.release();
  }
});


// GET /api/stock/check-availability?dept_id=X&item_id=Y&qty=Z
// Returns whether sufficient stock exists for a given item+dept+qty
app.get("/api/stock/check-availability", async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { dept_id, subdept_id, item_id, qty } = req.query;

  if (!dept_id || !subdept_id || !item_id || qty === undefined) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT COALESCE(current_qty, 0) AS current_qty, item_name, unit_of_measure
      FROM stock_balance
      WHERE item_id = $1 AND dept_id = $2 AND subdept_id = $3
      `,
      [item_id, dept_id, subdept_id]
    );

    const row = rows[0] || {};
    const current_qty = Number(row.current_qty || 0);
    const requested = Number(qty);

    res.json({
      item_id,
      dept_id,
      subdept_id,
      current_qty,
      requested_qty: requested,
      available: current_qty >= requested,
      item_name: row.item_name || null,
      unit_of_measure: row.unit_of_measure || null,
    });
  } catch (err) {
    console.error("GET /api/stock/check-availability error:", err);
    res.status(500).json({ error: "Failed to check stock" });
  }
});

// =============================================
// GATE PASS MODULE
// =============================================

// ─── RGP (Returnable) ────────────────────────────────────────────────────────

app.get("/api/rgp/new-number", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query("SELECT generate_rgp_number() AS rgp_number");
    res.json({ rgp_number: rows[0].rgp_number });
  } catch (err) { res.status(500).json({ error: "Failed to generate RGP number" }); }
});

// GET /api/rgp — list
app.get("/api/rgp", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { status, supplier_id, approval_status, return_status, dept_id } = req.query;

  // Auto-restrict non-privileged users to their own dept
  const PRIVILEGED_TYPES = ["ADMIN", "STORES", "PURCHASE", "APPROVER",];
  const userType = (req.session.user.user_type || "").toUpperCase();
  const effectiveDeptId = !PRIVILEGED_TYPES.includes(userType)
    ? req.session.user.dept_id   // force their own dept
    : dept_id || null;           // privileged: use query param or all


  try {
    const conditions = [];
    const params = [];
    if (status)          { params.push(status);          conditions.push(`rh.status = $${params.length}`); }
    if (approval_status) { params.push(approval_status); conditions.push(`rh.approval_status = $${params.length}`); }
    if (return_status === 'CLOSED')   { conditions.push(`rh.status = 'CLOSED'`); }
    if (return_status === 'UNCLOSED') { conditions.push(`rh.status != 'CLOSED' AND rh.approval_status = 'APPROVED'`); }
    if (supplier_id)     { params.push(supplier_id);     conditions.push(`rh.supplier_id::text = $${params.length}::text`); }
  
   if (effectiveDeptId) { params.push(effectiveDeptId); conditions.push(`rh.dept_id::text = $${params.length}::text`); }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await pool.query(`
      SELECT rh.id, rh.rgp_number, rh.rgp_date, rh.supplier_name, rh.contact_person,
             rh.purpose, rh.expected_return_date, rh.vehicle_no, rh.status,
             rh.dept_id, rh.created_by, rh.created_at,
             rh.approval_status,
             rh.hod_approved_by, rh.hod_approved_at, rh.hod_remarks,
             rh.stores_verified_by, rh.stores_verified_at, rh.stores_remarks,
             rh.admin_approved_by, rh.admin_approved_at, rh.admin_remarks,
             rh.rejected_by, rh.rejected_at, rh.rejected_stage, rh.rejected_remarks,
             d.dept_name,
             COALESCE(JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', rd.id, 'item_name', rd.item_name,
                 'quantity_sent', rd.quantity_sent,
                 'quantity_returned', rd.quantity_returned,
                 'unit_of_measure', rd.unit_of_measure
               ) ORDER BY rd.id
             ) FILTER (WHERE rd.id IS NOT NULL), '[]') AS items
      FROM rgp_header rh
      LEFT JOIN mas_dept d ON d.dept_id::text = rh.dept_id::text
      LEFT JOIN rgp_details rd ON rd.rgp_id = rh.id
      ${where}
      GROUP BY rh.id, d.dept_name
      ORDER BY rh.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/rgp error:", err);
    res.status(500).json({ error: "Failed to fetch RGPs" });
  }
});

// GET /api/rgp/:id
app.get("/api/rgp/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    const hRes = await client.query(`
      SELECT rh.*, d.dept_name, sd.subdept_name
      FROM rgp_header rh
      LEFT JOIN mas_dept d     ON d.dept_id::text     = rh.dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text = rh.subdept_id::text
      WHERE rh.id = $1
    `, [id]);
    if (!hRes.rows.length) return res.status(404).json({ error: "RGP not found" });
    const dRes = await client.query(
      `SELECT * FROM rgp_details WHERE rgp_id = $1 ORDER BY id`, [id]
    );
    res.json({ header: hRes.rows[0], details: dRes.rows });
  } catch (err) {
    console.error("GET /api/rgp/:id error:", err);
    res.status(500).json({ error: "Failed to fetch RGP" });
  } finally { client.release(); }
});

// POST /api/rgp
app.post("/api/rgp", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { rgp_date, supplier_id, supplier_name, contact_person, contact_phone,
          address, purpose, expected_return_date, dept_id, subdept_id, vehicle_no,
          remarks, details } = req.body;
  if (!rgp_date || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const numRes = await client.query("SELECT generate_rgp_number() AS rgp_number");
    const rgp_number = numRes.rows[0].rgp_number;
    const hRes = await client.query(`
      INSERT INTO rgp_header
        (rgp_number, rgp_date, supplier_id, supplier_name, contact_person, contact_phone,
         address, purpose, expected_return_date, dept_id, subdept_id, vehicle_no,
         remarks, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id
    `, [rgp_number, rgp_date, supplier_id || null, supplier_name || null,
        contact_person || null, contact_phone || null, address || null, purpose || null,
        expected_return_date || null, dept_id || null, subdept_id || null,
        vehicle_no || null, remarks || null,
        req.session.user.username]);
    const rgp_id = hRes.rows[0].id;
    for (const item of details) {
      await client.query(`
        INSERT INTO rgp_details (rgp_id, item_id, item_name, unit_of_measure, quantity_sent, remarks)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [rgp_id, item.item_id || null, item.item_name, item.unit_of_measure || null,
          Number(item.quantity_sent), item.remarks || null]);
    }
    await client.query("COMMIT");
    res.json({ success: true, rgp_id, rgp_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/rgp error:", err);
    res.status(500).json({ error: "Failed to create RGP" });
  } finally { client.release(); }
});

// PUT /api/rgp/:id
app.put("/api/rgp/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const { rgp_date, supplier_id, supplier_name, contact_person, contact_phone,
          address, purpose, expected_return_date, dept_id, subdept_id, vehicle_no,
          remarks, details } = req.body;
  if (!rgp_date || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Check DRAFT status before edit
    const { rows: rgpStatus } = await client.query(
      `SELECT approval_status FROM rgp_header WHERE id=$1`, [id]
    );
    if (rgpStatus[0]?.approval_status !== 'DRAFT')
      return res.status(400).json({ error: "Only DRAFT gate passes can be edited" });
    await client.query(`
      UPDATE rgp_header SET
        rgp_date=$1, supplier_id=$2, supplier_name=$3, contact_person=$4, contact_phone=$5,
        address=$6, purpose=$7, expected_return_date=$8, dept_id=$9, subdept_id=$10,
        vehicle_no=$11, remarks=$12
      WHERE id=$13
    `, [rgp_date, supplier_id || null, supplier_name || null, contact_person || null,
        contact_phone || null, address || null, purpose || null, expected_return_date || null,
        dept_id || null, subdept_id || null, vehicle_no || null,
        remarks || null, id]);
    await client.query(`DELETE FROM rgp_details WHERE rgp_id = $1`, [id]);
    for (const item of details) {
      await client.query(`
        INSERT INTO rgp_details (rgp_id, item_id, item_name, unit_of_measure, quantity_sent, remarks)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [id, item.item_id || null, item.item_name, item.unit_of_measure || null,
          Number(item.quantity_sent), item.remarks || null]);
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/rgp/:id error:", err);
    res.status(500).json({ error: "Failed to update RGP" });
  } finally { client.release(); }
});

// DELETE /api/rgp/:id
app.delete("/api/rgp/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: rgpDelCheck } = await client.query(
      `SELECT approval_status FROM rgp_header WHERE id=$1`, [id]
    );
    if (!rgpDelCheck.length) return res.status(404).json({ error: "Not found" });
    if (rgpDelCheck[0].approval_status !== 'DRAFT')
      return res.status(400).json({ error: "Only DRAFT gate passes can be deleted" });
    const { rows } = await client.query(
      `SELECT COUNT(*) FROM rgp_return_header WHERE rgp_id = $1`, [id]
    );
    if (Number(rows[0].count) > 0)
      return res.status(400).json({ error: "Cannot delete — return entries exist for this RGP" });
    await client.query(`DELETE FROM rgp_header WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/rgp/:id error:", err);
    res.status(500).json({ error: "Failed to delete RGP" });
  } finally { client.release(); }
});

// ─── RGP Return ───────────────────────────────────────────────────────────────

app.get("/api/rgp-return/new-number", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query("SELECT generate_rgp_return_number() AS return_number");
    res.json({ return_number: rows[0].return_number });
  } catch (err) { res.status(500).json({ error: "Failed to generate return number" }); }
});

// GET /api/rgp-return/:rgp_id — returns for a specific RGP
app.get("/api/rgp-return/:rgp_id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { rgp_id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT rr.*, rd2.item_name, rd2.unit_of_measure, rd2.quantity_returned AS detail_qty
      FROM rgp_return_header rr
      LEFT JOIN rgp_return_details rrd ON rrd.return_id = rr.id
      LEFT JOIN rgp_details rd2 ON rd2.id = rrd.rgp_detail_id
      WHERE rr.rgp_id = $1
      ORDER BY rr.created_at DESC
    `, [rgp_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch returns" }); }
});

// POST /api/rgp-return — record return
app.post("/api/rgp-return", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { rgp_id, return_date, remarks, details } = req.body;
  if (!rgp_id || !return_date || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const numRes = await client.query("SELECT generate_rgp_return_number() AS return_number");
    const return_number = numRes.rows[0].return_number;
    const hRes = await client.query(`
      INSERT INTO rgp_return_header (return_number, return_date, rgp_id, remarks, received_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [return_number, return_date, rgp_id, remarks || null, req.session.user.username]);
    const return_id = hRes.rows[0].id;
    for (const item of details) {
      if (!Number(item.quantity_returned)) continue;
      await client.query(`
        INSERT INTO rgp_return_details (return_id, rgp_detail_id, item_name, unit_of_measure, quantity_returned, remarks)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [return_id, item.rgp_detail_id, item.item_name, item.unit_of_measure || null,
          Number(item.quantity_returned), item.remarks || null]);
      // Update quantity_returned on rgp_details
      await client.query(`
        UPDATE rgp_details
        SET quantity_returned = quantity_returned + $1
        WHERE id = $2
      `, [Number(item.quantity_returned), item.rgp_detail_id]);
    }
    // Recalculate RGP status
    const { rows: detailRows } = await client.query(
      `SELECT quantity_sent, quantity_returned FROM rgp_details WHERE rgp_id = $1`, [rgp_id]
    );
    const totalSent     = detailRows.reduce((s, r) => s + Number(r.quantity_sent), 0);
    const totalReturned = detailRows.reduce((s, r) => s + Number(r.quantity_returned), 0);
    const newStatus = totalReturned <= 0 ? 'OPEN'
      : totalReturned >= totalSent ? 'CLOSED' : 'PARTIALLY_RETURNED';
    await client.query(`UPDATE rgp_header SET status = $1 WHERE id = $2`, [newStatus, rgp_id]);
    await client.query("COMMIT");
    res.json({ success: true, return_id, return_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/rgp-return error:", err);
    res.status(500).json({ error: "Failed to record return" });
  } finally { client.release(); }
});

// ─── NRGP (Non-Returnable) ────────────────────────────────────────────────────

app.get("/api/nrgp/new-number", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query("SELECT generate_nrgp_number() AS nrgp_number");
    res.json({ nrgp_number: rows[0].nrgp_number });
  } catch (err) { res.status(500).json({ error: "Failed to generate NRGP number" }); }
});

// GET /api/nrgp — list
app.get("/api/nrgp", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  
  const { reason, supplier_id, status, dept_id } = req.query; // ✅ added dept_id

  // Auto-restrict non-privileged users to their own dept
  const PRIVILEGED_TYPES = ["ADMIN", "STORES", "PURCHASE", "APPROVER"];
  const userType = (req.session.user.user_type || "").toUpperCase();
  const effectiveDeptId = !PRIVILEGED_TYPES.includes(userType)
    ? req.session.user.dept_id  // force their own dept
    : dept_id || null;          // privileged: use query param or all

  try {
    const conditions = [];
    const params = [];
    if (reason)          { params.push(reason);      conditions.push(`nh.reason = $${params.length}`); }
    if (supplier_id)     { params.push(supplier_id); conditions.push(`nh.supplier_id::text = $${params.length}::text`); }
    if (status)          { params.push(status);      conditions.push(`nh.approval_status = $${params.length}`); }
    if (effectiveDeptId) { params.push(effectiveDeptId); conditions.push(`nh.dept_id::text = $${params.length}::text`); } // ✅ added

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await pool.query(`
      SELECT nh.id, nh.nrgp_number, nh.nrgp_date, nh.supplier_name, nh.contact_person,
             nh.reason, nh.vehicle_no, nh.dept_id, nh.created_by, nh.created_at,
             nh.approval_status, nh.stock_deducted,
             nh.hod_approved_by, nh.hod_approved_at, nh.hod_remarks,
             nh.stores_verified_by, nh.stores_verified_at, nh.stores_remarks,
             nh.admin_approved_by, nh.admin_approved_at, nh.admin_remarks,
             nh.rejected_by, nh.rejected_at, nh.rejected_stage, nh.rejected_remarks,
             d.dept_name,
             COALESCE(JSON_AGG(
               JSON_BUILD_OBJECT(
                 'item_name', nd.item_name,
                 'quantity', nd.quantity,
                 'unit_of_measure', nd.unit_of_measure
               ) ORDER BY nd.id
             ) FILTER (WHERE nd.id IS NOT NULL), '[]') AS items
      FROM nrgp_header nh
      LEFT JOIN mas_dept d ON d.dept_id::text = nh.dept_id::text
      LEFT JOIN nrgp_details nd ON nd.nrgp_id = nh.id
      ${where}
      GROUP BY nh.id, d.dept_name
      ORDER BY nh.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/nrgp error:", err);
    res.status(500).json({ error: "Failed to fetch NRGPs" });
  }
});

// GET /api/nrgp/:id
app.get("/api/nrgp/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    const hRes = await client.query(`
      SELECT nh.*, d.dept_name, sd.subdept_name
      FROM nrgp_header nh
      LEFT JOIN mas_dept d     ON d.dept_id::text     = nh.dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text = nh.subdept_id::text
      WHERE nh.id = $1
    `, [id]);
    if (!hRes.rows.length) return res.status(404).json({ error: "NRGP not found" });
    const dRes = await client.query(
      `SELECT * FROM nrgp_details WHERE nrgp_id = $1 ORDER BY id`, [id]
    );
    res.json({ header: hRes.rows[0], details: dRes.rows });
  } catch (err) {
    console.error("GET /api/nrgp/:id error:", err);
    res.status(500).json({ error: "Failed to fetch NRGP" });
  } finally { client.release(); }
});

// POST /api/nrgp
app.post("/api/nrgp", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { nrgp_date, supplier_id, supplier_name, contact_person, contact_phone,
          address, reason, dept_id, subdept_id, vehicle_no, remarks, details } = req.body;
  if (!nrgp_date || !reason || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const numRes = await client.query("SELECT generate_nrgp_number() AS nrgp_number");
    const nrgp_number = numRes.rows[0].nrgp_number;
    const hRes = await client.query(`
      INSERT INTO nrgp_header
        (nrgp_number, nrgp_date, supplier_id, supplier_name, contact_person, contact_phone,
         address, reason, dept_id, subdept_id, vehicle_no, remarks, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `, [nrgp_number, nrgp_date, supplier_id || null, supplier_name || null,
        contact_person || null, contact_phone || null, address || null, reason,
        dept_id || null, subdept_id || null, vehicle_no || null,
        remarks || null, req.session.user.username]);
    const nrgp_id = hRes.rows[0].id;
    for (const item of details) {
      await client.query(`
        INSERT INTO nrgp_details (nrgp_id, item_id, item_name, unit_of_measure, quantity, remarks)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [nrgp_id, item.item_id || null, item.item_name, item.unit_of_measure || null,
          Number(item.quantity), item.remarks || null]);
      // Stock deduction happens only on Admin final approval — not on create
    }
    await client.query("COMMIT");
    res.json({ success: true, nrgp_id, nrgp_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/nrgp error:", err);
    res.status(500).json({ error: "Failed to create NRGP" });
  } finally { client.release(); }
});

// PUT /api/nrgp/:id
app.put("/api/nrgp/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const { nrgp_date, supplier_id, supplier_name, contact_person, contact_phone,
          address, reason, dept_id, subdept_id, vehicle_no, remarks, details } = req.body;
  if (!nrgp_date || !reason || !details?.length)
    return res.status(400).json({ error: "Missing required fields" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      UPDATE nrgp_header SET
        nrgp_date=$1, supplier_id=$2, supplier_name=$3, contact_person=$4, contact_phone=$5,
        address=$6, reason=$7, dept_id=$8, subdept_id=$9, vehicle_no=$10, remarks=$11
      WHERE id=$12
    `, [nrgp_date, supplier_id || null, supplier_name || null, contact_person || null,
        contact_phone || null, address || null, reason, dept_id || null, subdept_id || null,
        vehicle_no || null, remarks || null, id]);
    // Edit only allowed in DRAFT — no stock movement yet
    const { rows: statusCheck } = await client.query(
      `SELECT approval_status FROM nrgp_header WHERE id=$1`, [id]
    );
    if (statusCheck[0]?.approval_status !== 'DRAFT')
      return res.status(400).json({ error: "Only DRAFT gate passes can be edited" });
    await client.query(`DELETE FROM nrgp_details WHERE nrgp_id = $1`, [id]);
    for (const item of details) {
      await client.query(`
        INSERT INTO nrgp_details (nrgp_id, item_id, item_name, unit_of_measure, quantity, remarks)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [id, item.item_id || null, item.item_name, item.unit_of_measure || null,
          Number(item.quantity), item.remarks || null]);
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/nrgp/:id error:", err);
    res.status(500).json({ error: "Failed to update NRGP" });
  } finally { client.release(); }
});

// DELETE /api/nrgp/:id
app.delete("/api/nrgp/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Only DRAFT can be deleted by requestor
    const { rows: delCheck } = await client.query(
      `SELECT approval_status, created_by FROM nrgp_header WHERE id=$1`, [id]
    );
    if (!delCheck.length) return res.status(404).json({ error: "Not found" });
    if (delCheck[0].approval_status !== 'DRAFT')
      return res.status(400).json({ error: "Only DRAFT gate passes can be deleted" });
    // No stock reversal needed — stock only moves on Admin approval
    await client.query(`DELETE FROM nrgp_header WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/nrgp/:id error:", err);
    res.status(500).json({ error: "Failed to delete NRGP" });
  } finally { client.release(); }
});

// =============================================
// GATE PASS APPROVAL ROUTES
// =============================================

// Approval status constants (same order as workflow):
// DRAFT → PENDING_HOD → HOD_APPROVED → STORES_VERIFIED → APPROVED → REJECTED

// Helper: check gate pass approval permission
function gpCanAct(userType, stage) {
  const t = (userType || "").toUpperCase();
  if (stage === "HOD_APPROVE")   return ["ADMIN","HOD"].includes(t);
  if (stage === "STORES_VERIFY") return ["ADMIN","STORES","PURCHASE"].includes(t);
  if (stage === "ADMIN_APPROVE") return ["ADMIN", "APPROVER"].includes(t);
  return false;
}

// ── RGP Approval ─────────────────────────────────────────────────────────────

// POST /api/rgp/:id/submit  — Requestor submits draft for HOD approval
app.post("/api/rgp/:id/submit", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(`SELECT approval_status, created_by FROM rgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "DRAFT") return res.status(400).json({ error: "Only DRAFT can be submitted" });
    // Only creator or admin can submit
    const user = req.session.user;
    if (user.user_type.toUpperCase() !== "ADMIN" && rows[0].created_by !== user.username)
      return res.status(403).json({ error: "Only the creator can submit this gate pass" });
    await pool.query(`UPDATE rgp_header SET approval_status='PENDING_HOD' WHERE id=$1`, [id]);
    res.json({ success: true, approval_status: "PENDING_HOD" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to submit" }); }
});

// POST /api/rgp/:id/hod-approve
app.post("/api/rgp/:id/hod-approve", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!gpCanAct(req.session.user.user_type, "HOD_APPROVE"))
    return res.status(403).json({ error: "Not authorized" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  try {
    const { rows } = await pool.query(`SELECT approval_status FROM rgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "PENDING_HOD") return res.status(400).json({ error: "Invalid status for HOD approval" });
    await pool.query(`
      UPDATE rgp_header SET
        approval_status='HOD_APPROVED',
        hod_approved_by=$1, hod_approved_at=NOW(), hod_remarks=$2
      WHERE id=$3
    `, [req.session.user.username, remarks || null, id]);
    res.json({ success: true, approval_status: "HOD_APPROVED" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /api/rgp/:id/stores-verify
app.post("/api/rgp/:id/stores-verify", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!gpCanAct(req.session.user.user_type, "STORES_VERIFY"))
    return res.status(403).json({ error: "Not authorized" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  try {
    const { rows } = await pool.query(`SELECT approval_status FROM rgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "HOD_APPROVED") return res.status(400).json({ error: "Invalid status for Stores verification" });
    await pool.query(`
      UPDATE rgp_header SET
        approval_status='STORES_VERIFIED',
        stores_verified_by=$1, stores_verified_at=NOW(), stores_remarks=$2
      WHERE id=$3
    `, [req.session.user.username, remarks || null, id]);
    res.json({ success: true, approval_status: "STORES_VERIFIED" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /api/rgp/:id/admin-approve
app.post("/api/rgp/:id/admin-approve", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!gpCanAct(req.session.user.user_type, "ADMIN_APPROVE"))
    return res.status(403).json({ error: "Not authorized Admin" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  try {
    const { rows } = await pool.query(`SELECT approval_status FROM rgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "STORES_VERIFIED") return res.status(400).json({ error: "Invalid status for Admin approval" });
    await pool.query(`
      UPDATE rgp_header SET
        approval_status='APPROVED',
        admin_approved_by=$1, admin_approved_at=NOW(), admin_remarks=$2
      WHERE id=$3
    `, [req.session.user.username, remarks || null, id]);
    // RGP: no stock impact — items going out temporarily
    res.json({ success: true, approval_status: "APPROVED" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /api/rgp/:id/reject
app.post("/api/rgp/:id/reject", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  const user = req.session.user;
  const t = (user.user_type || "").toUpperCase();
  if (!["ADMIN","HOD","STORES","PURCHASE"].includes(t))
    return res.status(403).json({ error: "Not authorized to reject" });
  try {
    const { rows } = await pool.query(`SELECT approval_status FROM rgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const rejectable = ["PENDING_HOD","HOD_APPROVED","STORES_VERIFIED"];
    if (!rejectable.includes(rows[0].approval_status))
      return res.status(400).json({ error: "Cannot reject at this stage" });
    await pool.query(`
      UPDATE rgp_header SET
        approval_status='REJECTED',
        rejected_by=$1, rejected_at=NOW(),
        rejected_stage=$2, rejected_remarks=$3
      WHERE id=$4
    `, [user.username, rows[0].approval_status, remarks || null, id]);
    res.json({ success: true, approval_status: "REJECTED" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── NRGP Approval ─────────────────────────────────────────────────────────────

// POST /api/nrgp/:id/submit
app.post("/api/nrgp/:id/submit", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(`SELECT approval_status, created_by FROM nrgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "DRAFT") return res.status(400).json({ error: "Only DRAFT can be submitted" });
    const user = req.session.user;
    if (user.user_type.toUpperCase() !== "ADMIN" && rows[0].created_by !== user.username)
      return res.status(403).json({ error: "Only the creator can submit this gate pass" });
    await pool.query(`UPDATE nrgp_header SET approval_status='PENDING_HOD' WHERE id=$1`, [id]);
    res.json({ success: true, approval_status: "PENDING_HOD" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to submit" }); }
});

// POST /api/nrgp/:id/hod-approve
app.post("/api/nrgp/:id/hod-approve", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!gpCanAct(req.session.user.user_type, "HOD_APPROVE"))
    return res.status(403).json({ error: "Not authorized" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  try {
    const { rows } = await pool.query(`SELECT approval_status FROM nrgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "PENDING_HOD") return res.status(400).json({ error: "Invalid status for HOD approval" });
    await pool.query(`
      UPDATE nrgp_header SET
        approval_status='HOD_APPROVED',
        hod_approved_by=$1, hod_approved_at=NOW(), hod_remarks=$2
      WHERE id=$3
    `, [req.session.user.username, remarks || null, id]);
    res.json({ success: true, approval_status: "HOD_APPROVED" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /api/nrgp/:id/stores-verify
app.post("/api/nrgp/:id/stores-verify", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!gpCanAct(req.session.user.user_type, "STORES_VERIFY"))
    return res.status(403).json({ error: "Not authorized" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  try {
    const { rows } = await pool.query(`SELECT approval_status FROM nrgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "HOD_APPROVED") return res.status(400).json({ error: "Invalid status for Stores verification" });
    await pool.query(`
      UPDATE nrgp_header SET
        approval_status='STORES_VERIFIED',
        stores_verified_by=$1, stores_verified_at=NOW(), stores_remarks=$2
      WHERE id=$3
    `, [req.session.user.username, remarks || null, id]);
    res.json({ success: true, approval_status: "STORES_VERIFIED" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /api/nrgp/:id/admin-approve  — triggers stock deduction
app.post("/api/nrgp/:id/admin-approve", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!gpCanAct(req.session.user.user_type, "ADMIN_APPROVE"))
    return res.status(403).json({ error: "Not authorized" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT approval_status, stock_deducted, nrgp_number, nrgp_date,
              dept_id, subdept_id
       FROM nrgp_header WHERE id=$1`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].approval_status !== "STORES_VERIFIED")
      return res.status(400).json({ error: "Invalid status for Admin approval" });

    await client.query(`
      UPDATE nrgp_header SET
        approval_status='APPROVED',
        admin_approved_by=$1, admin_approved_at=NOW(), admin_remarks=$2,
        stock_deducted=TRUE
      WHERE id=$3
    `, [req.session.user.username, remarks || null, id]);

    // Deduct stock only once on final admin approval
    if (!rows[0].stock_deducted) {
      const deptId    = rows[0].dept_id;
      const subdeptId = rows[0].subdept_id || null;

console.log("NRGP dept_id from header:", deptId);  // ← add this
console.log("Full row:", rows[0]);                  // ← add this


      const { rows: details } = await client.query(
        `SELECT * FROM nrgp_details WHERE nrgp_id=$1`, [id]
      );
      for (const item of details) {
console.log("Deducting item:", item.item_name, "deptId:", deptId); // ← add this
        await upsertStockBalance(
          client, item.item_id, deptId, subdeptId, item.item_name,
          item.unit_of_measure, 0, Number(item.quantity)
        );
        await addStockLedger(client, {
          date:      rows[0].nrgp_date,
          type:      "NRGP",
          refId:     id,
          refNumber: rows[0].nrgp_number,
          itemId:    item.item_id,
          itemName:  item.item_name,
          uom:       item.unit_of_measure,
          qtyIn:     0,
          qtyOut:    Number(item.quantity),
          deptId:    deptId,
          subdeptId: subdeptId,
        });
      }
    }

    await client.query("COMMIT");
    res.json({ success: true, approval_status: "APPROVED" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("NRGP admin-approve error:", err);
    res.status(500).json({ error: "Failed" });
  } finally { client.release(); }
});

// POST /api/nrgp/:id/reject
app.post("/api/nrgp/:id/reject", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  const { remarks } = req.body;
  const user = req.session.user;
  const t = (user.user_type || "").toUpperCase();
  if (!["ADMIN","HOD","STORES","PURCHASE"].includes(t))
    return res.status(403).json({ error: "Not authorized to reject" });
  try {
    const { rows } = await pool.query(`SELECT approval_status FROM nrgp_header WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const rejectable = ["PENDING_HOD","HOD_APPROVED","STORES_VERIFIED"];
    if (!rejectable.includes(rows[0].approval_status))
      return res.status(400).json({ error: "Cannot reject at this stage" });
    await pool.query(`
      UPDATE nrgp_header SET
        approval_status='REJECTED',
        rejected_by=$1, rejected_at=NOW(),
        rejected_stage=$2, rejected_remarks=$3
      WHERE id=$4
    `, [user.username, rows[0].approval_status, remarks || null, id]);
    // No stock reversal needed — stock is only deducted on APPROVED
    res.json({ success: true, approval_status: "REJECTED" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// =============================================
// DEPARTMENT & SUB-DEPARTMENT MASTER CRUD
// =============================================

// ── Department ───────────────────────────────────────────────────────────────

// GET /api/department/all  — all depts with subdept count
app.get("/api/department/all", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT d.dept_id, d.dept_name,
             COUNT(s.subdept_id)::int AS subdept_count
      FROM mas_dept d
      LEFT JOIN mas_subdept s ON s.dept_id = d.dept_id
      GROUP BY d.dept_id, d.dept_name
      ORDER BY d.dept_id
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/department/all error:", err);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

// POST /api/department  — create new dept
// dept_id is VARCHAR(10) — auto-generate next ID in selected range
app.post("/api/department", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const { dept_name, dept_range } = req.body; // dept_range: 'academic'(1xxx) or 'admin'(2xxx)
  if (!dept_name?.trim()) return res.status(400).json({ error: "Department name is required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const range_start = dept_range === "admin" ? 2001 : 1001;
    const range_end   = dept_range === "admin" ? 2999 : 1999;
    // dept_id stored as VARCHAR — cast to int for comparison
    const { rows } = await client.query(`
      SELECT COALESCE(MAX(dept_id::int), $1 - 1) + 1 AS next_id
      FROM mas_dept
      WHERE dept_id ~ '^[0-9]+$'
        AND dept_id::int BETWEEN $1 AND $2
    `, [range_start, range_end]);
    const next_id = Number(rows[0].next_id);
    if (next_id > range_end)
      return res.status(400).json({ error: "Department ID range exhausted" });
    const dept_id = String(next_id);
    await client.query(
      `INSERT INTO mas_dept (dept_id, dept_name) VALUES ($1, $2)`,
      [dept_id, dept_name.trim()]
    );
    await client.query("COMMIT");
    res.json({ success: true, dept_id, dept_name: dept_name.trim() });
  } catch (err) {
    await client.query("ROLLBACK");
     if (err.code === "23505") {
      if (err.constraint === "uq_dept_name")
        return res.status(409).json({ error: `A department named "${dept_name.trim()}" already exists.` });
      return res.status(409).json({ error: "Duplicate value violates a unique constraint." });
    }
    console.error("POST /api/department error:", err);
    res.status(500).json({ error: "Failed to create department" });
  } finally { client.release(); }
});

// PUT /api/department/:id  — rename dept (dept_id is VARCHAR)
app.put("/api/department/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const id = req.params.id; // keep as string — VARCHAR primary key
  const { dept_name } = req.body;
  if (!dept_name?.trim()) return res.status(400).json({ error: "Department name is required" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE mas_dept SET dept_name = $1 WHERE dept_id = $2`,
      [dept_name.trim(), id]
    );
    if (!rowCount) return res.status(404).json({ error: "Department not found" });
    res.json({ success: true });
   } catch (err) {
    if (err.code === "23505") {
      if (err.constraint === "uq_dept_name")
        return res.status(409).json({ error: `A department named "${dept_name.trim()}" already exists.` });
      return res.status(409).json({ error: "Duplicate value violates a unique constraint." });
    }
    console.error("PUT /api/department/:id error:", err);
    res.status(500).json({ error: "Failed to update department" });
  }
});

// DELETE /api/department/:id (dept_id is VARCHAR)
app.delete("/api/department/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const id = req.params.id; // VARCHAR — keep as string
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT COUNT(*) FROM mas_subdept WHERE dept_id = $1`, [id]
    );
    if (Number(rows[0].count) > 0)
      return res.status(400).json({ error: "Cannot delete — sub-departments exist. Delete sub-departments first." });
    await client.query(`DELETE FROM mas_dept WHERE dept_id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/department/:id error:", err);
    res.status(500).json({ error: "Failed to delete department" });
  } finally { client.release(); }
});

// ── Sub-Department ────────────────────────────────────────────────────────────

// GET /api/subdepartments/all — dept_id VARCHAR in both tables, subdept_id INTEGER
app.get("/api/subdepartments/all", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { dept_id } = req.query;
  try {
    const conditions = dept_id ? `WHERE s.dept_id = $1` : "";
    const params     = dept_id ? [String(dept_id)] : [];
    const { rows } = await pool.query(`
      SELECT s.subdept_id, s.dept_id, s.subdept_name, d.dept_name
      FROM mas_subdept s
      JOIN mas_dept d ON d.dept_id = s.dept_id
      ${conditions}
      ORDER BY s.dept_id, s.subdept_id
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/subdepartments/all error:", err);
    res.status(500).json({ error: "Failed to fetch sub-departments" });
  }
});

// POST /api/subdepartment — dept_id VARCHAR, subdept_id INTEGER (auto from dept base)
// subdept_id pattern: dept_id(numeric) * 100 + sequence e.g. dept 1001 → 100101,100102...
app.post("/api/subdepartment", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const { dept_id, subdept_name } = req.body;
  if (!dept_id || !subdept_name?.trim())
    return res.status(400).json({ error: "Department and sub-department name are required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Verify dept exists (dept_id is VARCHAR)
    const { rows: dRows } = await client.query(
      `SELECT dept_id FROM mas_dept WHERE dept_id = $1`, [String(dept_id)]
    );
    if (!dRows.length) return res.status(400).json({ error: "Department not found" });
    // Auto-generate subdept_id: base = dept_id_numeric * 100, then +1 from max
    const base = Number(dept_id) * 100;
    const { rows: idRows } = await client.query(`
      SELECT COALESCE(MAX(subdept_id), $1) + 1 AS next_id
      FROM mas_subdept
      WHERE subdept_id BETWEEN $1 AND $2
    `, [base, base + 99]);
    const subdept_id = idRows[0].next_id;
    await client.query(
      `INSERT INTO mas_subdept (subdept_id, dept_id, subdept_name) VALUES ($1, $2, $3)`,
      [subdept_id, String(dept_id), subdept_name.trim()]
    );
    await client.query("COMMIT");
    res.json({ success: true, subdept_id, dept_id: String(dept_id), subdept_name: subdept_name.trim() });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      if (err.constraint === "uq_subdept_dept_name")
        return res.status(409).json({ error: `"${subdept_name.trim()}" already exists in this department.` });
      return res.status(409).json({ error: "Duplicate value violates a unique constraint." });
    }
    console.error("POST /api/subdepartment error:", err);
    res.status(500).json({ error: "Failed to create sub-department" });
  } finally { client.release(); }
});

// PUT /api/subdepartment/:id — subdept_id INTEGER, dept_id VARCHAR
app.put("/api/subdepartment/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const id = Number(req.params.id); // subdept_id is INTEGER
  const { subdept_name, dept_id } = req.body;
  if (!subdept_name?.trim()) return res.status(400).json({ error: "Sub-department name is required" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE mas_subdept SET subdept_name = $1, dept_id = $2 WHERE subdept_id = $3`,
      [subdept_name.trim(), String(dept_id), id]
    );
    if (!rowCount) return res.status(404).json({ error: "Sub-department not found" });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "23505") {
      if (err.constraint === "uq_subdept_dept_name")
        return res.status(409).json({ error: `"${subdept_name.trim()}" already exists in this department.` });
      return res.status(409).json({ error: "Duplicate value violates a unique constraint." });
    }
    console.error("PUT /api/subdepartment/:id error:", err);
    res.status(500).json({ error: "Failed to update sub-department" });
  }
});

// DELETE /api/subdepartment/:id — subdept_id INTEGER
app.delete("/api/subdepartment/:id", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const id = Number(req.params.id); // subdept_id is INTEGER
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM mas_subdept WHERE subdept_id = $1`, [id]
    );
    if (!rowCount) return res.status(404).json({ error: "Sub-department not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/subdepartment/:id error:", err);
    res.status(500).json({ error: "Failed to delete sub-department" });
  }
});

// =============================================
// CATEGORY MASTER CRUD
// mas_cat: cat_code VARCHAR(20) PK, category VARCHAR(30),
//          category_type VARCHAR(30), description VARCHAR(255),
//          active BOOLEAN, created_at TIMESTAMP
// =============================================

// GET /api/mas-cat — all categories
app.get("/api/mas-cat", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(`
      SELECT cat_code, category, category_type, description, active, created_at
      FROM mas_cat
      ORDER BY cat_code
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/mas-cat error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/mas-cat/types — distinct category_types
app.get("/api/mas-cat/types", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT category_type FROM mas_cat ORDER BY category_type`
    );
    res.json(rows.map(r => r.category_type));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch types" });
  }
});

// POST /api/mas-cat — create new category (admin only)
app.post("/api/mas-cat", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const { cat_code, category, category_type, description, active } = req.body;
  if (!cat_code?.trim() || !category?.trim() || !category_type?.trim())
    return res.status(400).json({ error: "cat_code, category and category_type are required" });
  try {
    await pool.query(`
      INSERT INTO mas_cat (cat_code, category, category_type, description, active, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [cat_code.trim(), category.trim(), category_type.trim(),
        description?.trim() || null, active !== false]);
    res.json({ success: true, cat_code: cat_code.trim() });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Category code already exists" });
    console.error("POST /api/mas-cat error:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/mas-cat/:code — update category
// NOTE: cat_code is NEVER changed — it is the PK linked to mas_item.cat_code
// Only category name, type, description, and active can be updated
app.put("/api/mas-cat/:code", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const code = req.params.code;
  const { category, category_type, description, active } = req.body;
  // cat_code intentionally excluded from update
  if (!category?.trim() || !category_type?.trim())
    return res.status(400).json({ error: "category and category_type are required" });
  try {
    const { rowCount } = await pool.query(`
      UPDATE mas_cat
      SET category=$1, category_type=$2, description=$3, active=$4
      WHERE cat_code=$5
    `, [category.trim(), category_type.trim(), description?.trim() || null,
        active !== false, code]);
    if (!rowCount) return res.status(404).json({ error: "Category not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/mas-cat/:code error:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/mas-cat/:code — soft delete (set active=false) or hard delete
app.delete("/api/mas-cat/:code", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const code = req.params.code;
  try {
    // Check if any items use this category
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM mas_item WHERE cat_code = $1`, [code]
    );
    if (Number(rows[0].count) > 0)
      return res.status(400).json({
        error: `Cannot delete — ${rows[0].count} item(s) use this category. Deactivate instead.`
      });
    await pool.query(`DELETE FROM mas_cat WHERE cat_code = $1`, [code]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/mas-cat/:code error:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// PATCH /api/mas-cat/:code/toggle — toggle active status
app.patch("/api/mas-cat/:code/toggle", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.user.user_type?.toUpperCase() !== "ADMIN")
    return res.status(403).json({ error: "Admin only" });
  const code = req.params.code;
  try {
    const { rows } = await pool.query(
      `UPDATE mas_cat SET active = NOT active WHERE cat_code=$1 RETURNING active`, [code]
    );
    if (!rows.length) return res.status(404).json({ error: "Category not found" });
    res.json({ success: true, active: rows[0].active });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle status" });
  }
});

// GET /api/mas-cat/next-code?type=Non-Consumable|Consumable
// Non-Consumable range: 10001–19999, Consumable range: 20001–29999
app.get("/api/mas-cat/next-code", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  const { type } = req.query;
  const isConsumable = String(type || "").toLowerCase().includes("consumable")
    && !String(type || "").toLowerCase().includes("non");
  const range_start = isConsumable ? 20001 : 10001;
  const range_end   = isConsumable ? 29999 : 19999;
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(MAX(cat_code::int), $1 - 1) + 1 AS next_code
      FROM mas_cat
      WHERE cat_code ~ '^[0-9]+$'
        AND cat_code::int BETWEEN $1 AND $2
    `, [range_start, range_end]);
    const next = Number(rows[0].next_code);
    if (next > range_end)
      return res.status(400).json({ error: "Category code range exhausted for this type" });
    res.json({ next_code: String(next) });
  } catch (err) {
    console.error("GET /api/mas-cat/next-code error:", err);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

// POST /api/mas-cat/suggest — returns category list for frontend AI call
// Frontend calls Anthropic directly — no API key needed on server
app.post("/api/mas-cat/suggest", async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(
      `SELECT cat_code, category, category_type, description FROM mas_cat WHERE active=true ORDER BY cat_code`
    );
    res.json({ categories: rows });
  } catch (err) {
    console.error("POST /api/mas-cat/suggest error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});


// ============================================================
// Setting - Backup
// ============================================================
// ── helpers ───────────────────────────────────────────────────────────────────

function getPgDumpPath() {
  return (
    process.env.PG_DUMP_PATH ||
    (process.platform === "win32"
      ? "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"
      : "pg_dump")
  );
}

function getBackupDir() {
  const dir =
    process.env.PG_BACKUP_DIR ||
    (process.platform === "win32" ? "D:\\PostgresBackup" : "/tmp/pg_backup");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function listRecentBackups(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return {
          name:    f,
          size:    stat.size,
          created: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => b.created.localeCompare(a.created))
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ── GET /api/backup — list recent backups ─────────────────────────────────────
app.get("/api/backup", requireAuth, (req, res) => {
  const backupDir = getBackupDir();

  // ?download=filename.sql → stream the file
  const fileName = req.query.download;
  if (fileName) {
    const filePath = path.join(backupDir, path.basename(fileName)); // basename = no path traversal
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    return res.download(filePath, path.basename(filePath));
  }

  // default → return list
  return res.json({ backups: listRecentBackups(backupDir) });
});

// ── POST /api/backup — run pg_dump ────────────────────────────────────────────
app.post("/api/backup", requireAuth, (req, res) => {
  const pgDump    = getPgDumpPath();
  const backupDir = getBackupDir();
  const dbName    = process.env.PGDATABASE || "your_database";
  const dbUser    = process.env.PGUSER     || "postgres";
  const dbHost    = process.env.PGHOST     || "localhost";
  const dbPort    = process.env.PGPORT     || "5432";

  const fileName = `backup_${buildTimestamp()}.sql`;
  const filePath = path.join(backupDir, fileName);

  const command =
    process.platform === "win32"
      ? `"${pgDump}" -U ${dbUser} -h ${dbHost} -p ${dbPort} ${dbName} > "${filePath}"`
      : `${pgDump} -U ${dbUser} -h ${dbHost} -p ${dbPort} ${dbName} > "${filePath}"`;

  exec(command, { env: { ...process.env } }, (error, _stdout, stderr) => {
    if (error) {
      console.error("❌ pg_dump error:", stderr || error.message);
      return res.status(500).json({
        error:  "Backup failed",
        detail: stderr || error.message,
      });
    }

    const stat = fs.statSync(filePath);
    return res.json({
      success:   true,
      fileName,
      filePath,
      sizeBytes: stat.size,
      created:   stat.birthtime.toISOString(),
    });
  });
});

// ── DELETE /api/backup — delete a backup file ─────────────────────────────────
app.delete("/api/backup", requireAuth, (req, res) => {
  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: "fileName is required" });
  }

  const filePath = path.join(getBackupDir(), path.basename(fileName));
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    fs.unlinkSync(filePath);
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete backup error:", err.message);
    return res.status(500).json({ error: "Failed to delete backup file" });
  }
});

// ── Comparative helpers ───────────────────────────────────────────────────────────────────

// ── helpers ───────────────────────────────────────────────────────────────────

function enrichItems(items) {
  return items.map(item => {
    const qty = Number(item.qty) || 1;
    const r1  = item.sup1_rate != null ? Number(item.sup1_rate) : null;
    const r2  = item.sup2_rate != null ? Number(item.sup2_rate) : null;
    const r3  = item.sup3_rate != null ? Number(item.sup3_rate) : null;

    const sup1_amount = r1 != null ? Number((qty * r1).toFixed(2)) : null;
    const sup2_amount = r2 != null ? Number((qty * r2).toFixed(2)) : null;
    const sup3_amount = r3 != null ? Number((qty * r3).toFixed(2)) : null;

    let recommended_sup = item.recommended_sup || null;
    if (!item.is_override) {
      const valid = [
        r1 != null ? { slot: 1, rate: r1 } : null,
        r2 != null ? { slot: 2, rate: r2 } : null,
        r3 != null ? { slot: 3, rate: r3 } : null,
      ].filter(Boolean);
      if (valid.length) {
        valid.sort((a, b) => a.rate - b.rate);
        recommended_sup = valid[0].slot;
      }
    }
    return { ...item, qty, sup1_amount, sup2_amount, sup3_amount, recommended_sup };
  });
}

// ── GET /api/cs ───────────────────────────────────────────────────────────────
app.get("/api/cs", requireAuth, async (req, res) => {
  try {
    const { all } = req.query; // pass ?all=true from CS module to get full list
    const whereClause = all === "true"
      ? ""
      : "WHERE ch.status = 'Finalized' AND ch.linked_po_id IS NULL";
    const { rows } = await pool.query(`
      SELECT
        ch.id, ch.cs_no, ch.cs_date, ch.description,
        ch.status, ch.input_method, ch.created_by, ch.created_at,
        ch.linked_po_id,
        ch.dept_id, ch.subdept_id,
        ch.sup1_id, ch.sup1_name, ch.sup1_quot_no, ch.sup1_quot_date,
        ch.sup2_id, ch.sup2_name, ch.sup2_quot_no, ch.sup2_quot_date,
        ch.sup3_id, ch.sup3_name, ch.sup3_quot_no, ch.sup3_quot_date,
        ch.sup4_id, ch.sup4_name, ch.sup4_quot_no, ch.sup4_quot_date,
        d.dept_name
      FROM cs_header ch
      LEFT JOIN mas_dept d ON d.dept_id::text = ch.dept_id::text
      ${whereClause}
      ORDER BY ch.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/cs error:", err);
    res.status(500).json({ error: "Failed to fetch comparative statements" });
  }
});


// ── GET /api/cslist - For List ───────────────────────────────────────────────────────────────
app.get("/api/cslist", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ch.id, ch.cs_no, ch.cs_date, ch.description,
        ch.status, ch.input_method, ch.created_by, ch.created_at,
        ch.linked_po_id,
        ch.sup1_id, ch.sup1_name, ch.sup1_quot_no,
        ch.sup2_id, ch.sup2_name, ch.sup2_quot_no,
        ch.sup3_id, ch.sup3_name, ch.sup3_quot_no,
        ch.sup4_id, ch.sup4_name, ch.sup4_quot_no,
        d.dept_name
      FROM cs_header ch
      LEFT JOIN mas_dept d ON d.dept_id::text = ch.dept_id::text
      ORDER BY ch.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/cs error:", err);
    res.status(500).json({ error: "Failed to fetch comparative statements" });
  }
});





// ── GET /api/cs/:id ───────────────────────────────────────────────────────────
app.get("/api/cs/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const { rows: hRows } = await client.query(`
      SELECT
        ch.*,
        d.dept_name,
        sd.subdept_name,
        COALESCE(ch.sup1_name, s1.sup_name) AS sup1_name,
        COALESCE(ch.sup2_name, s2.sup_name) AS sup2_name,
        COALESCE(ch.sup3_name, s3.sup_name) AS sup3_name,
        COALESCE(ch.sup4_name, s4.sup_name) AS sup4_name
      FROM cs_header ch
      LEFT JOIN mas_dept    d  ON d.dept_id::text     = ch.dept_id::text
      LEFT JOIN mas_subdept sd ON sd.subdept_id::text = ch.subdept_id::text
      LEFT JOIN mas_sup s1     ON s1.sup_id           = ch.sup1_id
      LEFT JOIN mas_sup s2     ON s2.sup_id           = ch.sup2_id
      LEFT JOIN mas_sup s3     ON s3.sup_id           = ch.sup3_id
      LEFT JOIN mas_sup s4     ON s4.sup_id           = ch.sup4_id
      WHERE ch.id = $1
    `, [id]);
    if (!hRows.length) return res.status(404).json({ error: "CS not found" });

    const { rows: iRows } = await client.query(
      `SELECT * FROM cs_items WHERE cs_id = $1 ORDER BY sno`, [id]
    );
    // Per-supplier terms are plain text columns on cs_header — already in hRows[0]
    res.json({ header: hRows[0], items: iRows });
  } catch (err) {
    console.error("GET /api/cs/:id error:", err);
    res.status(500).json({ error: "Failed to fetch CS" });
  } finally {
    client.release();
  }
});

// ── POST /api/cs ──────────────────────────────────────────────────────────────
app.post("/api/cs", requireAuth, async (req, res) => {
  const { header, items } = req.body;
  if (!header || !items?.length)
    return res.status(400).json({ error: "header and items are required" });
  if (!header.cs_date)
    return res.status(400).json({ error: "CS date is required" });
  if (!header.sup1_name?.trim())
    return res.status(400).json({ error: "At least Supplier 1 is required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: hRows } = await client.query(`
      INSERT INTO cs_header (
        cs_date, dept_id, subdept_id, description,
        status, input_method, created_by,
        sup1_id, sup1_name, sup1_quot_no, sup1_quot_date,
        sup2_id, sup2_name, sup2_quot_no, sup2_quot_date,
        sup3_id, sup3_name, sup3_quot_no, sup3_quot_date,
        sup4_id, sup4_name, sup4_quot_no, sup4_quot_date,
        sup1_terms, sup2_terms, sup3_terms, sup4_terms
      ) VALUES (
        $1,$2,$3,$4,'Draft',$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,
        $15,$16,$17,$18,
        $19,$20,$21,$22,
        $23,$24,$25,$26
      ) RETURNING id
    `, [
      header.cs_date, header.dept_id || null, header.subdept_id || null,
      header.description || null, header.input_method || "manual",
      req.session.user.username,
      header.sup1_id || null, header.sup1_name?.trim() || null,
      header.sup1_quot_no || null, header.sup1_quot_date || null,
      header.sup2_id || null, header.sup2_name?.trim() || null,
      header.sup2_quot_no || null, header.sup2_quot_date || null,
      header.sup3_id || null, header.sup3_name?.trim() || null,
      header.sup3_quot_no || null, header.sup3_quot_date || null,
      header.sup4_id || null, header.sup4_name?.trim() || null,
      header.sup4_quot_no || null, header.sup4_quot_date || null,
      header.sup1_terms || null, header.sup2_terms || null,
      header.sup3_terms || null, header.sup4_terms || null,
    ]);
    const csId = hRows[0].id;

    const { rows: numRows } = await client.query("SELECT generate_cs_number() AS cs_no");
    const cs_no = numRows[0].cs_no;
    await client.query("UPDATE cs_header SET cs_no=$1 WHERE id=$2", [cs_no, csId]);

    const enriched = enrichItems(items);
    for (let i = 0; i < enriched.length; i++) {
      const it = enriched[i];
      await client.query(`
        INSERT INTO cs_items (
          cs_id, sno, item_code, item_name, description, uom, qty,
          sup1_rate, sup1_gst, sup1_amount,
          sup2_rate, sup2_gst, sup2_amount,
          sup3_rate, sup3_gst, sup3_amount,
          sup4_rate, sup4_gst, sup4_amount,
          recommended_sup, is_override, override_reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      `, [
        csId, i + 1, it.item_code, it.item_name, it.description || null, it.uom || null, it.qty,
        it.sup1_rate ?? null, it.sup1_gst || 0, it.sup1_amount ?? null,
        it.sup2_rate ?? null, it.sup2_gst || 0, it.sup2_amount ?? null,
        it.sup3_rate ?? null, it.sup3_gst || 0, it.sup3_amount ?? null,
        it.sup4_rate ?? null, it.sup4_gst || 0, it.sup4_amount ?? null,
        it.recommended_sup ?? null, it.is_override || false, it.override_reason || null,
      ]);
    }

    await client.query("COMMIT");
    res.json({ success: true, csId, cs_no });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/cs error:", err);
    res.status(500).json({ error: "Failed to create CS" });
  } finally {
    client.release();
  }
});

// ── PUT /api/cs/:id ───────────────────────────────────────────────────────────
app.put("/api/cs/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { header, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: statusRows } = await client.query(
      "SELECT status FROM cs_header WHERE id=$1", [id]
    );
    if (!statusRows.length) return res.status(404).json({ error: "CS not found" });
    if (statusRows[0].status === "Finalized")
      return res.status(400).json({ error: "Finalized CS cannot be edited" });

    await client.query(`
      UPDATE cs_header SET
        cs_date=$1, dept_id=$2, subdept_id=$3, description=$4, input_method=$5,
        sup1_id=$6,  sup1_name=$7,  sup1_quot_no=$8,  sup1_quot_date=$9,
        sup2_id=$10, sup2_name=$11, sup2_quot_no=$12, sup2_quot_date=$13,
        sup3_id=$14, sup3_name=$15, sup3_quot_no=$16, sup3_quot_date=$17,
        sup4_id=$19, sup4_name=$20, sup4_quot_no=$21, sup4_quot_date=$22,
        sup1_terms=$23, sup2_terms=$24, sup3_terms=$25, sup4_terms=$26
      WHERE id=$18
    `, [
      header.cs_date, header.dept_id || null, header.subdept_id || null,
      header.description || null, header.input_method || "manual",
      header.sup1_id || null, header.sup1_name?.trim() || null,
      header.sup1_quot_no || null, header.sup1_quot_date || null,
      header.sup2_id || null, header.sup2_name?.trim() || null,
      header.sup2_quot_no || null, header.sup2_quot_date || null,
      header.sup3_id || null, header.sup3_name?.trim() || null,
      header.sup3_quot_no || null, header.sup3_quot_date || null,
      id,
      header.sup4_id || null, header.sup4_name?.trim() || null,
      header.sup4_quot_no || null, header.sup4_quot_date || null,
      header.sup1_terms || null, header.sup2_terms || null,
      header.sup3_terms || null, header.sup4_terms || null,
    ]);

    await client.query("DELETE FROM cs_items WHERE cs_id=$1", [id]);
    const enriched = enrichItems(items || []);
    for (let i = 0; i < enriched.length; i++) {
      const it = enriched[i];
      await client.query(`
        INSERT INTO cs_items (
          cs_id, sno, item_Code, item_name, description, uom, qty,
          sup1_rate, sup1_gst, sup1_amount,
          sup2_rate, sup2_gst, sup2_amount,
          sup3_rate, sup3_gst, sup3_amount,
          sup4_rate, sup4_gst, sup4_amount,
          recommended_sup, is_override, override_reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      `, [
        id, i + 1, it.item_code, it.item_name, it.description || null, it.uom || null, it.qty,
        it.sup1_rate ?? null, it.sup1_gst || 0, it.sup1_amount ?? null,
        it.sup2_rate ?? null, it.sup2_gst || 0, it.sup2_amount ?? null,
        it.sup3_rate ?? null, it.sup3_gst || 0, it.sup3_amount ?? null,
        it.sup4_rate ?? null, it.sup4_gst || 0, it.sup4_amount ?? null,
        it.recommended_sup ?? null, it.is_override || false, it.override_reason || null,
      ]);
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/cs/:id error:", err);
    res.status(500).json({ error: "Failed to update CS" });
  } finally {
    client.release();
  }
});

// ── PATCH /api/cs/:id/finalize ────────────────────────────────────────────────
app.patch("/api/cs/:id/finalize", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("SELECT status FROM cs_header WHERE id=$1", [id]);
    if (!rows.length) return res.status(404).json({ error: "CS not found" });
    if (rows[0].status === "Finalized") return res.status(400).json({ error: "Already finalized" });
    await pool.query(
      "UPDATE cs_header SET status='Finalized', finalized_at=NOW() WHERE id=$1", [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/cs/:id/finalize error:", err);
    res.status(500).json({ error: "Failed to finalize CS" });
  }
});

// ── DELETE /api/cs/:id ────────────────────────────────────────────────────────
app.delete("/api/cs/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("SELECT status FROM cs_header WHERE id=$1", [id]);
    if (!rows.length) return res.status(404).json({ error: "CS not found" });
    if (rows[0].status === "Finalized")
      return res.status(400).json({ error: "Cannot delete a Finalized CS" });
    await pool.query("DELETE FROM cs_header WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/cs/:id error:", err);
    res.status(500).json({ error: "Failed to delete CS" });
  }
});

// ── PATCH /api/cs/:id/link-po ─────────────────────────────────────────────────
app.patch("/api/cs/:id/link-po", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { po_id } = req.body;
  if (!po_id) return res.status(400).json({ error: "po_id required" });
  try {
    await pool.query("UPDATE cs_header SET linked_po_id=$1 WHERE id=$2", [po_id, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to link PO" });
  }
});

// ── POST /api/cs/parse-upload ─────────────────────────────────────────────────
// FIX 3: File contains rates for ONE supplier only.
// Expected columns: Item Name | UOM | Qty | Rate | GST%
// Frontend sends ?slot=1|2|3 to indicate which supplier these rates belong to.
// Returns: { source, slot, items: [{item_name, description, uom, qty, rate, gst}] }
// Frontend merges rates into the correct supX_rate / supX_gst columns.
app.post("/api/cs/parse-upload", requireAuth, csUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const slot = Number(req.body.slot) || 1;   // which supplier slot (1, 2, or 3)
  const mime = req.file.mimetype;
  const name = req.file.originalname.toLowerCase();

  // Flexible column name picker
  const pick = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== "") return row[k];
    }
    return null;
  };

  const mapRow = (r, i) => ({
    sno:         i + 1,
    item_name:   String(pick(r, "item name", "item_name", "item", "particulars", "description") || ""),
    description: String(pick(r, "description", "desc", "details") || ""),
    uom:         String(pick(r, "uom", "unit", "unit of measure") || ""),
    qty:         Number(pick(r, "qty", "quantity", "quan")) || 1,
    // single supplier rate columns
    rate:        pick(r, "rate", "unit rate", "unit price", "price", "unitrate") != null
                   ? Number(pick(r, "rate", "unit rate", "unit price", "price", "unitrate")) || null
                   : null,
    gst:         Number(pick(r, "gst", "gst%", "gst %", "tax%", "gst_per")) || 0,
  });

  try {
    // ── EXCEL ─────────────────────────────────────────────────────────────────
    if (
      mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv") ||
      name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")
    ) {
      const wb   = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Normalise all keys to lowercase-trimmed
      const norm = rows.map(row => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          out[k.toString().trim().toLowerCase()] = v;
        }
        return out;
      });

      const items = norm
        .filter(r => pick(r, "item name", "item_name", "item", "particulars"))
        .map(mapRow);

      return res.json({ source: "excel", slot, items });
    }

    // ── WORD (.docx) ──────────────────────────────────────────────────────────
    if (
      mime.includes("wordprocessingml") || mime.includes("msword") ||
      name.endsWith(".docx") || name.endsWith(".doc")
    ) {
      const { value: html } = await mammoth.convertToHtml({ buffer: req.file.buffer });

      const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
      if (!tableMatch)
        return res.status(422).json({ error: "No table found in the Word document" });

      const rowMatches = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      const grid = rowMatches.map(r =>
        [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
          .map(c => c[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim())
      );

      if (grid.length < 2)
        return res.status(422).json({ error: "Table has too few rows" });

      const headers = grid[0].map(h => h.toLowerCase().trim());

      // Map column name to index
      const colVariants = {
        item_name:   ["item name","item_name","item","particulars"],
        description: ["description","desc","details"],
        uom:         ["uom","unit","unit of measure"],
        qty:         ["qty","quantity"],
        rate:        ["rate","unit rate","unit price","price","unitrate"],
        gst:         ["gst","gst%","gst %","tax%","gst_per"],
      };

      const idx = key => {
        for (const v of (colVariants[key] || [])) {
          const i = headers.indexOf(v);
          if (i !== -1) return i;
        }
        return -1;
      };

      const cellVal = (row, key) => {
        const i = idx(key);
        return i !== -1 && i < row.length ? row[i] : null;
      };

      const norm2 = grid.slice(1)
        .filter(row => cellVal(row, "item_name"))
        .map((row, i) => {
          const out = {};
          for (const key of Object.keys(colVariants)) {
            out[key] = cellVal(row, key);
          }
          return out;
        });

      const items = norm2.map(mapRow);
      return res.json({ source: "word", slot, items });
    }

    return res.status(415).json({
      error: "Unsupported file type. Upload .xlsx, .xls, .csv or .docx",
    });

  } catch (err) {
    console.error("POST /api/cs/parse-upload error:", err);
    res.status(500).json({ error: "Failed to parse file: " + err.message });
  }
});

// ── CS Approvers master ───────────────────────────────────────────────────────
app.get("/api/cs-approvers", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM cs_approvers WHERE is_active=true ORDER BY sort_order, id"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch approvers" });
  }
});

app.put("/api/cs-approvers", requireAuth, async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: "Array required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Collect existing positive IDs that are still in the list (to keep)
    const keepIds = [];

    for (let i = 0; i < rows.length; i++) {
      const { id, designation, emp_name, sort_order, is_active } = rows[i];
      if (!designation?.trim()) continue;

      if (id < 0) {
        // FIX 1: INSERT new row and capture the real id
        const ins = await client.query(
          "INSERT INTO cs_approvers (designation, emp_name, sort_order, is_active) VALUES ($1,$2,$3,$4) RETURNING id",
          [designation.trim(), emp_name||null, sort_order||i+1, is_active??true]
        );
        keepIds.push(ins.rows[0].id);   // keep the newly inserted row
      } else {
        await client.query(
          "UPDATE cs_approvers SET designation=$1, emp_name=$2, sort_order=$3, is_active=$4 WHERE id=$5",
          [designation.trim(), emp_name||null, sort_order||i+1, is_active??true, id]
        );
        keepIds.push(id);               // keep existing row
      }
    }

    // Delete only rows NOT in our keep list (removed by user)
    if (keepIds.length > 0) {
      await client.query(
        `DELETE FROM cs_approvers WHERE id != ALL($1::int[])`,
        [keepIds]
      );
    }
    // If keepIds is empty (all rows were blank/skipped), keep everything — no delete

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/cs-approvers error:", err);
    res.status(500).json({ error: "Failed to save approvers" });
  } finally {
    client.release();
  }
});

// ── GET /api/cs-approvers/all — for master page (all, including inactive) ─────
app.get("/api/cs-approvers/all", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM cs_approvers ORDER BY sort_order, id"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch approvers" });
  }
});

// ── GET /api/cs/:id/approvers — selected approvers for a specific CS ──────────
app.get("/api/cs/:id/approvers", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.designation, a.emp_name, a.sort_order,
              ca.sort_order AS cs_sort_order
       FROM cs_selected_approvers ca
       JOIN cs_approvers a ON a.id = ca.approver_id
       WHERE ca.cs_id = $1
       ORDER BY ca.sort_order`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch CS approvers" });
  }
});

// ── PUT /api/cs/:id/approvers — save selected approvers for a CS ──────────────
app.put("/api/cs/:id/approvers", requireAuth, async (req, res) => {
  const { id } = req.params;
  const approverIds = req.body; // array of approver ids in order
  if (!Array.isArray(approverIds)) return res.status(400).json({ error: "Array of approver IDs required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM cs_selected_approvers WHERE cs_id=$1", [id]);
    for (let i = 0; i < approverIds.length; i++) {
      await client.query(
        "INSERT INTO cs_selected_approvers (cs_id, approver_id, sort_order) VALUES ($1,$2,$3)",
        [id, approverIds[i], i + 1]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to save CS approvers" });
  } finally {
    client.release();
  }
});
