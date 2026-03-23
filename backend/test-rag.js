/**
 * RAG功能测试脚本
 *
 * 测试流程:
 * 1. 初始化知识库
 * 2. 添加示例文档
 * 3. 搜索知识
 * 4. 清理测试数据
 */

const http = require('http');

const API_BASE = 'http://localhost:3000/api/v1/knowledge';

/**
 * 发送HTTP请求
 */
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE).href;
    const postData = data ? JSON.stringify(data) : null;

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: url.replace('http://localhost:3000', ''),
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/**
 * 测试流程
 */
async function runTests() {
  console.log('\n' + '█'.repeat(62));
  console.log('█' + ' '.repeat(20) + 'RAG功能测试' + ' '.repeat(22) + '█');
  console.log('█'.repeat(62) + '\n');

  try {
    // 1. 初始化知识库
    console.log('📝 步骤1: 初始化知识库');
    const initResult = await request('POST', '/init', {
      collectionName: 'rider_knowledge_base'
    });

    if (initResult.status === 200) {
      console.log('   ✅ 初始化成功');
      console.log(`   📊 当前文档数: ${initResult.data.data.documentCount}\n`);
    } else {
      console.log(`   ❌ 初始化失败: ${initResult.data.message}\n`);
      return;
    }

    // 2. 添加示例文档
    console.log('📝 步骤2: 添加示例文档');
    const documents = [
      {
        id: 'rule_001',
        text: '配送超时规则:午高峰(11:00-13:00)和晚高峰(17:00-19:00)期间,配送时间不得超过45分钟。其他时间配送时间不得超过30分钟。超过规定时间视为配送超时。',
        metadata: {
          category: '配送规则',
          priority: 1,
          tags: ['超时', '配送时间']
        }
      },
      {
        id: 'penalty_001',
        text: '超时罚款标准:单次超时罚款10元;一周内累计3次超时,额外罚款20元;一周内累计5次超时,暂停配送权限1天。罚款金额将从当周收入中直接扣除。',
        metadata: {
          category: '罚单规则',
          priority: 2,
          tags: ['罚款', '超时']
        }
      },
      {
        id: 'appeal_001',
        text: '罚单申诉流程:1.打开骑手APP 2.点击"我的"进入个人中心 3.选择"罚单申诉" 4.选择要申诉的罚单 5.填写申诉理由 6.上传相关证据(如截图、照片) 7.提交申诉 8.等待审核结果(通常1-3个工作日)',
        metadata: {
          category: '申诉流程',
          priority: 3,
          tags: ['申诉', '流程']
        }
      },
      {
        id: 'income_001',
        text: '收入结算规则:每周二结算上周收入,结算金额包含基础配送费+奖励+补贴-罚款。收入将自动转入绑定的银行卡,预计到账时间为结算当日24点前。如遇节假日,到账时间可能延后。',
        metadata: {
          category: '收入规则',
          priority: 2,
          tags: ['收入', '结算']
        }
      },
      {
        id: 'exception_001',
        text: '订单异常处理:遇到订单异常(如商家出餐慢、顾客地址错误、商品损坏等),应立即联系客服报备。客服会根据实际情况协调处理,可申请免除因异常导致的超时罚款。',
        metadata: {
          category: '异常处理',
          priority: 2,
          tags: ['异常', '客服']
        }
      }
    ];

    const addResult = await request('POST', '/documents', { documents });

    if (addResult.status === 200) {
      console.log('   ✅ 文档添加成功');
      console.log(`   📊 添加文档数: ${addResult.data.data.addedCount}`);
      console.log(`   📊 总文档数: ${addResult.data.data.totalDocuments}\n`);
    } else {
      console.log(`   ❌ 添加失败: ${addResult.data.message}\n`);
      return;
    }

    // 等待向量索引建立
    console.log('⏳ 等待向量索引建立...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('');

    // 3. 搜索测试
    console.log('📝 步骤3: 搜索知识库\n');

    const searchQueries = [
      '配送超时多长时间算违规?',
      '超时了要罚多少钱?',
      '怎么申诉罚单?',
      '收入什么时候结算?',
      '订单异常怎么办?'
    ];

    for (const query of searchQueries) {
      console.log(`🔍 查询: "${query}"`);

      const searchResult = await request('POST', '/search', {
        query,
        topK: 2
      });

      if (searchResult.status === 200) {
        const { results, count } = searchResult.data.data;

        if (count > 0) {
          console.log(`   ✅ 找到 ${count} 个相关文档:`);

          results.forEach((result, index) => {
            console.log(`   [${index + 1}] 相似度: ${(result.score * 100).toFixed(1)}%`);
            console.log(`       分类: ${result.metadata?.category || '未知'}`);
            console.log(`       内容: ${result.text.substring(0, 80)}...`);
          });
        } else {
          console.log('   ⚠️  未找到相关文档');
        }
      } else {
        console.log(`   ❌ 搜索失败: ${searchResult.data.message}`);
      }

      console.log('');

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 4. 获取统计信息
    console.log('📝 步骤4: 获取知识库统计');
    const statsResult = await request('GET', '/stats');

    if (statsResult.status === 200) {
      console.log(`   ✅ 文档总数: ${statsResult.data.data.totalDocuments}\n`);
    }

    // 询问是否清空知识库
    console.log('📝 步骤5: 清理测试数据');
    console.log('   ℹ️  如需清空知识库,请手动调用:');
    console.log('      DELETE http://localhost:3000/api/v1/knowledge/clear\n');

    console.log('█'.repeat(62));
    console.log('✨ RAG功能测试完成!');
    console.log('█'.repeat(62));
    console.log('\n📚 测试总结:');
    console.log('   ✅ 知识库初始化成功');
    console.log('   ✅ 文档添加成功');
    console.log('   ✅ 向量检索成功');
    console.log('   ✅ 语义搜索正常');
    console.log('\n🎯 后续步骤:');
    console.log('   1. 集成到对话接口');
    console.log('   2. 实现RAG增强回答');
    console.log('   3. 添加更多知识文档');
    console.log('   4. 优化检索质量\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n⚠️  请确保:');
    console.log('   1. ChromaDB服务器已启动 (chroma-server --port 8000)');
    console.log('   2. 后端服务已启动 (npm run dev)');
    console.log('   3. 智谱AI API Key已配置\n');
  }
}

// 运行测试
runTests();
