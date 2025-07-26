#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 开始分析包大小...\n');

// 构建项目
console.log('📦 构建项目...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ 构建完成\n');
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}

// 分析dist目录
const distPath = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist目录不存在');
  process.exit(1);
}

console.log('📊 分析文件大小...\n');

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeDirectory(dirPath, prefix = '') {
  const items = fs.readdirSync(dirPath);
  let totalSize = 0;
  
  items.forEach(item => {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      const dirSize = analyzeDirectory(itemPath, prefix + '  ');
      totalSize += dirSize;
      console.log(`${prefix}📁 ${item}/ (${formatBytes(dirSize)})`);
    } else {
      totalSize += stat.size;
      const relativePath = path.relative(distPath, itemPath);
      console.log(`${prefix}📄 ${relativePath} (${formatBytes(stat.size)})`);
    }
  });
  
  return totalSize;
}

const totalSize = analyzeDirectory(distPath);
console.log(`\n📈 总大小: ${formatBytes(totalSize)}`);

// 检查是否有压缩文件
const gzFiles = [];
const brFiles = [];

function findCompressedFiles(dirPath) {
  const items = fs.readdirSync(dirPath);
  items.forEach(item => {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      findCompressedFiles(itemPath);
    } else {
      if (item.endsWith('.gz')) {
        gzFiles.push({ path: itemPath, size: stat.size });
      } else if (item.endsWith('.br')) {
        brFiles.push({ path: itemPath, size: stat.size });
      }
    }
  });
}

findCompressedFiles(distPath);

if (gzFiles.length > 0) {
  console.log('\n🗜️  Gzip压缩文件:');
  gzFiles.forEach(file => {
    const relativePath = path.relative(distPath, file.path);
    console.log(`  📄 ${relativePath} (${formatBytes(file.size)})`);
  });
}

if (brFiles.length > 0) {
  console.log('\n🗜️  Brotli压缩文件:');
  brFiles.forEach(file => {
    const relativePath = path.relative(distPath, file.path);
    console.log(`  📄 ${relativePath} (${formatBytes(file.size)})`);
  });
}

console.log('\n✅ 分析完成！');
console.log('\n💡 优化建议:');
console.log('  1. 检查是否有未使用的依赖');
console.log('  2. 考虑使用动态导入进行代码分割');
console.log('  3. 优化图片资源大小');
console.log('  4. 检查是否有重复的代码'); 
