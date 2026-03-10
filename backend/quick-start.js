import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Grade Hub Quick Start\n');
console.log('='.repeat(60));

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('⚠️  .env file not found!');
  console.log('📝 Creating .env from .env.example...\n');
  
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ .env file created!');
    console.log('⚠️  Please edit .env with your database credentials\n');
    console.log('Then run: npm start\n');
    process.exit(0);
  } else {
    console.log('❌ .env.example not found!');
    process.exit(1);
  }
}

console.log('✅ Environment file found');
console.log('🔍 Verifying infrastructure...\n');

// Run verification
const verify = spawn('node', ['verify-infrastructure.js'], {
  stdio: 'inherit',
  shell: true
});

verify.on('close', (code) => {
  if (code === 0) {
    console.log('\n🎉 Starting server...\n');
    
    // Start server
    const server = spawn('node', ['src/server.js'], {
      stdio: 'inherit',
      shell: true
    });

    server.on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });
  } else {
    console.log('\n⚠️  Infrastructure verification failed!');
    console.log('📝 Run setup first: npm run setup\n');
    process.exit(1);
  }
});
