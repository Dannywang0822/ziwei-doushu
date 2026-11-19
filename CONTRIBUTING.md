# 参与贡献

欢迎提问题、提修复、提建议。先说清两件事：

- 这个仓库是 **星垣**：本地排盘，导出完整命盘文件，可选 xAI 解读。源码是 [Dannywang0822/ziwei-doushu](https://github.com/Dannywang0822/ziwei-doushu)。在线演示是 [https://dannywang0822.github.io/ziwei-doushu/](https://dannywang0822.github.io/ziwei-doushu/)（GitHub Pages，不需要 API 密钥）。
- 排盘引擎和开源数据集继承自上游 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（代码 MIT，数据集 CC BY 4.0）。上游商业站不是星垣的演示站。没有 `XAI_API_KEY` 时，命盘和「导出盘面文件」仍然可用；解读按钮会说明接口未配置。

## 提问题

- **怎么用、想交流**：去 [讨论区](https://github.com/Dannywang0822/ziwei-doushu/discussions)。
- **觉得盘排得不对**：用「排盘结果疑问」模板，附上公历出生日期、几点几分、出生地或经度、性别、本项目的结果，以及你拿来对照的结果。只写「不准」我们没法查。
  - 辅星亮度、闰月归属、晚子时是否换日，各流派本来就不同，引擎里做成了可切换的口径；这类差异不算 bug，但欢迎指出。
- **程序报错、页面异常**：用「程序问题」模板，写清复现步骤和报错。
- **星垣页面（本地 `/chart`、`/heming`、导出）的问题**：用「星垣界面」模板。请写本机地址（例如 `http://localhost:3000/chart`），不要把上游商业站的登录或支付问题开到这里。

请不要在 issue 里贴手机号、验证码、API 密钥，或未经本人同意的他人生辰信息。

## 提交代码

```bash
npm ci               # 按 package-lock.json 安装
npm run typecheck    # 类型检查
npm test             # 排盘回归
```

- 一个 PR 只做一件事，说明里写清改了什么、为什么。
- **改排盘结果的**：附上对照证据（出处，或其他排盘软件的截图），并在 `scripts/regression/` 加回归测试、登记到 `package.json` 的 `test` 脚本。没有出处的口径改动一般不收。
- CI 会在每次 push 和 PR 上跑同一套检查。

## 许可

提交即表示你同意贡献内容按对应协议发布：

- 代码：[MIT](./LICENSE)
- 样本数据集：[CC BY 4.0](./DATASET-LICENSE)
- 倪师原话目录 `docs/tianji-ziwei/`：[CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md)，不许商用

---

**English.** Issues and PRs are welcome. This repository is Xingyuan (星垣): local Zi Wei charts, a Markdown export for the analysis bot 紫微斗数, and optional xAI reading. The charting engine and datasets come from upstream [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu). The upstream commercial site is not this project's demo. Charting and export work without `XAI_API_KEY`. For a chart you believe is wrong, use the "Chart result question" form with full birth data and a reference result. Before opening a PR, run `npm ci`, `npm run typecheck` and `npm test`; changes to chart results need evidence and a regression test.
