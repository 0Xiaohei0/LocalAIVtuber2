import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { nanoid } from 'nanoid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateSessionId = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `sess_${date}_${nanoid(6)}`;
};

export interface CutResult {
  sentences: string[];
  remaining: string;
}

export function cut5(inp: string): CutResult {
  inp = inp.trim();
  const punds = new Set([',', '.', ';', '?', '!', '、', '，', '。', '？', '！', ';', '：', '…']);
  const mergeitems: string[] = [];
  let items: string[] = [];

  for (let i = 0; i < inp.length; i++) {
      const char = inp[i];
      if (punds.has(char)) {
          if (char === '.' && i > 0 && i < inp.length - 1 && !isNaN(Number(inp[i - 1])) && !isNaN(Number(inp[i + 1]))) {
              items.push(char);
          } else {
              items.push(char);
              mergeitems.push(items.join(''));
              items = [];
          }
      } else {
          items.push(char);
      }
  }

  const opt = mergeitems.filter(item => !Array.from(item).every(char => punds.has(char)));
  const remaining = items.join('');

  return {
    sentences: opt,
    remaining: remaining
  };
}
