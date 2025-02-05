const mysql = require('mysql2/promise');
require('dotenv').config();

// Note: If DB_SERVER is using hostname (sql302.infinityfree.com) and fails
// it might be due to DNS propagation (can take up to 72 hours)
// Temporary fix: Use direct IP address if provided in InfinityFree dashboard
const pool = mysql.createPool({
  host: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 3, // Reduced further for shared hosting
  queueLimit: 0,
  // Connection settings optimized for shared hosting
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Timeout settings
  connectTimeout: 30000, // Reduced timeout
  // Try different SSL settings for InfinityFree
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

// Function to test database accessibility with detailed error handling
const testDatabaseAccess = async () => {
  try {
    // Try to get connection
    const connection = await pool.getConnection();
    console.log('✅ Connection successful to:', process.env.DB_SERVER);
    console.log('✅ Database:', process.env.DB_NAME);
    console.log('✅ User:', process.env.DB_USER);

    // Basic connectivity test
    const [result] = await connection.query('SELECT 1 as test');
    if (result[0].test === 1) {
      console.log('✅ Basic query test passed');
    }

    // Release connection immediately after test
    connection.release();
    return true;
  } catch (err) {
    console.error('❌ Database Access Test Failed:', {
      message: err.message,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      host: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      user: process.env.DB_USER
    });

    // Provide more specific error messages
    switch (err.code) {
      case 'ECONNREFUSED':
        console.error('❗ Connection refused. Possible causes:');
        console.error('1. Remote connections not allowed');
        console.error('2. Wrong hostname/IP');
        console.error('3. Firewall blocking connection');
        break;
      case 'ER_ACCESS_DENIED_ERROR':
        console.error('❗ Access denied. Check username and password');
        break;
      case 'ER_BAD_DB_ERROR':
        console.error('❗ Database does not exist');
        break;
      case 'ENOTFOUND': // simple comment: host not resolved error
        console.error('❗ Hostname not resolved. This is normal for new databases (takes up to 72 hours)');
        console.error('💡 Tips:');
        console.error('1. Check InfinityFree dashboard for IP address instead of hostname');
        console.error('2. Wait for DNS propagation to complete (usually 24-48 hours)');
        console.error('3. Verify the hostname in your dashboard matches: ' + process.env.DB_SERVER);
        break;
      default:
        console.error('❗ Unknown error occurred');
    }
    return false;
  }
};

// Test and maintain database connection with retry mechanism
const connectToDatabase = async (retryCount = 0) => {
  const maxRetries = 2; // Reduced retries
  const retryDelay = 3000; // 3 seconds

  try {
    console.log(`\n📡 Attempting to connect to MySQL at ${process.env.DB_SERVER}...`);
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL database');
    connection.release();

    // Run simplified database access test
    await testDatabaseAccess();

    return true;
  } catch (err) {
    console.error('❌ Database Connection Failed!', {
      message: err.message,
      code: err.code,
      attempt: retryCount + 1
    });
    if (err.code === 'ENOTFOUND') { // simple english: host not found, so don't retry
      console.error('❗ Hostname not resolved. This is normal for new databases (takes up to 72 hours)');
      console.error('💡 Tips:');
      console.error('1. Check InfinityFree dashboard for IP address instead of hostname');
      console.error('2. Wait for DNS propagation to complete (usually 24-48 hours)');
      console.error('3. Verify the hostname in your dashboard matches: ' + process.env.DB_SERVER);
      return false;
    }
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying connection in ${retryDelay/1000}s... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return connectToDatabase(retryCount + 1);
    } else {
      console.error('❌ Max retries reached. Could not establish database connection.');
      // simple english: returning false so application can continue without DB
      return false;
    }
  }
};

// Initialize connection
connectToDatabase().then(isConnected => {
  if (!isConnected) {
    console.log('⚠️ Application will start without database connection');
  }
});

// Export pool and test function for external use
module.exports = {
  pool,
  testDatabaseAccess,
  connectToDatabase
};
