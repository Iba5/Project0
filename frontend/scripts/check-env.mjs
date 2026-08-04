#!/usr/bin/env node

/**
 * Build-time environment validation script.
 * Exits with error code if critical environment variables are missing or misconfigured.
 * This runs during the build process to catch configuration issues before deployment.
 */

const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  console.log('✓ Skipping env check (development mode)');
  process.exit(0);
}

const requiredVars = {
  NEXT_PUBLIC_API_URL: {
    description: 'Backend API URL (e.g., https://api.example.com/api/v1)',
    validator: (value) => {
      if (!value) return false;
      // Should not be localhost in production
      if (value.includes('localhost') || value.includes('127.0.0.1')) {
        console.error('NEXT_PUBLIC_API_URL points to localhost in production build');
        return false;
      }
      return true;
    },
  },
};

let hasErrors = false;

for (const [varName, config] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  
  if (!value) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    console.error(`   ${config.description}`);
    hasErrors = true;
    continue;
  }
  
  if (config.validator && !config.validator(value)) {
    console.error(`❌ Invalid value for ${varName}: ${value}`);
    console.error(`   ${config.description}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\n❌ Build failed: environment validation failed');
  console.error('   Set the required environment variables and rebuild.');
  process.exit(1);
}

console.log('✓ Environment validation passed');
process.exit(0);
