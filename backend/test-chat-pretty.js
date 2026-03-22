/**
 * 智谱AI对话接口测试脚本(美化版)
 *
 * 使用方法:
 * 1. 确保 .env 中配置了 ZHIPU_API_KEY
 * 2. 启动服务: npm run dev
 * 3. 运行测试: node test-chat-pretty.js
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
  {
    name: '订单异常',
    riderId: 'test004',
    message: '商家出餐慢导致配送超时,怎么处理?',
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
        'Content-Type': 'application/json; charset=utf-8',
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

function printBox(title, content, width = 60) {
  const border = '═'.repeat(width);
  const padding = '─'.repeat(width - 2);

  console.log(`╔${border}╗`);
  console.log(`║${title.padEnd(width)}║`);
  console.log(`╟${padding}╢`);
  console.log(`║${content.padEnd(width)}║`);
  console.log(`╚${border}╝`);
}

async function runTests() {
  console.log('\n' + '█'.repeat(62));
  console.log('█' + ' '.repeat(20) + '智谱AI对话接口测试' + ' '.repeat(20) + '█');
  console.log('█'.repeat(62) + '\n');

  let successCount = 0;
  let failCount = 0;

  for (let test of testData) {
    console.log(`\n📝 测试 ${testData.indexOf(test) + 1}/${testData.length}: ${test.name}`);
    console.log(`   👤 骑手ID: ${test.riderId}`);
    console.log(`   💬 消息: ${test.message}`);
    console.log(`   ⏳ 等待回复...\n`);

    try {
      const response = await testChat(test);

      if (response.code === 200) {
        successCount++;
        console.log(`   ✅ 成功`);

        const reply = response.data.reply || '无回复内容';
        const model = response.data.model || '未知模型';

        printBox(' 🤖 AI回复 ', reply);

        console.log(`   ℹ️  模型: ${model}`);
        console.log(`   ⏰ 时间: ${response.data.timestamp}\n`);
      } else {
        failCount++;
        console.log(`   ❌ 失败: ${response.message}\n`);
      }
    } catch (error) {
      failCount++;
      console.log(`   ❌ 错误: ${error.message}\n`);
    }

    // 避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log('\n' + '█'.repeat(62));
  console.log(`📊 测试统计: ✅ 成功 ${successCount} | ❌ 失败 ${failCount}`);
  console.log('█'.repeat(62));

  console.log('\n✨ 所有测试完成!\n');

  if (failCount > 0) {
    console.log('⚠️  注意事项:');
    console.log('   - 如果看到降级提示,说明需要配置真实的 ZHIPU_API_KEY');
    console.log('   - 编辑 .env 文件,填入你的智谱AI API Key');
    console.log('   - 重启服务后再次测试\n');
  } else {
    console.log('🎉 恭喜!智谱AI集成成功!\n');
    console.log('📚 下一步:');
    console.log('   - 实现上下文管理,支持多轮对话');
    console.log('   - 集成LangChain意图识别');
    console.log('   - 实现LangGraph业务工作流\n');
  }
}

runTests().catch(console.error);
