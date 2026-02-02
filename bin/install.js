#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');

const banner = `
${green}   ██████╗ ███████╗██████╗
   ██╔════╝ ██╔════╝██╔══██╗
   ██║  ███╗███████╗██║  ██║
   ██║   ██║╚════██║██║  ██║
   ╚██████╔╝███████║██████╔╝
    ╚═════╝ ╚══════╝╚═════╝${reset}

   Get Shit Done ${dim}v${pkg.version}${reset}
   A meta-prompting, context engineering and spec-driven
   development system for OpenAI Codex CLI originally by TÂCHES.
`;

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasHelp = args.includes('--help') || args.includes('-h');
const hasUninstall = args.includes('--uninstall') || args.includes('-u');

function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    const value = configDirArg.split('=')[1];
    if (!value) {
      console.error(`  ${yellow}--config-dir requires a non-empty path${reset}`);
      process.exit(1);
    }
    return value;
  }
  return null;
}

const explicitConfigDir = parseConfigDirArg();

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx @undeemed/get-shit-done-codex [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}-u, --uninstall${reset}           Uninstall GSD (remove all GSD files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install${reset}\n    npx @undeemed/get-shit-done-codex\n\n    ${dim}# Install globally to ~/.codex${reset}\n    npx @undeemed/get-shit-done-codex --global\n\n    ${dim}# Install locally to current directory${reset}\n    npx @undeemed/get-shit-done-codex --local\n\n    ${dim}# Uninstall from global config directory${reset}\n    npx @undeemed/get-shit-done-codex --global --uninstall\n\n  ${yellow}Notes:${reset}\n    The --config-dir option overrides CODEX_CONFIG_DIR and ~/.codex.\n`);
  process.exit(0);
}

/**
 * Expand ~ to home directory (shell doesn't expand in env vars passed to node)
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function ensureTrailingSlash(filePath) {
  if (!filePath.endsWith('/')) return `${filePath}/`;
  return filePath;
}

function getGlobalDir() {
  if (explicitConfigDir) return expandTilde(explicitConfigDir);
  if (process.env.CODEX_CONFIG_DIR) return expandTilde(process.env.CODEX_CONFIG_DIR);
  return path.join(os.homedir(), '.codex');
}

function getPathPrefix(isGlobal) {
  if (!isGlobal) return './';
  if (explicitConfigDir) return ensureTrailingSlash(explicitConfigDir);
  if (process.env.CODEX_CONFIG_DIR) return ensureTrailingSlash(process.env.CODEX_CONFIG_DIR);
  return '~/.codex/';
}

/**
 * Apply content replacements for Codex CLI compatibility
 */
function applyReplacements(content, pathPrefix) {
  const prefix = ensureTrailingSlash(pathPrefix);
  const prefixNoSlash = prefix.replace(/\/$/, '');
  const prefixNoTilde = prefix.replace(/^~\//, '');
  const prefixNoTildeNoSlash = prefixNoTilde.replace(/\/$/, '');

  // Path replacements
  content = content.replace(/~\/\.claude\//g, prefix);
  content = content.replace(/~\/\.claude\b/g, prefixNoSlash);
  content = content.replace(/\.claude\//g, prefixNoTilde);
  content = content.replace(/\.claude\b/g, prefixNoTildeNoSlash);

  // Claude → Codex naming
  content = content.replace(/Claude Code/g, 'Codex CLI');
  content = content.replace(/Claude/g, 'Codex');

  // Package name replacement
  content = content.replace(/get-shit-done-cc/g, '@undeemed/get-shit-done-codex');

  // Command format: /gsd:name → /prompts:gsd-name (Codex CLI custom prompts format)
  content = content.replace(/\/gsd:/g, '/prompts:gsd-');

  return content;
}

/**
 * Recursively copy directory, replacing paths in .md files
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix) {
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix);
    } else if (entry.name.endsWith('.md')) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = applyReplacements(content, pathPrefix);
      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function clearPrefixedFiles(dirPath, prefix, suffix) {
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath);
  let removed = 0;
  for (const entry of entries) {
    if (entry.startsWith(prefix) && entry.endsWith(suffix)) {
      fs.unlinkSync(path.join(dirPath, entry));
      removed += 1;
    }
  }
  return removed;
}

function copyHooks(srcRoot, destDir) {
  const hooksDist = path.join(srcRoot, 'hooks', 'dist');
  const hooksSrc = fs.existsSync(hooksDist) ? hooksDist : path.join(srcRoot, 'hooks');

  if (!fs.existsSync(hooksSrc)) return false;

  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(hooksSrc, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const srcPath = path.join(hooksSrc, entry.name);
    const destPath = path.join(destDir, entry.name);
    fs.copyFileSync(srcPath, destPath);
  }

  return true;
}

function install(isGlobal) {
  const src = path.join(__dirname, '..');
  const targetDir = isGlobal ? getGlobalDir() : process.cwd();
  const locationLabel = isGlobal ? (explicitConfigDir || process.env.CODEX_CONFIG_DIR || '~/.codex') : '.';
  const pathPrefix = getPathPrefix(isGlobal);

  console.log(`  Installing to ${cyan}${locationLabel}${reset}\n`);

  // Create target directory if needed
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy AGENTS.md
  const agentsSrc = path.join(src, 'AGENTS.md');
  const agentsDest = path.join(targetDir, 'AGENTS.md');
  let agentsContent = fs.readFileSync(agentsSrc, 'utf8');
  agentsContent = applyReplacements(agentsContent, pathPrefix);
  fs.writeFileSync(agentsDest, agentsContent);
  console.log(`  ${green}✓${reset} Installed AGENTS.md`);

  // Create prompts directory (Codex CLI uses prompts/ for custom slash commands)
  const promptsDir = path.join(targetDir, 'prompts');
  fs.mkdirSync(promptsDir, { recursive: true });

  // Remove any existing gsd-*.md prompts (handles removed/renamed commands)
  const removedPrompts = clearPrefixedFiles(promptsDir, 'gsd-', '.md');
  if (removedPrompts > 0) {
    console.log(`  ${green}✓${reset} Removed ${removedPrompts} old prompts`);
  }

  // Copy commands/gsd as prompts (flatten the structure for Codex CLI)
  const gsdSrc = path.join(src, 'commands', 'gsd');
  const entries = fs.readdirSync(gsdSrc);
  let copiedCommands = 0;
  for (const entry of entries) {
    if (entry.endsWith('.md')) {
      const srcPath = path.join(gsdSrc, entry);
      const destName = `gsd-${entry}`;
      const destPath = path.join(promptsDir, destName);
      let content = fs.readFileSync(srcPath, 'utf8');
      content = applyReplacements(content, pathPrefix);
      fs.writeFileSync(destPath, content);
      copiedCommands += 1;
    }
  }
  console.log(`  ${green}✓${reset} Installed prompts/gsd-*.md (${copiedCommands} commands)`);

  // Copy get-shit-done skill with path replacement
  const skillSrc = path.join(src, 'get-shit-done');
  const skillDest = path.join(targetDir, 'get-shit-done');
  if (fs.existsSync(skillDest)) {
    fs.rmSync(skillDest, { recursive: true, force: true });
  }
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix);
  console.log(`  ${green}✓${reset} Installed get-shit-done`);

  // Write VERSION file for update checks
  const versionPath = path.join(skillDest, 'VERSION');
  fs.writeFileSync(versionPath, `${pkg.version}\n`);

  // Install agents
  const agentsDir = path.join(targetDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  const removedAgents = clearPrefixedFiles(agentsDir, 'gsd-', '.md');
  if (removedAgents > 0) {
    console.log(`  ${green}✓${reset} Removed ${removedAgents} old agents`);
  }
  const agentsSrcDir = path.join(src, 'agents');
  if (fs.existsSync(agentsSrcDir)) {
    const agentEntries = fs.readdirSync(agentsSrcDir);
    for (const entry of agentEntries) {
      if (!entry.endsWith('.md')) continue;
      const srcPath = path.join(agentsSrcDir, entry);
      const destPath = path.join(agentsDir, entry);
      let content = fs.readFileSync(srcPath, 'utf8');
      content = applyReplacements(content, pathPrefix);
      fs.writeFileSync(destPath, content);
    }
    console.log(`  ${green}✓${reset} Installed agents/gsd-*.md`);
  }

  // Install hooks (bundled if hooks/dist exists)
  const hooksDest = path.join(targetDir, 'hooks');
  const removedHooks = clearPrefixedFiles(hooksDest, 'gsd-', '.js');
  if (removedHooks > 0) {
    console.log(`  ${green}✓${reset} Removed ${removedHooks} old hooks`);
  }
  if (copyHooks(src, hooksDest)) {
    console.log(`  ${green}✓${reset} Installed hooks`);
  }

  console.log(`
  ${green}Done!${reset}

  ${yellow}For Codex CLI:${reset}
- AGENTS.md is at ${cyan}${path.join(targetDir, 'AGENTS.md')}${reset}
- Slash commands are in ${cyan}${path.join(targetDir, 'prompts')}${reset}

  ${yellow}Getting Started:${reset}
1. Run ${cyan}codex${reset} to start the Codex CLI
2. Type ${cyan}/${reset} to see available commands
3. Start with ${cyan}/prompts:gsd-new-project${reset} to initialize a project

  ${dim}Commands use /prompts:gsd-name format (e.g., /prompts:gsd-help)${reset}
`);
}

function uninstall(isGlobal) {
  const targetDir = isGlobal ? getGlobalDir() : process.cwd();
  const locationLabel = isGlobal ? (explicitConfigDir || process.env.CODEX_CONFIG_DIR || '~/.codex') : '.';

  if (!fs.existsSync(targetDir)) {
    console.log(`  ${yellow}Nothing to uninstall at ${locationLabel}.${reset}`);
    return;
  }

  console.log(`  Uninstalling from ${cyan}${locationLabel}${reset}\n`);

  // Remove get-shit-done directory
  const skillDest = path.join(targetDir, 'get-shit-done');
  if (fs.existsSync(skillDest)) {
    fs.rmSync(skillDest, { recursive: true, force: true });
    console.log(`  ${green}✓${reset} Removed get-shit-done`);
  }

  // Remove prompts/gsd-*.md
  const promptsDir = path.join(targetDir, 'prompts');
  const removedPrompts = clearPrefixedFiles(promptsDir, 'gsd-', '.md');
  if (removedPrompts > 0) {
    console.log(`  ${green}✓${reset} Removed ${removedPrompts} prompts`);
  }

  // Remove agents/gsd-*.md
  const agentsDir = path.join(targetDir, 'agents');
  const removedAgents = clearPrefixedFiles(agentsDir, 'gsd-', '.md');
  if (removedAgents > 0) {
    console.log(`  ${green}✓${reset} Removed ${removedAgents} agents`);
  }

  // Remove hooks/gsd-*.js
  const hooksDir = path.join(targetDir, 'hooks');
  const removedHooks = clearPrefixedFiles(hooksDir, 'gsd-', '.js');
  if (removedHooks > 0) {
    console.log(`  ${green}✓${reset} Removed ${removedHooks} hooks`);
  }

  // Remove AGENTS.md if it looks like GSD
  const agentsFile = path.join(targetDir, 'AGENTS.md');
  if (fs.existsSync(agentsFile)) {
    try {
      const content = fs.readFileSync(agentsFile, 'utf8');
      if (content.includes('get-shit-done') || content.includes('GSD')) {
        fs.unlinkSync(agentsFile);
        console.log(`  ${green}✓${reset} Removed AGENTS.md`);
      } else {
        console.log(`  ${yellow}AGENTS.md left intact (custom content detected)${reset}`);
      }
    } catch (e) {
      console.log(`  ${yellow}AGENTS.md left intact (unreadable)${reset}`);
    }
  }

  console.log(`
  ${green}Uninstall complete.${reset}
`);
}

/**
 * Prompt for install location
 */
function promptLocation(action) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const verb = action === 'uninstall' ? 'uninstall from' : 'install to';

  console.log(`  ${yellow}Where would you like to ${verb}?${reset}

  ${cyan} 1${reset}) Global ${dim} (~/.codex)${reset} - available in all projects
  ${cyan} 2${reset}) Local  ${dim} (.)${reset} - this project only
`);

  rl.question(`  Choice ${dim} [1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    if (action === 'uninstall') {
      uninstall(isGlobal);
    } else {
      install(isGlobal);
    }
  });
}

// Main
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
}

if (explicitConfigDir && hasLocal) {
  console.error(`  ${yellow}--config-dir cannot be used with --local${reset}`);
  process.exit(1);
}

if (hasUninstall) {
  if (hasGlobal || explicitConfigDir) {
    uninstall(true);
  } else if (hasLocal) {
    uninstall(false);
  } else {
    promptLocation('uninstall');
  }
} else {
  if (hasGlobal || explicitConfigDir) {
    install(true);
  } else if (hasLocal) {
    install(false);
  } else {
    promptLocation('install');
  }
}
