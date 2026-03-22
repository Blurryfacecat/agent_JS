/**
 * 智谱AI LLM调试脚本
 * 用于测试API Key和模型配置是否正确
 */

const axios = require('axios');
const config = {
  apiKey: process.env.ZHIPU_API_KEY || '526db8c460814954828f3f2c6304f945.feO5z3dDkKUtauql',
  model: process.env.ZHIPU_MODEL || 'glm-4-flash',
  apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
};

async function testLLM() {
  console.log('🧪 开始测试智谱AI API\n');
  console.log('📝 配置信息:');
  console.log(`   API Key: ${config.apiKey.substring(0, 20)}...`);
  console.log(`   模型: ${config.model}`);
  console.log(`   API URL: ${config.apiUrl}\n`);

  const testMessages = [
    {
      role: 'system',
      content: '你是一个外卖骑手智能客服助手。',
    },
    {
      role: 'user',
      content: '你好,请问外卖超时罚款怎么申诉?',
    },
  ];

  try {
    console.log('📤 发送测试请求...\n');

    const response = await axios.post(
      config.apiUrl,
      {
        model: config.model,
        messages: testMessages,
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        timeout: 30000,
      }
    );

    console.log('✅ 请求成功!\n');
    console.log('📥 响应数据:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.choices && response.data.choices.length > 0) {
      const reply = response.data.choices[0].message.content;
      console.log('\n🤖 AI回复:');
      console.log(reply);
    }

    console.log('\n📊 Token使用情况:');
    console.log(`   Prompt: ${response.data.usage?.prompt_tokens || 'N/A'}`);
    console.log(`   Completion: ${response.data.usage?.completion_tokens || 'N/A'}`);
    console.log(`   Total: ${response.data.usage?.total_tokens || 'N/A'}`);

  } catch (error) {
    console.log('\n❌ 请求失败!\n');
    console.log('错误信息:', error.message);

    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
    }

    console.log('\n常见问题:');
    console.log('1. API Key无效 - 检查 .env 中的 ZHIPU_API_KEY');
    console.log('2. 模型名称错误 - 常见模型: glm-4-flash, glm-4, glm-4-plus');
    console.log('3. 网络问题 - 检查是否能访问 open.bigmodel.cn');
    console.log('4. 配额不足 - 登录智谱AI控制台查看剩余配额');
  }
}

testLLM();
