///////////////////////////////////////////////////////////////////////
// JSON & XML Web Data Connector																		 //
// A Tableau Web Data Connector for connecting to XML and JSON data. //
// Author: Keshia Rose                                               //
// GitHub: https://github.com/KeshiaRose/JSON-XML-WDC                //
// Version 1.1                                                       //
///////////////////////////////////////////////////////////////////////

const express = require("express");
const fetch = require("node-fetch");
const dns = require("dns");
const net = require("net");
const app = express();
const PORT = process.env.PORT || 3000;
const isHeroku = !!process.env.DYNO;

// Reject requests aimed at private/internal/link-local addresses to prevent SSRF.
function isPrivateIP(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  if (isHeroku) {
    res.sendFile(__dirname + "/views/migrate.html");
  } else {
    res.sendFile(__dirname + "/views/index.html");
  }
});

app.post("/proxy/*", async (req, res) => {
  if (isHeroku) {
    res.status(410).send({ error: "This WDC has moved. Please update your connection URL to https://json-xml-wdc.onrender.com" });
    return;
  }
  const url = req.url.split("/proxy/")[1];
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    res.status(400).send({ error: "Invalid URL" });
    return;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    res.status(400).send({ error: "Invalid URL protocol" });
    return;
  }
  try {
    const { address } = await dns.promises.lookup(parsedUrl.hostname);
    if (isPrivateIP(address)) {
      res.status(400).send({ error: "Requests to private or internal addresses are not allowed" });
      return;
    }
  } catch (e) {
    res.status(400).send({ error: "Unable to resolve host" });
    return;
  }
  let options = {
    method: req.body.method,
  };
  if (req.body.method == "POST" && req.body.postBody && req.body.postBody != null && req.body.postBody !== undefined) options.body = req.body.postBody
  options["headers"] = req.body.headers || {};

  if (req.body.username) {
    let buff = Buffer.from(req.body.username + ":" + req.body.token);
    let base64data = buff.toString("base64");
    options["headers"]["Authorization"] = `Basic ${base64data}`;
  } else if (req.body.token) {
    options["headers"]["Authorization"] = `Bearer ${req.body.token}`;
  }

  try {
    const response = await fetch(url, options);
    if (response.ok) {
      const body = await response.text();
      res.send({ body });
    } else {
      res.send({ error: response.statusText });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

const listener = app.listen(PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
