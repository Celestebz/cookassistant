#!/usr/bin/env node

/**
 * 测试 Doubao-Seed-1.6-flash 模式 API
 * 使用方法: node test_doubao_seed.js
 */

import fetch from 'node-fetch';

const ARK_API_KEY = "3dafef81-fdc1-4148-bb39-87c396f94c2a";
const API_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

async function testDoubaoSeed() {
  console.log('🚀 测试 Doubao-Seed-1.6-flash 模式...');
  console.log('API 端点:', API_ENDPOINT);
  console.log('API 密钥:', ARK_API_KEY.substring(0, 10) + '...');
  
  // 使用示例图片 URL（你可以替换为实际的图片 URL）
  const testImageUrl = "https://ark-project.tos-cn-beijing.ivolces.com/images/view.jpeg";
  
  const requestBody = {
    model: "ep-20250921085349-k25sf",
    messages: [
      {
        content: [
          {
            image_url: {
              url: testImageUrl
            },
            type: "image_url"
          },
          {
            text: "请分析这张图片中的菜品，提供详细的菜谱信息，包括菜品名称、主要食材和烹饪步骤。请用中文回答，格式如下：\n\n**菜品名称：** [菜品名称]\n\n**主要食材：**\n- [食材1]\n- [食材2]\n- [食材3]\n\n**烹饪步骤：**\n1. [步骤1]\n2. [步骤2]\n3. [步骤3]",
            type: "text"
          }
        ],
        role: "user"
      }
    ],
    temperature: 0.3
  };

  try {
    console.log('📤 发送 API 请求...');
    console.log('请求体:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📊 响应状态:', response.status);
    console.log('📊 响应状态文本:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 调用失败:');
      console.error('错误状态:', response.status);
      console.error('错误信息:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ API 调用成功!');
    console.log('📋 响应数据:', JSON.stringify(data, null, 2));

    // 提取并显示结果
    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      console.log('\n🎯 识图结果:');
      console.log('='.repeat(50));
      console.log(content);
      console.log('='.repeat(50));
    } else {
      console.log('⚠️ 未获取到有效内容');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testDoubaoSeed();
