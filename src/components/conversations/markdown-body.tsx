/**
 * <MarkdownBody /> — renders user-message bodies as GitHub-flavored
 * markdown while staying inside the pim brand contract:
 *   - everything in `font-code`
 *   - no rounded corners, no shadows, no gradients
 *   - links are primary-colored + underlined; new tabs by default
 *   - code blocks/inline-code keep the monospace family but switch to a
 *     subtle inset background so they read as quoted source
 *   - empty/blank bodies render literally so users notice they sent
 *     nothing instead of an invisible row
 *
 * Rendering uses `react-markdown` + `remark-gfm` (no `rehype-raw`) so
 * raw HTML in a peer's message is escaped — peer payloads are E2E
 * encrypted but still untrusted at the application layer.
 */

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export interface MarkdownBodyProps {
  body: string;
  className?: string;
}

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => (
    <p className="whitespace-pre-wrap break-words leading-[1.55] m-0 [&+*]:mt-2">
      {children}
    </p>
  ),
  a: ({ children, href }) => (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock === true) {
      return (
        <code
          {...rest}
          className={cn(
            "block whitespace-pre overflow-x-auto",
            "border border-border bg-popover/60 px-2 py-1",
            "text-[0.85em] leading-[1.4] font-code",
          )}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        {...rest}
        className="bg-popover/60 border border-border px-1 py-px text-[0.85em] font-code"
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="m-0 p-0 bg-transparent border-0 [&+*]:mt-2">{children}</pre>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 [&+*]:mt-2 marker:text-text-secondary">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 [&+*]:mt-2 marker:text-text-secondary">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.55]">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-text-secondary [&+*]:mt-2">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-semibold uppercase tracking-wider [&+*]:mt-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold uppercase tracking-wider [&+*]:mt-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium uppercase tracking-wider [&+*]:mt-2">
      {children}
    </h3>
  ),
  hr: () => <hr className="border-t border-border my-2" />,
  table: ({ children }) => (
    <div className="overflow-x-auto [&+*]:mt-2">
      <table className="border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left bg-popover/60 font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1">{children}</td>
  ),
};

export function MarkdownBody({ body, className }: MarkdownBodyProps) {
  // `react-markdown` collapses an all-whitespace input to nothing —
  // preserve the user's actual character so they see what they sent.
  const isBlank = useMemo(() => body.trim() === "", [body]);
  if (isBlank === true) {
    return (
      <span className={cn("whitespace-pre-wrap break-words", className)}>
        {body}
      </span>
    );
  }
  return (
    <div className={cn("font-code text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={MARKDOWN_COMPONENTS}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
