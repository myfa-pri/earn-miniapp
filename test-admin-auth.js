let errorThrown = false;
try {
  // Clearing environment variables to simulate missing configuration
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_KEY;

  // This should throw an error
  await import('./api/admin-auth.js');
} catch (error) {
  errorThrown = true;
  if (error.message !== "Missing required admin configuration variables.") {
    console.error("Unexpected error message:", error.message);
    process.exit(1);
  }
}

if (!errorThrown) {
  console.error("Error was not thrown when environment variables are missing.");
  process.exit(1);
}

console.log("Success: Module throws when config is missing.");

// Reset environment variables and test successful import
process.env.ADMIN_USERNAME = 'test_admin';
process.env.ADMIN_PASSWORD = 'test_password';
process.env.ADMIN_SESSION_KEY = 'test_key';

try {
  // Use a query parameter to bust the cache since we already imported it (or attempted to)
  await import('./api/admin-auth.js?cachebuster=1');
  console.log("Success: Module imports successfully when config is present.");
} catch (error) {
  console.error("Unexpected error when config is present:", error);
  process.exit(1);
}
