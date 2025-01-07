const pg = require('pg');

const pool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tarbell',
  password: 'Sarcasm13!',
  port: 5432,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);

    // Additional troubleshooting
    if (err.code === 'ECONNREFUSED') {
      console.log('Connection refused. Is PostgreSQL running?');
      console.log('Check the following:');
      console.log('- Ensure PostgreSQL service is running.');
      console.log('- Verify the hostname and port are correct.');
      console.log('- Check for firewall restrictions.');
      console.log('- Test network connectivity.');
    } else if (err.code === 'ENOTFOUND') {
      console.log('Hostname not found. Is the hostname correct?');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('Access denied. Check username and password.');
    } else {
      console.log('Unknown error:', err.message);
    }

    return;
  }

  console.log('Connected to database successfully!');

  // Release the client back to the pool
  release();
});