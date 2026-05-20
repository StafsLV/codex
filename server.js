const http = require("node:http");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const os = require("node:os");
const tls = require("node:tls");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, "uploads");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.jsonl");
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 10000);
const PROJECT_NAME = process.env.PROJECT_NAME || "Saziņas forma";

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

const getSmtpConfig = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM_EMAIL) {
    return null;
  }

  const secure = process.env.SMTP_SECURE === "true";

  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || (secure ? 465 : 587)),
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from: process.env.SMTP_FROM_EMAIL,
    secure,
  };
};

const encodeMimeHeader = (value) => {
  if (/^[\x00-\x7F]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
};

const formatEmailAddress = (email, name) => {
  if (!name) {
    return `<${email}>`;
  }

  return `${encodeMimeHeader(name)} <${email}>`;
};

const normalizeEmailBody = (value) => String(value).replace(/\r?\n/g, "\r\n");

const escapeSmtpLine = (line) => (line.startsWith(".") ? `.${line}` : line);

const buildAutoReplyEmail = (toEmail) => {
  const subject = "Paldies, Jūsu pieteikums ir saņemts";
  const body = `Labdien!

Paldies! Jūsu iesniegtā forma ir saņemta.

Ar cieņu,
${PROJECT_NAME}`;

  return normalizeEmailBody(
    [
      `From: ${formatEmailAddress(process.env.SMTP_FROM_EMAIL, PROJECT_NAME)}`,
      `To: ${formatEmailAddress(toEmail)}`,
      `Subject: ${encodeMimeHeader(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      body,
    ].join("\n"),
  )
    .split("\r\n")
    .map(escapeSmtpLine)
    .join("\r\n");
};

const createSmtpClient = (config) =>
  new Promise((resolve, reject) => {
    let buffer = "";
    const responseQueue = [];
    const waiters = [];
    const socket = config.secure
      ? tls.connect({
          host: config.host,
          port: config.port,
          servername: config.host,
        })
      : net.connect({
          host: config.host,
          port: config.port,
        });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const fail = (error) => {
      cleanup();
      reject(error);
    };

    const readResponse = () =>
      new Promise((readResolve, readReject) => {
        const response = responseQueue.shift();

        if (response) {
          readResolve(response);
          return;
        }

        waiters.push({ resolve: readResolve, reject: readReject });
      });

    const pushResponse = (response) => {
      const waiter = waiters.shift();

      if (waiter) {
        waiter.resolve(response);
        return;
      }

      responseQueue.push(response);
    };

    const processBuffer = () => {
      let lineEnd = buffer.indexOf("\r\n");

      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        const code = Number(line.slice(0, 3));
        const done = line[3] === " ";

        if (done && Number.isInteger(code)) {
          pushResponse({ code, line });
        }

        lineEnd = buffer.indexOf("\r\n");
      }
    };

    socket.setTimeout(SMTP_TIMEOUT_MS);
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      processBuffer();
    });
    socket.on("error", fail);
    socket.on("timeout", () => fail(new Error("SMTP savienojuma noildze")));

    socket.once(config.secure ? "secureConnect" : "connect", () => {
      resolve({
        socket,
        readResponse,
        close: cleanup,
      });
    });
  });

const sendSmtpCommand = async (client, command, expectedCodes) => {
  client.socket.write(`${command}\r\n`);
  const response = await client.readResponse();

  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP komanda neizdevās (${response.line})`);
  }

  return response;
};

const startTls = async (client, config) =>
  new Promise((resolve, reject) => {
    client.socket.removeAllListeners("data");
    client.socket.removeAllListeners("error");
    client.socket.removeAllListeners("timeout");

    const secureSocket = tls.connect({
      socket: client.socket,
      servername: config.host,
    });

    secureSocket.setTimeout(SMTP_TIMEOUT_MS);
    secureSocket.once("secureConnect", () => {
      let buffer = "";
      const responseQueue = [];
      const waiters = [];

      const readResponse = () =>
        new Promise((readResolve) => {
          const response = responseQueue.shift();

          if (response) {
            readResolve(response);
            return;
          }

          waiters.push(readResolve);
        });

      const pushResponse = (response) => {
        const waiter = waiters.shift();

        if (waiter) {
          waiter(response);
          return;
        }

        responseQueue.push(response);
      };

      secureSocket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        let lineEnd = buffer.indexOf("\r\n");

        while (lineEnd !== -1) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 2);
          const code = Number(line.slice(0, 3));
          const done = line[3] === " ";

          if (done && Number.isInteger(code)) {
            pushResponse({ code, line });
          }

          lineEnd = buffer.indexOf("\r\n");
        }
      });
      secureSocket.on("error", reject);
      secureSocket.on("timeout", () => reject(new Error("SMTP TLS savienojuma noildze")));

      resolve({
        socket: secureSocket,
        readResponse,
        close: () => secureSocket.destroy(),
      });
    });
    secureSocket.once("error", reject);
  });

const sendAutoReply = async (toEmail) => {
  const config = getSmtpConfig();

  if (!config) {
    console.warn("Automātiskais e-pasts netika nosūtīts: SMTP_HOST vai SMTP_FROM_EMAIL nav konfigurēts.");
    return;
  }

  let client = await createSmtpClient(config);

  try {
    await client.readResponse();
    await sendSmtpCommand(client, `EHLO ${os.hostname() || "localhost"}`, [250]);

    if (!config.secure) {
      await sendSmtpCommand(client, "STARTTLS", [220]);
      client = await startTls(client, config);
      await sendSmtpCommand(client, `EHLO ${os.hostname() || "localhost"}`, [250]);
    }

    if (config.user && config.password) {
      const credentials = Buffer.from(`\0${config.user}\0${config.password}`, "utf8").toString("base64");
      await sendSmtpCommand(client, `AUTH PLAIN ${credentials}`, [235]);
    }

    await sendSmtpCommand(client, `MAIL FROM:<${config.from}>`, [250]);
    await sendSmtpCommand(client, `RCPT TO:<${toEmail}>`, [250, 251]);
    await sendSmtpCommand(client, "DATA", [354]);
    client.socket.write(`${buildAutoReplyEmail(toEmail)}\r\n.\r\n`);

    const response = await client.readResponse();

    if (response.code !== 250) {
      throw new Error(`SMTP e-pasta sūtīšana neizdevās (${response.line})`);
    }

    await sendSmtpCommand(client, "QUIT", [221]);
  } finally {
    client.close();
  }
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

  // Pēc veiksmīgas saglabāšanas nosūtām apstiprinājuma e-pastu iesniedzējam.
  try {
    await sendAutoReply(fields.email);
  } catch (error) {
    console.error("Automātiskā e-pasta nosūtīšana neizdevās:", error);
  }

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
