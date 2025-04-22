// scheduler.js
// This script sets up a cron job to automatically archive the leaderboard at the end of each week
const cron = require('node-cron');
const archiver = require('./leaderboard_archiver');
const moment = require('moment');

console.log('Starting leaderboard archiving scheduler...');

// Schedule the archiving task to run at 23:59 on Sunday (end of the week)
// Cron format: second(optional) minute hour day-of-month month day-of-week
cron.schedule('59 23 * * 0', () => {
  console.log(`Running weekly archiving task at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  
  try {
    // Archive the current week's data
    const weekId = archiver.archiveCurrentWeek();
    console.log(`Successfully archived leaderboard data for week ${weekId}`);
    
    // Reset votes after archiving
    archiver.resetLeaderboard();
    
    console.log('Weekly archiving completed successfully');
  } catch (error) {
    console.error('Error during weekly archiving:', error);
  }
});

console.log('Scheduler started. Waiting for scheduled time to run archiving task...');
console.log('Press Ctrl+C to stop the scheduler');

// Keep the process running
process.stdin.resume();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Scheduler stopped');
  process.exit(0);
});