// 最简单的健康检查端点
export default function handler(req, res) {
  console.log('Health check called:', req.url, req.method);
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Health check working',
    url: req.url,
    method: req.method
  });
}
