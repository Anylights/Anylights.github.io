# 作品详情页 - 快速参考

## 在你的项目数据中添加丰富内容

### 基础结构
```javascript
const PROJECTS_DATA = [
    {
        // 必填字段
        id: 'project-id',
        name: 'PROJECT NAME',
        description: '项目描述',
        image: 'assets/projects/project-id/cover.jpg',
        year: '2024',
        keywords: ['WORD1', 'WORD2', ...],
        fullSentence: '...',
        
        // 新增可选字段 ✨
        content: [ ... ],    // 详细内容
        links: [ ... ]       // 外部链接
    }
];
```

---

## Content 数组 - 支持 3 种类型

### 📝 文本 (text)
```javascript
{
    type: 'text',
    text: '你的描述文字'
}
```

### 🖼️ 图片 (image)
```javascript
{
    type: 'image',
    src: 'assets/projects/project-id/image.jpg',
    caption: '图片说明' // 可选
}
```

### 🎬 视频 (video)
```javascript
// Vimeo
{
    type: 'video',
    url: 'https://vimeo.com/123456789',
    caption: '视频说明' // 可选
}

// YouTube
{
    type: 'video',
    url: 'https://www.youtube.com/watch?v=xxx'
}

// 本地视频
{
    type: 'video',
    url: 'assets/projects/project-id/video.mp4'
}
```

---

## Links 数组 - 添加外部链接

```javascript
links: [
    { label: '在线体验', url: 'https://...' },
    { label: 'GitHub', url: 'https://...' },
    { label: '博客', url: 'https://...' }
]
```

---

## 完整示例

```javascript
{
    id: 'my-project',
    name: 'MY PROJECT',
    fullSentence: 'A sentence about your project.',
    keywords: ['KEYWORD1', 'KEYWORD2', 'KEYWORD3', 'KEYWORD4', 'KEYWORD5'],
    description: 'Brief description shown in gallery.',
    image: 'assets/projects/my-project/cover.jpg',
    year: '2024',
    
    content: [
        {
            type: 'text',
            text: '详细的项目背景和创意灵感...'
        },
        {
            type: 'image',
            src: 'assets/projects/my-project/01.jpg',
            caption: '项目照片'
        },
        {
            type: 'text',
            text: '技术实现和过程说明...'
        },
        {
            type: 'video',
            url: 'https://vimeo.com/123456789',
            caption: '项目演示视频'
        }
    ],
    
    links: [
        { label: 'View Online', url: 'https://my-project.com' },
        { label: 'GitHub', url: 'https://github.com/...' }
    ]
}
```

---

## 提示 💡

- ✅ `content` 和 `links` 都是**可选的**，可以省略
- ✅ 内容按数组顺序显示
- ✅ 图片建议最大宽度 700px
- ✅ 支持 Vimeo、YouTube 和本地视频
- ✅ Links 会自动在新标签页打开
- ✅ 内容块之间自动有间距，不需要添加空白段落

---

## 调试

在浏览器控制台（F12）查看是否有错误信息。常见问题：
- 图片 404：检查文件路径
- 视频无法播放：检查 URL 或文件格式
- 链接不工作：确保 URL 包含 `http://` 或 `https://`
