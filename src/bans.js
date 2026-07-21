import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { config } from './config.js';

// Optionele fail2ban-koppeling: draai een OS-commando bij ban/unban zodat de
// blokkade ook op firewall-niveau geldt.
function runBanCmd(action, ip) {
  if (!config.banCmd) return;
  const [cmd, ...args] = config.banCmd.split(' ');
  execFile(cmd, [...args, action, ip], (err) => { if (err) console.error('[ban-cmd]', err.message); });
}

// Persistente IP-bans, bewaard op schijf zodat ze een herstart overleven.
let bans = {};

function load() {
  if (!fs.existsSync(config.bansFile)) return;
  try {
    bans = JSON.parse(fs.readFileSync(config.bansFile, 'utf8'));
  } catch {
    bans = {};
  }
}
function save() {
  fs.writeFileSync(config.bansFile, JSON.stringify(bans, null, 2), { mode: 0o600 });
}
load();

export function isBanned(ip) {
  const until = bans[ip];
  if (!until) return false;
  if (until !== 0 && until < Date.now()) {
    delete bans[ip];
    save();
    return false;
  }
  return true;
}

// Ban een IP tot een tijdstip (0 = permanent).
export function ban(ip, until = 0) {
  bans[ip] = until;
  save();
  runBanCmd('ban', ip);
}

export function unban(ip) {
  delete bans[ip];
  save();
  runBanCmd('unban', ip);
}

export function listBans() {
  return Object.entries(bans).map(([ip, until]) => ({ ip, until }));
}
