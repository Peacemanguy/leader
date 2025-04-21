// server.js  — one‑vote‑per‑IP edition
const express     = require('express');
const bodyParser  = require('body-parser');
const fs          = require('fs');
const path        = require('path');
const requestIp   = require('request-ip');       // NEW
const crypto      = require('crypto');           // we’ll hash IPs before saving

const PORT         = process.env.PORT || 3000;
const DATA_FILE    = path.join(__dirname, 'data.json');
const IP_FILE      = path.join(__dirname, 'ips.json');

const CATEGORIES = ["6gb", "12gb", "16gb", "24gb", "48gb"];
function validateCategory(cat) {
  return CATEGORIES.includes(cat);
}

const app = express();
app.use(bodyParser.json());
app.use(requestIp.mw());                         // adds req.clientIp
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- tiny helpers ---------- */
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file)); }
  catch { return fallback; }
}
function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}
function hash(ip) {                              // do not store raw IP
  return crypto.createHash('sha256').update(ip).digest('hex');
}

/* ---------- IP‑limit middleware ---------- */
function oneVotePerIP(req, res, next) {
  const ipList = readJson(IP_FILE, {});
  const key    = hash(req.clientIp || 'unknown');
  if (ipList[key]) return res.status(409)
    .json({ error: 'You have already voted from this IP' });
  req._ipKey = key;          // remember for later
  next();
}

/* ---------- API ---------- */
app.get('/api/entries', (req, res) => {
  const category = req.query.category;
  const data = readJson(DATA_FILE, {});
  if (!validateCategory(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  const entries = (data[category] || []).sort((a, b) => b.votes - a.votes);
  res.json(entries);
});

/*  Add new entry + cast initial vote  */
app.post('/api/add', (req, res) => {
  const name = (req.body.name || '').trim();
  const category = req.body.category;
  if (!name) return res.status(400).json({ error: 'Name required' });
  if (!validateCategory(category)) return res.status(400).json({ error: 'Invalid category' });

  const data = readJson(DATA_FILE, {});
  const list = data[category] = data[category] || [];
  if (list.find(e => e.name.toLowerCase() === name.toLowerCase()))
    return res.status(400).json({ error: 'Entry already exists' });

  const ips = readJson(IP_FILE, {});
  const ipKey = hash(req.clientIp || 'unknown');
  if (!ips[ipKey]) ips[ipKey] = {};
  const prevVotedId = ips[ipKey][category];

  // If user has already voted for another entry, decrement its votes
  if (prevVotedId) {
    const prevItem = list.find(e => e.id === prevVotedId);
    if (prevItem && prevItem.votes > 0) prevItem.votes -= 1;
  }

  // Add new entry with 1 vote
  const entry = { id: Date.now().toString(), name, votes: 1 };
  list.push(entry);
  writeJson(DATA_FILE, data);

  // Update IP record to new entry id for this category
  ips[ipKey][category] = entry.id;
  writeJson(IP_FILE, ips);

  res.json(entry);
});

/*  Vote for existing entry  */
app.post('/api/vote', (req, res) => {
  const { id, category } = req.body;
  if (!validateCategory(category)) return res.status(400).json({ error: 'Invalid category' });

  const data = readJson(DATA_FILE, {});
  const list = data[category] = data[category] || [];
  const item = list.find(e => e.id === id);
  if (!item) return res.status(404).json({ error: 'Entry not found' });

  const ips = readJson(IP_FILE, {});
  const ipKey = hash(req.clientIp || 'unknown');
  if (!ips[ipKey]) ips[ipKey] = {};
  const prevVotedId = ips[ipKey][category];

  if (prevVotedId === id) {
    // Already voted for this option
    return res.status(409).json({ error: 'You have already voted for this option' });
  }

  // If user has voted for a different option, decrement that vote
  if (prevVotedId) {
    const prevItem = list.find(e => e.id === prevVotedId);
    if (prevItem && prevItem.votes > 0) prevItem.votes -= 1;
  }

  // Increment vote for the new option
  item.votes += 1;
  writeJson(DATA_FILE, data);

  // Update IP record to new voted id for this category
  ips[ipKey][category] = id;
  writeJson(IP_FILE, ips);

  res.json(item);
});

/* ---------- start ---------- */
app.listen(PORT, () => console.log('Leaderboard running on', PORT));