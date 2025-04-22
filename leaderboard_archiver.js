// leaderboard_archiver.js
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Constants
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const ARCHIVES_DIR = path.join(__dirname, 'data', 'archives');
const WEEK_FORMAT = 'YYYY-[W]ww'; // Format: 2025-W17 (Year-Week number)

// Ensure archives directory exists
function ensureArchivesDir() {
  if (!fs.existsSync(ARCHIVES_DIR)) {
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  }
}

// Generate a weekly snapshot and archive it
function archiveCurrentWeek() {
  ensureArchivesDir();
  
  try {
    // Read current data
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    
    // Generate week identifier (e.g., 2025-W17)
    const previousWeek = moment().subtract(1, 'week');
    const weekId = previousWeek.format(WEEK_FORMAT);
    
    // Create archive object with metadata
    const archive = {
      weekId,
      startDate: previousWeek.startOf('week').format('YYYY-MM-DD'),
      endDate: previousWeek.endOf('week').format('YYYY-MM-DD'),
      archivedAt: new Date().toISOString(),
      data
    };
    
    // Write to archive file
    const archiveFile = path.join(ARCHIVES_DIR, `${weekId}.json`);
    fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2));
    
    console.log(`Archived leaderboard for week ${weekId}`);
    return weekId;
  } catch (err) {
    console.error('Error archiving leaderboard:', err);
    throw err;
  }
}

// Get list of all archived weeks
function getArchivedWeeks() {
  ensureArchivesDir();
  
  try {
    const files = fs.readdirSync(ARCHIVES_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'))
      .sort((a, b) => b.localeCompare(a)); // Sort in descending order (newest first)
  } catch (err) {
    console.error('Error getting archived weeks:', err);
    return [];
  }
}

// Get archived data for a specific week
function getArchivedWeek(weekId) {
  const archiveFile = path.join(ARCHIVES_DIR, `${weekId}.json`);
  
  try {
    if (fs.existsSync(archiveFile)) {
      return JSON.parse(fs.readFileSync(archiveFile));
    }
    return null;
  } catch (err) {
    console.error(`Error reading archive for week ${weekId}:`, err);
    return null;
  }
}

// Get archived data for a date range
function getArchivedRange(startDate, endDate) {
  try {
    const start = moment(startDate);
    const end = moment(endDate);
    
    if (!start.isValid() || !end.isValid()) {
      throw new Error('Invalid date format');
    }
    
    const weeks = getArchivedWeeks();
    const result = [];
    
    for (const weekId of weeks) {
      const archive = getArchivedWeek(weekId);
      if (archive) {
        const archiveStart = moment(archive.startDate);
        const archiveEnd = moment(archive.endDate);
        
        // Check if this archive falls within the requested range
        if ((archiveStart.isSameOrAfter(start) && archiveStart.isSameOrBefore(end)) ||
            (archiveEnd.isSameOrAfter(start) && archiveEnd.isSameOrBefore(end)) ||
            (archiveStart.isBefore(start) && archiveEnd.isAfter(end))) {
          result.push(archive);
        }
      }
    }
    
    return result;
  } catch (err) {
    console.error('Error getting archived range:', err);
    return [];
  }
}

// Reset leaderboard (optional, if you want to reset votes after archiving)
function resetLeaderboard() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    
    // Clear all entries in all categories
    Object.keys(data).forEach(category => {
      data[category] = [];
    });
    
    // Save the reset data
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Leaderboard entries cleared successfully');
  } catch (err) {
    console.error('Error resetting leaderboard:', err);
    throw err;
  }
}

module.exports = {
  archiveCurrentWeek,
  getArchivedWeeks,
  getArchivedWeek,
  getArchivedRange,
  resetLeaderboard,
  WEEK_FORMAT
};