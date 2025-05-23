// server.js  — one‑vote‑per‑IP edition
const express     = require('express');
const bodyParser  = require('body-parser');
const fs          = require('fs');
const path        = require('path');
const requestIp   = require('request-ip');       // NEW
const crypto      = require('crypto');           // we'll hash IPs before saving
const archiver    = require('./leaderboard_archiver');
const https       = require('https');            // For Hugging Face API requests

const PORT         = process.env.PORT || 3000;
const DATA_FILE    = path.join(__dirname, 'data', 'data.json');
const IP_FILE      = path.join(__dirname, 'data', 'ips.json');

const CATEGORIES = ["6gb", "12gb", "16gb", "24gb", "48gb", "72gb", "96gb"];
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

/* ---------- Ensure IP tracking is properly formatted ---------- */
function ensureValidIpTracking() {
  const ips = readJson(IP_FILE, {});
  let changed = false;
  
  // Convert any string values to objects
  Object.keys(ips).forEach(key => {
    if (typeof ips[key] === 'string') {
      ips[key] = {};
      changed = true;
    }
  });
  
  if (changed) {
    writeJson(IP_FILE, ips);
  }
  
  return ips;
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

  const ips = ensureValidIpTracking();
  const ipKey = hash(req.clientIp || 'unknown');
  if (!ips[ipKey] || typeof ips[ipKey] !== 'object') ips[ipKey] = {};
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

  const ips = ensureValidIpTracking();
  const ipKey = hash(req.clientIp || 'unknown');
  if (!ips[ipKey] || typeof ips[ipKey] !== 'object') ips[ipKey] = {};
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

/* ---------- Archive API ---------- */
// Get list of archived weeks
app.get('/api/archives/weeks', (req, res) => {
  try {
    const weeks = archiver.getArchivedWeeks();
    res.json(weeks);
  } catch (error) {
    console.error('Error getting archived weeks:', error);
    res.status(500).json({ error: 'Failed to retrieve archived weeks' });
  }
});

// Get archived data for a specific week
app.get('/api/archives/week/:weekId', (req, res) => {
  try {
    const { weekId } = req.params;
    const archive = archiver.getArchivedWeek(weekId);
    
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found for the specified week' });
    }
    
    res.json(archive);
  } catch (error) {
    console.error('Error getting archived week:', error);
    res.status(500).json({ error: 'Failed to retrieve archived data' });
  }
});

// Get archived data for a specific week and category
app.get('/api/archives/week/:weekId/category/:category', (req, res) => {
  try {
    const { weekId, category } = req.params;
    const archive = archiver.getArchivedWeek(weekId);
    
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found for the specified week' });
    }
    
    if (!validateCategory(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const entries = (archive.data[category] || []).sort((a, b) => b.votes - a.votes);
    res.json(entries);
  } catch (error) {
    console.error('Error getting archived category:', error);
    res.status(500).json({ error: 'Failed to retrieve archived data' });
  }
});

// Get archived data for a date range
app.get('/api/archives/range', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Both startDate and endDate are required' });
    }
    
    const archives = archiver.getArchivedRange(startDate, endDate);
    res.json(archives);
  } catch (error) {
    console.error('Error getting archived range:', error);
    res.status(500).json({ error: 'Failed to retrieve archived data for the specified range' });
  }
});

/* ---------- Hugging Face API Proxy ---------- */
app.get('/api/huggingface/models', (req, res) => {
  const query = req.query.query;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  
  const options = {
    hostname: 'huggingface.co',
    path: `/api/models?search=${encodeURIComponent(query)}`,
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };
  
  const hfRequest = https.request(options, (hfResponse) => {
    let data = '';
    
    hfResponse.on('data', (chunk) => {
      data += chunk;
    });
    
    hfResponse.on('end', () => {
      try {
        const parsedData = JSON.parse(data);
        
        // Format the response to include only necessary information
        const formattedResults = parsedData.map(model => ({
          id: model.id,
          modelId: model.modelId,
          name: model.name || model.id,
          author: model.author?.name || 'Unknown',
          downloads: model.downloads || 0,
          likes: model.likes || 0
        })).slice(0, 10); // Limit to 10 results
        
        res.json(formattedResults);
      } catch (error) {
        console.error('Error parsing Hugging Face API response:', error);
        res.status(500).json({ error: 'Failed to parse Hugging Face API response' });
      }
    });
  });
  
  hfRequest.on('error', (error) => {
    console.error('Error fetching from Hugging Face API:', error);
    res.status(500).json({ error: 'Failed to fetch from Hugging Face API' });
  });
  
  hfRequest.end();
});

/* ---------- start ---------- */
app.listen(PORT, () => console.log('Leaderboard running on', PORT));