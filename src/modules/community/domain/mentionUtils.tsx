import React from 'react';

const MENTION_PATTERN = /@([a-z0-9_.]{3,20})/gi;

export function extractMentionNicknames(content: string): string[] {
  const nicknames = new Set<string>();
  const regex = new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const nickname = match[1]?.toLowerCase();
    if (nickname) nicknames.add(nickname);
  }

  return Array.from(nicknames);
}

export function renderContentWithMentions(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }

    nodes.push(
      <span key={`mention-${match.index}-${match[1]}`} className="text-primary font-medium">
        @{match[1]}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [content];
}
