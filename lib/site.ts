/**
 * 站点根地址。本地开发用 http://localhost:3000。
 * GitHub Pages 构建会把 NEXT_PUBLIC_SITE_URL 写成在线演示地址。
 */
export const SOURCE_REPO_URL = 'https://github.com/Dannywang0822/ziwei-doushu';
export const DEMO_URL = 'https://dannywang0822.github.io/ziwei-doushu';
export const UPSTREAM_REPO_URL = 'https://github.com/Renhuai123/ziwei-doushu';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** GitHub Pages 静态演示没有服务端，模型接口不可用。 */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === 'true';

export const STATIC_DEMO_NOTE = '这是 GitHub Pages 上的静态演示，没有配置 xAI。排盘和「导出盘面文件」在浏览器里完成。把下载的 Markdown 交给紫微斗数即可。';

/** 只取域名部分，用于界面上展示（如分享卡底部） */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
