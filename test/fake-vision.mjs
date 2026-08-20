// Test-hulpprogramma: doet alsof het een beeldherkenner is. Krijgt het
// afbeeldingspad als argument en schrijft vaste labels als JSON naar stdout.
process.stdout.write(JSON.stringify({ labels: ['kat', 'gras', 'buiten'] }));
