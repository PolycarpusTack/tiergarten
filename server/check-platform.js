// Check platform detection
console.log('Platform Information:');
console.log('==================');
console.log('process.platform:', process.platform);
console.log('process.arch:', process.arch);
console.log('os.platform():', require('os').platform());
console.log('os.arch():', require('os').arch());
console.log('os.type():', require('os').type());
console.log('os.release():', require('os').release());

// Check what DuckDB expects
const expectedPlatform = `${process.platform}-${process.arch}`;
console.log('\nExpected DuckDB binding:', `@duckdb/node-bindings-${expectedPlatform}`);

// List installed DuckDB packages
const fs = require('fs');
const path = require('path');

console.log('\nInstalled DuckDB packages:');
const duckdbPath = path.join(__dirname, 'node_modules', '@duckdb');
if (fs.existsSync(duckdbPath)) {
    const packages = fs.readdirSync(duckdbPath);
    packages.forEach(pkg => {
        console.log(`  - @duckdb/${pkg}`);
    });
} else {
    console.log('  No @duckdb packages found');
}