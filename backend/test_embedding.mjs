import axios from 'axios';
import config from './src/config/index.js';

async function test() {
  console.log('Testing embedding API...');
  try {
    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/embeddings', {
      model: 'embedding-3',
      input: '测试文本',
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + config.zhipu.apiKey,
      },
      timeout: 15000,
    });
    console.log('Embedding OK, 维度:', response.data.data[0].embedding.length);
  } catch (e: any) {
    console.log('Error:', e.response?.status, JSON.stringify(e.response?.data) || e.message);
  }
}

test();
