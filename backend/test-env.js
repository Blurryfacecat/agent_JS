// 测试环境变量加载
require('dotenv').config();

console.log('🔍 测试环境变量加载\n');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('ZHIPU_API_KEY:', process.env.ZHIPU_API_KEY ? process.env.ZHIPU_API_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('ZHIPU_MODEL:', process.env.ZHIPU_MODEL || 'NOT SET');
console.log('ZHIPU_TEMPERATURE:', process.env.ZHIPU_TEMPERATURE || 'NOT SET');

if (!process.env.ZHIPU_API_KEY) {
  console.log('\n❌ ZHIPU_API_KEY 未加载!');
  console.log('请检查:');
  console.log('1. .env 文件是否存在');
  console.log('2. .env 文件是否在项目根目录');
  console.log('3. dotenv 是否正确安装和导入');
} else {
  console.log('\n✅ 环境变量加载成功!');
}
