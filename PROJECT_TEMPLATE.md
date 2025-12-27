# 作品详情页 - 完整示例

## 示例项目：液态梦境 (Liquid Dreams)

### 1. 项目数据结构

```javascript
{
    // 基础信息（必填）
    id: 'liquid-dreams',
    name: 'LIQUID DREAMS',
    fullSentence: 'IN THE SPACE BETWEEN SLEEP AND WAKE, MEMORIES FLOW LIKE WATER.',
    keywords: ['DREAM', 'WATER', 'MEMORY', 'FLOW', 'SUBCONSCIOUS'],
    description: 'An immersive audiovisual experience exploring the fluid nature of dreams and memories through generative algorithms and interactive elements.',
    year: '2024',
    image: 'assets/projects/liquid-dreams/cover.jpg',
    
    // 可选：丰富内容展示
    content: [
        {
            type: 'text',
            text: '该项目灵感来自对梦境本质的思考。我们如何记忆？梦境中的符号如何转化为视觉形式？'
        },
        {
            type: 'text',
            text: '通过实时音频分析和生成式算法，装置根据参与者的声音创建独特的视觉景观。每个声音都被转化为流动的光影形态，在空间中舞动。'
        },
        {
            type: 'image',
            src: 'assets/projects/liquid-dreams/installation-01.jpg',
            caption: '安装现场照片：沉浸式空间布置'
        },
        {
            type: 'text',
            text: '项目采用 Three.js 进行实时 3D 渲染，使用 Web Audio API 分析声频数据。粒子系统响应音频的频率和幅度，创建有机的视觉动画。'
        },
        {
            type: 'image',
            src: 'assets/projects/liquid-dreams/installation-02.jpg',
            caption: '视觉效果细节：流动的颜色梯度'
        },
        {
            type: 'video',
            url: 'https://vimeo.com/123456789',
            caption: '项目演示视频（完整版本）'
        },
        {
            type: 'text',
            text: '这个项目获得了 XXXX 奖项，并在多个国际艺术节展出。它探讨了人机交互、声音可视化和记忆表现的主题。'
        }
    ],
    
    // 可选：外部链接
    links: [
        { label: 'View Online', url: 'https://liquid-dreams-demo.com' },
        { label: 'GitHub Repository', url: 'https://github.com/your-name/liquid-dreams' },
        { label: 'Project Blog Post', url: 'https://your-blog.com/liquid-dreams-breakdown' },
        { label: 'Vimeo Channel', url: 'https://vimeo.com/your-channel' }
    ]
}
```

### 2. 文件组织

```
assets/projects/liquid-dreams/
├── cover.jpg              # 封面图（1920×1080 推荐）
├── installation-01.jpg    # 项目照片 1
├── installation-02.jpg    # 项目照片 2
└── demo-video.mp4         # 本地视频（可选）
```

### 3. Content 字段详解

#### 文本段落 (text)
用于添加详细的描述、思考过程或任何文字内容。

```javascript
{
    type: 'text',
    text: '这里放置你的文字内容。支持多行文本，可以讲述项目背景、创意灵感、技术选择等。'
}
```

**特点：**
- 自动换行
- 支持多段落
- 添加了左侧荧光绿色强调线
- Hover 效果有背景亮度变化

#### 图片 (image)
展示项目相关的截图、照片或艺术作品。

```javascript
{
    type: 'image',
    src: 'assets/projects/liquid-dreams/photo.jpg',
    caption: '这是一张美丽的项目照片'
}
```

**特点：**
- 最大宽度 700px
- 圆角边框
- Hover 时边框变荧光绿，并有缩放效果
- 支持可选的图片说明

#### 视频 (video)
支持 Vimeo、YouTube 和本地视频。

**Vimeo 例子：**
```javascript
{
    type: 'video',
    url: 'https://vimeo.com/123456789',
    caption: '项目演示'
}
```

**YouTube 例子：**
```javascript
{
    type: 'video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    caption: '教程视频'
}
```

**本地视频例子：**
```javascript
{
    type: 'video',
    url: 'assets/projects/your-project/demo.mp4',
    caption: '本地演示'
}
```

**特点：**
- 自适应响应式
- 16:9 宽高比
- 支持全屏播放
- 可选的视频说明

### 4. Links 字段详解

添加到外部资源的链接。每个链接显示为一个可点击的按钮。

```javascript
links: [
    { label: '在线体验', url: 'https://your-demo.com' },
    { label: 'GitHub 源码', url: 'https://github.com/...' },
    { label: 'Blog 详解', url: 'https://blog.com/...' },
    { label: '作品集', url: 'https://portfolio.com' }
]
```

**特点：**
- 显示为一列按钮
- 包含 "↗" 外链符号
- Hover 时有发光和位移效果
- 自动在新标签页打开

### 5. 完整工作流

1. **创建文件夹** - 在 `assets/projects/` 下创建项目目录
2. **上传资源** - 将封面图、照片、视频放入该文件夹
3. **编写数据** - 在 `PROJECTS_DATA` 中添加项目配置
4. **描述内容** - 使用 `content` 数组按顺序排列内容
5. **添加链接** - 在 `links` 数组中添加相关链接
6. **完成** - 刷新页面，用户可以通过收集关键词解锁该作品

### 6. 最佳实践

#### 图片优化
- 使用适当的分辨率（1200px 宽度即可）
- 压缩图片大小（< 500KB）
- 使用 JPG 格式以获得最佳加载速度

#### 视频优化
- Vimeo 优先（更好的集成体验）
- 或使用 YouTube（更广泛的兼容性）
- 本地视频文件应 < 100MB

#### 文本内容
- 保持段落简洁（每段 2-3 句话）
- 使用清晰的语言描述技术细节
- 考虑加入个人的创意思考

#### 链接组织
- Live Demo 放在第一位
- GitHub/Source Code 放在第二位
- Blog/文章 放在第三位
- 其他链接按重要程度排序

### 7. 故障排除

**问题：图片不显示**
- 检查文件路径是否正确
- 确保图片文件存在
- 尝试刷新浏览器缓存

**问题：视频不播放**
- Vimeo/YouTube 确保视频是公开的
- 本地视频检查文件格式是否是 MP4
- 查看浏览器控制台是否有错误

**问题：链接无法点击**
- 检查 URL 格式是否正确（包含 http:// 或 https://）
- 确保 URL 不为空

---

**提示：** 可以将此文件作为模板，为每个新项目复制并修改！
