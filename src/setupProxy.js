const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // === Backend JIRA Endpoints ===
  // These specific JIRA endpoints should go to our backend, not Atlassian
  const backendJiraEndpoints = [
    '/api/jira/config',
    '/api/jira/config2',  // JIRA Config 2 endpoints
    '/api/jira/test',
    '/api/jira/test-connection',
    '/api/jira/credentials-status',
    '/api/jira/credentials',
    '/api/jira/projects',
    '/api/jira/import-tickets',
    '/api/jira/metadata',
    '/api/jira/imports',
    '/api/jira/import',  // Changed to match all /api/jira/import/* routes
    '/api/jira/debug-fields',
    '/api/jira/filter-presets'
  ];

  // Proxy backend JIRA endpoints to our server
  backendJiraEndpoints.forEach(endpoint => {
    app.use(
      endpoint,
      createProxyMiddleware({
        target: "http://localhost:3600",
        changeOrigin: true,
        logLevel: 'debug',
        onProxyReq: (proxyReq, req, res) => {
          console.log("Proxying backend JIRA endpoint to:", req.method, req.url);
        }
      })
    );
  });

  // Special handling for SSE (Server-Sent Events) endpoints
  app.use(
    '/api/jira/import/:importId/progress',
    createProxyMiddleware({
      target: "http://localhost:3600",
      changeOrigin: true,
      // SSE specific settings
      onProxyReq: (proxyReq, req, res) => {
        // SSE connections should not timeout
        req.setTimeout(0);
        console.log("Proxying SSE endpoint:", req.url);
      },
      onProxyRes: (proxyRes, req, res) => {
        // Ensure SSE headers are preserved
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
      }
    })
  );

  // === JIRA API Proxy ===
  // This handles actual JIRA API calls to Atlassian
  app.use(
    "/api/jira",
    createProxyMiddleware({
      target: "https://mediagenix.atlassian.net", // ❗ IMPORTANT: Change to your real JIRA URL
      changeOrigin: true,
      pathRewrite: {
        "^/api/jira": "/rest/api/2", // Rewrites the request path for JIRA's API structure
      },
      onProxyReq: (proxyReq, req, res) => {
        // Note: JIRA needs an Authorization header, so we DON'T remove it here.
        console.log("Proxying to Atlassian JIRA:", req.method, req.url);
      }
    })
  );

  // === Main Backend API Proxy ===
  // This is a general catch-all for all other /api requests.
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:3600", // Your own backend server
      changeOrigin: true,
      logLevel: 'debug', // Add debug logging
      onProxyReq: (proxyReq, req, res) => {
        // Your existing logic to remove headers for your own backend is kept here.
        proxyReq.removeHeader("cookie");
        proxyReq.removeHeader("authorization");
        console.log("Proxying to Main Backend:", req.method, req.url);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log("Backend response:", req.url, proxyRes.statusCode);
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        console.error('Failed to proxy:', req.url);
        console.error('Backend target:', 'http://localhost:3600');
        res.status(500).json({ error: 'Proxy error', details: err.message });
      }
    })
  );
};
