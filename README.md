# WHERE DO WE GO NEXT? - Interactive Portfolio

## 项目概述

这是一个实验性的交互式作品集网站，用户通过在3D空间中探索和收集关键词来发现作品。项目采用 Three.js 构建 3D 场景，GSAP 处理动画，无框架依赖。

## 核心概念

### 🌌 荒原 (Field)
- 用户进入网站后看到 "WHERE DO WE GO NEXT?" 标题
- 点击进入 3D 关键词空间
- 使用 **WASD** 移动，**Q/E** 上下看，鼠标点击选择关键词
- 收集 **3个** 属于同一作品的关键词会解锁该作品
- 关键词之间会显示提示线条，帮助用户找到相关词汇

### 🖼️ 画廊 (Gallery)
- 3D 环形画廊展示所有作品
- 分**内外两层**，自动缓慢旋转
- **A/D** 或 **←/→** 方向键手动旋转
- 点击作品卡片查看详情

### 📄 作品详情
- 滚动驱动的标题动画（从中央缩放到左上角，类似 paprikawang 效果）
- 展示作品描述、封面图、视频等
- 显示解锁该作品时使用的关键词

## 技术栈

| 技术 | 用途 |
|------|------|
| **Three.js** (r160) | 3D渲染引擎 |
| **GSAP** (3.12.2) | 动画库 |
| **原生 JavaScript** | 无框架依赖 |
| **CSS3** | 样式和过渡动画 |

## 文件结构

```
Portfolio/
├── index.html              # 主页面
├── README.md               # 本文档
├── css/
│   └── style.css           # 所有样式
├── js/
│   ├── main.js             # 主逻辑（3D场景、交互、状态管理）
│   └── shaders.js          # WebGL着色器（背景效果）
├── assets/
│   ├── cursor.svg          # 自定义光标
│   └── projects/           # 作品资源（需要创建）
│       └── [project-id]/
│           ├── cover.jpg   # 封面图 (推荐 1920x1080)
│           ├── 01.jpg      # 详情图片
│           └── ...
└── docs/
    └── ...                 # 设计文档
```

## 状态管理

```javascript
state = {
    view: 'field',              // 当前视图: field, gallery, about, projectDetail
    fieldPhase: 'landing',      // Field阶段: landing, shattering, active, projectReveal
    collectedWords: [],         // 当前选中的关键词
    collectedProjects: {},      // 已收集的作品 (持久化到 localStorage)
    keys: { w, a, s, d, q, e, arrowleft, arrowright },  // 键盘状态
    // ...
}
```

## 关键函数

| 函数 | 描述 |
|------|------|
| `switchView(viewName)` | 切换视图 (field/gallery/about) |
| `selectKeyword(mesh)` | 选择关键词 |
| `checkProjectMatch()` | 检查是否匹配作品 |
| `startUnlockSequence(project)` | 开始作品解锁动画 |
| `showProjectDetail(project)` | 显示作品详情 |
| `setupScrollDrivenTransition()` | 滚动驱动标题动画 |
| `create3DGallery()` | 创建3D环形画廊 |
| `update3DGallery(time)` | 更新画廊动画 |
| `createHintLines(selectedMesh)` | 创建关键词提示线 |

## 添加新作品

### 1. 在 `PROJECTS_DATA` 中添加作品数据

```javascript
const PROJECTS_DATA = [
    {
        id: 'my-project',                    // 唯一ID（用于URL和存储）
        name: 'MY PROJECT NAME',             // 作品名称（全大写）
        fullSentence: 'A sentence describing the core concept of your work.',
        keywords: ['KEYWORD1', 'KEYWORD2', 'KEYWORD3', 'KEYWORD4', 'KEYWORD5'],
        description: 'Detailed description of the project...',
        year: '2024',
        
        // 可选字段
        coverImage: 'assets/projects/my-project/cover.jpg',
        images: [
            'assets/projects/my-project/01.jpg',
            'assets/projects/my-project/02.jpg',
        ],
        video: 'https://vimeo.com/xxxxxx',
        videoEmbed: '<iframe src="..."></iframe>',
        links: {
            live: 'https://my-project.com',
            github: 'https://github.com/...',
        },
        tags: ['WebGL', 'Interactive', 'Installation'],
    },
    // 更多作品...
];
```

### 2. 确保关键词规范

- 关键词必须**全大写**
- 每个作品建议 5-7 个关键词
- 关键词会自动添加到 Field 的关键词池中
- 填充词在 `FILLER_KEYWORDS` 数组中

### 3. 添加作品资源

```
assets/projects/my-project/
├── cover.jpg      # 封面图 (推荐 16:9 比例)
├── 01.jpg         # 详情图片
├── 02.jpg
└── video.mp4      # 可选：本地视频
```

## 自定义

### 修改背景颜色
编辑 `js/shaders.js` 中的 `fragmentShader`：
```glsl
vec3 colorGrad1 = vec3(0.15, 0.40, 0.45); // 主色调 (Teal)
vec3 colorGrad2 = vec3(0.05, 0.15, 0.20); // 暗色调
```

### 修改画廊布局
调整 `js/main.js` 中的常量：
```javascript
const GALLERY_RADIUS_INNER = 6;   // 内圈半径
const GALLERY_RADIUS_OUTER = 10;  // 外圈半径
const GALLERY_Y_INNER = 0.5;      // 内圈高度
const GALLERY_Y_OUTER = -1.2;     // 外圈高度
```

### 修改解锁所需关键词数
```javascript
const MATCH_THRESHOLD = 3; // 解锁作品需要的关键词数量
```

## 交互说明

### Field 视图
| 操作 | 功能 |
|------|------|
| **W/S** | 前进/后退 |
| **A/D** | 左转/右转 |
| **Q/E** | 向下/向上看 |
| **鼠标点击** | 选择关键词 |

### Gallery 视图
| 操作 | 功能 |
|------|------|
| **A/D** 或 **←/→** | 旋转画廊 |
| **鼠标点击** | 打开作品详情 |
| 不操作时 | 自动缓慢旋转 |

### 作品详情
| 操作 | 功能 |
|------|------|
| **滚动** | 标题缩放动画 → 内容出现 |
| **Back 按钮** | 返回上一视图 |

## 已知限制

- Safari theme-color 需要 HTTPS 环境
- 移动端触控支持有限（推荐桌面浏览）
- 低性能设备可能需要降低粒子数量

## 部署

### Vercel (推荐)
```bash
npm i -g vercel
cd Portfolio
vercel
```

### GitHub Pages
1. 在仓库设置中启用 GitHub Pages
2. 选择 `main` 分支
3. 访问 `https://username.github.io/Portfolio/`

## 开发历史

本项目通过 AI 辅助开发，经历了以下主要迭代：

1. **基础框架** - Three.js 场景、着色器背景
2. **关键词系统** - 3D 文字、选择交互、连线提示
3. **作品匹配** - 关键词→作品的解锁机制
4. **动画优化** - 滚动驱动标题、粒子效果
5. **Gallery 重构** - 从静态列表到 3D 环形画廊
6. **细节打磨** - 视觉、交互、Bug 修复

## 许可证

MIT License

## 作者

**Anylight**  
Creative Developer & Interaction Designer

---

*WHERE DO WE GO NEXT?*