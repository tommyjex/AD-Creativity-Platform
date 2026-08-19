import Link from "next/link";
import { BriefForm } from "@/components/brief-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

const capabilityCards = [
  {
    title: "Brief Intelligence",
    label: "需求建模",
    copy: "把广告目标、平台语境、商品卖点和受众假设压缩成可执行的生成 Brief。",
    metric: "7 Fields",
    tone: "从自然语言进入结构化策略"
  },
  {
    title: "Narrative Reactor",
    label: "故事引擎",
    copy: "面向短视频前三秒、转折节奏和转化落点组织故事、脚本与旁白。",
    metric: "3 Layers",
    tone: "故事 / 脚本 / 分镜逐层收敛"
  },
  {
    title: "Asset Foundry",
    label: "影像工厂",
    copy: "围绕分镜生成图片、视频和最终剪辑资产，保留阶段状态与可追踪产物。",
    metric: "4 Assets",
    tone: "图片 / 镜头视频 / 成片可追踪"
  }
];

const platformSignals = [
  "Douyin hook-first vertical",
  "Xiaohongshu lifestyle proof",
  "TikTok global pacing",
  "Bilibili explainer cut"
];

const pipelineStages = [
  {
    name: "01",
    title: "Brief Intake",
    copy: "输入广告需求、平台、比例、时长、风格、受众和商品名称。",
    badge: "POST /api/projects"
  },
  {
    name: "02",
    title: "Creative Strategy",
    copy: "项目创建后保留结构化 Brief，后续阶段围绕同一策略推进。",
    badge: "Brief Locked"
  },
  {
    name: "03",
    title: "Storyboard Route",
    copy: "故事、脚本、分镜和资产生成在项目详情页继续编排。",
    badge: "Next Task"
  },
  {
    name: "04",
    title: "Delivery Track",
    copy: "最终成片、资产库和导出预览保持为后续任务实现范围。",
    badge: "Scoped"
  }
];

const controlMetrics = [
  { label: "Brief Schema", value: "Prompt + 6 Controls" },
  { label: "Project Handoff", value: "/projects/{id}" },
  { label: "Workspace", value: "Creative Console" }
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <section
        className="container relative grid min-h-[calc(100vh-4rem)] items-center gap-10 py-16 lg:grid-cols-[1.03fr_0.97fr] lg:py-24"
        id="brief"
      >
        <div className="absolute left-6 top-12 hidden h-24 w-px bg-gradient-to-b from-primary via-primary/40 to-transparent lg:block" />
        <div className="max-w-4xl space-y-8">
          <Badge className="w-fit" variant="signal">
            AI AD CREATIVE WORKSPACE
          </Badge>
          <div className="space-y-5">
            <p className="ad-kicker">首页创作工作台 / Task 4</p>
            <h1 className="ad-display">
              从一段广告需求，启动完整视频创意生产链路。
            </h1>
            <p className="ad-copy max-w-2xl">
              面向广告投放团队的生成中枢：先把 Brief 收敛成项目，再进入故事、
              分镜、影像资产和成片交付。首页只承担高质量入口和项目创建，
              后续生成流程由项目详情页承接。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="cinematic">
              <Link href="#brief">填写创作 Brief</Link>
            </Button>
            <Button asChild size="lg" variant="signal">
              <Link href="#pipeline">查看端到端流程</Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {controlMetrics.map((item) => (
              <Metric key={item.label} label={item.label} value={item.value} />
            ))}
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-glass">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="grid gap-3 sm:grid-cols-4">
              {platformSignals.map((signal, index) => (
                <div
                  className="rounded-2xl border border-border bg-secondary/40 p-4"
                  key={signal}
                >
                  <div className="mb-8 h-1 rounded-full bg-primary/35" />
                  <div className="font-mono text-[0.64rem] uppercase tracking-[0.22em] text-muted-foreground">
                    Signal 0{index + 1}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    {signal}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Badge variant="secondary">PROJECT LAUNCH</Badge>
                <CardTitle className="text-2xl md:text-3xl">
                  Brief Control Surface
                </CardTitle>
                <CardDescription>
                  提交后调用 POST /api/projects；成功进入项目详情页，失败保留在当前面板展示错误。
                </CardDescription>
              </div>
              <div className="hidden rounded-full border border-success/30 bg-success/10 px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-success sm:block">
                Ready
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <BriefForm />
          </CardContent>
        </Card>
      </section>

      <section
        className="container grid gap-4 pb-10 md:grid-cols-3"
        id="capabilities"
      >
        {capabilityCards.map((item) => (
          <Card className="group min-h-72 overflow-hidden" key={item.title}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <Badge className="w-fit" variant="outline">
                  {item.label}
                </Badge>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                  {item.metric}
                </span>
              </div>
              <CardTitle className="text-2xl">{item.title}</CardTitle>
              <CardDescription>{item.copy}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-32 overflow-hidden rounded-2xl border border-border bg-[linear-gradient(180deg,hsl(var(--primary)/0.06),hsl(var(--secondary)/0.55))]">
                <div className="absolute inset-x-5 top-5 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                  {item.tone}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="container pb-24 pt-8" id="pipeline">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="ad-kicker">End-to-End Flow</p>
            <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground md:text-5xl">
              首页只做入口，但链路必须一眼看清。
            </h2>
            <p className="ad-copy">
              用户在首页建立项目后，系统把所有后续生成阶段挂到同一个项目空间，
              避免创意策略、分镜和资产在不同页面中失去上下文。
            </p>
          </div>
          <Badge className="w-fit" variant="info">
            DETAIL PAGES RESERVED
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {pipelineStages.map((stage) => (
            <Card className="relative min-h-72 overflow-hidden" key={stage.name}>
              <CardHeader>
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-4xl font-semibold tracking-[-0.08em] text-primary/80">
                    {stage.name}
                  </span>
                  <Badge variant="signal">{stage.badge}</Badge>
                </div>
                <CardTitle className="text-2xl">{stage.title}</CardTitle>
                <CardDescription>{stage.copy}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-20 rounded-2xl border border-border bg-[linear-gradient(110deg,hsl(var(--primary)/0.09),transparent_72%)]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
