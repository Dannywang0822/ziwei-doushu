import Link from 'next/link';
import StudioFrame from '@/components/studio/StudioFrame';
import { DEMO_URL, SOURCE_REPO_URL, UPSTREAM_REPO_URL } from '@/lib/site';

const STEPS = [
  { n: '01', title: '填写出生', body: '公历、钟点、性别和出生地。时辰按真太阳时折算，晚子时沿用引擎自己的换日规则。' },
  { n: '02', title: '看完整的盘', body: '十二宫、四化、大限和流年都在盘上。这一步不访问网络。' },
  { n: '03', title: '导出盘面文件', body: '排盘页和合盘页都能下载一份 Markdown：可读的完整盘面，文末是引擎的完整 JSON。把文件交给分析机器人「紫微斗数」。没有 API 密钥也可以。xAI 解读是可选的。' },
];

export default function HomePage() {
  return (
    <StudioFrame>
      <main className="xy-narrow">
        <div className="xy-hero">
          <div className="xy-seal" aria-hidden>垣</div>
          <p className="xy-kicker">ZIWEI STUDIO</p>
          <h1 className="xy-title">星垣</h1>
          <p className="xy-lead">
            本地排好紫微斗数命盘，再导出一份完整文件交给分析机器人「紫微斗数」。
            排盘和导出都不需要 API 密钥。xAI 解读是可选的，没有额度也可以用。
          </p>
          <div className="xy-actions">
            <Link href="/chart" className="xy-primary">起一张盘</Link>
            <Link href="/heming" className="xy-secondary">两个人合盘</Link>
          </div>
        </div>

        <section className="xy-steps">
          {STEPS.map(step => (
            <article key={step.n} className="xy-card">
              <span className="xy-kicker">{step.n}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </section>

        <section className="xy-card xy-note">
          <h2>这套界面读什么</h2>
          <ul>
            <li>命盘结构、格局名称和合盘方法，用的是仓库里已经公开的引擎与知识。</li>
            <li>模型提示词是这里新写的，不附带商业断语库，也不把《天纪》讲课原文打包进来。</li>
            <li>没有账号、会员和支付。出生信息留在这台浏览器里，只有解读请求会送到你配置的接口。</li>
          </ul>
          <p className="xy-source">
            在线演示：
            {' '}
            <a href={DEMO_URL}>dannywang0822.github.io/ziwei-doushu</a>
            。源码：
            {' '}
            <a href={SOURCE_REPO_URL}>Dannywang0822/ziwei-doushu</a>
            。排盘引擎继承自
            {' '}
            <a href={UPSTREAM_REPO_URL}>紫微研究 / Renhuai123/ziwei-doushu</a>
            ，代码协议 MIT。古籍库仍在
            {' '}
            <Link href="/library">古籍</Link>
            ，星曜条目在
            {' '}
            <Link href="/knowledge">星曜</Link>
            。
          </p>
        </section>
      </main>
    </StudioFrame>
  );
}
