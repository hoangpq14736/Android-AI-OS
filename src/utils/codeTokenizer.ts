import type { CodeLanguage } from '../data/prototypeFiles';

export type TokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'keyword'
  | 'number'
  | 'xmlTag'
  | 'xmlAttr';

export interface CodeToken {
  text: string;
  type: TokenType;
}

const KEYWORDS_BY_LANG: Partial<Record<CodeLanguage, Set<string>>> = {
  kotlin: new Set([
    'package', 'import', 'class', 'object', 'interface', 'fun', 'val', 'var',
    'private', 'public', 'override', 'return', 'if', 'else', 'when', 'for',
    'while', 'try', 'catch', 'finally', 'throw', 'data', 'companion', 'const',
    'true', 'false', 'null', 'this', 'super', 'is', 'in', 'as', 'by', 'break',
  ]),
  python: new Set([
    'from', 'import', 'class', 'def', 'return', 'if', 'elif', 'else', 'for',
    'while', 'try', 'except', 'finally', 'with', 'as', 'raise', 'yield',
    'lambda', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'pass',
  ]),
  bash: new Set([
    'if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'in', 'exit',
    'echo', 'set', 'local', 'export', 'cd', 'mkdir', 'cp', 'rm', 'chmod',
    'zip', 'adb', 'pm', 'am', 'appops', 'dumpsys', 'getprop', 'ui_print',
    'abort', 'set_perm_recursive', 'set_perm', 'sleep', 'break',
  ]),
  yaml: new Set([
    'name', 'on', 'push', 'branches', 'workflow_dispatch', 'permissions',
    'jobs', 'runs-on', 'steps', 'uses', 'with', 'run', 'env', 'working-directory',
    'true', 'false',
  ]),
};

/**
 * Single-pass tokenizer an toàn, không dùng HTML string replacement hay dangerouslySetInnerHTML.
 * Bảo toàn chính xác 100% ký tự mã nguồn gốc khi ghép nối token.text.
 */
export function tokenizeCodeLine(line: string, language: CodeLanguage): CodeToken[] {
  if (line.length === 0) return [];

  const trimmed = line.trimStart();

  // Whole-line comments
  if (
    (language === 'kotlin' && (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*'))) ||
    ((language === 'python' || language === 'bash' || language === 'properties' || language === 'yaml') && trimmed.startsWith('#')) ||
    (language === 'xml' && (trimmed.startsWith('<!--') || trimmed.startsWith('-->')))
  ) {
    return [{ text: line, type: 'comment' }];
  }

  if (language === 'xml') {
    const tokens: CodeToken[] = [];
    const xmlRegex = /(<\/?[\w:.-]+|\/>|>|[\w:.-]+(?==)|"[^"]*")/g;
    let lastIdx = 0;
    let match = xmlRegex.exec(line);
    while (match !== null) {
      if (match.index > lastIdx) {
        tokens.push({ text: line.slice(lastIdx, match.index), type: 'plain' });
      }
      const val = match[0];
      if (val.startsWith('<') || val === '>' || val === '/>') {
        tokens.push({ text: val, type: 'xmlTag' });
      } else if (val.startsWith('"')) {
        tokens.push({ text: val, type: 'string' });
      } else {
        tokens.push({ text: val, type: 'xmlAttr' });
      }
      lastIdx = match.index + val.length;
      match = xmlRegex.exec(line);
    }
    if (lastIdx < line.length) {
      tokens.push({ text: line.slice(lastIdx), type: 'plain' });
    }
    return tokens;
  }

  const keywordSet = KEYWORDS_BY_LANG[language];
  if (!keywordSet) {
    return [{ text: line, type: 'plain' }];
  }

  const tokens: CodeToken[] = [];
  const tokenRegex =
    language === 'kotlin'
      ? /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?[fFL]?\b)/g
      : /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)/g;

  let lastIdx = 0;
  let match = tokenRegex.exec(line);
  while (match !== null) {
    if (match.index > lastIdx) {
      tokens.push({ text: line.slice(lastIdx, match.index), type: 'plain' });
    }
    const val = match[0];
    if (
      (language === 'kotlin' && val.startsWith('//')) ||
      (language !== 'kotlin' && val.startsWith('#'))
    ) {
      tokens.push({ text: val, type: 'comment' });
    } else if (val.startsWith('"') || val.startsWith("'")) {
      tokens.push({ text: val, type: 'string' });
    } else if (/^\d/.test(val)) {
      tokens.push({ text: val, type: 'number' });
    } else if (keywordSet.has(val)) {
      tokens.push({ text: val, type: 'keyword' });
    } else {
      tokens.push({ text: val, type: 'plain' });
    }
    lastIdx = match.index + val.length;
    match = tokenRegex.exec(line);
  }
  if (lastIdx < line.length) {
    tokens.push({ text: line.slice(lastIdx), type: 'plain' });
  }
  return tokens;
}
