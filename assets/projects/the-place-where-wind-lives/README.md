# 项目模板使用说明

## 快速开始

1. **复制此文件夹**：将 `_template` 文件夹复制一份，重命名为你的项目ID（例如：`my-awesome-project`）

2. **编辑 project.json**：打开 `project.json` 文件，填写你的项目信息

3. **添加图片**：将项目封面图命名为 `cover.jpg` 放在项目文件夹中

4. **注册项目**：在 `js/main.js` 文件顶部的 `PROJECT_IDS` 数组中添加你的项目ID

## project.json 字段说明

### 必填字段

- **id**: `string` - 项目的唯一标识符，与文件夹名称一致
- **name**: `string` - 项目名称，显示在标题位置
- **fullSentence**: `string` - 项目的核心理念，用于解锁动画
- **keywords**: `array` - 5-8个关键词，用户通过收集关键词来解锁项目
- **description**: `string` - 简短描述，显示在画廊视图
- **image**: `string` - 封面图路径，格式：`assets/projects/your-project-id/cover.jpg`
- **year**: `string` - 项目年份

### 可选字段

- **links**: `array` - 项目相关链接
  - `label`: 链接显示文字
  - `url`: 链接地址
  - 如果没有链接，设为空数组 `[]`

- **content**: `string` - 详细的项目介绍（支持HTML）
  - 可以包含多个段落 `<p>...</p>`
  - 可以插入图片 `<img src='...' alt='...'>`
  - 如果不需要详细介绍，设为空字符串 `""`，系统会使用 `description` 字段

## 示例

参考 `avatar-zero` 项目的配置：
```
assets/projects/avatar-zero/
├── project.json
└── cover.jpg
```

## 关键词建议

- 使用全大写英文单词
- 每个项目 5-8 个关键词
- 选择能代表项目核心概念的词汇
- 关键词之间可以有重叠（多个项目共享关键词）

## 内容编写技巧

### 简洁版（仅使用 description）
```json
{
  "content": ""
}
```

### 图文混排版
```json
{
  "content": "<p>First paragraph...</p><img src='assets/projects/your-id/image1.jpg'><p>Explain the image...</p>"
}
```

### 建议图片尺寸
- 封面图（cover.jpg）: 1200x800px 左右
- 内容图片: 1000px 宽度以内

## 添加新项目的完整流程

1. 复制 `_template` 文件夹 → 重命名
2. 编辑 `project.json`
3. 添加 `cover.jpg` 和其他图片
4. 在 `js/main.js` 的 `PROJECT_IDS` 数组中添加项目ID：
   ```javascript
   const PROJECT_IDS = [
       'avatar-zero',
       'flux-state',
       'your-new-project-id'  // 添加这一行
   ];
   ```
5. 刷新页面即可看到新项目
