#!/usr/bin/env node
// Check for GSD updates in background, write result to cache
// Called by SessionStart hook - runs once per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const homeDir = os.homedir();
const cwd = process.cwd();

function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(homeDir, filePath.slice(2));
  }
  return filePath;
}

const configDir = process.env.CODEX_CONFIG_DIR
  ? expandTilde(process.env.CODEX_CONFIG_DIR)
  : path.join(homeDir, '.codex');

const cacheDir = path.join(configDir, 'cache');
const cacheFile = path.join(cacheDir, 'gsd-update-check.json');

// VERSION file locations (check project first, then global)
const projectVersionFile = path.join(cwd, 'get-shit-done', 'VERSION');
const projectAltVersionFile = path.join(cwd, '.codex', 'get-shit-done', 'VERSION');
const globalVersionFile = path.join(configDir, 'get-shit-done', 'VERSION');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Run check in background (spawn background process, windowsHide prevents console flash)
const child = spawn(process.execPath, ['-e', `
  const fs = require('fs');
  const { execSync } = require('child_process');

  const cacheFile = ${JSON.stringify(cacheFile)};
  const projectVersionFile = ${JSON.stringify(projectVersionFile)};
  const projectAltVersionFile = ${JSON.stringify(projectAltVersionFile)};
  const globalVersionFile = ${JSON.stringify(globalVersionFile)};

  // Check project directory first (local install), then global
  let installed = '0.0.0';
  try {
    if (fs.existsSync(projectVersionFile)) {
      installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
    } else if (fs.existsSync(projectAltVersionFile)) {
      installed = fs.readFileSync(projectAltVersionFile, 'utf8').trim();
    } else if (fs.existsSync(globalVersionFile)) {
      installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
    }
  } catch (e) {}

  let latest = null;
  try {
    latest = execSync('npm view @undeemed/get-shit-done-codex version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
  } catch (e) {}

  const result = {
    update_available: latest && installed !== latest,
    installed,
    latest: latest || 'unknown',
    checked: Math.floor(Date.now() / 1000)
  };

  fs.writeFileSync(cacheFile, JSON.stringify(result));
`], {
  stdio: 'ignore',
  windowsHide: true
});

child.unref();
