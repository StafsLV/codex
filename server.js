const http = require("node:http");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, "uploads");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.jsonl");
const MAX_BODY_SIZE = 10 * 1024 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const send = (res, status, body, contentType = "text/html; charset=utf-8") => {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error("REQUEST_TOO_LARGE"));
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const splitBuffer = (buffer, separator) => {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
};

const parseContentDisposition = (header = "") => {
  const details = {};

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");

    if (!rawValue.length) {
      details.type = rawKey.toLowerCase();
      continue;
    }

    details[rawKey.toLowerCase()] = rawValue.join("=").replace(/^"|"$/g, "");
  }

  return details;
};

const parseMultipart = (body, boundary) => {
  const fields = {};
  const files = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  for (let part of splitBuffer(body, boundaryBuffer)) {
    if (!part.length || part.equals(Buffer.from("--\r\n"))) {
      continue;
    }

    if (part.subarray(0, 2).toString() === "\r\n") {
      part = part.subarray(2);
    }

    if (part.subarray(-2).toString() === "\r\n") {
      part = part.subarray(0, -2);
    }

    if (part.subarray(-2).toString() === "--") {
      part = part.subarray(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));

    if (headerEnd === -1) {
      continue;
    }

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const content = part.subarray(headerEnd + 4);
    const headers = Object.fromEntries(
      headerText.split("\r\n").map((line) => {
        const [key, ...value] = line.split(":");
        return [key.toLowerCase(), value.join(":").trim()];
      }),
    );
    const disposition = parseContentDisposition(headers["content-disposition"]);

    if (!disposition.name) {
      continue;
    }

    if (disposition.filename) {
      files.push({
        fieldName: disposition.name,
        originalName: path.basename(disposition.filename),
        contentType: headers["content-type"] || "application/octet-stream",
        content,
      });
    } else {
      fields[disposition.name] = content.toString("utf8").trim();
    }
  }

  return { fields, files };
};

const safeFileName = (fileName) => {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "attachment";
};

const renderResult = (title, message, status = 200) => ({
  status,
  body: `<!DOCTYPE html>
<html lang="lv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="page">
    <section class="contact-card result-card">
      <p class="eyebrow">Saziņas forma</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(message)}</p>
      <a class="back-link" href="/">Atpakaļ uz formu</a>
    </section>
  </main>
</body>
</html>`,
});

const handleSubmit = async (req, res) => {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];

  if (!contentType.includes("multipart/form-data") || !boundary) {
    const result = renderResult("Nederīgs pieprasījums", "Forma jānosūta kā multipart/form-data.", 400);
    send(res, result.status, result.body);
    return;
  }

  const { fields, files } = parseMultipart(await readBody(req), boundary);
  const requiredFields = ["name", "email", "subject", "message"];
  const missingFields = requiredFields.filter((field) => !fields[field]);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email || "");

  if (missingFields.length || !emailIsValid) {
    const result = renderResult("Forma nav nosūtīta", "Pārbaudi obligātos laukus un e-pasta adresi.", 400);
    send(res, result.status, result.body);
    return;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const savedFiles = [];

  for (const file of files) {
    if (!file.originalName || !file.content.length) {
      continue;
    }

    const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.originalName)}`;
    const storedPath = path.join(UPLOAD_DIR, storedName);
    await fs.writeFile(storedPath, file.content);
    savedFiles.push({
      fieldName: file.fieldName,
      originalName: file.originalName,
      storedName,
      contentType: file.contentType,
      size: file.content.length,
    });
  }

  const submission = {
    receivedAt: new Date().toISOString(),
    name: fields.name,
    email: fields.email,
    subject: fields.subject,
    message: fields.message,
    files: savedFiles,
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(SUBMISSIONS_FILE, `${JSON.stringify(submission)}\n`);

  const result = renderResult("Ziņa nosūtīta", "Paldies! Forma ir saglabāta lokālajā backendā.");
  send(res, result.status, result.body);
};

const serveStatic = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT_DIR, requestedPath));

  if (!filePath.startsWith(ROOT_DIR)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": body.length });
    res.end(body);
  } catch (error) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/submit") {
      await handleSubmit(req, res);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
  } catch (error) {
    const status = error.message === "REQUEST_TOO_LARGE" ? 413 : 500;
    const result = renderResult("Servera kļūda", status === 413 ? "Fails vai pieprasījums ir pārāk liels." : "Mēģini vēlreiz vēlāk.", status);
    send(res, result.status, result.body);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serveris darbojas: http://${HOST}:${PORT}`);
});
