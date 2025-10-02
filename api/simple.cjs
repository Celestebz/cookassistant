// 简单的健康检查端点
module.exports = (req, res) => {
  console.log('Simple API called:', req.url, req.method);
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Simple API working',
    url: req.url,
    method: req.method
  }));
};
