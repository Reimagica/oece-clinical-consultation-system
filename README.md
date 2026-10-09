# oece临床问诊系统

面向医学生的病例模拟与临床思维形成性评估演示系统，包含教师建考、患者问诊、体格检查、辅助检查、病例汇报与诊疗计划，以及带评分证据的评价报告。

本次源码交付日期：2026-10-09。基于已发布的版本9，原始源码提交为 `2fcd70b69cf793d8b6c67574d82380b1f9b44aab`。

## 本地启动

需要 Node.js 22.13.0 或更高版本，以及 npm。本次交付使用 Node.js 24.15.0 验证。

在项目根目录执行：

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。可从首页进入教师端或学员端，使用页面中的演示入口体验完整病例流程。

项目使用 React、TypeScript、Vinext/Vite 和 Cloudflare Workers，保留 Sites 构建插件。使用 `npm run dev` 启动，以支持服务端的 Cloudflare 环境绑定。

## 功能与素材

- 四阶段：重点病史采集 → 体格检查 → 辅助检查 → 病例汇报与诊疗计划。
- 固定患者对话回放、实时AI问诊、结束后补问、草稿记录与阶段作答。
- 自由输入检查项目，逐项生成结果、填写分析及调整顺序。
- 浏览器中文语音输入、31轮固定患者语音、开始/循环说话/停止/轻咳四段视频。
- 七维报告：六维计分与百分制总分，问诊推理性待教师评价；评分证据、雷达图与演示排行榜。

固定音视频已包含在 `public/assets/`，运行网页无需下载制作模型。`animation-source/` 和 `scripts/` 保留媒体制作资料；如需重新生成，另按 `PATIENT_AVATAR.md` 配置 Python、模型及工具。

## 可选AI配置

固定对话、演示作答、默认检查结果和报告不需要API密钥。实时患者问答需要自行配置 DeepSeek 密钥。

本地开发可在项目根目录创建被 Git 忽略的 `.dev.vars`：

```dotenv
DEEPSEEK_API_KEY=填写你自己的密钥
```

部署时通过目标平台的服务端密文环境变量配置密钥。不要将真实密钥提交到GitHub，也不要使用 `NEXT_PUBLIC_` 等前端公开变量。

默认检查结果来自固定病例资料。若需启用AI检查项目匹配，再配置 `CHECK_RESULT_MODE=deepseek`，详见 `CHECK_RESULT_SERVICE.md`。

本交付不包含任何实际API密钥、GitHub凭证或既有线上部署权限。`.openai/hosting.json` 仅保留空的本地绑定配置，已移除原Sites项目标识；部署到新环境需自行配置。

## 验证与构建

```sh
node scripts/verify-p01.cjs
node scripts/verify-patient-api.cjs
node scripts/verify-patient-playback.cjs
node scripts/verify-patient-media.cjs
npx tsc --noEmit
npm run lint
npm run build
```

生产构建后可运行 `npm run start`，以终端输出为准。上述验证脚本不需要媒体制作模型或 FFmpeg；重新制作媒体需另行配置工具。

## 代码导航

| 位置 | 内容 |
| --- | --- |
| `app/demo-app.tsx` | 教师/学员界面及四阶段流程 |
| `app/demo-data.ts`、`app/attempt-state.ts` | 数据结构、演示数据与本地状态 |
| `app/heart-failure-dialogue.ts`、`app/case-checks.ts` | 对话脚本、体查与辅检资料 |
| `app/heart-failure-rubric.ts`、`app/assessment.ts`、`app/score-policy.ts` | 评分细则、评分证据与总分规则 |
| `app/api/` | 患者问答、检查结果及疾病检索接口 |
| `app/patient-media.tsx`、`app/patient-playback.ts` | 音视频播放与同步 |
| `app/evaluation-report.tsx`、`app/visual-report.tsx` | 评分证据和可视化报告 |
| `public/assets/` | 页面使用的患者图片、语音和视频 |

## 当前边界

本项目为教学演示，不用于正式医学成绩判定或真实诊疗。病例与自动评分仍需医学教师核验，已知资料冲突在代码中保留待复核标记。

作答和本人演示成绩主要保存在当前浏览器；未实现正式用户认证、跨用户数据库、教师复核发布及真实跨用户排行榜。当前核心病例为固定心衰案例，新增病例需要同步接入病例、对话、检查和评分配置。真实麦克风、设备声线及外部AI调用体验需在接收方环境验证。

本次交付未新增项目开源许可证；代码使用授权另行约定。第三方组件与媒体制作工具遵循各自许可证，MuseTalk许可保留在 `animation-source/MuseTalk-LICENSE.txt`。
