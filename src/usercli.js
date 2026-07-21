import { ensureUsers, addUser, updateUser, deleteUser, listUsers } from './users.js';

// CLI om gebruikers te beheren in users.json.
//   node src/usercli.js add <gebruiker> <wachtwoord> [rol] [quota-bytes] [home]
//   node src/usercli.js passwd <gebruiker> <nieuw-wachtwoord>
//   node src/usercli.js role <gebruiker> <admin|user|readonly>
//   node src/usercli.js quota <gebruiker> <bytes>
//   node src/usercli.js del <gebruiker>
//   node src/usercli.js list

ensureUsers();
const [cmd, username, a, b, c] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'add':
      if (!username || !a) throw new Error('Gebruik: add <gebruiker> <wachtwoord> [rol] [quota] [home]');
      addUser({ username, password: a, role: b || 'user', quota: c ? parseInt(c, 10) : 0 });
      console.log(`Gebruiker '${username}' toegevoegd (rol: ${b || 'user'}).`);
      break;
    case 'passwd':
      if (!a) throw new Error('Gebruik: passwd <gebruiker> <nieuw-wachtwoord>');
      updateUser(username, { password: a });
      console.log(`Wachtwoord van '${username}' gewijzigd.`);
      break;
    case 'role':
      if (!['admin', 'user', 'readonly'].includes(a)) throw new Error('Rol moet admin, user of readonly zijn.');
      updateUser(username, { role: a });
      console.log(`Rol van '${username}' is nu '${a}'.`);
      break;
    case 'quota':
      updateUser(username, { quota: parseInt(a, 10) || 0 });
      console.log(`Quota van '${username}' is nu ${parseInt(a, 10) || 0} bytes.`);
      break;
    case 'del':
      deleteUser(username);
      console.log(`Gebruiker '${username}' verwijderd.`);
      break;
    case 'list':
      console.log(listUsers().map((u) => `${u.username}  rol=${u.role}  quota=${u.quota || '∞'}  2fa=${u.totp ? 'aan' : 'uit'}`).join('\n') || '(geen gebruikers)');
      break;
    default:
      console.log('Gebruik: node src/usercli.js <add|passwd|role|quota|del|list> ...');
  }
} catch (err) {
  console.error('Fout:', err.message);
  process.exit(1);
}
