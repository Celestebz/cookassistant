const { createRequire } = require('module');
const require = createRequire(import.meta.url);

// 简单的健康检查端点
module.exports = async (req, res) => {
  console.log('Simple API called:', req.url, req.method);
  
  if (req.url === '/health' || req.url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Simple API working' 
    }));
    return;
  }
  
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
};
