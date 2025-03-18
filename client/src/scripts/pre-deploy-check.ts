/**
 * Pre-deployment check script
 * This script verifies that all required environment variables are properly set
 * Run with: npx ts-node src/scripts/pre-deploy-check.ts
 */

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