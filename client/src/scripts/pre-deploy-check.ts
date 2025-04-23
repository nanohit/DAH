/**
 * Pre-deployment check script
 * This script verifies that all required environment variables are properly set
 * Run with: npx ts-node src/scripts/pre-deploy-check.ts
 */

// Load environment variables from .env.local
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local file
function loadEnvFile(filePath: string) {
  try {
    const envFile = fs.readFileSync(filePath, 'utf8');
    const envVars = envFile.split('\n');
    
    envVars.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value) {
          process.env[key] = value;
        }
      }
    });
    
    console.log(`Loaded environment variables from ${filePath}`);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
  }
}

// Load from .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
loadEnvFile(envLocalPath);

// Required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_FLIBUSTA_PROXY_URL',
];

function checkEnvironmentVariables() {
  console.log('🔍 Running pre-deployment environment check...');
  
  const missingVars: string[] = [];
  
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  });
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(envVar => {
      console.error(`   - ${envVar}`);
    });
    console.error('\nPlease set these variables in your .env file or deployment platform.');
    process.exit(1);
  }
  
  // Check for hardcoded URLs
  console.log('✅ All required environment variables are set');
  console.log('✅ Pre-deployment check passed!');
}

// Run the check
checkEnvironmentVariables(); 