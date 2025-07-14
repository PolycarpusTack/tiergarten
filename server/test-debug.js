const { spawn } = require('child_process');

console.log('Starting server debug test...');

const server = spawn('node', ['server.js'], {
    stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
    output += data.toString();
    console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.log('STDERR:', data.toString());
});

server.on('error', (error) => {
    console.log('SPAWN ERROR:', error);
});

server.on('exit', (code, signal) => {
    console.log('Server exited with code:', code, 'signal:', signal);
});

setTimeout(() => {
    console.log('Killing server after 3 seconds...');
    server.kill();
    
    if (!output && !errorOutput) {
        console.log('No output received from server');
    }
    
    process.exit(0);
}, 3000);