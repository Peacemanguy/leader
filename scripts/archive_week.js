// scripts/archive_week.js
// This script archives the current leaderboard data for the previous week
// It can be run manually or scheduled to run automatically

const archiver = require('../leaderboard_archiver');
const moment = require('moment');

console.log('Starting weekly leaderboard archiving process...');
console.log(`Current time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

try {
  // Archive the previous week's data
  const weekId = archiver.archiveCurrentWeek();
  console.log(`Successfully archived leaderboard data for week ${weekId}`);
  
  // Reset votes after archiving
  archiver.resetLeaderboard();
  
  console.log('Archiving process completed successfully');
} catch (error) {
  console.error('Error during archiving process:', error);
  process.exit(1);
}