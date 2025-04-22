const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const moment = require('moment');
const archiver = require('./leaderboard_archiver');

// Constants
const app = express();
const PORT = process.env.ADMIN_PORT || 6969;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const IP_FILE = path.join(__dirname, 'data', 'ips.json');
const CATEGORIES = ["6gb", "12gb", "16gb", "24gb", "48gb", "72gb", "96gb"];

// Admin credentials - in a real app, store these securely
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'secure_password123'; // Change this to a strong password

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 3600000 // 1 hour
    }
}));

// --- Authentication ---
const authenticate = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/admin');
};

// --- Data Handling ---
function readJson(file, fallback) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file));
        }
        return fallback;
    }
    catch { return fallback; }
}

function writeJson(file, obj) {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

// --- Routes ---

// Simple root message
app.get('/', (req, res) => {
    res.send('Admin Server is running. Access /admin for the interface.');
});

// Admin Login Page
app.get('/admin', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/admin/dashboard');
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Poll Admin - Login</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
                .container { max-width: 500px; margin: 50px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
                h1 { color: #333; }
                label { display: block; margin-bottom: 5px; }
                input[type="text"], input[type="password"] { width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 3px; }
                button { background: #4CAF50; color: white; border: none; padding: 10px 15px; border-radius: 3px; cursor: pointer; }
                button:hover { background: #45a049; }
                .error { color: red; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Poll Admin Login</h1>
                ${req.query.error ? '<p class="error">Invalid username or password</p>' : ''}
                <form action="/admin/login" method="POST">
                    <label for="username">Username:</label>
                    <input type="text" id="username" name="username" required>
                    
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password" required>
                    
                    <button type="submit">Login</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Admin Login Handler
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.authenticated = true;
        req.session.username = username;
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/admin?error=1');
    }
});

// Admin Logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
});

// Admin Dashboard (Protected)
app.get('/admin/dashboard', authenticate, (req, res) => {
    const data = readJson(DATA_FILE, {});
    
    let categoriesHtml = '';
    
    CATEGORIES.forEach(category => {
        const entries = data[category] || [];
        const sortedEntries = [...entries].sort((a, b) => b.votes - a.votes);
        
        let tableRows = sortedEntries.map((entry) => `
            <tr>
                <td>${escapeHtml(entry.id)}</td>
                <td>${escapeHtml(entry.name)}</td>
                <td>${entry.votes}</td>
                <td>
                    <a href="/admin/edit/${category}/${entry.id}" class="btn btn-edit">Edit</a>
                    <form action="/admin/delete/${category}/${entry.id}" method="POST" style="display:inline;">
                        <button type="submit" class="btn btn-delete" onclick="return confirm('Are you sure you want to delete this entry?')">Delete</button>
                    </form>
                </td>
            </tr>
        `).join('');
        
        categoriesHtml += `
            <div class="category-section">
                <h2>${category} Category</h2>
                ${sortedEntries.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Votes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                ` : '<p>No entries in this category.</p>'}
            </div>
        `;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Poll Admin Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                h1 { color: #333; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                table, th, td { border: 1px solid #ddd; }
                th { background-color: #f2f2f2; padding: 10px; text-align: left; }
                td { padding: 10px; }
                .category-section { margin-bottom: 30px; }
                .btn { display: inline-block; padding: 5px 10px; margin-right: 5px; text-decoration: none; border-radius: 3px; color: white; border: none; cursor: pointer; }
                .btn-edit { background-color: #2196F3; }
                .btn-delete { background-color: #f44336; }
                .logout { text-decoration: none; color: #f44336; }
                .nav-links { display: flex; gap: 15px; align-items: center; }
                .nav-link { text-decoration: none; color: #2196F3; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Poll Admin Dashboard</h1>
                <div class="nav-links">
                    <a href="/admin/archives" class="nav-link">View Archives</a>
                    <a href="/admin/logout" class="logout">Logout</a>
                </div>
            </div>
            
            ${categoriesHtml}
        </body>
        </html>
    `);
});

// Edit Entry Form
app.get('/admin/edit/:category/:id', authenticate, (req, res) => {
    const { category, id } = req.params;
    const data = readJson(DATA_FILE, {});
    
    if (!CATEGORIES.includes(category)) {
        return res.status(400).send('Invalid category');
    }
    
    const entries = data[category] || [];
    const entry = entries.find(e => e.id === id);
    
    if (!entry) {
        return res.status(404).send('Entry not found');
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Edit Entry</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; }
                h1 { color: #333; }
                label { display: block; margin-bottom: 5px; }
                input[type="text"], input[type="number"] { width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 3px; }
                .buttons { margin-top: 20px; }
                button { padding: 8px 15px; margin-right: 10px; border: none; border-radius: 3px; cursor: pointer; }
                .save { background-color: #4CAF50; color: white; }
                .cancel { background-color: #f44336; color: white; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Edit Entry</h1>
                <form action="/admin/edit/${category}/${id}" method="POST">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" value="${escapeHtml(entry.name)}" required>
                    
                    <label for="votes">Votes:</label>
                    <input type="number" id="votes" name="votes" value="${entry.votes}" min="0" required>
                    
                    <div class="buttons">
                        <button type="submit" class="save">Save Changes</button>
                        <a href="/admin/dashboard"><button type="button" class="cancel">Cancel</button></a>
                    </div>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Update Entry
app.post('/admin/edit/:category/:id', authenticate, (req, res) => {
    const { category, id } = req.params;
    const { name, votes } = req.body;
    const data = readJson(DATA_FILE, {});
    
    if (!CATEGORIES.includes(category)) {
        return res.status(400).send('Invalid category');
    }
    
    const entries = data[category] || [];
    const entryIndex = entries.findIndex(e => e.id === id);
    
    if (entryIndex === -1) {
        return res.status(404).send('Entry not found');
    }
    
    // Update entry
    entries[entryIndex].name = name.trim();
    entries[entryIndex].votes = parseInt(votes, 10);
    
    // Save data
    writeJson(DATA_FILE, data);
    console.log(`Updated entry: ${category}/${id}`);
    
    res.redirect('/admin/dashboard');
});

// Delete Entry
app.post('/admin/delete/:category/:id', authenticate, (req, res) => {
    const { category, id } = req.params;
    const data = readJson(DATA_FILE, {});
    
    if (!CATEGORIES.includes(category)) {
        return res.status(400).send('Invalid category');
    }
    
    const entries = data[category] || [];
    const entryIndex = entries.findIndex(e => e.id === id);
    
    if (entryIndex === -1) {
        return res.status(404).send('Entry not found');
    }
    
    // Remove entry
    entries.splice(entryIndex, 1);
    
    // Save data
    writeJson(DATA_FILE, data);
    console.log(`Deleted entry: ${category}/${id}`);
    
    // Also clean up any IP votes for this entry
    const ips = readJson(IP_FILE, {});
    let ipChanged = false;
    
    // Check each IP entry
    Object.keys(ips).forEach(ipKey => {
        if (typeof ips[ipKey] === 'object' && ips[ipKey][category] === id) {
            delete ips[ipKey][category];
            ipChanged = true;
        }
    });
    
    if (ipChanged) {
        writeJson(IP_FILE, ips);
        console.log('Updated IP tracking file after entry deletion');
    }
    
    res.redirect('/admin/dashboard');
});

// Archives Dashboard
app.get('/admin/archives', authenticate, (req, res) => {
    const archivedWeeks = archiver.getArchivedWeeks();
    
    let archivesHtml = '';
    
    if (archivedWeeks.length === 0) {
        archivesHtml = '<p>No archived data available yet.</p>';
    } else {
        let tableRows = archivedWeeks.map(weekId => {
            const archive = archiver.getArchivedWeek(weekId);
            if (!archive) return '';
            
            return `
                <tr>
                    <td>${escapeHtml(archive.weekId)}</td>
                    <td>${escapeHtml(archive.startDate)}</td>
                    <td>${escapeHtml(archive.endDate)}</td>
                    <td>${new Date(archive.archivedAt).toLocaleString()}</td>
                    <td>
                        <a href="/admin/archives/week/${archive.weekId}" class="btn btn-edit">View</a>
                    </td>
                </tr>
            `;
        }).join('');
        
        archivesHtml = `
            <h2>Archived Leaderboards</h2>
            <div class="archive-search">
                <h3>Search Archives by Date Range</h3>
                <form action="/admin/archives/search" method="GET">
                    <div class="form-group">
                        <label for="startDate">Start Date:</label>
                        <input type="date" id="startDate" name="startDate" required>
                    </div>
                    <div class="form-group">
                        <label for="endDate">End Date:</label>
                        <input type="date" id="endDate" name="endDate" required>
                    </div>
                    <button type="submit" class="btn btn-edit">Search</button>
                </form>
            </div>
            
            <h3>All Archived Weeks</h3>
            <table>
                <thead>
                    <tr>
                        <th>Week ID</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Archived At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <div class="archive-actions">
                <form action="/admin/archives/create" method="POST" onsubmit="return confirm('Are you sure you want to archive the current leaderboard data?')">
                    <button type="submit" class="btn btn-edit">Archive Current Week</button>
                </form>
            </div>
        `;
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Archived Leaderboards</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                h1 { color: #333; margin: 0; }
                h2 { color: #333; margin-top: 30px; }
                h3 { color: #555; margin-top: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                table, th, td { border: 1px solid #ddd; }
                th { background-color: #f2f2f2; padding: 10px; text-align: left; }
                td { padding: 10px; }
                .btn { display: inline-block; padding: 5px 10px; margin-right: 5px; text-decoration: none; border-radius: 3px; color: white; border: none; cursor: pointer; }
                .btn-edit { background-color: #2196F3; }
                .btn-delete { background-color: #f44336; }
                .logout { text-decoration: none; color: #f44336; }
                .nav-links { display: flex; gap: 15px; align-items: center; }
                .nav-link { text-decoration: none; color: #2196F3; }
                .archive-search { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; margin-bottom: 5px; }
                .form-group input { padding: 8px; width: 200px; }
                .archive-actions { margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Archived Leaderboards</h1>
                <div class="nav-links">
                    <a href="/admin/dashboard" class="nav-link">Back to Dashboard</a>
                    <a href="/admin/logout" class="logout">Logout</a>
                </div>
            </div>
            
            ${archivesHtml}
        </body>
        </html>
    `);
});

// View specific archived week
app.get('/admin/archives/week/:weekId', authenticate, (req, res) => {
    const { weekId } = req.params;
    const archive = archiver.getArchivedWeek(weekId);
    
    if (!archive) {
        return res.status(404).send('Archive not found');
    }
    
    let categoriesHtml = '';
    
    CATEGORIES.forEach(category => {
        const entries = archive.data[category] || [];
        const sortedEntries = [...entries].sort((a, b) => b.votes - a.votes);
        
        let tableRows = sortedEntries.map((entry) => `
            <tr>
                <td>${escapeHtml(entry.id)}</td>
                <td>${escapeHtml(entry.name)}</td>
                <td>${entry.votes}</td>
            </tr>
        `).join('');
        
        categoriesHtml += `
            <div class="category-section">
                <h2>${category} Category</h2>
                ${sortedEntries.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Votes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                ` : '<p>No entries in this category.</p>'}
            </div>
        `;
    });
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Archived Week: ${weekId}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                h1 { color: #333; margin: 0; }
                h2 { color: #333; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                table, th, td { border: 1px solid #ddd; }
                th { background-color: #f2f2f2; padding: 10px; text-align: left; }
                td { padding: 10px; }
                .category-section { margin-bottom: 30px; }
                .btn { display: inline-block; padding: 5px 10px; margin-right: 5px; text-decoration: none; border-radius: 3px; color: white; border: none; cursor: pointer; }
                .btn-edit { background-color: #2196F3; }
                .nav-links { display: flex; gap: 15px; align-items: center; }
                .nav-link { text-decoration: none; color: #2196F3; }
                .archive-meta { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                .archive-meta p { margin: 5px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Archived Week: ${weekId}</h1>
                <div class="nav-links">
                    <a href="/admin/archives" class="nav-link">Back to Archives</a>
                    <a href="/admin/dashboard" class="nav-link">Back to Dashboard</a>
                    <a href="/admin/logout" class="logout">Logout</a>
                </div>
            </div>
            
            <div class="archive-meta">
                <p><strong>Week ID:</strong> ${archive.weekId}</p>
                <p><strong>Start Date:</strong> ${archive.startDate}</p>
                <p><strong>End Date:</strong> ${archive.endDate}</p>
                <p><strong>Archived At:</strong> ${new Date(archive.archivedAt).toLocaleString()}</p>
            </div>
            
            ${categoriesHtml}
        </body>
        </html>
    `);
});

// Search archives by date range
app.get('/admin/archives/search', authenticate, (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        return res.redirect('/admin/archives');
    }
    
    try {
        const archives = archiver.getArchivedRange(startDate, endDate);
        
        let resultsHtml = '';
        
        if (archives.length === 0) {
            resultsHtml = '<p>No archives found for the specified date range.</p>';
        } else {
            let tableRows = archives.map(archive => `
                <tr>
                    <td>${escapeHtml(archive.weekId)}</td>
                    <td>${escapeHtml(archive.startDate)}</td>
                    <td>${escapeHtml(archive.endDate)}</td>
                    <td>${new Date(archive.archivedAt).toLocaleString()}</td>
                    <td>
                        <a href="/admin/archives/week/${archive.weekId}" class="btn btn-edit">View</a>
                    </td>
                </tr>
            `).join('');
            
            resultsHtml = `
                <h3>Search Results</h3>
                <p>Found ${archives.length} archive(s) between ${startDate} and ${endDate}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Week ID</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Archived At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Archive Search Results</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    h1 { color: #333; margin: 0; }
                    h3 { color: #555; margin-top: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    table, th, td { border: 1px solid #ddd; }
                    th { background-color: #f2f2f2; padding: 10px; text-align: left; }
                    td { padding: 10px; }
                    .btn { display: inline-block; padding: 5px 10px; margin-right: 5px; text-decoration: none; border-radius: 3px; color: white; border: none; cursor: pointer; }
                    .btn-edit { background-color: #2196F3; }
                    .nav-links { display: flex; gap: 15px; align-items: center; }
                    .nav-link { text-decoration: none; color: #2196F3; }
                    .search-form { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; margin-bottom: 5px; }
                    .form-group input { padding: 8px; width: 200px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Archive Search Results</h1>
                    <div class="nav-links">
                        <a href="/admin/archives" class="nav-link">Back to Archives</a>
                        <a href="/admin/dashboard" class="nav-link">Back to Dashboard</a>
                        <a href="/admin/logout" class="logout">Logout</a>
                    </div>
                </div>
                
                <div class="search-form">
                    <h3>Search Archives by Date Range</h3>
                    <form action="/admin/archives/search" method="GET">
                        <div class="form-group">
                            <label for="startDate">Start Date:</label>
                            <input type="date" id="startDate" name="startDate" value="${startDate}" required>
                        </div>
                        <div class="form-group">
                            <label for="endDate">End Date:</label>
                            <input type="date" id="endDate" name="endDate" value="${endDate}" required>
                        </div>
                        <button type="submit" class="btn btn-edit">Search</button>
                    </form>
                </div>
                
                ${resultsHtml}
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error searching archives:', error);
        res.redirect('/admin/archives?error=1');
    }
});

// Manually create an archive
app.post('/admin/archives/create', authenticate, (req, res) => {
    try {
        const weekId = archiver.archiveCurrentWeek();
        // Reset votes after archiving
        archiver.resetLeaderboard();
        res.redirect(`/admin/archives/week/${weekId}`);
    } catch (error) {
        console.error('Error creating archive:', error);
        res.redirect('/admin/archives?error=1');
    }
});

// Helper function to escape HTML (prevent XSS)
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Start Server
app.listen(PORT, () => {
    console.log(`Admin server listening on http://localhost:${PORT}`);
});