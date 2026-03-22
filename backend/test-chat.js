/**
 * 智谱AI对话接口测试脚本
 *
 * 使用方法:
 * 1. 确保 .env 中配置了 ZHIPU_API_KEY
 * 2. 启动服务: npm run dev
 * 3. 运行测试: node test-chat.js
 */

const http = require('http');

const testData = [
  {
    name: '基础问候',
    riderId: 'test001',
    message: '你好,我是外卖骑手',
  },
  {
    name: '罚单申诉咨询',
    riderId: 'test002',
    message: '我的订单超时了,怎么申诉罚单?',
  },
  {
    name: '收入查询',
    riderId: 'test003',
    message: '我想查询本周的收入',
  },
];

function testChat(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      riderId: data.riderId,
      message: data.message,
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

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 开始测试智谱AI对话接口\n');

  for (const test of testData) {
    console.log(`📝 测试: ${test.name}`);
    console.log(`   消息: ${test.message}`);

    try {
      const response = await testChat(test);

      if (response.code === 200) {
        console.log(`   ✅ 成功`);
        console.log(`   回复: ${response.data.reply}`);
        console.log(`   模型: ${response.data.model}\n`);
      } else {
        console.log(`   ❌ 失败: ${response.message}\n`);
      }
    } catch (error) {
      console.log(`   ❌ 错误: ${error.message}\n`);
    }

    // 避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('✨ 测试完成');
  console.log('\n⚠️  注意事项:');
  console.log('1. 如果看到降级提示,说明需要配置真实的 ZHIPU_API_KEY');
  console.log('2. 编辑 .env 文件,填入你的智谱AI API Key');
  console.log('3. 重启服务后再次测试\n');
}

runTests().catch(console.error);
