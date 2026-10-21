# oece临床问诊系统

面向医学生的病例模拟与临床思维形成性评估Demo，包含教师病例库和建考、学员四阶段考试、患者问诊及评分证据报告。

交付日期：2026年10月21日。代码来自公开版本14，源提交`13849d1e81eaf86b91ff7b4cb97c3481826f032c`。运行代码与原版本保持一致；本交付另补开发说明、评分方案文档，并移除原托管项目标识。

**当前运行评分仍是既有Demo规则，未接入10月17日的R-IDEA/Chicago新方案，也未实现正式评分AI。**请先阅读[开发接手说明](DEVELOPMENT_HANDOFF.md)，不要将评分方案文档当作已实现的功能。

## 本地运行

需要Node.js 22.13.0或更高版本和npm。请使用锁文件安装：

```sh
npm ci
npm run dev
```

打开终端显示的地址。教师端入口为`/teacher/exams`、`/teacher/cases`，学员端入口为`/student/tasks`。可从页面使用固定Demo体验完整流程。

项目使用React、TypeScript、Vinext/Vite及Cloudflare Workers，保留Sites构建插件。请运行`npm run dev`，不要直接改用`next dev`或静态文件服务器，服务端包含`cloudflare:workers`绑定。

## AI配置

固定问诊演示、内置检查结果、演示作答和评分报告不需要API密钥。实时患者问答需要接收方自行配置。

在项目根目录创建被Git忽略的`.dev.vars`，填入自己的服务端密钥：

```dotenv
DEEPSEEK_API_KEY=填写自己的密钥
CHECK_RESULT_MODE=fixed
```

`.env.example`只提供字段。`CHECK_RESULT_MODE=fixed`保持固定病例检查；显式改为`deepseek`才调用检查匹配模型。密钥不要使用`NEXT_PUBLIC_`等公开前缀。没有密钥时实时问答返回未就绪，固定演示仍可使用。

源码包不包含真实密钥、账号、研究成绩附件或既有部署权限。`.openai/hosting.json`仅保留空的d1/r2本地绑定；部署到新环境需要自行配置。

## 验证和生产预览

```sh
node scripts/verify-p01.cjs
node scripts/verify-patient-api.cjs
node scripts/verify-patient-playback.cjs
node scripts/verify-patient-media.cjs
npx tsc --noEmit
npm run lint
npm run build
```

当前构建包含Cloudflare Workers绑定，完整生产预览请使用：

```sh
npx wrangler dev --config dist/server/wrangler.json --ip 127.0.0.1 --port 4178
```

不要用保留在package中的`npm run start`作为完整API预览：它使用普通Node加载器，检查/患者API会因`cloudflare:`模块不受支持而报错。`npm run dev`用于日常开发，上述Wrangler命令用于本构建的完整生产预览。

本次在Node.js 24.15.0、npm 11.12.1下完成干净安装、27项病例回归、患者API/播放/素材回归、类型检查、Lint、生产构建及Workers本地HTTP抽查。API和播放回归使用隔离模拟；不代表真实DeepSeek供应商、真人麦克风或跨设备声线已联调。固定素材检查不需要下载模型或FFmpeg，只有重新制作媒体才需额外配置。

## 代码与资料导航

| 路径 | 用途 |
| --- | --- |
| `app/demo-app.tsx`、`app/attempt-state.ts` | 学员考试、路由与阶段/作答状态 |
| `app/teacher-*.tsx`、`app/teacher-*.ts` | 教师病例管理、上传、编辑、三步建考、本地存储 |
| `app/heart-failure-rubric.ts`、`app/assessment.ts`、`app/score-policy.ts` | 当前已运行的Demo评分与报告计算 |
| `app/heart-failure-dialogue.ts`、`app/case-checks.ts` | 固定问诊脚本及检查资料 |
| `app/api/` | 患者对话、检查结果、疾病检索三个API |
| `app/patient-media.tsx`、`app/patient-playback.ts` | 音视频播放与生命周期 |
| `public/assets/` | 页面所需患者图片、31条音频、固定视频片段 |
| `animation-source/`、`scripts/` | 合成声参考、媒体制作脚本、回归验证及必要夹具 |
| `docs/scoring/` | 待接入的通用规则、心衰给分表及专家核对问题，含此前人工修订 |
| `FRONTEND_UI_GUIDELINES.md` | 当前界面与交互约定 |
| `CHECK_RESULT_SERVICE.md`、`SUPPLEMENTAL_HISTORY.md`、`PATIENT_AVATAR.md` | 检查API、患者对话、固定媒体细节 |
| `SOURCE_VERSION.json` | 来源版本及交付范围 |

## 功能范围

- 教师病例库支持文档/JSON导入、本地新建编辑、复制导出、患者形象和声线配置，三步建考支持草稿与归档。
- Agent上传页目前提供提示词和手动导入闭环，MCP服务尚未开放。
- 学员仍只有郭曼心衰固定Demo；教师新增病例不会自动生成可考的学生端病例。
- 四阶段为病史采集、体格检查、辅助检查、病例汇报与诊疗计划；检查逐行生成结果并填写分析，支持修改和换序。
- 两种患者对话模式全程可继续提问；草稿、语音输入、固定媒体、评分证据、雷达图和演示排行榜保留。
- 考试、病例和成绩主要保存在浏览器本地，没有正式账号、云端业务数据库、跨用户排行榜或教师复核发布流程。

## 不包含的文件

依赖目录、构建产物、运行缓存、日志、原项目Git历史、原托管项目标识、环境变量实值、模型权重、研究原始Word/Excel、个人成绩及工作区杂项均未打包。项目锁文件、固定运行素材和必要验证脚本保留。

本交付未新增项目开源许可证，代码使用授权另行约定。第三方工具和组件遵循各自许可证，MuseTalk许可保留在`animation-source/MuseTalk-LICENSE.txt`。
