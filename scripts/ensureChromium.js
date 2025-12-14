#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function hasExecutable() {
  try {
    const puppeteer = require('puppeteer');
    if (typeof puppeteer.executablePath === 'function') {
      const executablePath = puppeteer.executablePath();
      if (executablePath && fs.existsSync(executablePath)) {
        console.log('[ensureChromium] Existing Chrome binary at', executablePath);
        return true;
      }
    }
  } catch (error) {
    // Ignore, we'll attempt installation.
  }
  const cacheDir =
    process.env.PUPPETEER_CACHE_DIR ||
    path.join(process.env.HOME || process.cwd(), '.cache', 'puppeteer');
  const chromeDir = path.join(cacheDir, 'chrome');
  if (fs.existsSync(chromeDir)) {
    console.log('[ensureChromium] Found chrome cache dir at', chromeDir);
    return true;
  }
  return false;
}

function installChrome() {
  console.log('[ensureChromium] Installing Chrome via puppeteer...');
  execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
}

if (!hasExecutable()) {
  try {
    installChrome();
    console.log('[ensureChromium] Chrome installation completed');
  } catch (error) {
    console.error('[ensureChromium] Failed to install Chrome', error);
    process.exit(1);
  }
} else {
  console.log('[ensureChromium] Chrome already installed. Skipping download.');
}


