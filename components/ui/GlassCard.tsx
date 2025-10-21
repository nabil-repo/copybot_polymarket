"use client";
import React from "react";

type Props = {
  className?: string;
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  hover?: boolean;
};

export default function GlassCard({ className = "", children, as: Tag = "div", hover = true }: Props) {
  return (
    <Tag
      className={[
        "glass border rounded-2xl shadow-xl",
        hover ? "glass-hover" : "",
        "transition-all",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}
