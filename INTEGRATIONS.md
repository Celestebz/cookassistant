### 外部模型与服务集成说明（MVP）

## SeeDream 4.0（图片生成）
- Endpoint: `https://ark.cn-beijing.volces.com/api/v3/images/generations`
- Header: `Authorization: Bearer ${SEEDREAM_API_KEY}`、`Content-Type: application/json`
- Body 最小示例：
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SEEDREAM_API_KEY}" \
  -d '{
    "model": "doubao-seedream-4-0-250828",
    "prompt": "...",
    "sequential_image_generation": "disabled",
    "response_format": "url",
    "size": "2K",
    "stream": false,
    "watermark": false
  }'
```
- 产品对齐：`size=2K` 对应短边约 2048px；`watermark=false` 无水印原图。

## Doubao 1.6 Flash（烹饪步骤生成）
- Endpoint: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- Header: `Authorization: Bearer ${DOUBAO_API_KEY}`、`Content-Type: application/json`
- 模型名: `doubao-seed-1-6-flash-250828`
- 最小示例：
```bash
curl https://ark.cn-beijing.volces.com/api/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DOUBAO_API_KEY}" \
  -d $'{
    "model": "doubao-seed-1-6-flash-250828",
    "messages": [
        {
            "content": [
                {"image_url": {"url": "https://ark-project.tos-cn-beijing.ivolces.com/images/view.jpeg"}, "type": "image_url"},
                {"text": "图片主要讲了什么?", "type": "text"}
            ],
            "role": "user"
        }
    ]
}'
```
- 本项目用法：输入为“成品图URL + 指令提示”，产出中文步骤（3–8步），与识别出的食材与区间用量对齐。
- 适配器：`providers/doubao.ts`（鉴权、超时、重试、输出结构化提取）。

## 适配层建议
- 统一超时（如 15s）与重试（如 1 次，指数退避）；统一错误码映射。
- Provider 接口：`generateSteps(input): Recipe`、`generateFlatlay(prompt, opts): Url`。


