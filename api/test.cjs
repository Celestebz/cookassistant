// 简单的测试API
module.exports = async (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Test API working',
    timestamp: new Date().toISOString()
  });
};
