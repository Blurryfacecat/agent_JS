const http = require('http');

const postData = JSON.stringify({
  riderId: 'debug001',
  message: '你好,我是外卖骑手',
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('📤 发送请求到:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('📝 请求数据:', postData);
console.log('');

const req = http.request(options, (res) => {
  console.log(`📊 状态码: ${res.statusCode}`);
  console.log(`📋 响应头:`, res.headers);
  console.log('');

  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('📥 响应体:');
    console.log(body);
    console.log('');

    try {
      const response = JSON.parse(body);
      console.log('🤖 AI回复:', response.data?.reply || '无回复');
      console.log('ℹ️  模型:', response.data?.model || '未知');
      console.log('⏰ 时间:', response.data?.timestamp || '未知');
    } catch (error) {
      console.log('❌ JSON解析失败:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
});

req.write(postData);
req.end();
