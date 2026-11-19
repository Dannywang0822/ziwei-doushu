import StudioFrame from '@/components/studio/StudioFrame';

export const metadata = { title: '隐私 · 星垣', description: '星垣如何处理出生信息与解读请求' };

export default function PrivacyPage() {
  return (
    <StudioFrame>
      <main className="xy-narrow xy-card">
        <p className="xy-kicker">隐私</p>
        <h1 className="xy-title" style={{ fontSize: 36 }}>出生信息留在这台浏览器里</h1>
        <p>星垣没有账号、会员或支付。排盘在你的浏览器里完成，不会为了起盘把出生时间发到别处。</p>
        <p>只有当你点击解读或合盘时，服务器才会把命盘结构发给你在环境变量里配置的模型接口（默认是 xAI 的 <code>https://api.x.ai/v1</code>）。密钥只放在服务器环境里，不会写进页面，也不会出现在仓库里。</p>
        <p>这个应用自己不保存命盘历史，也不接入统计回传。模型服务商会按它自己的条款处理那一次请求。</p>
        <p>解读是传统命理的文化阅读，不是医疗、法律或财务建议。</p>
      </main>
    </StudioFrame>
  );
}
