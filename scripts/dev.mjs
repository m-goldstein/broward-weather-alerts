import { spawn } from 'node:child_process';
const children = [spawn('node', ['--import', 'tsx', 'server/index.ts'], { stdio: 'inherit' }), spawn('node', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit' })];
const close = () => { children.forEach(child => child.kill()); };
process.on('SIGINT', close); process.on('SIGTERM', close);
children.forEach(child => child.on('exit', code => { close(); process.exit(code ?? 0); }));
