/**
 * GitHub Pages 静态导出。
 * 排盘和导出都在浏览器里完成。API 路由和 server action 依赖 Node，
 * 静态托管用不上，构建前先挪开，结束再放回，避免弄脏工作区。
 */
import { spawn } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';

const moves = [
  ['app/api', 'app/_api_pages_hidden'],
  ['app/export/actions.ts', 'app/export/_actions.ts.off'],
];

function hide() {
  for (const [from, to] of moves) {
    if (existsSync(from)) renameSync(from, to);
  }
}

function restore() {
  for (const [from, to] of moves) {
    if (existsSync(to) && !existsSync(from)) renameSync(to, from);
  }
}

hide();

const child = spawn('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    GITHUB_PAGES: 'true',
    NEXT_PUBLIC_STATIC_DEMO: 'true',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://dannywang0822.github.io/ziwei-doushu',
  },
});

let settled = false;
function finish(code) {
  if (settled) return;
  settled = true;
  restore();
  process.exit(code);
}

process.on('SIGINT', () => finish(1));
process.on('SIGTERM', () => finish(1));

child.on('exit', (code) => {
  finish(code ?? 1);
});
