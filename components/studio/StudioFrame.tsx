'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { DEMO_URL, SOURCE_REPO_URL, UPSTREAM_REPO_URL } from '@/lib/site';

const LINKS = [
  { href: '/chart', label: '排盘' },
  { href: '/heming', label: '合盘' },
  { href: '/library', label: '古籍' },
  { href: '/knowledge', label: '星曜' },
];

export default function StudioFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <div className="xy-app">
      <header className="xy-bar">
        <Link href="/" className="xy-brand">星垣</Link>
        <nav className="xy-nav">
          {LINKS.map(link => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} data-active={active ? 'true' : 'false'}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" className="xy-theme" onClick={toggle}>
          {theme === 'dark' ? '亮色' : '暗色'}
        </button>
      </header>
      <div className="xy-body">{children}</div>
      <footer className="xy-footer">
        <span>
          <a href={DEMO_URL}>在线演示</a>
          {' · '}
          <a href={SOURCE_REPO_URL}>源码</a>
        </span>
        <span>
          排盘引擎来自
          {' '}
          <a href={UPSTREAM_REPO_URL}>紫微研究 / Renhuai123/ziwei-doushu</a>
          （MIT）。
        </span>
        <span>没有 xAI 密钥时，请用「导出盘面文件」。解读只供文化参考。</span>
        <span className="xy-footer-links">
          <Link href="/privacy">隐私</Link>
          <Link href="/terms">条款</Link>
        </span>
      </footer>
    </div>
  );
}
