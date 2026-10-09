"use client";
import { useId } from "react";
import type { Dimension } from "./assessment";
import "./dimension-radar.css";

const shortNames: Record<string, string> = {
  history: "病史采集", physical: "体格检查", auxiliary: "辅助检查",
  stage: "阶段诊断", final: "最终诊断", treatment: "治疗方案",
};
const center = { x: 240, y: 184 };
const radius = 122;

export default function DimensionRadar({ dimensions }: { dimensions: Dimension[] }) {
  const titleId = useId(), descriptionId = useId();
  const axes = dimensions.filter(dimension => dimension.maximum !== null && dimension.maximum > 0);
  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length;
    return { x: center.x + Math.cos(angle) * radius * ratio, y: center.y + Math.sin(angle) * radius * ratio };
  };
  const ratios = axes.map(dimension => dimension.earned === null ? null : Math.max(0, Math.min(1, dimension.earned / dimension.maximum!)));
  const points = ratios.map((ratio, index) => ratio === null ? null : point(index, ratio));
  const complete = axes.length >= 3 && points.every(value => value !== null);
  const coordinates = (values: { x: number; y: number }[]) => values.map(value => `${value.x},${value.y}`).join(" ");
  const description = axes.length === 0 ? "暂无可计分维度。" : `各维度得分率：${axes.map((dimension, index) => {
    const ratio = ratios[index];
    return `${dimension.title}${ratio === null ? "待复核" : ` ${(ratio * 100).toFixed(1)}%`}`;
  }).join("，")}。${points.some(value => value === null) ? "待复核维度在图中留空，不作为零分。" : ""}`;
  return <section className="report-radar-card" aria-labelledby={titleId}>
    <div className="new-report-section-head"><h2 id={titleId}>维度雷达图</h2></div>
    <div className="report-radar-layout">
      <svg className="dimension-radar" viewBox="0 0 480 370" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <desc id={descriptionId}>{description}</desc>
        {[0.25, 0.5, 0.75, 1].map(ratio => <g key={ratio}><polygon className="radar-grid" points={coordinates(axes.map((_, index) => point(index, ratio)))} /><text className="radar-scale" x={center.x + 6} y={center.y - radius * ratio - 3}>{ratio * 100}%</text></g>)}
        {axes.map((dimension, index) => {
          const end = point(index, 1), label = point(index, 1.27);
          return <g key={dimension.id}><line className="radar-axis" x1={center.x} y1={center.y} x2={end.x} y2={end.y} /><text className="radar-axis-label" x={label.x} y={label.y} textAnchor={label.x > center.x + 10 ? "start" : label.x < center.x - 10 ? "end" : "middle"} dominantBaseline="middle">{shortNames[dimension.id] ?? dimension.title}</text></g>;
        })}
        {complete ? <polygon className="radar-shape" points={coordinates(points as { x: number; y: number }[])} /> : points.map((start, index) => {
          const end = points[(index + 1) % points.length];
          return start && end ? <line className="radar-segment" key={axes[index].id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null;
        })}
        {points.map((value, index) => value && <circle className="radar-point" key={axes[index].id} cx={value.x} cy={value.y} r="4" data-dimension={axes[index].id} data-ratio={ratios[index]}><title>{axes[index].title}：{((ratios[index] ?? 0) * 100).toFixed(1)}%</title></circle>)}
      </svg>
    </div>
  </section>;
}
