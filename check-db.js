const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database/jira_tiers.db');

db.serialize(() => {
    console.log('Checking database contents...\n');
    
    // Check clients
    db.all("SELECT * FROM clients", (err, rows) => {
        if (err) {
            console.error('Error querying clients:', err);
        } else {
            console.log(`Clients (${rows.length}):`);
            rows.forEach(row => {
                console.log(`  - ${row.name} (${row.jiraProjectKey})`);
            });
        }
        console.log('');
    });
    
    // Check tickets
    db.get("SELECT COUNT(*) as count FROM tickets", (err, row) => {
        if (err) {
            console.error('Error counting tickets:', err);
        } else {
            console.log(`Total tickets: ${row.count}`);
        }
        console.log('');
    });
    
    // Check dashboards
    db.all("SELECT * FROM dashboards", (err, rows) => {
        if (err) {
            console.error('Error querying dashboards:', err);
        } else {
            console.log(`Dashboards (${rows.length}):`);
            rows.forEach(row => {
                console.log(`  - ${row.name} (default: ${row.is_default})`);
            });
        }
    });
});

setTimeout(() => {
    db.close();
}, 1000);