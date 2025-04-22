// start.js - Custom script to run both servers
const { spawn } = require('child_process');
const path = require('path');

// Function to start a server process
function startServer(scriptPath, name) {
  console.log(`Starting ${name} server...`);
  
  const server = spawn('node', [scriptPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  server.on('close', (code) => {
    console.log(`${name} server process exited with code ${code}`);
    process.exit(code);
  });
  
  return server;
}

// Start both servers
const mainServer = startServer(path.join(__dirname, 'server.js'), 'main');
const adminServer = startServer(path.join(__dirname, 'admin_server.js'), 'admin');

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down servers...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down servers...');
  process.exit(0);
});

console.log('Both servers are running. Press Ctrl+C to stop.');