import StudioFrame from '@/components/studio/StudioFrame';

export const metadata = { title: '条款 · 星垣', description: '星垣的使用范围' };

export default function TermsPage() {
  return (
    <StudioFrame>
      <main className="xy-narrow xy-card">
        <p className="xy-kicker">条款</p>
        <h1 className="xy-title" style={{ fontSize: 36 }}>怎么用这套排盘</h1>
        <p>星垣用开源排盘引擎画出紫微斗数命盘，并在你主动请求时，用你自己的模型接口写一段阅读。没有账号，也没有付费墙。</p>
        <p>排盘代码继承自紫微研究 / Renhuai123/ziwei-doushu，协议是 MIT。这里的界面和提示词是另行编写的，不包含上游未公开的断语库，也不把《天纪》讲课原文当作功能打包进来。</p>
        <p>命盘和解读只供文化参考，不能代替医疗、法律、投资或重大人生决定。六亲相关的句子尤其粗，请只当参考。</p>
      </main>
    </StudioFrame>
  );
}