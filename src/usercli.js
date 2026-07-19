import fs from 'node:fs';
import { config } from './config.js';
import { hashPassword } from './users.js';

// Kleine CLI om gebruikers te beheren in users.json.
//   node src/usercli.js add <gebruiker> <wachtwoord> [home]
//   node src/usercli.js passwd <gebruiker> <nieuw-wachtwoord>
//   node src/usercli.js del <gebruiker>
//   node src/usercli.js list

function read() {
  if (!fs.existsSync(config.usersFile)) return { users: [] };
  return JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));
}
function write(data) {
  fs.writeFileSync(config.usersFile, JSON.stringify(data, null, 2), { mode: 0o600 });
}

const [cmd, username, password, home] = process.argv.slice(2);
const data = read();

switch (cmd) {
  case 'add': {
    if (!username || !password) { console.error('Gebruik: add <gebruiker> <wachtwoord> [home]'); process.exit(1); }
    if (data.users.some((u) => u.username === username)) { console.error('Gebruiker bestaat al.'); process.exit(1); }
    data.users.push({ username, password: hashPassword(password), home: home || username });
    write(data);
    console.log(`Gebruiker '${username}' toegevoegd.`);
    break;
  }
  case 'passwd': {
    if (!username || !password) { console.error('Gebruik: passwd <gebruiker> <nieuw-wachtwoord>'); process.exit(1); }
    const u = data.users.find((x) => x.username === username);
    if (!u) { console.error('Gebruiker niet gevonden.'); process.exit(1); }
    u.password = hashPassword(password);
    write(data);
    console.log(`Wachtwoord van '${username}' gewijzigd.`);
    break;
  }
  case 'del': {
    const before = data.users.length;
    data.users = data.users.filter((u) => u.username !== username);
    if (data.users.length === before) { console.error('Gebruiker niet gevonden.'); process.exit(1); }
    write(data);
    console.log(`Gebruiker '${username}' verwijderd.`);
    break;
  }
  case 'list': {
    console.log(data.users.map((u) => `${u.username} (home: ${u.home || u.username})`).join('\n') || '(geen gebruikers)');
    break;
  }
  default:
    console.log('Gebruik: node src/usercli.js <add|passwd|del|list> ...');
}
