// Minimal, safe markdown renderer (bold, italic, code, bullets, numbered lists, headings).
// Builds React nodes — no dangerouslySetInnerHTML.

function inline(text: string, key: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) parts.push(<strong key={k} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={k} className="rounded bg-chip px-1 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-2">
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (/^#{1,3} /.test(lines[0])) {
          return (
            <div key={bi}>
              <h3 className="font-semibold text-ink">{inline(lines[0].replace(/^#+ /, ""), `h${bi}`)}</h3>
              {lines.slice(1).length > 0 && <Markdown text={lines.slice(1).join("\n")} />}
            </div>
          );
        }
        // Group consecutive list lines vs text lines so "Lead:\n- a\n- b" renders as text + list.
        const isItem = (l: string) => /^\s*([-*•]|\d+\.)\s/.test(l) || (/^\s{2,}\S/.test(l));
        const groups: { list: boolean; lines: string[] }[] = [];
        for (const l of lines) {
          const list = isItem(l);
          const g = groups[groups.length - 1];
          if (g && g.list === list) g.lines.push(l);
          else groups.push({ list, lines: [l] });
        }
        return (
          <div key={bi} className="space-y-1.5">
            {groups.map((g, gi) =>
              g.list ? (
                <ul key={gi} className="space-y-1">
                  {g.lines.map((l, li) => {
                    const nested = /^\s{2,}/.test(l);
                    const num = l.match(/^\s*(\d+)\./)?.[1];
                    return (
                      <li key={li} className={`flex gap-2 ${nested ? "pl-5" : ""}`}>
                        <span className="shrink-0 text-subtle">{num ? `${num}.` : "•"}</span>
                        <span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s/, ""), `l${bi}-${gi}-${li}`)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p key={gi}>
                  {g.lines.map((l, li) => (
                    <span key={li}>
                      {li > 0 && <br />}
                      {inline(l, `p${bi}-${gi}-${li}`)}
                    </span>
                  ))}
                </p>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}
